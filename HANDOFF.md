# HERTZ — передача

Короткая карта для того, кто продолжит проект.

## Что это

Статический лендинг студии звукозаписи HERTZ. Демонстрационный кейс VOIDCODE.
Контакты и каталог — вымышленные, помечены в данных.

## Стек

Astro 7.4.7, GSAP 3.15 + ScrollTrigger, Canvas 2D + Web Audio API, `@fontsource`.
Сборка — `npm run build`, проверка — `npm run verify`.

## Что читать

1. `docs/ARCHITECTURE.md` — дерево, решения, токены, скрипты.
2. `plans/2026-11-07-hertz.md` — что закрыто.
3. `README.md` — команды.
4. `retrospectives/2026-11-07-hertz.md` — уроки.

## Как менять

- Контент — только `src/data/`.
- Фото — `assets/photos` + `tools/photo_sources.json`; после замены `npm run photos:check`.
- Цвет — только `src/styles/tokens.css`, затем `npm run contrast`.
- Секция — один файл в `src/components/sections/`, порядок — `src/pages/index.astro`.
- Движение — `src/scripts/motion.ts`; сигнал — `src/scripts/visualizer.ts`.

## Не ломать

- Без JS всё читается; скрытие только под `html.js:not(.reduce)`.
- Reduce показывает статичный сигнал и отключает GSAP.
- Микрофон не включается автоматически.
- `npm run verify` должен давать exit 0 перед сдачей.

## Дальше

Домен, рабочая форма + 152-ФЗ, реальные контакты, деплой по команде.
