// Контраст пар палитры по WCAG 2.x. Цвета читаются из src/styles/tokens.css — единый источник.
//   node tools/contrast.mjs        проверить пары, exit 1 если есть провал
//   node tools/contrast.mjs --list только напечатать пары с результатом
import { readFileSync } from 'node:fs';

const TOKENS = 'src/styles/tokens.css';
let css;
try {
  css = readFileSync(TOKENS, 'utf8');
} catch {
  console.error(`нет ${TOKENS} — запускать из корня проекта`);
  process.exit(1);
}

const hexOf = (name) => {
  const m = new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})\\b`).exec(css);
  if (!m) throw new Error(`токен --${name} не найден в ${TOKENS}`);
  return m[1];
};

// цвет токена либо смесь «mix:<цвет>:<доля %>:<фон>» — как color-mix(in srgb, цвет N%, фон)
// нужно для полупрозрачных линий: rgba нельзя посчитать напрямую
const resolve = (spec) => {
  if (!spec.startsWith('mix:')) return hexOf(spec);
  const [, a, pct, b] = spec.split(':');
  const k = Number(pct) / 100;
  const chan = (h, i) => parseInt(h.slice(i, i + 2), 16);
  const [x, y] = [hexOf(a), hexOf(b)];
  return (
    '#' +
    [1, 3, 5]
      .map((i) => Math.round(chan(x, i) * k + chan(y, i) * (1 - k)).toString(16).padStart(2, '0'))
      .join('')
  );
};

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const ratio = (a, b) => {
  const [x, y] = [luminance(resolve(a)), luminance(resolve(b))].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// [текст, фон, порог, где]. Порог 3 — только для крупных элементов и границ (WCAG 1.4.11).
const pairs = [
  // светлые поверхности
  ['ink', 'paper', 4.5, 'основной текст на светлом'],
  ['muted-ink', 'paper', 4.5, 'вторичный текст на светлом'],
  ['accent-ink', 'paper', 4.5, 'акцент текстом на светлом'],
  ['ink', 'paper-2', 4.5, 'основной текст на подложке'],
  ['muted-ink', 'paper-2', 4.5, 'вторичный текст на подложке'],
  ['accent-ink', 'paper-2', 4.5, 'акцент текстом на подложке'],

  // тёмные поверхности
  ['paper', 'ink', 4.5, 'основной текст на тёмном'],
  ['muted', 'ink', 4.5, 'вторичный текст на тёмном'],
  ['accent', 'ink', 4.5, 'акцент текстом на тёмном'],
  ['paper', 'ink-2', 4.5, 'текст на подложке тёмного'],
  ['muted', 'ink-2', 4.5, 'вторичный на подложке тёмного'],
  ['accent', 'ink-2', 4.5, 'акцент на подложке тёмного'],

  // акцентная заливка
  ['on-accent', 'accent', 4.5, 'текст на акцентной заливке'],

  // границы интерактивных элементов (WCAG 1.4.11)
  ['line-light', 'paper', 3, 'граница поля ввода на светлом'],
  ['line-dark', 'ink', 3, 'граница поля ввода на тёмном'],
  ['accent', 'ink', 3, 'обводка фокуса на тёмном'],
  ['ink', 'paper', 3, 'обводка фокуса на светлом'],

  // контроль: не валит прогон, но печатается — запреты важны так же, как разрешения
  ['white', 'paper', 4.5, 'белый на бумаге — запрещено (контроль)', true],
  ['muted-ink', 'paper', 7, 'вторичный на светлом редко даёт AAA (контроль)', true],
];

const listOnly = process.argv.includes('--list');
let fail = 0;

console.log('Контраст палитры — WCAG 2.x\n');

for (const [fg, bg, min, where, control] of pairs) {
  let r;
  try {
    r = ratio(fg, bg);
  } catch (e) {
    console.error(`  ✗  ${e.message}`);
    fail++;
    continue;
  }
  const pass = r >= min;
  const mark = control ? ' ·' : pass ? ' ok' : ' ✗ ';
  const level = r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : r >= 3 ? 'AA-large' : '—';
  console.log(
    `${mark} ${r.toFixed(2).padStart(6)}:1  ${fg} на ${bg} — ${where} (норма ${min}, ${level})`,
  );
  if (!pass && !control) fail++;
}

if (listOnly) {
  console.log('\n--list: код выхода принудительно 0');
  process.exit(0);
}

if (fail) {
  console.log(`\nПРОВАЛ: ${fail} ${fail === 1 ? 'пара' : 'пар'} ниже нормы.`);
  console.log('Правится в src/styles/tokens.css — примитив, а не компонент.');
  process.exit(1);
}
console.log('\nВсе пары в норме.');
