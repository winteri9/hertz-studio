// Скриншоты через headless Chrome по CDP (Node >= 22, встроенный WebSocket). Без зависимостей.
// usage: node tools/shot.mjs <url> <out.png> <width> <height> [флаги]
//   --full          вся страница, не только вьюпорт
//   --scroll        прокрутить до низа (запускает анимации по входу в кадр)
//   --reduce        prefers-reduced-motion: reduce
//   --no-js         отключить JS (проверка прогрессивного улучшения)
//   --mobile        мобильная эмуляция + тач
//   --wait=ms       пауза перед снимком (по умолчанию 2500)
//   --eval=js       выполнить выражение и напечатать результат
//   --json          напечатать строку RESULT {...} для машинной обработки
//
// Коды выхода: 0 — ок, 1 — проверка не прошла (горизонтальный скролл, пустая страница),
//              2 — не удалось запустить (нет Chrome, неверные аргументы).
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';

// --- поиск браузера: без захардкоженного пути (в исходнике apm-site был только macOS) ---
function findChrome() {
  const fromEnv = process.env.CHROME_PATH || process.env.BROWSER_PATH;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  const names =
    process.platform === 'win32'
      ? ['chrome.exe', 'msedge.exe', 'chromium.exe']
      : ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge'];

  const absolute = [];
  if (process.platform === 'win32') {
    const roots = [
      process.env.ProgramFiles,
      process.env['ProgramFiles(x86)'],
      process.env.LOCALAPPDATA,
    ].filter(Boolean);
    for (const root of roots) {
      absolute.push(join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'));
      absolute.push(join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
    }
  } else if (process.platform === 'darwin') {
    absolute.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    );
  } else {
    absolute.push('/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser');
  }
  for (const p of absolute) if (existsSync(p)) return p;

  // поиск в PATH
  const dirs = (process.env.PATH || '').split(delimiter).filter(Boolean);
  for (const dir of dirs) {
    for (const name of names) {
      const candidate = join(dir, name);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

const [url, out, w, h, ...flags] = process.argv.slice(2);
if (!url || !out || !w || !h) {
  console.error(
    'usage: node tools/shot.mjs <url> <out.png> <width> <height> [--full] [--scroll] [--reduce] [--no-js] [--mobile] [--wait=ms] [--eval=js] [--json]',
  );
  process.exit(2);
}

const opt = Object.fromEntries(
  flags.map((f) => {
    const g = f.replace(/^--/, '');
    const i = g.indexOf('=');
    return i < 0 ? [g, true] : [g.slice(0, i), g.slice(i + 1)];
  }),
);

const chrome = findChrome();
if (!chrome) {
  console.error(
    'Chrome или Edge не найден. Укажи путь явно:\n' +
      '  Windows:  $env:CHROME_PATH="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"\n' +
      '  macOS:    export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"\n' +
      '  Linux:    export CHROME_PATH=/usr/bin/google-chrome',
  );
  process.exit(2);
}

const W = Number(w);
const H = Number(h);
const wait = Number(opt.wait ?? 2500);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const outDir = dirname(out);
if (outDir && outDir !== '.') mkdirSync(outDir, { recursive: true });

const port = 9300 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'chr-'));
const proc = spawn(
  chrome,
  [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--hide-scrollbars',
    '--allow-file-access-from-files',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    `--window-size=${W},${H}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

// профиль одноразовый (≈ 20 МБ): гасим Chrome и удаляем папку при любом исходе
const exited = new Promise((r) => proc.once('exit', r));
const cleanup = () => {
  try {
    proc.kill('SIGKILL');
  } catch {}
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  } catch {}
};
process.on('exit', cleanup);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => process.exit(130));

let ws;
let id = 0;
const pending = new Map();
const events = [];

async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(150);
  }
  throw new Error('Chrome не открыл порт отладки');
}

function send(method, params = {}) {
  return new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
}

const evaluate = async (expression, awaitPromise = false) => {
  const { result } = await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
  return result?.value;
};

let exitCode = 0;

try {
  ws = new WebSocket(await connect());
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
    } else if (m.method) {
      events.push(m);
    }
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: W,
    height: H,
    deviceScaleFactor: 1,
    mobile: Boolean(opt.mobile),
  });
  if (opt.mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  if (opt.reduce)
    await send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
  if (opt['no-js']) await send('Emulation.setScriptExecutionDisabled', { value: true });

  await send('Page.navigate', { url });
  for (let i = 0; i < 100 && !events.find((e) => e.method === 'Page.loadEventFired'); i++) await sleep(100);
  if (!opt['no-js']) await evaluate('document.fonts.ready.then(() => 1)', true);

  if (opt.scroll) {
    const height = await evaluate('document.documentElement.scrollHeight');
    for (let y = 0; y < height; y += Math.floor(H * 0.6)) {
      await evaluate(`window.scrollTo(0,${y})`);
      await sleep(120);
    }
    await sleep(900);
    await evaluate('window.scrollTo(0,0)');
    await sleep(300);
  }

  if (opt.eval) {
    const r = await evaluate(String(opt.eval), true);
    console.log('EVAL', JSON.stringify(r));
  }

  await sleep(wait);

  const logs = events.filter(
    (e) =>
      e.method === 'Runtime.exceptionThrown' ||
      (e.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(e.params.type)),
  );
  for (const l of logs) console.log('LOG', JSON.stringify(l.params).slice(0, 400));

  let params = { format: 'png' };
  const pageHeight = await evaluate('document.documentElement.scrollHeight');
  if (opt.full) {
    params = {
      format: 'png',
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: W, height: Math.min(pageHeight, 16000), scale: 1 },
    };
  }

  // горизонтальный скролл — дефект вёрстки, а не предупреждение
  const widths = JSON.parse(
    await evaluate(
      'JSON.stringify({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth})',
    ),
  );
  const overflow = widths.sw > widths.cw + 1;
  const textLength = await evaluate('(document.body?.innerText || "").trim().length');

  console.log(`page height ${pageHeight}`);
  console.log('widths', JSON.stringify(widths));
  if (overflow) {
    console.error(`✗ горизонтальный скролл: scrollWidth ${widths.sw} > clientWidth ${widths.cw}`);
    exitCode = 1;
  }
  if (textLength === 0) {
    console.error('✗ страница пустая: в body нет текста (проверь, что сервер отдал контент)');
    exitCode = 1;
  }

  const shot = await send('Page.captureScreenshot', params);
  writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log('saved', out);

  if (opt.json) {
    console.log(
      'RESULT ' +
        JSON.stringify({
          url,
          out,
          width: W,
          height: H,
          scrollWidth: widths.sw,
          clientWidth: widths.cw,
          overflow,
          pageHeight,
          textLength,
          consoleErrors: logs.length,
        }),
    );
  }
} catch (e) {
  console.error('✗', e instanceof Error ? e.message : e);
  exitCode = 2;
} finally {
  try {
    ws?.close();
  } catch {}
  proc.kill('SIGKILL');
  let t;
  await Promise.race([exited, new Promise((r) => (t = setTimeout(r, 3000)))]);
  clearTimeout(t);
  cleanup();
}

process.exit(exitCode);
