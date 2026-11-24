import type { BuildingKind, BuildingStatus } from './types'

export const KIND_LABEL: Record<BuildingKind, string> = {
  tower: 'Небоскрёб',
  office: 'Офис',
  hotel: 'Отель',
  shop: 'Магазин',
  cafe: 'Кафе',
  library: 'Библиотека',
  house: 'Дом',
  apartment: 'Жилой комплекс',
  park: 'Парк',
  school: 'Школа',
  factory: 'Завод',
  warehouse: 'Склад',
  plant: 'Электростанция',
  unknown: 'Неизвестно',
}

/** Kinds whose occupants count as residents (the rest count as jobs/visitors). */
export const RESIDENTIAL_KINDS: ReadonlySet<BuildingKind> = new Set(['house', 'apartment', 'hotel'])

export const STATUS_LABEL: Record<BuildingStatus, string> = {
  open: 'Открыто',
  closed: 'Закрыто',
  locked: 'Не исследовано',
}

export const STATUS_COLOR: Record<BuildingStatus, string> = {
  open: '#34d399',
  closed: '#f59e0b',
  locked: '#a78bfa',
}
