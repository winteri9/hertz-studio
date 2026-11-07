/**
 * Факты сайта — единственный источник правды.
 *
 * Источник: бриф HERTZ (демонстрационный кейс VOIDCODE).
 * Контакты, адрес и часы работы — демонстрационные, не выдаются за реальные реквизиты.
 * Правило: нет факта — нет строки.
 */

export const SITE = {
  name: 'HERTZ',
  legalName: 'HERTZ STUDIO',
  url: 'https://hertz.studio',
  locale: 'ru_RU',
  title: 'HERTZ — студия звукозаписи',
  description:
    'Запись, сведение, мастеринг и продакшн. Студия полного цикла в Москве. Звук, который имеет вес.',
  tagline: 'Звук, который имеет вес',
  city: 'Москва',
  coordinates: '55.747° N / 37.664° E',
  founded: '2016',
} as const;

export const CONTACTS = {
  phone: '+7 (495) 120-18-40',
  phoneHref: 'tel:+74951201840',
  email: 'hello@hertz.studio',
  emailHref: 'mailto:hello@hertz.studio',
  address: 'Москва, Нижняя Сыромятническая, 10, стр. 2',
  addressHref: 'https://yandex.ru/maps/?text=Москва%2C%20Нижняя%20Сыромятническая%2C%2010',
  telegram: '@hertzstudio',
  telegramHref: 'https://t.me/hertzstudio',
  hours: 'Пн–Сб, 11:00–23:00',
} as const;

/** Навигация. Только якоря на главной — отдельных страниц в кейсе нет. */
export const NAV = [
  { label: 'Услуги', href: '#services' },
  { label: 'Релизы', href: '#releases' },
  { label: 'Оборудование', href: '#equipment' },
  { label: 'Контакты', href: '#contact' },
] as const;

export const SOCIALS = [
  { label: 'Telegram', href: 'https://t.me/hertzstudio' },
  { label: 'VK', href: 'https://vk.com/hertzstudio' },
  { label: 'YouTube', href: 'https://youtube.com/@hertzstudio' },
] as const;

/** Технические подписи первого экрана: это метки интерфейса, а не обещания студии. */
export const HERO_SPECS = [
  { value: '01—04', label: 'полный цикл' },
  { value: '128', label: 'полос' },
  { value: '30', label: 'кадров/с' },
] as const;
