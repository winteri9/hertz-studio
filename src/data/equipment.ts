/**
 * Оборудование студии.
 *
 * Источник: бриф HERTZ (демонстрационный кейс VOIDCODE).
 * Модели реальные; формулировки — про роль инструмента, без непроверяемых цифр.
 */

export interface EquipmentItem {
  id: string;
  name: string;
  category: string;
  note: string;
}

export const EQUIPMENT: EquipmentItem[] = [
  {
    id: 'u87',
    name: 'Neumann U 87 Ai',
    category: 'Микрофон',
    note: 'Конденсатор с плотной серединой и узнаваемым верхом.',
  },
  {
    id: 'c800g',
    name: 'Sony C-800G',
    category: 'Микрофон',
    note: 'Ламповый микрофон для вокала, которому нужен вес.',
  },
  {
    id: 'api1608',
    name: 'API 1608',
    category: 'Консоль',
    note: 'Аналоговая консоль: эквалайзеры и сумма, которая держит низ.',
  },
  {
    id: 'ns10',
    name: 'Yamaha NS-10M',
    category: 'Мониторы',
    note: 'Честная середина: проверка микса, а не украшение.',
  },
  {
    id: 'a80',
    name: 'Studer A80',
    category: 'Магнитофон',
    note: 'Лента добавляет компрессию, шум и глубину, которых нет в плагине.',
  },
];
