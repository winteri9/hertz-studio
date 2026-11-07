/**
 * HERTZ — сигнальный визуализатор.
 *
 * Источники: демо-волна, микрофон, загруженный аудиофайл, захват звука экрана.
 * Один AudioContext и один AnalyserNode, источники переключаются без перезагрузки страницы.
 * 30 fps через setTimeout, пауза в неактивной вкладке, статичный постер при reduce.
 */

const BAR_COUNT = 128;
const TARGET_FPS = 30;
const FRAME_MS = 1000 / TARGET_FPS;
const DEMO_STATUS = 'Демо-сигнал · источник не выбран';
const MIC_ERROR = 'Микрофон недоступен. Разреши доступ в настройках браузера';
const DISPLAY_ERROR = 'Звук с экрана не передан. При захвате включи «Поделиться звуком»';
const FILE_ERROR = 'Не удалось воспроизвести файл. Выбери MP3, WAV или OGG';

type SourceMode = 'demo' | 'mic' | 'file' | 'display';
type LiveMode = Exclude<SourceMode, 'demo'>;

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const hexToRgb = (hex: string): [number, number, number] => {
  const clean = hex.replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const mix = (a: [number, number, number], b: [number, number, number], t: number): string => {
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]} ${c[1]} ${c[2]})`;
};

const drawRoundedTop = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  const radius = Math.max(0, Math.min(r, w / 2, h));
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
};

export function initVisualizer() {
  const root = document.querySelector<HTMLElement>('[data-visualizer]');
  const hero = document.querySelector<HTMLElement>('.hero');
  const canvas = document.querySelector<HTMLCanvasElement>('[data-canvas]');
  const micButton = document.querySelector<HTMLButtonElement>('[data-mic-toggle]');
  const micLabel = document.querySelector<HTMLElement>('[data-mic-label]');
  const fileButton = document.querySelector<HTMLButtonElement>('[data-file-trigger]');
  const fileLabel = document.querySelector<HTMLElement>('[data-file-label]');
  const fileInput = document.querySelector<HTMLInputElement>('[data-file-input]');
  const displayButton = document.querySelector<HTMLButtonElement>('[data-display-toggle]');
  const displayLabel = document.querySelector<HTMLElement>('[data-display-label]');
  const status = document.querySelector<HTMLElement>('[data-mic-status]');
  const modeLabel = document.querySelector<HTMLElement>('[data-viz-mode]');

  if (!root || !canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rootStyle = getComputedStyle(document.documentElement);
  const accent = hexToRgb(rootStyle.getPropertyValue('--accent').trim() || '#D0F43C');
  const red = hexToRgb(rootStyle.getPropertyValue('--red').trim() || '#FF3B3B');
  const muted = rootStyle.getPropertyValue('--muted').trim() || '#8A9099';

  const levels = new Float32Array(BAR_COUNT);
  const targets = new Float32Array(BAR_COUNT);
  let width = 0;
  let height = 0;
  let dpr = 1;
  let mode: SourceMode = 'demo';
  let audioContext: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let monitorGain: GainNode | null = null;
  let stream: MediaStream | null = null;
  let streamSource: MediaStreamAudioSourceNode | null = null;
  let audioEl: HTMLAudioElement | null = null;
  let fileSource: MediaElementAudioSourceNode | null = null;
  let fileUrl: string | null = null;
  let frequencyData: Uint8Array<ArrayBuffer> | null = null;
  let timer: number | null = null;
  let lastDraw = 0;
  let scrolling = 0;
  let busy = false;

  const setStatus = (text: string, state: 'demo' | 'live' | 'error') => {
    if (!status) return;
    status.textContent = text;
    status.dataset.state = state;
  };

  const setModeLabel = (text: string) => {
    if (modeLabel) modeLabel.textContent = text;
  };

  const setButtonState = (nextMode: SourceMode) => {
    mode = nextMode;
    const isMic = nextMode === 'mic';
    const isFile = nextMode === 'file';
    const isDisplay = nextMode === 'display';

    for (const [button, active] of [
      [micButton, isMic],
      [fileButton, isFile],
      [displayButton, isDisplay],
    ] as const) {
      button?.classList.toggle('is-active', active);
      button?.setAttribute('aria-pressed', String(active));
    }

    if (micLabel) micLabel.textContent = isMic ? 'Остановить микрофон' : 'Активировать микрофон';
    if (fileLabel) fileLabel.textContent = isFile ? 'Остановить трек' : 'Загрузить трек';
    if (displayLabel) {
      displayLabel.textContent = isDisplay ? 'Остановить захват' : 'Захватить звук с экрана';
    }

    const labels: Record<SourceMode, string> = {
      demo: 'demo / 128 bands',
      mic: 'mic / 128 bands',
      file: 'file / 128 bands',
      display: 'display / 128 bands',
    };
    setModeLabel(labels[nextMode]);
  };

  const setDemoUi = (message = DEMO_STATUS) => {
    setButtonState('demo');
    setStatus(message, 'demo');
  };

  const setLiveUi = (nextMode: LiveMode, message: string) => {
    setButtonState(nextMode);
    setStatus(message, 'live');
  };

  const setError = (message: string) => {
    setButtonState('demo');
    setStatus(message, 'error');
  };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(performance.now());
  };

  const readTargets = (now: number) => {
    if (mode !== 'demo' && analyser && frequencyData) {
      analyser.getByteFrequencyData(frequencyData);
      for (let i = 0; i < BAR_COUNT; i += 1) {
        const raw = frequencyData[i] / 255;
        targets[i] = clamp(Math.pow(raw, 1.28) * 1.08);
      }
      return;
    }

    const time = now / 1000;
    const energy = 0.72 + scrolling * 0.28;
    for (let i = 0; i < BAR_COUNT; i += 1) {
      const p = i / (BAR_COUNT - 1);
      const envelope = Math.pow(1 - p, 1.35) * 0.82 + 0.12;
      const wave =
        0.46 +
        Math.sin(i * 0.31 + time * 1.55) * 0.25 +
        Math.sin(i * 0.09 - time * 0.72) * 0.18 +
        Math.sin(i * 0.67 + time * 2.1) * 0.07;
      targets[i] = clamp(Math.abs(wave) * envelope * energy, 0.02, 1);
    }
  };

  const draw = (now: number, sample = true) => {
    if (!width || !height) return;
    if (sample) readTargets(now);

    ctx.clearRect(0, 0, width, height);
    const gap = width < 520 ? 1 : 2;
    const barWidth = Math.max(0.8, (width - gap * (BAR_COUNT - 1)) / BAR_COUNT);
    const floor = height - 2;
    const maxHeight = height - 10;

    for (let i = 0; i < BAR_COUNT; i += 1) {
      const target = targets[i];
      const current = levels[i];
      const factor = target > current ? 0.34 : 0.14;
      levels[i] = current + (target - current) * factor;

      const barHeight = Math.max(1, levels[i] * maxHeight);
      const x = i * (barWidth + gap);
      const y = floor - barHeight;
      const color = mix(accent, red, i / (BAR_COUNT - 1));

      ctx.fillStyle = color;
      drawRoundedTop(ctx, x, y, barWidth, barHeight, Math.min(2.5, barWidth / 2));
      ctx.fill();
    }

    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = muted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, floor + 0.5);
    ctx.lineTo(width, floor + 0.5);
    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  const drawPoster = () => {
    const savedMode = mode;
    mode = 'demo';
    for (let i = 0; i < BAR_COUNT; i += 1) {
      const p = i / (BAR_COUNT - 1);
      const envelope = Math.pow(1 - p, 1.35) * 0.82 + 0.12;
      const wave = 0.46 + Math.sin(i * 0.31) * 0.25 + Math.sin(i * 0.09 - 1.2) * 0.18;
      targets[i] = clamp(Math.abs(wave) * envelope, 0.02, 1);
      levels[i] = targets[i];
    }
    draw(performance.now(), false);
    mode = savedMode;
  };

  const tick = () => {
    timer = null;
    if (document.visibilityState !== 'visible') return;
    const now = performance.now();
    if (now - lastDraw >= FRAME_MS) {
      draw(now);
      lastDraw = now;
    }
    timer = window.setTimeout(tick, FRAME_MS);
  };

  const startLoop = () => {
    if (timer !== null || reduce) return;
    timer = window.setTimeout(tick, FRAME_MS);
  };

  const stopLoop = () => {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
  };

  const ensureAudio = async () => {
    if (!audioContext) {
      const AudioCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) throw new Error('AudioContext is not supported');

      audioContext = new AudioCtor();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.72;

      monitorGain = audioContext.createGain();
      monitorGain.gain.value = 0;
      analyser.connect(monitorGain);
      monitorGain.connect(audioContext.destination);

      frequencyData = new Uint8Array(analyser.frequencyBinCount);
    }

    if (audioContext.state === 'suspended') await audioContext.resume();
  };

  const stopSource = () => {
    stream?.getTracks().forEach((track) => track.stop());
    streamSource?.disconnect();
    stream = null;
    streamSource = null;

    if (audioEl) {
      audioEl.pause();
      audioEl.currentTime = 0;
    }

    if (fileUrl) {
      URL.revokeObjectURL(fileUrl);
      fileUrl = null;
    }

    if (monitorGain) monitorGain.gain.value = 0;
    mode = 'demo';
  };

  const stopAndDemo = (message = DEMO_STATUS) => {
    stopSource();
    setDemoUi(message);
    startLoop();
  };

  const startMic = async () => {
    if (busy) return;
    busy = true;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('getUserMedia is not supported');
      }

      const next = await navigator.mediaDevices.getUserMedia({ audio: true });
      stopSource();
      stream = next;
      await ensureAudio();
      if (!audioContext || !analyser) throw new Error('Analyser is not available');

      streamSource = audioContext.createMediaStreamSource(next);

      streamSource.connect(analyser);
      if (monitorGain) monitorGain.gain.value = 0;

      next.getAudioTracks()[0]?.addEventListener('ended', () => {
        if (mode === 'mic') stopAndDemo('Микрофон отключён · демо-сигнал');
      });

      setLiveUi('mic', 'Микрофон активен · сигнал идёт с микрофона');
      startLoop();
    } catch {
      stopSource();
      setError(MIC_ERROR);
      startLoop();
    } finally {
      busy = false;
    }
  };

  const startDisplay = async () => {
    if (busy) return;
    busy = true;

    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error('getDisplayMedia is not supported');
      }

      const next = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
      if (!next.getAudioTracks().length) {
        next.getTracks().forEach((track) => track.stop());
        throw new Error('No audio track');
      }

      stopSource();
      stream = next;
      await ensureAudio();
      if (!audioContext || !analyser) throw new Error('Analyser is not available');

      streamSource = audioContext.createMediaStreamSource(next);

      streamSource.connect(analyser);
      if (monitorGain) monitorGain.gain.value = 0;

      next.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (mode === 'display') stopAndDemo('Захват остановлен · демо-сигнал');
      });

      setLiveUi('display', 'Захват экрана активен · звук вкладки');
      startLoop();
    } catch {
      stopSource();
      setError(DISPLAY_ERROR);
      startLoop();
    } finally {
      busy = false;
    }
  };

  const startFile = async (file: File) => {
    if (busy) return;
    if (file.type && !file.type.startsWith('audio/')) {
      stopSource();
      setError(FILE_ERROR);
      return;
    }

    busy = true;
    try {
      stopSource();
      await ensureAudio();
      if (!audioContext || !analyser) throw new Error('Analyser is not available');

      if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.preload = 'auto';
        audioEl.addEventListener('ended', () => {
          if (mode === 'file') stopAndDemo('Трек завершён · демо-сигнал');
        });
      }

      if (!fileSource) {
        fileSource = audioContext.createMediaElementSource(audioEl);
        fileSource.connect(analyser);
      }

      fileUrl = URL.createObjectURL(file);
      audioEl.src = fileUrl;
      audioEl.currentTime = 0;
      if (monitorGain) monitorGain.gain.value = 1;

      setLiveUi('file', `Трек: ${file.name} · играет`);
      await audioEl.play();
      startLoop();
    } catch {
      stopSource();
      setError(FILE_ERROR);
      startLoop();
    } finally {
      busy = false;
    }
  };

  micButton?.addEventListener('click', () => {
    if (mode === 'mic') stopAndDemo();
    else void startMic();
  });

  displayButton?.addEventListener('click', () => {
    if (mode === 'display') stopAndDemo('Захват остановлен · демо-сигнал');
    else void startDisplay();
  });

  fileButton?.addEventListener('click', () => {
    if (mode === 'file') stopAndDemo('Трек остановлен · демо-сигнал');
    else fileInput?.click();
  });

  fileInput?.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (file) void startFile(file);
  });

  const onScroll = () => {
    if (reduce) return;
    const heroHeight = hero?.offsetHeight ?? window.innerHeight;
    scrolling = clamp(window.scrollY / Math.max(1, window.innerHeight * 0.9));
    const scale = 1 - scrolling * 0.4;
    const away = clamp(
      (window.scrollY - heroHeight * 0.78) / Math.max(1, heroHeight * 0.22),
    );
    root.style.setProperty('--viz-scale', scale.toFixed(3));
    root.style.setProperty(
      '--viz-opacity',
      String((1 - scrolling * 0.12) * (1 - away)),
    );
    root.classList.toggle('is-docked', scrolling > 0.18);
  };

  const onVisibility = () => {
    if (document.visibilityState === 'visible') startLoop();
    else stopLoop();
  };

  if (reduce) {
    root.classList.add('is-static');
    setButtonState('demo');
    if (micButton) micButton.disabled = true;
    if (fileButton) fileButton.disabled = true;
    if (displayButton) displayButton.disabled = true;
    if (micLabel) micLabel.textContent = 'Визуализация отключена';
    setStatus('Уменьшенное движение: статичный сигнал', 'demo');
    setModeLabel('static / 128 bands');
    resize();
    drawPoster();
    return;
  }

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('pagehide', () => stopSource());

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  resize();
  onScroll();
  setDemoUi();
  startLoop();
}
