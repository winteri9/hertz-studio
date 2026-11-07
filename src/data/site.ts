/**
 * Факты сайта — единственный источник правды.
 *
 * HERTZ — концепт VOIDCODE. Физического адреса, телефона, почты и соцсетей нет.
 * Реальный канал связи — Telegram @winteri9.
 * Правило: нет факта — нет строки.
 */

export const SITE = {
  name: 'HERTZ',
  legalName: 'VOIDCODE',
  url: 'https://hertz-studio.vercel.app',
  locale: 'ru_RU',
  title: 'HERTZ — концепт студии звукозаписи',
  description:
    'Концепт студии звукозаписи: запись, сведение, мастеринг и продакшн. Демонстрационный кейс VOIDCODE.',
  tagline: 'Звук, который имеет вес',
  city: 'Москва',
  conceptLabel: 'Concept / VOIDCODE',
} as const;

export const CONTACTS = {
  city: 'Москва',
  telegram: '@winteri9',
  telegramHref: 'https://t.me/winteri9',
} as const;

/** Навигация. Только якоря на главной — отдельных страниц в кейсе нет. */
export const NAV = [
  { label: 'Услуги', href: '#services' },
  { label: 'Релизы', href: '#releases' },
  { label: 'Оборудование', href: '#equipment' },
  { label: 'Концепт', href: '#concept' },
  { label: 'Контакты', href: '#contact' },
] as const;

/** Технические подписи первого экрана: это метки интерфейса, а не обещания студии. */
export const HERO_SPECS = [
  { value: '01—04', label: 'полный цикл' },
  { value: '128', label: 'полос' },
  { value: '30', label: 'кадров/с' },
] as const;
