// @ts-check
import { defineConfig } from 'astro/config';

/**
 * Конфиг намеренно пустой: статика, без интеграций и без лишних зависимостей.
 * Добавлять по потребности проекта, а не «на всякий случай».
 *
 * site — обязателен для абсолютных OG-ссылок и sitemap. Вписать домен проекта.
 */
export default defineConfig({
  site: 'https://hertz-studio.vercel.app',
  build: { format: 'directory' },
  compressHTML: true,
  devToolbar: { enabled: false },
});
