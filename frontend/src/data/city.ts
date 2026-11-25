import { PLAN } from '../city/plan'
import type { Parcel } from '../city/planner'
import { createRng, type Rng } from '../lib/random'
import type {
  Building,
  ProceduralKind,
  BuildingShape,
  District,
  DistrictId,
} from './types'


/**
 * One continuous city on one piece of land, built like a real one: factories at the west
 * end, a mixed centre of towers, offices, small blocks and shops, and a dense residential
 * microdistrict in the east with its own school, clinic and park. The three zones share
 * their border streets, so there is no gap between them.
 */
export const DISTRICTS: District[] = [
  {
    id: 'industrial',
    name: 'Промзона',
    shortName: 'Промзона',
    subtitle: 'Заводы, склады, ТЭЦ',
    description:
      'Западный край города: заводы, склады и ТЭЦ, которая питает весь город. Ближе к центру между цехами стоят дома рабочих и магазины.',
    color: '#c7761f',
    origin: [PLAN.zoneCentroid.industrial.x, PLAN.zoneCentroid.industrial.z],
    grid: { cols: 5, rows: 5 },
  },
  {
    id: 'downtown',
    name: 'Центр',
    shortName: 'Центр',
    subtitle: 'Башни, офисы, магазины',
    description:
      'Сердце города. Небоскрёбы и офисы стоят вперемешку с жилыми домами, кафе и магазинами, как в настоящем центре.',
    color: '#2f63c9',
    origin: [PLAN.zoneCentroid.downtown.x, PLAN.zoneCentroid.downtown.z],
    grid: { cols: 5, rows: 5 },
  },
  {
    id: 'residential',
    name: 'Жилой микрорайон',
    shortName: 'Микрорайон',
    subtitle: 'Дома, школа, больница',
    description:
      'Восточный микрорайон: многоэтажки с дворами, частные дома, школа, поликлиника и парк с беседкой. Здесь живёт большинство горожан.',
    color: '#3f8f5a',
    origin: [PLAN.zoneCentroid.residential.x, PLAN.zoneCentroid.residential.z],
    grid: { cols: 5, rows: 5 },
  },
]

export const DISTRICT_BY_ID = Object.fromEntries(DISTRICTS.map((d) => [d.id, d])) as Record<
  DistrictId,
  District
>

/* ------------------------------------------------------------------ */
/* Generation rules                                                    */
/* ------------------------------------------------------------------ */

interface KindRule {
  shape: BuildingShape
  height: [number, number]
  width: [number, number]
  depth: [number, number]
  /** People per floor per 10 m² of footprint (rough density). */
  density: number
}

const KIND_RULES: Record<ProceduralKind, KindRule> = {
  tower: { shape: 'block', height: [32, 64], width: [5.5, 7.5], depth: [5.5, 7.5], density: 0.9 },
  office: { shape: 'block', height: [14, 30], width: [6, 8.5], depth: [6, 8.5], density: 0.7 },
  hotel: { shape: 'block', height: [18, 34], width: [6, 8], depth: [5, 7], density: 0.5 },
  shop: { shape: 'block', height: [4, 7], width: [6, 8.5], depth: [5, 7.5], density: 0.6 },
  cafe: { shape: 'block', height: [3.5, 6], width: [5, 7], depth: [5, 7], density: 0.8 },
  library: { shape: 'block', height: [10, 14], width: [8.5, 8.5], depth: [8.5, 8.5], density: 0.4 },
  house: { shape: 'house', height: [4, 7], width: [5, 6.5], depth: [5, 6.5], density: 0.25 },
  apartment: { shape: 'block', height: [12, 24], width: [7, 8.5], depth: [5, 7], density: 0.45 },
  park: { shape: 'park', height: [0.3, 0.3], width: [9, 9], depth: [9, 9], density: 0.15 },
  school: { shape: 'block', height: [8, 10], width: [8.5, 8.5], depth: [7, 8], density: 0.6 },
  factory: { shape: 'factory', height: [7, 12], width: [8, 8.8], depth: [7, 8.8], density: 0.15 },
  warehouse: { shape: 'block', height: [6, 9], width: [8, 8.8], depth: [5.5, 7], density: 0.08 },
  plant: { shape: 'plant', height: [14, 20], width: [8.5, 8.5], depth: [8.5, 8.5], density: 0.05 },
  unknown: { shape: 'mystery', height: [6, 12], width: [6, 8], depth: [6, 8], density: 0 },
}

interface DistrictRule {
  seed: number
  kinds: [ProceduralKind, number][]
  /** Different mix per column, so zones blend into each other at their borders. */
  byCol?: Partial<Record<number, [ProceduralKind, number][]>>
  walls: string[]
  accents: string[]
  founded: [number, number]
  closedChance: number
  /** Probability that a lot stays empty (plaza / parking). */
  emptyChance: number
}

const DISTRICT_RULES: Record<DistrictId, DistrictRule> = {
  downtown: {
    seed: 1101,
    kinds: [['tower', 34], ['office', 26], ['apartment', 12], ['hotel', 8], ['shop', 10], ['cafe', 10]],
    byCol: {
      0: [['office', 30], ['apartment', 25], ['warehouse', 12], ['shop', 18], ['house', 15]],
      4: [['apartment', 40], ['office', 15], ['house', 15], ['shop', 15], ['cafe', 15]],
    },
    walls: ['#a9bccd', '#bfcbd6', '#93abc2', '#d3d8dc', '#c7b8a2', '#e0dbd0', '#9fb3c6'],
    accents: ['#ffd9a0', '#ffe4b8', '#fff1d6', '#ffcf8a'],
    founded: [2031, 2049],
    closedChance: 0.06,
    emptyChance: 0,
  },
  residential: {
    seed: 2203,
    kinds: [['apartment', 62], ['house', 18], ['shop', 12], ['cafe', 8]],
    byCol: {
      0: [['apartment', 40], ['office', 20], ['shop', 20], ['cafe', 20]],
      4: [['house', 55], ['apartment', 35], ['shop', 10]],
    },
    walls: ['#efe3cf', '#e2c6a2', '#d79f7a', '#f1d9b5', '#c98b6b', '#e8dccb', '#b9c8d4', '#d8b4a0'],
    accents: ['#ffd59a', '#ffcc80', '#ffe0b0'],
    founded: [2024, 2046],
    closedChance: 0.05,
    emptyChance: 0,
  },
  industrial: {
    seed: 3307,
    kinds: [['factory', 42], ['warehouse', 46], ['unknown', 8]],
    byCol: {
      4: [['house', 35], ['apartment', 25], ['shop', 20], ['warehouse', 20]],
      3: [['warehouse', 40], ['factory', 30], ['house', 20], ['shop', 10]],
    },
    walls: ['#9a8f84', '#a89c8c', '#8a8178', '#b5a58f', '#857b70', '#a3998c'],
    accents: ['#ffd08a', '#ffc070'],
    founded: [2008, 2034],
    closedChance: 0.18,
    emptyChance: 0,
  },
}

/* ------------------------------------------------------------------ */
/* Names & descriptions                                                */
/* ------------------------------------------------------------------ */

const NAMES: Record<ProceduralKind, string[]> = {
  tower: ['Башня «Зенит»', 'Башня «Горизонт»', 'Башня «Вершина»', 'Башня «Призма»', 'Башня «Рассвет»', 'Башня «Северная»', 'Башня «Эхо»', 'Башня «Аврора»'],
  office: ['Бизнес-центр «Сигнал»', 'БЦ «Нексус»', 'Квант-Плаза', 'БЦ «Пульс»', 'БЦ «Меридиан»', 'БЦ «Орбита»', 'БЦ «Гранит»'],
  hotel: ['Отель «Полярная»', 'Отель «Люмен»', 'Отель «Восход»', 'Отель «Бархат»', 'Гостиница «Причал»'],
  shop: ['Лавка «Всё и сразу»', 'Маркет «Байт»', 'Магазин «Сфера»', 'Лавка «Ретро»', 'Маркет «24/7»', 'Пластинки «Винил»', 'Ткани «Лён»'],
  cafe: ['Кафе «Полночь»', 'Кофейня «Зерно»', 'Кофейня «Пиксель»', 'Лапшичная «88»', 'Чайная «Туман»', 'Закусочная «Ночная смена»'],
  library: ['Центральная библиотека'],
  house: ['Дом', 'Коттедж', 'Особняк', 'Домик'],
  apartment: ['ЖК «Светлячок»', 'ЖК «Сосны»', 'ЖК «Тёплый квартал»', 'ЖК «Плющ»', 'ЖК «Рассвет»', 'ЖК «Аллея»'],
  park: ['Сквер Тишины', 'Ивовый сквер', 'Сад на углу', 'Сквер Мечтателей'],
  school: ['Школа №1'],
  factory: ['Завод «Сталь-Про»', 'Цех №3', 'Фабрика «Импульс»', 'Сборочный цех №4', 'Литейный цех', 'Завод «Север»'],
  warehouse: ['Склад', 'Логистический терминал', 'Хранилище', 'Ангар'],
  plant: ['ТЭЦ «Искра»'],
  unknown: ['Заброшенное здание', 'Старый корпус', 'Закрытый объект'],
}

const STREETS = ['Ивовая', 'Липовая', 'Тихая', 'Кленовая', 'Рассветная', 'Северная', 'Звёздная', 'Каменная', 'Медная', 'Портовая']

const DESCRIPTIONS: Record<ProceduralKind, string[]> = {
  tower: [
    'Стеклянный гигант, видимый из любой точки города. На верхних этажах арендуют офисы самые амбициозные жители.',
    'Небоскрёб с панорамным лобби и садом на крыше.',
  ],
  office: [
    'Здесь работают стартапы и небольшие студии. В будущем жители смогут арендовать здесь собственные офисы.',
    'Деловой центр с переговорными на каждом этаже. Говорят, на крыше есть закрытый клуб.',
  ],
  hotel: ['Гостиница для путешественников из других городов. Лобби работает круглосуточно.'],
  shop: [
    'Небольшой магазин на первом этаже. Скоро здесь появятся предметы, которые можно будет купить за внутреннюю валюту.',
    'Лавка, где продают всё — от лампочек до старых пластинок.',
  ],
  cafe: [
    'Уютное место, где жители встречаются после работы. В будущем владелец кафе сможет устраивать события.',
    'Кафе с панорамными окнами. Лучший кофе в районе — по мнению местных.',
  ],
  library: [
    'Хранилище истории города. Здесь будет записываться всё, что жители сделали для города.',
  ],
  house: [
    'Частный дом. Пока он свободен — в будущем здесь сможет поселиться новый житель.',
    'Небольшой дом с садом. Свет в окнах горит почти каждую ночь.',
  ],
  apartment: [
    'Многоквартирный дом с общим двором. Соседи здесь знают друг друга по именам.',
    'Современный жилой комплекс с детской площадкой и кофейней на первом этаже.',
  ],
  park: [
    'Зелёный островок посреди района. Такие парки будут появляться, когда жители коллективно поддержат район.',
  ],
  school: ['Школа района. Днём здесь шумно, вечером тихо горят окна учительской.'],
  factory: [
    'Производственный цех. Шум станков слышно за квартал.',
    'Завод, который производит материалы для строительства новых зданий города.',
  ],
  warehouse: ['Склад, где хранятся товары для магазинов города.', 'Логистический терминал, откуда грузы расходятся по районам.'],
  plant: ['Энергостанция, питающая весь город. Если она остановится — погаснет весь город.'],
  unknown: [
    'Никто не знает, что находится внутри. Двери заперты, окна заколочены. Возможно, однажды жители найдут ключ.',
    'Заброшенное здание без опознавательных знаков. Иногда по ночам изнутри доносится гул.',
  ],
}

const TAGS: Partial<Record<ProceduralKind, string[]>> = {
  tower: ['панорама', 'бизнес'],
  office: ['работа', 'аренда'],
  cafe: ['еда', 'встречи'],
  shop: ['торговля'],
  hotel: ['гости'],
  house: ['жильё', 'свободно'],
  apartment: ['жильё'],
  park: ['отдых', 'природа'],
  factory: ['производство'],
  warehouse: ['логистика'],
  unknown: ['секрет', 'тайна'],
}

/* ------------------------------------------------------------------ */
/* Landmarks: hand-authored buildings on specific lots                 */
/* ------------------------------------------------------------------ */

const LANDMARK_DEFS: Record<string, { kind: ProceduralKind; name: string; description?: string; color?: string; accent?: string; founded?: number; tags?: string[] }> = {
  plant: { kind: 'plant', name: 'ТЭЦ «Искра»', founded: 2008 },
  school: { kind: 'school', name: 'Школа №1', color: '#d9a27a' },
  midnight: {
    kind: 'cafe',
    name: 'Кафе «Полночь»',
    description: 'Открыто только ночью. Говорят, именно здесь родилась идея построить этот город.',
    tags: ['еда', 'встречи', 'легенда'],
  },
  'mystery-res': { kind: 'unknown', name: 'Старый дом на окраине', description: 'Старый дом на окраине. Все соседи делают вид, что его не существует.' },
  'mystery-ind': {
    kind: 'unknown',
    name: 'Склад №7',
    description: 'Склад, отмеченный на старых картах как «объект 7». Охраны нет, но войти не удалось никому.',
  },
}

/** What to build on an ordinary parcel, by zone and parcel size. */
function kindFor(p: Parcel, rng: Rng): ProceduralKind {
  const busy = PLAN.edges[p.edge].kind !== 'local'
  if (p.zone === 'industrial') {
    if (p.size === 'small') return rng.pick(['warehouse', 'shop', 'house'] as ProceduralKind[])
    return rng.chance(0.55) ? 'factory' : 'warehouse'
  }
  if (p.zone === 'downtown') {
    if (p.size === 'small') return busy ? rng.pick(['shop', 'cafe', 'office'] as ProceduralKind[]) : rng.pick(['shop', 'apartment', 'house'] as ProceduralKind[])
    if (p.size === 'medium') return rng.pick(['office', 'apartment', 'hotel', 'office'] as ProceduralKind[])
    return rng.chance(0.75) ? 'tower' : 'office'
  }
  if (p.size === 'small') return busy && rng.chance(0.3) ? rng.pick(['shop', 'cafe'] as ProceduralKind[]) : busy && rng.chance(0.35) ? 'apartment' : 'house'
  if (p.size === 'medium') return busy && rng.chance(0.2) ? 'shop' : 'apartment'
  return 'apartment'
}

function makeBuilding(rng: Rng, parcel: Parcel, kind: ProceduralKind, override: Partial<Building> = {}): Building {
  const rule = DISTRICT_RULES[parcel.zone]
  const kr = KIND_RULES[kind]
  // Fit the footprint inside the parcel with a little garden / yard around it.
  const maxW = Math.max(4, parcel.w - 2.2)
  const maxD = Math.max(4, parcel.d - 2.2)
  const big = kind === 'apartment' && parcel.size === 'large'
  const w = +Math.min(maxW, rng.range(kr.width[0], kr.width[1]) * (big ? 1.8 : 1)).toFixed(1)
  const d = +Math.min(maxD, rng.range(kr.depth[0], kr.depth[1]) * (big ? 1.5 : 1)).toFixed(1)
  const height = override.height ?? +rng.range(kr.height[0], kr.height[1]).toFixed(1)
  const floors = kind === 'park' ? 0 : Math.max(1, Math.round(height / 3.4))
  const capacity = kind === 'unknown' ? 0 : Math.max(4, Math.round((Math.max(floors, 1) * w * d * kr.density) / 10) * 2)
  const isLocked = kind === 'unknown'
  const status = override.status ?? (isLocked ? 'locked' : rng.chance(rule.closedChance) ? 'closed' : 'open')
  const occupancy = status === 'open' ? Math.round(capacity * rng.range(0.35, 0.96)) : status === 'closed' ? Math.round(capacity * 0.05) : 0
  let name = override.name ?? rng.pick(NAMES[kind])
  if (!override.name && (kind === 'house' || kind === 'warehouse')) name = `${name}, ул. ${rng.pick(STREETS)}, ${rng.int(1, 48)}`
  // Set the building towards the street, leaving a front yard.
  const shift = Math.max(0, (parcel.d - d) / 2 - 1.2)
  const ux = Math.sin(parcel.rot)
  const uz = Math.cos(parcel.rot)
  return {
    id: `b-${parcel.id}`,
    districtId: parcel.zone,
    kind,
    shape: kr.shape,
    name,
    description: override.description ?? rng.pick(DESCRIPTIONS[kind]),
    position: [+(parcel.c.x + ux * shift).toFixed(2), +(parcel.c.z + uz * shift).toFixed(2)],
    rotation: parcel.rot,
    parcel: parcel.id,
    size: [w, d],
    height,
    floors,
    occupancy,
    capacity,
    founded: override.founded ?? rng.int(rule.founded[0], rule.founded[1]),
    status,
    color: override.color ?? (isLocked ? '#6e5f55' : rng.pick(rule.walls)),
    accent: override.accent ?? (isLocked ? '#e0a33b' : rng.pick(rule.accents)),
    landmark: override.landmark ?? false,
    tags: override.tags ?? TAGS[kind] ?? [],
  }
}

/** Ordinary buildings and landmarks on the plan's parcels. */
function generateBuildings(): Building[] {
  const rng = createRng(4401)
  const out: Building[] = []
  for (const p of PLAN.parcels) {
    if (p.use === 'landmark' && p.landmark) {
      const def = LANDMARK_DEFS[p.landmark]
      const { kind, ...rest } = def
      out.push(makeBuilding(rng, p, kind, { ...rest, landmark: true }))
    } else if (p.use === 'building') {
      out.push(makeBuilding(rng, p, kindFor(p, rng)))
    }
  }
  return out
}

/** The full static city. Later: replaced by data fetched from the API. */
export const BUILDINGS: Building[] = generateBuildings()

export const BUILDING_BY_ID: Record<string, Building> = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]))

export const BUILDINGS_BY_DISTRICT = Object.fromEntries(
  DISTRICTS.map((d) => [d.id, BUILDINGS.filter((b) => b.districtId === d.id)]),
) as Record<DistrictId, Building[]>

/** The night cafe: used by the "go to the cafe" task when nobody else runs a business. */
export const MIDNIGHT_ID = BUILDINGS.find((b) => b.landmark && b.kind === 'cafe')?.id ?? ''
