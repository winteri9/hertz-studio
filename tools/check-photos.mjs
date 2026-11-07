// Проверка фотоманифеста: node tools/check-photos.mjs
// Файлы существуют, размеры реальные, атрибуция заполнена, платных Unsplash+ нет.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const PHOTOS = 'assets/photos';
const MANIFEST = join(PHOTOS, 'photos.json');
const EXPECTED = 6;

const fail = [];
const ok = (message) => console.log(`  ok  ${message}`);

if (!existsSync(MANIFEST)) {
  console.error(`✗ нет ${MANIFEST}`);
  process.exit(1);
}

let payload;
try {
  payload = JSON.parse(readFileSync(MANIFEST, 'utf8'));
} catch (error) {
  console.error(`✗ ${MANIFEST} не читается: ${error.message}`);
  process.exit(1);
}

const photos = Array.isArray(payload.photos) ? payload.photos : [];
if (photos.length !== EXPECTED) {
  fail.push(`в манифесте ${photos.length} фото, ожидается ${EXPECTED}`);
}

const seen = new Set();
for (const [index, photo] of photos.entries()) {
  const where = `фото ${index + 1}`;
  if (!photo.file || seen.has(photo.file)) {
    fail.push(`${where}: пустой или повторяющийся file`);
    continue;
  }
  seen.add(photo.file);

  const path = join(PHOTOS, photo.file);
  if (!existsSync(path)) {
    fail.push(`${where}: нет файла ${photo.file}`);
    continue;
  }

  const size = statSync(path).size;
  if (size < 20_000) fail.push(`${where}: ${photo.file} слишком маленький (${size} байт)`);

  if (!photo.width || !photo.height || photo.width < 800 || photo.height < 800) {
    fail.push(`${where}: некорректные размеры ${photo.width}x${photo.height}`);
  }
  if (!photo.author || !photo.author_url || !photo.photo_url) {
    fail.push(`${where}: неполная атрибуция`);
  }
  if (!String(photo.photo_url || '').startsWith('https://unsplash.com/')) {
    fail.push(`${where}: photo_url не ведёт на Unsplash`);
  }
  if (`${photo.photo_url} ${photo.author_url}`.includes('plus.unsplash.com')) {
    fail.push(`${where}: платная лицензия Unsplash+`);
  }

  console.log(
    `  ok  ${photo.file}  ${photo.width}x${photo.height}  ${(size / 1024).toFixed(0)} КБ  — ${photo.author}`,
  );
}

if (fail.length) {
  console.error(`\n✗ Фотомониторинг: ${fail.length} проблем(ы)`);
  for (const problem of fail) console.error(`  - ${problem}`);
  process.exit(1);
}

ok(`${photos.length} фото, размеры и атрибуция на месте`);
console.log('Фотоманифест в порядке.');
