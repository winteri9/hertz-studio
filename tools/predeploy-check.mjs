// Проверка dist/ перед выкладкой: node tools/predeploy-check.mjs
//   --allow-todo  не валить на TODO/плейсхолдерах (для проверки структуры на свежем шаблоне)
//
// Падает (exit 1), если: нет dist/, в страницах остались TODO или плейсхолдеры, битые внутренние
// ссылки, пустые <title>/description, нет языка у <html>, в сборку утёк ключ или localhost.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const allowTodo = process.argv.includes('--allow-todo');

const errors = [];
const warns = [];
const ok = (m) => console.log(`  ok  ${m}`);

if (!existsSync(DIST)) {
  console.error('нет dist/ — сначала npm run build');
  process.exit(1);
}

const pages = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (path.endsWith('.html')) pages.push(path);
  }
})(DIST);

if (!pages.length) {
  console.error(`в ${DIST}/ нет ни одной страницы — сборка пустая`);
  process.exit(1);
}

console.log(`VOIDCODE — проверка ${DIST}/ перед деплоем (${allowTodo ? 'мягкий' : 'строгий'} режим)\n`);

// ---------- плейсхолдеры ----------
const placeholders = [
  [/\bTODO\b/, 'TODO'],
  [/lorem ipsum/i, 'lorem ipsum'],
  [/\bLorem\b/, 'Lorem'],
  [/\[N\]/, 'плейсхолдер [N]'],
  [/localhost:\d+/, 'localhost в ссылке'],
  [/example\.com/, 'example.com в домене'],
];

const seenPlaceholders = new Set();
for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  for (const [re, what] of placeholders) {
    const m = re.exec(html);
    if (m) seenPlaceholders.add(`${page}: ${what} (${m[0]})`);
  }
}
if (seenPlaceholders.size) {
  const target = allowTodo ? warns : errors;
  for (const item of seenPlaceholders) target.push(item);
  if (allowTodo) console.log(`  !   найдено ${seenPlaceholders.size} мест с плейсхолдерами (мягкий режим)`);
} else {
  ok('плейсхолдеров нет');
}

// ---------- заголовки и мета ----------
const metaProblems = [];
for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  const title = /<title>([\s\S]*?)<\/title>/.exec(html)?.[1]?.trim() ?? '';
  const description = /<meta name="description" content="([^"]*)"/.exec(html)?.[1]?.trim() ?? '';
  const lang = /<html[^>]*\blang="([^"]+)"/.exec(html)?.[1]?.trim() ?? '';

  if (!title) metaProblems.push(`${page}: нет <title>`);
  else if (/\bTODO\b/.test(title) && !allowTodo) metaProblems.push(`${page}: <title> не заполнен`);
  if (!description) metaProblems.push(`${page}: нет meta description`);
  else if (/\bTODO\b/.test(description) && !allowTodo) metaProblems.push(`${page}: description не заполнен`);
  if (!lang) metaProblems.push(`${page}: у <html> нет lang`);
}
if (metaProblems.length) errors.push(...metaProblems);
else ok(`${pages.length} стр. — title, description и lang на месте`);

// ---------- внутренние ссылки ----------
const exists = (href) => {
  const path = decodeURI(href.split('#')[0].split('?')[0]);
  if (!path || path === '/') return existsSync(join(DIST, 'index.html'));
  const full = join(DIST, path);
  return existsSync(full) && (statSync(full).isFile() || existsSync(join(full, 'index.html')));
};

const broken = new Set();
for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  for (const m of html.matchAll(/(?:href|src)="(\/[^"]*)"/g)) {
    const href = m[1];
    if (href.startsWith('//') || href.startsWith('/api/')) continue;
    if (!exists(href)) broken.add(`${href} (в ${page})`);
  }
}
if (broken.size) {
  errors.push(`битые внутренние ссылки:\n    ${[...broken].slice(0, 20).join('\n    ')}`);
} else {
  ok('внутренние ссылки и картинки на месте');
}

// ---------- утечка секретов ----------
const secretPatterns = [
  [/UNSPLASH_ACCESS_KEY/, 'имя переменной ключа в сборке'],
  [/\bLWIg[A-Za-z0-9_-]{20,}/, 'похоже на ключ Unsplash'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'приватный ключ'],
];
const leaks = [];
for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  for (const [re, what] of secretPatterns) if (re.test(html)) leaks.push(`${page}: ${what}`);
}
if (leaks.length) errors.push(`в сборку утёк секрет: ${leaks.join(', ')}`);
else ok('ключей и приватных данных в сборке нет');

// ---------- служебные файлы ----------
const recommended = [
  ['favicon.svg', 'фавикон'],
  ['404.html', 'страница 404'],
  ['robots.txt', 'robots.txt'],
];
for (const [file, what] of recommended) {
  if (!existsSync(join(DIST, file))) warns.push(`нет dist/${file} — ${what}`);
}
if (!warns.some((w) => w.startsWith('нет dist/'))) ok('фавикон, 404 и robots на месте');

// ---------- итог ----------
console.log('');
for (const w of warns) console.log(`  !   ${w}`);
if (errors.length) {
  for (const e of errors) console.log(`  ✗   ${e}`);
  console.log(
    `\nНЕ ГОТОВО К ДЕПЛОЮ: ${errors.length} ${errors.length === 1 ? 'проблема' : 'проблем(ы)'}`,
  );
  process.exit(1);
}
console.log('Структура сборки в порядке.');
if (allowTodo) console.log('Мягкий режим: плейсхолдеры не считаются провалом. Перед деплоем — строгий.');
