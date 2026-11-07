/**
 * Локальные фото и их роли.
 * Файлы лежат в assets/photos, атрибуция — в assets/photos/photos.json.
 * ID — часть контракта данных: на него ссылаются релизы и секции.
 */

export const PHOTO_FILES = {
  consoleDetail: '01-console-detail.jpg',
  consoleRoom: '02-console-room.jpg',
  condenserMic: '03-condenser-mic.jpg',
  goldMic: '04-gold-mic.jpg',
  turntable: '05-turntable.jpg',
  wave: '06-wave-texture.jpg',
} as const;

export type PhotoId = keyof typeof PHOTO_FILES;

export const PHOTO_ALTS: Record<PhotoId, string> = {
  consoleDetail: 'Крупный план микшерного пульта: фейдеры и цветные индикаторы',
  consoleRoom: 'Микшерная консоль в студии звукозаписи',
  condenserMic: 'Студийный конденсаторный микрофон с поп-фильтром',
  goldMic: 'Золотой конденсаторный микрофон на стойке',
  turntable: 'Виниловый проигрыватель в тёплом свете',
  wave: 'Абстрактный зелёно-чёрный волновой паттерн',
};
