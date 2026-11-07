/**
 * Релизы студии.
 *
 * Источник: бриф HERTZ (демонстрационный кейс VOIDCODE).
 * Названия, артисты и годы — вымышленные, чтобы карточки выглядели как настоящий каталог.
 * cover — ID фото из src/data/photos.ts.
 */
import type { PhotoId } from './photos';

export interface Release {
  id: string;
  title: string;
  artist: string;
  genre: string;
  year: number;
  format: 'Single' | 'EP' | 'LP';
  catalog: string;
  /** ID фото обложки: ключ из PHOTO_FILES */
  cover: PhotoId;
  /** точка кадрирования обложки */
  coverPosition: string;
}

export const RELEASES: Release[] = [
  {
    id: 'neon-dust',
    title: 'Неон и пыль',
    artist: 'Мира Восс',
    genre: 'Электроника',
    year: 2026,
    format: 'Single',
    catalog: 'HZ-001',
    cover: 'wave',
    coverPosition: '42% 50%',
  },
  {
    id: 'late-checkout',
    title: 'Поздний выезд',
    artist: 'Low Season',
    genre: 'Инди',
    year: 2025,
    format: 'EP',
    catalog: 'HZ-002',
    cover: 'turntable',
    coverPosition: '50% 58%',
  },
  {
    id: 'gold',
    title: 'GOLD',
    artist: 'Арман Рей',
    genre: 'Хип-хоп',
    year: 2025,
    format: 'Single',
    catalog: 'HZ-003',
    cover: 'goldMic',
    coverPosition: '58% 45%',
  },
  {
    id: 'room-tone',
    title: 'Room Tone',
    artist: 'Нора Фельд',
    genre: 'Эмбиент',
    year: 2024,
    format: 'LP',
    catalog: 'HZ-004',
    cover: 'condenserMic',
    coverPosition: '52% 30%',
  },
];
