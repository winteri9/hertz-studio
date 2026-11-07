/**
 * Демо-калькулятор записи.
 *
 * Это концепт, а не прайс студии: цены показывают механику расчёта.
 * Финальная смета — после брифа.
 */

export interface PricingService {
  id: string;
  name: string;
  note: string;
  rate: number;
}

export interface PricingDuration {
  hours: number;
  label: string;
}

export const PRICING_SERVICES: PricingService[] = [
  { id: 'recording', name: 'Запись', note: 'Сессия в студии', rate: 4500 },
  { id: 'mixing', name: 'Сведение', note: 'Работа с дорожками', rate: 3500 },
  { id: 'mastering', name: 'Мастеринг', note: 'Финальный релиз', rate: 2500 },
];

export const PRICING_DURATIONS: PricingDuration[] = [
  { hours: 2, label: '2 часа' },
  { hours: 4, label: '4 часа' },
  { hours: 6, label: '6 часов' },
  { hours: 8, label: '8 часов' },
];
