# HERTZ — студия звукозаписи

Премиальный лендинг студии звукозаписи. Флагманский кейс VOIDCODE: архитектура, типографика,
GSAP-движение и аудиовизуализатор на Canvas.

**Слоган:** «Звук, который имеет вес».

## Стек

- Astro 7.4.7, статическая сборка.
- GSAP 3.15 + ScrollTrigger.
- Canvas 2D + Web Audio API (`AnalyserNode`, 128 полос).
- Inter Tight Variable + Martian Mono, самохостинг через `@fontsource`.
- Без UI-фреймворков и без клиентской гидрации.

## Запуск

```bash
npm install
npm run dev          # http://localhost:4321
npm run build        # astro check + astro build
npm run verify       # типы, сборка, фото, контраст, скриншоты, структура
```

## Структура

```
src/
  data/              факты: site, services, releases, equipment, photos
  components/
    SiteHeader.astro
    sections/        Hero, Services, Releases, Equipment, Footer
  layouts/BaseLayout.astro
  scripts/           main, motion (GSAP), visualizer (Canvas + Web Audio)
  styles/            tokens.css, base.css
  pages/index.astro  порядок секций
assets/photos/       6 фото Unsplash + photos.json с атрибуцией
tools/               fetch_photos.py, check-photos.mjs, contrast.mjs, shot.mjs, verify.mjs
screenshots/         финальные снимки 1440 и 390
```

## Проверки

`npm run verify` прогоняет:

1. `astro check` и `astro build`;
2. `check-photos.mjs` — 6 фото, реальные размеры, атрибуция, без Unsplash+;
3. `contrast.mjs` — WCAG-пары (текст ≥ 4.5:1, границы ≥ 3:1);
4. `shot.mjs` — 1440, 390, reduce и no-JS; падает на горизонтальном скролле;
5. `predeploy-check.mjs` — ссылки, заголовки, плейсхолдеры, утечки ключей.

Детали — `docs/ARCHITECTURE.md`. План — `plans/2026-11-07-hertz.md`.

## Важно

Контакты и адрес — демонстрационные. Микрофон включается только по клику и только на
`localhost`/HTTPS: браузер требует secure context для `getUserMedia`.
