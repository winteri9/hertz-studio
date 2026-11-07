# HERTZ — проект

Премиальный лендинг студии звукозаписи. Демонстрационный кейс VOIDCODE.

## Порядок чтения

1. `plans/2026-11-07-hertz.md` — что делали и что закрыто.
2. `docs/ARCHITECTURE.md` — карта кода и решения.
3. `README.md` — запуск и проверки.
4. `retrospectives/2026-11-07-hertz.md` — итог вехи.

## Стек

- Astro 7.4.7, статика, без UI-фреймворков.
- GSAP 3.15 + ScrollTrigger — движение.
- Canvas 2D + Web Audio API — визуализатор.
- Шрифты через `@fontsource`, без Google Fonts и CDN.
- `npm run build` = `astro check && astro build`.

## Структура

- `src/data/` — единственный источник фактов: `site.ts`, `services.ts`, `releases.ts`,
  `equipment.ts`, `photos.ts`.
- `src/components/sections/` — один блок макета = один файл.
- `src/pages/index.astro` — порядок секций, и только он.
- `src/scripts/` — `main.ts` (вход), `motion.ts` (GSAP), `visualizer.ts` (Canvas/Web Audio).
- `src/styles/tokens.css` — все сырые цвета и поверхности.
- `assets/photos/` — локальные фото + `photos.json`.
- `tools/` — фото, контраст, скриншоты, проверки.

## Правила

1. Нет факта — нет строки. Демо-контакты помечены в `src/data/site.ts`.
2. Сырой `#hex` — только в `tokens.css`.
3. Секция не импортирует другую секцию.
4. Без JS страница читается: скрытие до анимации — только под `html.js:not(.reduce)`.
5. `prefers-reduced-motion` отключает движение, визуализатор показывает статичный постер.
6. Микрофон — только по клику. Ошибка доступа — текстом, не алертом.
7. Перед сдачей: `npm run verify` → exit 0, затем посмотреть скриншоты глазами.

## Открыто

- Реальный домен и почта клиента.
- Бэкенд заявки и политика ПДн — если форма станет рабочей.
- Контент релизов и оборудования — демонстрационный.
