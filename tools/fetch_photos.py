#!/usr/bin/env python3
"""Скачивание реальных фото из Unsplash по запросу.

Использование:
    python tools/fetch_photos.py "modern real estate interior" -n 5
    python tools/fetch_photos.py "промышленный цех" -n 3 --orientation landscape -o assets/photos

Ключ берётся из переменной окружения UNSPLASH_ACCESS_KEY или из .env в корне проекта
(ключ бесплатный: https://unsplash.com/developers -> New application).

Что делает по правилам Unsplash API:
  * сохраняет автора, ссылку на профиль и на фото — в assets/photos/photos.json (атрибуция);
  * дёргает links.download_location при скачивании (требование API Guidelines);
  * не кэширует и не перепродаёт контент.

Коды выхода: 0 — ок, 2 — нет ключа, 3 — пустой результат, 4 — сеть/HTTP.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

try:
    import requests
except ImportError:
    sys.stderr.write(
        "Нет библиотеки requests. Установи: python -m pip install requests\n"
    )
    raise SystemExit(2)

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

API = "https://api.unsplash.com"
ENV_KEY = "UNSPLASH_ACCESS_KEY"
UTM = "utm_source=voidcode&utm_medium=referral"
SIZES = ("raw", "full", "regular", "small")


# ---------------------------------------------------------------- окружение
def load_env_file(start: Path) -> dict[str, str]:
    """Читает .env, поднимаясь от start до корня диска. Ошибки не глотает молча."""
    for folder in (start, *start.parents):
        candidate = folder / ".env"
        if not candidate.is_file():
            continue
        values: dict[str, str] = {}
        for raw in candidate.read_text(encoding="utf-8", errors="replace").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            name, _, value = line.partition("=")
            name = name.strip().removeprefix("export ").strip()
            values[name] = value.strip().strip("'\"")
        return values
    return {}


def get_key() -> str:
    key = (os.getenv(ENV_KEY) or "").strip()
    if key:
        return key
    env = load_env_file(Path.cwd().resolve())
    key = (env.get(ENV_KEY) or "").strip()
    if key:
        return key
    sys.stderr.write(
        f"Не найден {ENV_KEY}.\n"
        "\n"
        "1. Ключ: https://unsplash.com/developers -> New application (бесплатно, demo = 50 запросов/час).\n"
        f"2. Создай .env в корне проекта: {ENV_KEY}=твой_ключ\n"
        f"   или задай в окружении: $env:{ENV_KEY}='твой_ключ'\n"
        "\n"
        ".env не коммитить — он в .gitignore.\n"
    )
    raise SystemExit(2)


# ---------------------------------------------------------------- утилиты
def slugify(text: str, limit: int = 48) -> str:
    text = (text or "photo").lower().replace("ё", "e")
    text = re.sub(r"[^a-z0-9а-я]+", "-", text).strip("-")
    return (text[:limit].strip("-") or "photo")


def human(n: int) -> str:
    return f"{n / 1024 / 1024:.1f} МБ" if n >= 1024 * 1024 else f"{n / 1024:.0f} КБ"


def search(
    session: requests.Session, key: str, query: str, count: int, orientation: str | None, quiet: bool = False
) -> list[dict]:
    # Берём с запасом: часть выдачи отсеется фильтром Unsplash+ (plus.unsplash.com — платная лицензия).
    params = {"query": query, "per_page": min(30, max(count * 2, count)), "content_filter": "high"}
    if orientation:
        params["orientation"] = orientation
    try:
        resp = session.get(
            f"{API}/search/photos",
            params=params,
            headers={"Authorization": f"Client-ID {key}", "Accept-Version": "v1"},
            timeout=30,
        )
    except requests.RequestException as exc:
        sys.stderr.write(f"Сеть недоступна: {exc}\n")
        raise SystemExit(4)

    if resp.status_code == 401:
        sys.stderr.write("401 — ключ неверный или отозван. Проверь UNSPLASH_ACCESS_KEY.\n")
        raise SystemExit(2)
    if resp.status_code == 403:
        sys.stderr.write(
            "403 — лимит запросов (demo-приложение: 50 запросов/час). Подожди или "
            "переведи приложение в production в кабинете Unsplash.\n"
        )
        raise SystemExit(4)
    if not resp.ok:
        sys.stderr.write(f"HTTP {resp.status_code}: {resp.text[:300]}\n")
        raise SystemExit(4)

    raw_results = resp.json().get("results", [])

    def is_free_license(photo: dict) -> bool:
        """Unsplash+ отдаётся с plus.unsplash.com — это платная лицензия, брать нельзя
        (правило из проекта arka-estate). Бесплатные фото — с images.unsplash.com."""
        urls = photo.get("urls") or {}
        return all("plus.unsplash.com" not in (value or "") for value in urls.values())

    results = [photo for photo in raw_results if is_free_license(photo)]
    dropped = len(raw_results) - len(results)
    if dropped and not quiet:
        print(f"  отсеяно {dropped} шт. с платной лицензией Unsplash+")

    if not results:
        sys.stderr.write(f'По запросу «{query}» ничего не найдено. Смени формулировку (по-английски ищет лучше).\n')
        raise SystemExit(3)
    return results[:count]


def track_download(session: requests.Session, key: str, photo: dict) -> None:
    """Unsplash требует обращаться к download_location при скачивании."""
    url = (photo.get("links") or {}).get("download_location")
    if not url:
        return
    try:
        session.get(url, headers={"Authorization": f"Client-ID {key}", "Accept-Version": "v1"}, timeout=20)
    except requests.RequestException:
        pass  # не валим скачивание из-за счётчика


def download(session: requests.Session, url: str, dest: Path) -> int:
    try:
        with session.get(url, stream=True, timeout=60) as resp:
            resp.raise_for_status()
            tmp = dest.with_suffix(dest.suffix + ".part")
            total = 0
            with tmp.open("wb") as fh:
                for chunk in resp.iter_content(64 * 1024):
                    if chunk:
                        fh.write(chunk)
                        total += len(chunk)
            tmp.replace(dest)
            return total
    except requests.RequestException as exc:
        sys.stderr.write(f"  не скачалось: {exc}\n")
        return 0


def merge_manifest(path: Path, photos: list[dict], query: str) -> None:
    """Дописывает в манифест, не теряя прошлые загрузки (атрибуция не должна пропадать)."""
    existing: list[dict] = []
    if path.is_file():
        try:
            existing = json.loads(path.read_text(encoding="utf-8")).get("photos", [])
        except (json.JSONDecodeError, OSError):
            existing = []
    by_id = {p.get("id"): p for p in existing if p.get("id")}
    for item in photos:
        by_id[item["id"]] = item
    payload = {
        "note": "Фото Unsplash. Атрибуция обязательна: имя автора + ссылка на профиль + ссылка на Unsplash.",
        "source": "https://unsplash.com",
        "license": "https://unsplash.com/license",
        "updated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "last_query": query,
        "photos": sorted(by_id.values(), key=lambda p: p.get("file", "")),
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

def image_dimensions(path: Path) -> tuple[int, int] | None:
    """Реальные размеры JPEG/PNG из заголовка файла, без зависимостей.

    Нужно потому, что API отдаёт размер ОРИГИНАЛА (например 6240x4160),
    а скачивается ресайз (regular ≈ 1080px). Манифест с чужими размерами
    ломает вёрстку и srcset.
    """
    try:
        with path.open("rb") as fh:
            head = fh.read(26)
            if head[:8] == b"\x89PNG\r\n\x1a\n":
                return int.from_bytes(head[16:20], "big"), int.from_bytes(head[20:24], "big")
            if head[:2] != b"\xff\xd8":
                return None
            fh.seek(2)
            sof = {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}
            while True:
                marker = fh.read(2)
                if len(marker) < 2 or marker[0] != 0xFF:
                    return None
                code = marker[1]
                if code in (0xD8, 0xD9) or 0xD0 <= code <= 0xD7:
                    continue
                raw = fh.read(2)
                if len(raw) < 2:
                    return None
                length = int.from_bytes(raw, "big")
                if code in sof:
                    data = fh.read(5)
                    if len(data) < 5:
                        return None
                    return int.from_bytes(data[3:5], "big"), int.from_bytes(data[1:3], "big")
                fh.seek(length - 2, 1)
    except OSError:
        return None


# ---------------------------------------------------------------- curated

def fetch_curated(path: Path, out_dir: Path, session: requests.Session, quiet: bool = False) -> int:
    """Скачать фото по заранее собранному JSON (когда API-ключа нет).

    Формат: {"photos": [{file, url, query, alt, author, author_url, photo_url,
    width, height}]}. Автор и ссылка обязательны: без них запись отклоняется.
    Это не обход API, а воспроизводимый способ скачать уже выбранные кадры и
    сохранить ту же атрибуцию, которую дал бы API.
    """
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        sys.stderr.write(f"Не читается {path}: {exc}\n")
        return 4

    photos = payload.get("photos", payload)
    if not isinstance(photos, list) or not photos:
        sys.stderr.write(f"В {path} нет массива photos.\n")
        return 3

    out_dir.mkdir(parents=True, exist_ok=True)
    manifest: list[dict] = []
    saved = skipped = 0

    for index, item in enumerate(photos, start=1):
        filename = str(item.get("file") or "").strip()
        url = str(item.get("url") or "").strip()
        author = str(item.get("author") or "").strip()
        photo_url = str(item.get("photo_url") or "").strip()
        if not filename or not url or not author or not photo_url:
            sys.stderr.write(f"  {index}. пропуск: нужны file, url, author и photo_url.\n")
            continue
        if not url.startswith("https://images.unsplash.com/"):
            sys.stderr.write(f"  {index}. пропуск: url должен вести на images.unsplash.com.\n")
            continue

        dest = out_dir / filename
        existed = dest.exists() and dest.stat().st_size > 0
        if existed:
            skipped += 1
        else:
            size_bytes = download(session, url, dest)
            if not size_bytes:
                continue
            saved += 1
            time.sleep(0.2)

        actual = image_dimensions(dest) if dest.exists() else None
        entry = {
            "id": item.get("id") or Path(filename).stem,
            "file": filename,
            "query": item.get("query") or "curated",
            "alt": item.get("alt") or Path(filename).stem,
            "author": author,
            "author_url": item.get("author_url") or "",
            "photo_url": photo_url,
            "width": item.get("width") or 0,
            "height": item.get("height") or 0,
            "license": "Unsplash License",
            "downloaded": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }
        if actual:
            entry["source_width"], entry["source_height"] = entry["width"], entry["height"]
            entry["width"], entry["height"] = actual

        if not quiet:
            print(f"  {index}. {filename}  {entry['width']}x{entry['height']}{'  — уже есть' if existed else ''}  — {author}")
        manifest.append(entry)

    if manifest:
        merge_manifest(out_dir / "photos.json", manifest, "curated")

    print(f"\nГотово: скачано {saved}, пропущено {skipped}. Папка: {out_dir}")
    print(f"Атрибуция: {out_dir / 'photos.json'}")
    return 0


# ---------------------------------------------------------------- main
def main() -> int:
    ap = argparse.ArgumentParser(
        description="Скачать реальные фото из Unsplash по запросу.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='Пример: python tools/fetch_photos.py "modern real estate interior" -n 5',
    )
    ap.add_argument("query", nargs="?", help='поисковый запрос, например "modern real estate interior"')
    ap.add_argument("-n", "--count", type=int, default=5, help="сколько фото (1-10, по умолчанию 5)")
    ap.add_argument("-o", "--out", default="assets/photos", help="папка (по умолчанию assets/photos)")
    ap.add_argument("--orientation", choices=("landscape", "portrait", "squarish"), help="ориентация кадра")
    ap.add_argument("--size", choices=SIZES, default="regular", help="размер: regular ~1080px для веба (по умолчанию)")
    ap.add_argument("--dry-run", action="store_true", help="только показать, что нашлось; не скачивать")
    ap.add_argument("--quiet", action="store_true", help="меньше вывода")
    ap.add_argument(
        "--from-json",
        help="JSON с готовыми URL и атрибуцией; не требует API-ключа (см. tools/photo_sources.json)",
    )
    args = ap.parse_args()

    count = max(1, min(10, args.count))
    out_dir = Path(args.out).resolve()
    session = requests.Session()
    session.headers["User-Agent"] = "voidcode-fetch-photos/1.0"

    if args.from_json:
        return fetch_curated(Path(args.from_json), out_dir, session, args.quiet)

    if not args.query:
        sys.stderr.write("Нужен поисковый запрос или --from-json.\n")
        return 2

    key = get_key()

    print(f'Запрос: «{args.query}» · {count} шт · размер {args.size}')
    results = search(session, key, args.query, count, args.orientation, args.quiet)

    out_dir.mkdir(parents=True, exist_ok=True)
    manifest: list[dict] = []
    saved = skipped = 0

    for index, photo in enumerate(results, start=1):
        pid = photo.get("id", "unknown")
        user = photo.get("user") or {}
        author = (user.get("name") or user.get("username") or "unknown").strip()
        username = user.get("username") or ""
        alt = (photo.get("alt_description") or photo.get("description") or args.query).strip()
        width = photo.get("width") or 0
        height = photo.get("height") or 0

        filename = f"{index:02d}-{slugify(alt)}-{pid[:10]}.jpg"
        dest = out_dir / filename
        urls = photo.get("urls") or {}
        url = urls.get(args.size) or urls.get("regular")

        entry = {
            "id": pid,
            "file": filename,
            "query": args.query,
            "alt": alt,
            "author": author,
            "author_url": f"https://unsplash.com/@{username}?{UTM}" if username else "",
            "photo_url": f"{(photo.get('links') or {}).get('html', '')}?{UTM}".rstrip("?"),
            "width": width,
            "height": height,
            "license": "Unsplash License",
            "downloaded": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }

        if args.dry_run:
            print(f"  {index}. {filename}  {width}x{height}  {author}")
            manifest.append(entry)
            continue

        existed = dest.exists() and dest.stat().st_size > 0
        if existed:
            skipped += 1
        else:
            size_bytes = download(session, url, dest)
            if not size_bytes:
                continue
            track_download(session, key, photo)
            saved += 1
            time.sleep(0.2)  # вежливость к API

        # размеры берём с диска: API отдаёт оригинал, а скачивается ресайз.
        actual = image_dimensions(dest) if dest.exists() else None
        if actual:
            entry["source_width"], entry["source_height"] = width, height
            entry["width"], entry["height"] = actual

        if not args.quiet:
            dims = f"{entry['width']}x{entry['height']}"
            print(f"  {index}. {filename}  {dims}{'  — уже есть' if existed else ''}  — {author}")

        manifest.append(entry)

    if args.dry_run:
        print("\n--dry-run: ничего не записано.")
        return 0

    if manifest:
        merge_manifest(out_dir / "photos.json", manifest, args.query)

    print(f"\nГотово: скачано {saved}, пропущено {skipped}. Папка: {out_dir}")
    print(f"Атрибуция: {out_dir / 'photos.json'}")
    print("Не забыть: имя автора и ссылку на Unsplash вывести в интерфейсе или в кредитах.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
