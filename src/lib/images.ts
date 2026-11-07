/**
 * Локальные фото.
 *
 * Все изображения лежат в assets/photos и собираются Astro как оптимизируемые ассеты.
 * tools/fetch_photos.py пишет photos.json с автором, профилем и ссылкой на фото.
 * Атрибуция обязательна: photoCredit() отдаёт запись из манифеста.
 */
import type { ImageMetadata } from 'astro';

type LocalMap = Record<string, { default: ImageMetadata }>;
type JsonMap = Record<string, { default: PhotoManifest }>;

export interface PhotoManifest {
  note?: string;
  source?: string;
  license?: string;
  updated?: string;
  last_query?: string;
  photos: PhotoEntry[];
}

export interface PhotoEntry {
  id: string;
  file: string;
  query?: string;
  alt?: string;
  author: string;
  author_url: string;
  photo_url: string;
  width: number;
  height: number;
  license?: string;
  downloaded?: string;
}

/** Все скачанные фото из assets/photos. */
const localFiles = import.meta.glob('../../assets/photos/*.{jpg,jpeg,png,webp}', {
  eager: true,
}) as LocalMap;

/** Манифест атрибуции. Может отсутствовать, если фото ещё не скачивались. */
const manifests = import.meta.glob('../../assets/photos/photos.json', {
  eager: true,
}) as JsonMap;

const manifest: PhotoManifest = Object.values(manifests)[0]?.default ?? { photos: [] };

/**
 * Локальное фото как ассет Astro.
 * Нет файла — ошибка сборки, а не пустое место на странице: молчаливая дыра дороже падения.
 */
export const localPhoto = (file: string): ImageMetadata => {
  const mod = localFiles[`../../assets/photos/${file}`];
  if (!mod) {
    throw new Error(
      `Нет фото assets/photos/${file}. Скачай: python tools/fetch_photos.py --from-json tools/photo_sources.json`,
    );
  }
  return mod.default;
};

/** Атрибуция по имени файла. Для вывода в кредитах или подписью под фото. */
export const photoCredit = (file: string): PhotoEntry | null =>
  manifest.photos.find((p) => p.file === file) ?? null;
