# HERTZ — архитектура

Карта кода и принятые решения. Принципы — `~/.dsh/rules/architecture.md`, здесь только проект.

## Дерево

```
src/
  data/
    site.ts          SITE, CONTACTS, NAV, HERO_SPECS
    services.ts      Service + SERVICES (4)
    releases.ts      Release + RELEASES (4, cover: PhotoId)
    equipment.ts     EquipmentItem + EQUIPMENT (5)
    pricing.ts       PRICING_SERVICES + PRICING_DURATIONS
    photos.ts        PHOTO_FILES + PhotoId + PHOTO_ALTS
  components/
    SiteHeader.astro
    sections/
      Hero.astro     фото пульта, маска HERTZ, signal dock
      Services.astro  сетка 01—04
      Releases.astro  4 обложки + VHS на hover
      Equipment.astro marquee + список
      PricingQuiz.astro 3 шага: услуга → длительность → цена
      Concept.astro   светлая плашка VOIDCODE + Telegram
      Footer.astro    контакты, кредиты, огромный HERTZ
  layouts/BaseLayout.astro   meta, OG, JSON-LD, шрифты, js/reduce
  scripts/
    main.ts          единая точка входа
    motion.ts        GSAP + ScrollTrigger
    visualizer.ts    Canvas 2D + Web Audio API (mic / file / display)
    pricing.ts       демо-расчёт без библиотек
  styles/
    tokens.css       цвет и поверхности
    base.css         сброс, типографика, кнопки, состояния
  pages/index.astro  порядок секций
assets/photos/       6 фото + photos.json
tools/               проверки и фото
```

## Решения

| Дата | Решение | Почему |
|---|---|---|
| 07.11.2026 | Astro static, без UI-фреймворков | лендинг без клиентского роутинга; состояние — два независимых сценария |
| 07.11.2026 | GSAP + ScrollTrigger, не CSS-only | маска, параллакс и stagger требуют таймлайна; reduce отключает всё |
| 07.11.2026 | Canvas + Web Audio, не библиотека | 128 полос, 30 fps, полный контроль над цветом и lerp |
| 07.11.2026 | Локальные фото + manifest | hero не зависит от CDN; атрибуция проверяется машинно |
| 07.11.2026 | `@fontsource` вместо Google Fonts | самохостинг, кириллица, без внешнего запроса |
| 07.11.2026 | `fetch_photos.py --from-json` | API-ключ не нужен; выбранные кадры и атрибуция воспроизводимы |
| 07.11.2026 | Отдельная проверка фото в verify | «все фото загружены» — машинный факт, не обещание |

## Состояние на `<html>`

- `js` — скрипты работают. Скрытие `[data-reveal]`, `.hero__word`, `.footer__word` — только
  под `html.js:not(.reduce)`.
- `reduce` — `prefers-reduced-motion: reduce`. Визуализатор показывает статичный постер,
  GSAP не запускается, CSS-анимации отключены.
- `no-js` — серверный класс; без JS всё содержимое видно, в signal dock показывается SVG-постер.

## Поверхности

| Класс | Фон | Где |
|---|---|---|
| `surface-ink` | `--ink` `#0A0A0A` | Hero, Releases, PricingQuiz, Footer |
| `surface-paper` | `--paper` `#EAEAEA` | Services, Equipment, Concept |

Текст: `--paper` на ink (16.46:1), `--ink` на paper (16.46:1), `--muted` на ink (6.16:1),
`--muted-ink` на paper (5.70:1). Акцент текстом на светлом — `--accent-ink` (7.92:1),
на тёмном — `--accent` (15.73:1). Границы — `--line-light` 3.87:1, `--line-dark` 3.15:1.

## Данные

- `Release.cover: PhotoId` — контракт между релизом и `PHOTO_FILES`.
- `PHOTO_FILES` — единственный список локальных файлов.
- `photos.json` — автор, профиль, ссылка на фото, размеры. `Footer.astro` выводит кредиты.
- `site.ts` — только Москва и Telegram @winteri9; выдуманных адресов, телефонов и соцсетей нет.
- `pricing.ts` — ставки и длительности демо-калькулятора; это не прайс студии.

## Scripts

`main.ts` вызывает `initVisualizer()`, `initMotion()` и `initPricingQuiz()`.

`motion.ts`:
- интро: маска HERTZ, header, `[data-intro]`;
- параллакс фона `hero__image`;
- `.service` — stagger по `.services__grid`;
- остальные `[data-reveal]` — по появлению;
- `footer__word` — выезд из-под маски;
- `ScrollTrigger.refresh()` после `load`.

`visualizer.ts`:
- 128 баров, `lerp` атаки/спада, градиент lime → red;
- три источника: микрофон, локальный аудиофайл, `getDisplayMedia` со звуком вкладки;
- один `AudioContext` и `AnalyserNode`, переключение без перезагрузки;
- активный источник подсвечивается лаймом, ошибки доступа — текстом;
- `fftSize = 256`, mute gain для mic/display (без обратной связи), gain 1 для файла;
- `setTimeout` 30 fps, пауза на `visibilitychange`;
- scroll: scale 1 → 0.6, dock в правый нижний угол, `is-docked` уменьшает панель;
- reduce: статичный постер, кнопки источников отключены.

## Проверки

`npm run verify` — 10 проверок:

1. типы и сборка;
2. фото: 6 файлов, размеры, атрибуция, без Unsplash+;
3. контраст WCAG;
4. скриншоты 1440/390/reduce/no-JS, горизонтальный скролл;
5. `dist/`: ссылки, meta, 404, robots, плейсхолдеры, ключи.

## Открыто

- Рабочая форма/бэкенд и 152-ФЗ.
- HERTZ — концепт без физического адреса и соцсетей; связь только Telegram.
- Контент каталога — демонстрационный.
