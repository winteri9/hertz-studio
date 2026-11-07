// Полная проверка проекта одной командой: node tools/verify.mjs   (npm run verify)
//
//   --no-shots   без скриншотов (быстро: типы, сборка, контраст, структура)
//   --keep       не удалять .cache/verify после прогона
//
// Порядок: типы → сборка → контраст → скриншоты 1440/390/reduce/no-js → структура dist/.
// Скриншоты снимаются с прод-сборки через `astro preview` на порту 4321
// (порт зафиксирован в .claude/launch.json, чтобы проверка была воспроизводимой).
//
// Коды выхода: 0 — всё прошло, 1 — есть провал.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const PORT = 4321;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = join('.cache', 'verify');
const skipShots = process.argv.includes('--no-shots');
const keep = process.argv.includes('--keep');

// Путь к CLI Astro берём из package.json пакета: он менялся между версиями
// (astro.js → bin/astro.mjs), поэтому зашивать его нельзя.
function resolveAstroBin() {
  const pkgPath = join('node_modules', 'astro', 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.astro;
      if (bin) {
        const resolved = join('node_modules', 'astro', bin);
        if (existsSync(resolved)) return resolved;
      }
    } catch {}
  }
  for (const candidate of [
    join('node_modules', 'astro', 'bin', 'astro.mjs'),
    join('node_modules', 'astro', 'astro.js'),
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const astroJs = resolveAstroBin();
if (!astroJs) {
  console.error('нет node_modules/astro — сначала npm install');
  process.exit(1);
}

const results = [];
const record = (name, passed, detail = '') => {
  results.push({ name, passed, detail });
  console.log(`${passed ? '  ok' : '  ✗ '} ${name}${detail ? ` — ${detail}` : ''}`);
};

const step = (title) => console.log(`\n${title}`);

const astro = (args) =>
  spawnSync(process.execPath, [astroJs, ...args], { stdio: 'inherit', env: process.env });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- 1. типы и сборка ---
step('[1/6] Типы и сборка');
const check = astro(['check']);
record('astro check (типы)', check.status === 0);
if (check.status !== 0) {
  console.error('\nТипы не сходятся — дальше проверять нечего.');
  process.exit(1);
}
const build = astro(['build']);
record('astro build', build.status === 0);
if (build.status !== 0) {
  console.error('\nСборка упала — дальше проверять нечего.');
  process.exit(1);
}

// --- 2. фотоманифест ---
step('[2/6] Фото и атрибуция');
const photos = spawnSync(process.execPath, [join('tools', 'check-photos.mjs')], { stdio: 'inherit' });
record('6 фото, размеры и атрибуция', photos.status === 0);

// --- 3. контраст ---
step('[3/6] Контраст палитры');
const contrast = spawnSync(process.execPath, [join('tools', 'contrast.mjs')], { stdio: 'inherit' });
record('WCAG-контраст пар', contrast.status === 0);
// --- 3. скриншоты ---
step('[4/6] Скриншоты');
let server = null;

async function waitForServer(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE + '/');
      if (res.ok) return true;
    } catch {}
    await sleep(300);
  }
  return false;
}

function killTree(proc) {
  if (!proc) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    try {
      proc.kill('SIGTERM');
    } catch {}
  }
}

if (skipShots) {
  console.log('  (пропущено: --no-shots)');
} else {
  mkdirSync(OUT, { recursive: true });

  // --host 127.0.0.1 обязателен: без него Astro на Windows слушает только ::1,
  // а fetch/Chrome по 127.0.0.1 получают «connection refused».
  let serverLog = '';
  server = spawn(
    process.execPath,
    [astroJs, 'preview', '--port', String(PORT), '--host', '127.0.0.1'],
    { stdio: ['ignore', 'pipe', 'pipe'], env: process.env },
  );
  server.stdout.on('data', (d) => (serverLog += d));
  server.stderr.on('data', (d) => (serverLog += d));

  const up = await waitForServer();
  if (!up) {
    killTree(server);
    record('astro preview на :' + PORT, false, 'сервер не поднялся за 60 с');
    const tail = serverLog.trim().split('\n').slice(-5).join('\n');
    if (tail) console.log(`    вывод сервера:\n${tail}`);
    server = null;
  } else {
    record('astro preview на :' + PORT, true);

    const shots = [
      ['desktop-1440.png', ['1440', '900', '--full', '--scroll']],
      ['mobile-390.png', ['390', '844', '--mobile', '--full', '--scroll']],
      ['reduce-1440.png', ['1440', '900', '--reduce']],
      ['no-js-1440.png', ['1440', '900', '--no-js', '--full']],
    ];

    const shotScript = join('tools', 'shot.mjs');
    for (const [file, args] of shots) {
      const res = spawnSync(
        process.execPath,
        [shotScript, `${BASE}/`, join(OUT, file), ...args, '--json'],
        { encoding: 'utf8', env: process.env },
      );
      const tail = (res.stdout || '') + (res.stderr || '');
      const overflow = /горизонтальный скролл/.test(tail);
      const empty = /страница пустая/.test(tail);
      const detail = overflow
        ? 'горизонтальный скролл'
        : empty
          ? 'пустая страница'
          : res.status === 2
            ? 'браузер не найден (задай CHROME_PATH)'
            : '';
      record(`скриншот ${file}`, res.status === 0, detail);
      if (res.status !== 0 && detail === '') {
        console.log((res.stderr || '').trim().split('\n').slice(-3).join('\n'));
      }
    }

    killTree(server);
    server = null;
  }
}

// --- 4. структура dist ---
step('[5/6] Структура сборки');
const predeploy = spawnSync(
  process.execPath,
  [join('tools', 'predeploy-check.mjs'), '--allow-todo'],
  { stdio: 'inherit' },
);
record('структура dist/', predeploy.status === 0);

// --- 5. итог ---
step('[6/6] Итог');
killTree(server);

const failed = results.filter((r) => !r.passed);
const width = Math.max(...results.map((r) => r.name.length));
console.log('');
for (const r of results) {
  console.log(`  ${r.passed ? 'ok' : '✗ '} ${r.name.padEnd(width)}${r.detail ? `  ← ${r.detail}` : ''}`);
}

if (failed.length) {
  console.log(`\nПРОВЕРКА НЕ ПРОЙДЕНА: ${failed.length} из ${results.length}.`);
  if (!keep) rmSync(OUT, { recursive: true, force: true });
  process.exit(1);
}

console.log(`\nВсё прошло: ${results.length} проверок.`);
if (!skipShots) {
  console.log(`Скриншоты: ${OUT}`);
  console.log('Открыть и посмотреть глазами — наличие файла не является проверкой.');
  if (!keep) console.log('(папка удаляется при следующем прогоне; --keep чтобы сохранить явно)');
}
