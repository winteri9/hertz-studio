# tools/

Проверки и утилиты. Всё без внешних зависимостей: node + стандартная библиотека, python + requests.

## Одна команда

```powershell
npm run verify          # типы → сборка → контраст → скриншоты → структура
npm run verify:fast     # то же без скриншотов
```

`verify` обязателен перед сдачей. Скриншоты складываются в `.cache/verify/` и его надо **открыть глазами**:
наличие файла проверкой не является.

## `verify.mjs` — оркестратор

Порядок: `astro check` → `astro build` → `contrast.mjs` → `shot.mjs` × 4 → `predeploy-check.mjs --allow-todo`.

Скриншоты снимаются с **прод-сборки** через `astro preview` на порту **4321** (`--host 127.0.0.1`),
чтобы проверка была воспроизводимой и не ловила dev-артефакты.

| Шаг | Что ловит |
|---|---|
| `astro check` | ошибки типов в данных и пропсах |
| `astro build` | битые импорты, падение рендера |
| `contrast.mjs` | пары цвета ниже 4.5:1 (текст) и 3:1 (границы) |
| `shot.mjs` | горизонтальный скролл, пустая страница |
| `predeploy-check.mjs` | `TODO`, плейсхолдеры, пустое мета, битые ссылки, утечка ключа |

| Флаг | Что делает |
|---|---|
| `--no-shots` | без браузера: быстро |
| `--keep` | не удалять `.cache/verify` после прогона |

## `contrast.mjs` — контраст палитры

```powershell
npm run contrast              # проверить, exit 1 при провале
node tools/contrast.mjs --list
```

Читает цвета из `src/styles/tokens.css` — источник правды один. Пары заданы в самом скрипте:
текст ≥ 4.5:1, границы интерактивных элементов ≥ 3:1 (WCAG 1.4.11). Поддерживает `mix:<цвет>:<доля>:<фон>`
для полупрозрачных линий.

Пары-«контроли» (например, белый на белом) печатаются, но прогон не валят — запреты важны так же, как разрешения.

Провал правится **в токене**, а не подгонкой компонента.

## `shot.mjs` — скриншоты

```powershell
node tools/shot.mjs http://127.0.0.1:4321/ .cache/a.png 1440 900 --full --scroll
node tools/shot.mjs <url> <out.png> <w> <h> --mobile --full
node tools/shot.mjs <url> <out.png> <w> <h> --reduce
node tools/shot.mjs <url> <out.png> <w> <h> --no-js --full
```

| Флаг | Что делает |
|---|---|
| `--full` | вся страница, не только вьюпорт |
| `--scroll` | прокрутить до низа — запускает анимации по входу в кадр |
| `--reduce` | `prefers-reduced-motion: reduce` |
| `--no-js` | отключить JS |
| `--mobile` | мобильная эмуляция + тач |
| `--wait=ms` | пауза перед снимком (по умолчанию 2500) |
| `--eval=js` | выполнить выражение и напечатать результат |
| `--json` | строка `RESULT {...}` для машинной обработки |

**Chrome ищется сам:** `CHROME_PATH` → типовые пути Windows/macOS/Linux → `chrome`/`msedge` в `PATH`.
Захардкоженного пути нет (в исходнике `apm-site` был только macOS — это ломало инструмент на Windows).
Если браузер не найден — понятная ошибка и код 2.

**Падает с exit 1**, если `scrollWidth > clientWidth` (горизонтальный скролл) или страница пустая.
Это проверка, а не предупреждение.

## `predeploy-check.mjs` — гейт перед выкладкой

```powershell
npm run predeploy                    # строгий: валит на любом плейсхолдере
node tools/predeploy-check.mjs --allow-todo
```

`verify` вызывает его в мягком режиме (`--allow-todo`), иначе свежий шаблон не прошёл бы никогда.
Перед выкладкой — только строгий. Падает на: `TODO`, `lorem`, `localhost`, `example.com`, пустых
`<title>`/description, отсутствии `lang`, битых внутренних ссылках, утечке ключа Unsplash в сборку.

## `fetch_photos.py` — реальные фото из Unsplash

```powershell
python tools/fetch_photos.py "modern real estate interior" -n 5
python tools/fetch_photos.py "промышленный цех" -n 3 --orientation landscape
python tools/fetch_photos.py "office team" -n 5 --dry-run
```

| Флаг | По умолчанию | Что делает |
|---|---|---|
| `-n, --count` | 5 | сколько фото, 1–10 |
| `-o, --out` | `assets/photos` | папка |
| `--orientation` | — | `landscape` / `portrait` / `squarish` |
| `--size` | `regular` | `raw` / `full` / `regular` / `small` |
| `--dry-run` | — | показать найденное, не скачивать |

Ключ: `UNSPLASH_ACCESS_KEY` из окружения или из `.env` (бесплатно, https://unsplash.com/developers).

Пишет `assets/photos/photos.json`: автор, профиль, ссылка на фото. **Атрибуция обязательна**, манифест не удалять.
Дёргает `download_location` при скачивании — требование Unsplash API Guidelines.
**Unsplash+ отсеивается:** кадры с `plus.unsplash.com` — платная лицензия.
Повторный запуск не перекачивает уже скачанное; манифест дополняется, а не перезаписывается.

**Размеры** в манифесте — реальные размеры скачанного файла (`regular` ≈ 1080 px), а не оригинала.
Оригинал сохраняется в `source_width` / `source_height`. От `width`/`height` зависит вёрстка и `srcSet`,
поэтому врать про них нельзя.

Коды выхода: `0` ок, `2` нет ключа, `3` пустой результат, `4` сеть/HTTP.
