/*
 * Everything a player can build, with prices and what each thing does. All the numbers of the
 * game's balance live here.
 */

/** Map size in cells and the size of one cell in metres. */
export const GRID = 40
export const CELL = 6
/** Money a new city starts with. */
export const START_MONEY = 30000
/** Selling gives back this share of the price. */
export const SELL_SHARE = 0.5

export type Category = 'roads' | 'homes' | 'work' | 'services' | 'utility' | 'fun'

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'roads', label: 'Дороги' },
  { id: 'homes', label: 'Жильё' },
  { id: 'work', label: 'Работа' },
  { id: 'services', label: 'Услуги' },
  { id: 'utility', label: 'Свет, вода' },
  { id: 'fun', label: 'Отдых' },
]

/** What a city's residents need near their homes (each service covers a radius around it). */
export type Need = 'shops' | 'kids' | 'school' | 'health' | 'police' | 'fire' | 'fun' | 'parking' | 'cars'

export const NEEDS: { id: Need; label: string; from: number }[] = [
  // `from`: the need appears once the city has this many residents.
  { id: 'shops', label: 'Магазины', from: 0 },
  { id: 'fun', label: 'Отдых', from: 30 },
  { id: 'kids', label: 'Детский сад', from: 60 },
  { id: 'school', label: 'Школа', from: 90 },
  { id: 'health', label: 'Больница', from: 120 },
  { id: 'police', label: 'Полиция', from: 200 },
  { id: 'fire', label: 'Пожарные', from: 250 },
  { id: 'parking', label: 'Парковки', from: 400 },
  { id: 'cars', label: 'Автосервис', from: 600 },
]
export const NEED_BY_ID = Object.fromEntries(NEEDS.map((n) => [n.id, n])) as Record<Need, (typeof NEEDS)[number]>

export type RoadKind = 'dirt' | 'street' | 'avenue' | 'ring'

export interface RoadDef {
  id: RoadKind
  name: string
  text: string
  cost: number
  /** Residents next to it are this much happier (avenues) or less happy (dirt roads). */
  mood: number
}

export const ROADS: RoadDef[] = [
  { id: 'dirt', name: 'Грунтовка', text: 'Самая дешёвая. Пыльно и некрасиво: соседи чуть менее счастливы.', cost: 10, mood: -3 },
  { id: 'street', name: 'Улица', text: 'Асфальт, тротуары и фонари.', cost: 40, mood: 0 },
  { id: 'avenue', name: 'Проспект', text: 'Широкий, с аллеей посередине. Жить рядом приятнее.', cost: 120, mood: 4 },
  { id: 'ring', name: 'Круговой перекрёсток', text: 'Кольцо с клумбой: ставь там, где сходятся дороги.', cost: 300, mood: 2 },
]
export const ROAD_BY_ID = Object.fromEntries(ROADS.map((r) => [r.id, r])) as Record<RoadKind, RoadDef>

export type Model =
  | 'house'
  | 'cottage'
  | 'lowrise'
  | 'apartment'
  | 'tower'
  | 'shop'
  | 'cafe'
  | 'office'
  | 'bizTower'
  | 'mall'
  | 'garage'
  | 'parking'
  | 'factory'
  | 'kindergarten'
  | 'school'
  | 'clinic'
  | 'hospital'
  | 'police'
  | 'fire'
  | 'coal'
  | 'solar'
  | 'wind'
  | 'waterTower'
  | 'pump'
  | 'gazebo'
  | 'playground'
  | 'park'
  | 'fountain'
  | 'stadium'

export interface BuildingDef {
  id: string
  name: string
  text: string
  category: Category
  model: Model
  /** Footprint in cells before rotation (w along x, d along z). */
  w: number
  d: number
  cost: number
  /** Running costs per minute. */
  upkeep: number
  /** People living here. */
  homes?: number
  /** Jobs here. */
  jobs?: number
  /** Electricity and water made (positive) by power plants and pumps. */
  power?: number
  water?: number
  /** Services: the need it covers and how far (in cells). */
  covers?: { need: Need; r: number }[]
  /** Smoke: homes this close are unhappy. */
  pollution?: number
  /** A small boost to happiness of homes around (parks, fountains). */
  mood?: { r: number; v: number }
  /** Opens once the city has this many residents. */
  unlock: number
}

export const BUILDINGS: BuildingDef[] = [
  // Homes
  { id: 'house', name: 'Частный дом', text: 'Дом на одну семью.', category: 'homes', model: 'house', w: 1, d: 1, cost: 300, upkeep: 0, homes: 5, unlock: 0 },
  { id: 'cottage', name: 'Коттедж', text: 'Большой дом с садом.', category: 'homes', model: 'cottage', w: 1, d: 1, cost: 700, upkeep: 0, homes: 9, mood: { r: 1, v: 2 }, unlock: 40 },
  { id: 'lowrise', name: 'Малоэтажка', text: 'Трёхэтажный дом на несколько семей.', category: 'homes', model: 'lowrise', w: 2, d: 1, cost: 1600, upkeep: 2, homes: 30, unlock: 20 },
  { id: 'apartment', name: 'Многоэтажка', text: 'Девять этажей, много квартир.', category: 'homes', model: 'apartment', w: 2, d: 2, cost: 5000, upkeep: 6, homes: 110, unlock: 150 },
  { id: 'tower', name: 'Жилой небоскрёб', text: 'Тридцать этажей с видом на весь город.', category: 'homes', model: 'tower', w: 2, d: 2, cost: 16000, upkeep: 15, homes: 380, unlock: 700 },
  // Work
  { id: 'shop', name: 'Магазин', text: 'Продукты у дома.', category: 'work', model: 'shop', w: 1, d: 1, cost: 700, upkeep: 1, jobs: 8, covers: [{ need: 'shops', r: 6 }], unlock: 0 },
  { id: 'cafe', name: 'Кафе', text: 'Кофе и обеды. Жителям есть куда сходить.', category: 'work', model: 'cafe', w: 1, d: 1, cost: 900, upkeep: 1, jobs: 6, covers: [{ need: 'fun', r: 4 }], unlock: 10 },
  { id: 'office', name: 'Офис', text: 'Работа для многих жителей.', category: 'work', model: 'office', w: 2, d: 2, cost: 4500, upkeep: 4, jobs: 120, unlock: 60 },
  { id: 'factory', name: 'Завод', text: 'Много рабочих мест, но дым: дома рядом несчастны.', category: 'work', model: 'factory', w: 3, d: 2, cost: 5500, upkeep: 5, jobs: 180, pollution: 6, unlock: 30 },
  { id: 'mall', name: 'Торговый центр', text: 'Магазины, кино и фудкорт под одной крышей.', category: 'work', model: 'mall', w: 3, d: 3, cost: 14000, upkeep: 10, jobs: 220, covers: [{ need: 'shops', r: 14 }, { need: 'fun', r: 10 }], unlock: 350 },
  { id: 'garage', name: 'Автосервис', text: 'Машинам жителей нужен ремонт.', category: 'work', model: 'garage', w: 2, d: 1, cost: 2400, upkeep: 2, jobs: 18, covers: [{ need: 'cars', r: 12 }], unlock: 400 },
  { id: 'parking', name: 'Парковка', text: 'Место, где оставить машину.', category: 'work', model: 'parking', w: 2, d: 2, cost: 1200, upkeep: 1, jobs: 2, covers: [{ need: 'parking', r: 7 }], unlock: 300 },
  { id: 'bizTower', name: 'Бизнес-центр', text: 'Стеклянная башня с тысячей рабочих мест.', category: 'work', model: 'bizTower', w: 2, d: 2, cost: 22000, upkeep: 18, jobs: 650, unlock: 900 },
  // Services
  { id: 'kindergarten', name: 'Детский сад', text: 'Малышам нужно куда-то ходить днём.', category: 'services', model: 'kindergarten', w: 2, d: 1, cost: 2000, upkeep: 3, jobs: 10, covers: [{ need: 'kids', r: 8 }], unlock: 40 },
  { id: 'school', name: 'Школа', text: 'Учит детей всего района.', category: 'services', model: 'school', w: 3, d: 2, cost: 5000, upkeep: 6, jobs: 30, covers: [{ need: 'school', r: 11 }], unlock: 70 },
  { id: 'clinic', name: 'Поликлиника', text: 'Врачи рядом с домом.', category: 'services', model: 'clinic', w: 2, d: 1, cost: 3000, upkeep: 4, jobs: 20, covers: [{ need: 'health', r: 9 }], unlock: 100 },
  { id: 'hospital', name: 'Больница', text: 'Лечит весь город.', category: 'services', model: 'hospital', w: 3, d: 3, cost: 12000, upkeep: 10, jobs: 90, covers: [{ need: 'health', r: 20 }], unlock: 450 },
  { id: 'police', name: 'Полиция', text: 'Порядок и спокойствие.', category: 'services', model: 'police', w: 2, d: 1, cost: 3000, upkeep: 4, jobs: 20, covers: [{ need: 'police', r: 12 }], unlock: 160 },
  { id: 'fire', name: 'Пожарная часть', text: 'Спасает от пожаров.', category: 'services', model: 'fire', w: 2, d: 1, cost: 3000, upkeep: 4, jobs: 20, covers: [{ need: 'fire', r: 12 }], unlock: 200 },
  // Electricity and water
  { id: 'wind', name: 'Ветряк', text: 'Немного чистого электричества.', category: 'utility', model: 'wind', w: 1, d: 1, cost: 1500, upkeep: 1, power: 60, unlock: 0 },
  { id: 'waterTower', name: 'Водонапорная башня', text: 'Вода для небольшого района.', category: 'utility', model: 'waterTower', w: 1, d: 1, cost: 1200, upkeep: 1, water: 90, unlock: 0 },
  { id: 'solar', name: 'Солнечная станция', text: 'Панели на крыше и на земле.', category: 'utility', model: 'solar', w: 2, d: 2, cost: 4000, upkeep: 2, power: 180, unlock: 100 },
  { id: 'pump', name: 'Насосная станция', text: 'Много чистой воды.', category: 'utility', model: 'pump', w: 2, d: 2, cost: 4500, upkeep: 3, water: 400, jobs: 10, unlock: 150 },
  { id: 'coal', name: 'ТЭЦ', text: 'Много тока на весь город, но дымит.', category: 'utility', model: 'coal', w: 3, d: 3, cost: 9000, upkeep: 8, power: 700, jobs: 40, pollution: 8, unlock: 200 },
  // Leisure
  { id: 'gazebo', name: 'Беседка', text: 'Посидеть вечером с соседями.', category: 'fun', model: 'gazebo', w: 1, d: 1, cost: 250, upkeep: 0, covers: [{ need: 'fun', r: 3 }], mood: { r: 2, v: 2 }, unlock: 0 },
  { id: 'playground', name: 'Детская площадка', text: 'Горки и качели.', category: 'fun', model: 'playground', w: 1, d: 1, cost: 500, upkeep: 0, covers: [{ need: 'fun', r: 4 }], mood: { r: 3, v: 2 }, unlock: 20 },
  { id: 'fountain', name: 'Фонтан', text: 'Красиво и прохладно.', category: 'fun', model: 'fountain', w: 1, d: 1, cost: 900, upkeep: 1, covers: [{ need: 'fun', r: 4 }], mood: { r: 4, v: 4 }, unlock: 80 },
  { id: 'park', name: 'Парк', text: 'Деревья, дорожки, скамейки.', category: 'fun', model: 'park', w: 2, d: 2, cost: 1800, upkeep: 1, covers: [{ need: 'fun', r: 8 }], mood: { r: 6, v: 5 }, unlock: 50 },
  { id: 'stadium', name: 'Стадион', text: 'Матчи и концерты для всего города.', category: 'fun', model: 'stadium', w: 4, d: 3, cost: 26000, upkeep: 15, jobs: 60, covers: [{ need: 'fun', r: 26 }], mood: { r: 26, v: 4 }, unlock: 1200 },
]
export const BUILDING_BY_ID = Object.fromEntries(BUILDINGS.map((b) => [b.id, b])) as Record<string, BuildingDef>

/** Each resident needs this much electricity and water; each job a little too. */
export const POWER_PER_RESIDENT = 0.5
export const POWER_PER_JOB = 0.3
export const WATER_PER_RESIDENT = 0.6
export const WATER_PER_JOB = 0.2
/** Share of residents who work. */
export const WORKERS_SHARE = 0.6

/** Taxes per minute: from each resident and each filled job. */
export const TAX_PER_RESIDENT = 0.6
export const TAX_PER_JOB = 0.4

/** One game tick, and how much of the gap between residents and homes fills in one tick. */
export const TICK_MS = 5000
export const MOVE_IN_SHARE = 0.12
/** Money earned while away is counted for at most this long. */
export const OFFLINE_CAP_MS = 4 * 3600_000

/**
 * The city falls apart when residents are unhappy for too long: below this happiness for this
 * long, the city rolls back to the last saved good state.
 */
export const BAD_MOOD = 25
export const BAD_MOOD_MS = 120_000
/** A good state (happiness at least this) is remembered for the roll-back every so often. */
export const GOOD_MOOD = 55
export const SNAPSHOT_EVERY_MS = 60_000
