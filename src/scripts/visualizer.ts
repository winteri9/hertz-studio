/**
 * HERTZ — сигнальный визуализатор.
 *
 * До микрофона: математическая волна, которая живёт сама.
 * После клика: getUserMedia → AnalyserNode (fftSize 256 → 128 полос) → canvas.
 * 30 fps через setTimeout, пауза в неактивной вкладке, статичный постер при reduce.
 * Микрофон не включается без действия пользователя.
 */

const BAR_COUNT = 128;
const TARGET_FPS = 30;
const FRAME_MS = 1000 / TARGET_FPS;

type Mode = 'demo' | 'live';

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
  const button = document.querySelector<HTMLButtonElement>('[data-mic-toggle]');
  const label = document.querySelector<HTMLElement>('[data-mic-label]');
  const status = document.querySelector<HTMLElement>('[data-mic-status]');
  const modeLabel = document.querySelector<HTMLElement>('[data-viz-mode]');
  const dot = document.querySelector<HTMLElement>('[data-mic-dot]');

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
  let mode: Mode = 'demo';
  let stream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let muteGain: GainNode | null = null;
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

  const setButton = (text: string, pressed: boolean) => {
    if (!button) return;
    button.setAttribute('aria-pressed', String(pressed));
    if (label) label.textContent = text;
  };

  const setModeLabel = (text: string) => {
    if (modeLabel) modeLabel.textContent = text;
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
    const time = now / 1000;
    if (mode === 'live' && analyser && frequencyData) {
      analyser.getByteFrequencyData(frequencyData);
      for (let i = 0; i < BAR_COUNT; i += 1) {
        const raw = frequencyData[i] / 255;
        targets[i] = clamp(Math.pow(raw, 1.28) * 1.08);
      }
      return;
    }

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
      // Атака быстрее спада — так бары реагируют, но не дёргаются.
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
    scrolling = 0.4;
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

  const stopAudio = async () => {
    stream?.getTracks().forEach((track) => track.stop());
    source?.disconnect();
    analyser?.disconnect();
    muteGain?.disconnect();
    if (audioContext && audioContext.state !== 'closed') {
      await audioContext.close();
    }
    stream = null;
    audioContext = null;
    analyser = null;
    source = null;
    muteGain = null;
    frequencyData = null;
    mode = 'demo';
  };

  const resetDemo = () => {
    setButton('Активировать микрофон', false);
    setStatus('Демо-сигнал · микрофон выключен', 'demo');
    setModeLabel('demo / 128 bands');
    if (dot) dot.style.background = '';
  };

  const showError = () => {
    setButton('Попробовать снова', false);
    setStatus('Микрофон недоступен. Разреши доступ в настройках браузера', 'error');
    setModeLabel('demo / 128 bands');
    if (dot) dot.style.background = '';
  };

  const enableMic = async () => {
    if (busy) return;
    busy = true;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('getUserMedia is not supported');
      }

      stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const AudioCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) throw new Error('AudioContext is not supported');

      audioContext = new AudioCtor();
      await audioContext.resume();

      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.72;

      source = audioContext.createMediaStreamSource(stream);
      muteGain = audioContext.createGain();
      muteGain.gain.value = 0;
      source.connect(analyser);
      analyser.connect(muteGain);
      muteGain.connect(audioContext.destination);

      frequencyData = new Uint8Array(analyser.frequencyBinCount);
      mode = 'live';

      setButton('Остановить микрофон', true);
      setStatus('Микрофон активен · сигнал идёт с пульта', 'live');
      setModeLabel('mic / 128 bands');
      if (dot) dot.style.background = 'var(--accent)';
      startLoop();
    } catch {
      await stopAudio();
      showError();
      startLoop();
    } finally {
      busy = false;
    }
  };

  const disableMic = async () => {
    if (busy) return;
    busy = true;
    await stopAudio();
    resetDemo();
    startLoop();
    busy = false;
  };

  button?.addEventListener('click', () => {
    if (mode === 'live') {
      void disableMic();
    } else {
      void enableMic();
    }
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
    if (document.visibilityState === 'visible') {
      startLoop();
    } else {
      stopLoop();
    }
  };

  if (reduce) {
    root.classList.add('is-static');
    setButton('Визуализация отключена', false);
    if (button) button.disabled = true;
    setStatus('Уменьшенное движение: статичный сигнал', 'demo');
    setModeLabel('static / 128 bands');
    const hideWhenPastHero = () => {
      const heroHeight = hero?.offsetHeight ?? window.innerHeight;
      root.style.opacity = window.scrollY > heroHeight * 0.9 ? '0' : '1';
    };
    resize();
    drawPoster();
    hideWhenPastHero();
    window.addEventListener('scroll', hideWhenPastHero, { passive: true });
    return;
  }

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', resize, { passive: true });

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  resize();
  onScroll();
  resetDemo();
  startLoop();
}
