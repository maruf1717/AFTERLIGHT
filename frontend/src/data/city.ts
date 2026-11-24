import { createRng, hashString, type Rng } from '../lib/random'
import { RESIDENTIAL_KINDS } from './kinds'
import type {
  Building,
  BuildingKind,
  BuildingShape,
  District,
  DistrictId,
  DistrictStats,
} from './types'

/** Size of one building lot and the street between lots, in world units (~metres). */
export const LOT = 9
export const STREET = 4
export const PITCH = LOT + STREET

export const DISTRICTS: District[] = [
  {
    id: 'residential',
    name: 'Residential',
    subtitle: 'Жилой район',
    description:
      'Тихие улицы, дома с тёплым светом в окнах и парки. Здесь живёт большинство жителей Afterlight. Сюда в будущем будут заселяться новые игроки.',
    color: '#fbbf24',
    origin: [-80, 0],
    grid: { cols: 5, rows: 5 },
  },
  {
    id: 'downtown',
    name: 'Downtown',
    subtitle: 'Центр города',
    description:
      'Неоновое сердце Afterlight: небоскрёбы, офисы, отели и ночные кафе. Здесь принимаются решения, которые меняют весь город.',
    color: '#22d3ee',
    origin: [0, 0],
    grid: { cols: 5, rows: 5 },
  },
  {
    id: 'industrial',
    name: 'Industrial',
    subtitle: 'Промзона',
    description:
      'Заводы, склады и энергостанция, которая питает весь город. Часть зданий заброшена, и никто толком не знает, что внутри.',
    color: '#f97316',
    origin: [80, 0],
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

const KIND_RULES: Record<BuildingKind, KindRule> = {
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
  kinds: [BuildingKind, number][]
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
    kinds: [['tower', 34], ['office', 28], ['hotel', 10], ['shop', 13], ['cafe', 15]],
    walls: ['#1e2a44', '#24304d', '#1a2238', '#2b2f4a', '#16203a', '#2a3656'],
    accents: ['#67e8f9', '#a5f3fc', '#c4b5fd', '#f0abfc', '#93c5fd'],
    founded: [2031, 2049],
    closedChance: 0.06,
    emptyChance: 0.04,
  },
  residential: {
    seed: 2203,
    kinds: [['house', 46], ['apartment', 28], ['shop', 9], ['cafe', 8], ['park', 9]],
    walls: ['#e7d7c1', '#d6b99a', '#c9a27e', '#e8c9a8', '#b98c6a', '#dcc6b0', '#a7b7c9'],
    accents: ['#fde68a', '#fcd34d', '#fdba74', '#fef3c7'],
    founded: [2024, 2046],
    closedChance: 0.05,
    emptyChance: 0.06,
  },
  industrial: {
    seed: 3307,
    kinds: [['factory', 40], ['warehouse', 46], ['unknown', 10]],
    walls: ['#5b5450', '#6b625a', '#4b4744', '#7a6d60', '#57534e', '#665a4e'],
    accents: ['#fb923c', '#fdba74', '#fca5a5', '#fde047'],
    founded: [2008, 2034],
    closedChance: 0.18,
    emptyChance: 0.08,
  },
}

/* ------------------------------------------------------------------ */
/* Names & descriptions                                                */
/* ------------------------------------------------------------------ */

const NAMES: Record<BuildingKind, string[]> = {
  tower: ['Neon Spire', 'Башня «Горизонт»', 'Vertex Tower', 'Башня «Призма»', 'Halo One', 'Skyline 9', 'Башня «Эхо»', 'Aurora Heights'],
  office: ['Бизнес-центр «Сигнал»', 'Nexus Offices', 'Квант-Плаза', 'Pulse Hub', 'БЦ «Меридиан»', 'Grid Works', 'Orbit House'],
  hotel: ['Отель «Полярная»', 'Lumen Hotel', 'Отель «Восход»', 'Nightfall Inn', 'Velvet Suites'],
  shop: ['Лавка «Всё и сразу»', 'Byte Market', 'Магазин «Сфера»', 'Retro Goods', 'Маркет «24/7»', 'Vinyl & Co', 'Ткани «Лён»'],
  cafe: ['Кафе «Полночь»', 'Glitch Coffee', 'Кофейня «Пиксель»', 'Noodle Bar 88', 'Чайная «Туман»', 'Late Shift Diner'],
  library: ['Центральная библиотека'],
  house: ['Дом', 'Коттедж', 'Особняк', 'Домик'],
  apartment: ['ЖК «Светлячок»', 'ЖК «Сосны»', 'ЖК «Тёплый квартал»', 'Ivy Residence', 'ЖК «Рассвет»', 'ЖК «Аллея»'],
  park: ['Сквер Тишины', 'Ивовый сквер', 'Сад на углу', 'Сквер Мечтателей'],
  school: ['Школа №1'],
  factory: ['Завод «Сталь-Про»', 'Цех №3', 'Фабрика «Импульс»', 'Assembly Line 4', 'Литейный цех', 'Завод «Север»'],
  warehouse: ['Склад', 'Логистический терминал', 'Хранилище', 'Ангар'],
  plant: ['ТЭЦ «Искра»'],
  unknown: ['???'],
}

const STREETS = ['Ивовая', 'Неоновая', 'Тихая', 'Кленовая', 'Рассветная', 'Северная', 'Звёздная', 'Каменная', 'Медная', 'Портовая']

const DESCRIPTIONS: Record<BuildingKind, string[]> = {
  tower: [
    'Стеклянный гигант, видимый из любой точки города. На верхних этажах арендуют офисы самые амбициозные жители.',
    'Небоскрёб с панорамным лобби. По ночам его фасад превращается в огромный световой экран.',
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
    'Хранилище истории Afterlight. Здесь будет записываться всё, что жители сделали для города.',
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
  plant: ['Энергостанция, питающая весь Afterlight. Если она остановится — погаснет весь город.'],
  unknown: [
    'Никто не знает, что находится внутри. Двери заперты, окна заколочены. Возможно, однажды жители найдут ключ.',
    'Заброшенное здание без опознавательных знаков. Иногда по ночам изнутри доносится гул.',
  ],
}

const TAGS: Partial<Record<BuildingKind, string[]>> = {
  tower: ['панорама', 'бизнес', 'неон'],
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

interface Landmark extends Partial<Omit<Building, 'id' | 'districtId' | 'position'>> {
  kind: BuildingKind
  lot: [col: number, row: number]
}

const LANDMARKS: Record<DistrictId, Landmark[]> = {
  downtown: [
    {
      lot: [2, 2],
      kind: 'tower',
      name: 'Шпиль Afterlight',
      height: 92,
      size: [8, 8],
      accent: '#5eead4',
      color: '#1b2a40',
      description:
        'Самое высокое здание города и его символ. Вершина Шпиля светится цветом, который отражает настроение всего города.',
      tags: ['символ города', 'панорама', 'неон'],
    },
    {
      lot: [0, 4],
      kind: 'library',
      name: 'Центральная библиотека',
      color: '#3b3552',
      accent: '#fcd34d',
      tags: ['история', 'знания'],
      founded: 2031,
    },
    {
      lot: [4, 0],
      kind: 'cafe',
      name: 'Кафе «Полночь»',
      accent: '#f0abfc',
      description: 'Открыто только ночью. Говорят, именно здесь родилась идея построить Afterlight.',
      tags: ['еда', 'встречи', 'легенда'],
    },
  ],
  residential: [
    {
      lot: [2, 2],
      kind: 'park',
      name: 'Парк Светлячков',
      description: 'Главный парк района. По вечерам здесь загораются тысячи маленьких огней.',
      tags: ['отдых', 'природа', 'события'],
    },
    { lot: [4, 3], kind: 'school', name: 'Школа №1', color: '#c98d6b', accent: '#fde68a' },
    {
      lot: [0, 0],
      kind: 'unknown',
      name: '???',
      description: 'Старый дом на окраине. Все соседи делают вид, что его не существует.',
    },
  ],
  industrial: [
    { lot: [2, 2], kind: 'plant', name: 'ТЭЦ «Искра»', founded: 2008 },
    {
      lot: [4, 4],
      kind: 'unknown',
      name: 'Склад №7',
      description:
        'Склад, отмеченный на старых картах как «объект 7». Охраны нет, но войти не удалось никому.',
    },
  ],
}

/* ------------------------------------------------------------------ */
/* Generator                                                           */
/* ------------------------------------------------------------------ */

function weightedPick(rng: Rng, items: [BuildingKind, number][]): BuildingKind {
  const total = items.reduce((s, [, w]) => s + w, 0)
  let r = rng.next() * total
  for (const [k, w] of items) {
    r -= w
    if (r <= 0) return k
  }
  return items[items.length - 1][0]
}

export function lotCenter(district: District, col: number, row: number): [number, number] {
  const { cols, rows } = district.grid
  return [
    district.origin[0] + (col - (cols - 1) / 2) * PITCH,
    district.origin[1] + (row - (rows - 1) / 2) * PITCH,
  ]
}

export function districtSize(district: District): [number, number] {
  return [district.grid.cols * PITCH + STREET, district.grid.rows * PITCH + STREET]
}

function makeBuilding(
  rng: Rng,
  district: District,
  rule: DistrictRule,
  kind: BuildingKind,
  col: number,
  row: number,
  override: Partial<Building> = {},
): Building {
  const kr = KIND_RULES[kind]
  const height = override.height ?? +rng.range(kr.height[0], kr.height[1]).toFixed(1)
  const size = override.size ?? [
    +rng.range(kr.width[0], kr.width[1]).toFixed(1),
    +rng.range(kr.depth[0], kr.depth[1]).toFixed(1),
  ]
  const floors = kind === 'park' ? 0 : Math.max(1, Math.round(height / 3.4))
  const footprint = size[0] * size[1]
  const capacity =
    kind === 'unknown' ? 0 : Math.max(4, Math.round((Math.max(floors, 1) * footprint * kr.density) / 10) * 2)
  const isLocked = kind === 'unknown'
  const status = override.status ?? (isLocked ? 'locked' : rng.chance(rule.closedChance) ? 'closed' : 'open')
  const occupancy =
    status === 'open' ? Math.round(capacity * rng.range(0.35, 0.96)) : status === 'closed' ? Math.round(capacity * 0.05) : 0

  let name = override.name ?? rng.pick(NAMES[kind])
  if (!override.name && (kind === 'house' || kind === 'warehouse')) {
    name = `${name}, ул. ${rng.pick(STREETS)}, ${rng.int(1, 48)}`
  }

  // Lots are jittered slightly so the grid doesn't look machine-perfect.
  const [cx, cz] = lotCenter(district, col, row)
  const slackX = Math.max(0, (LOT - size[0]) / 2)
  const slackZ = Math.max(0, (LOT - size[1]) / 2)

  return {
    id: `${district.id}-${col}-${row}`,
    districtId: district.id,
    kind,
    shape: KIND_RULES[kind].shape,
    name,
    description: override.description ?? rng.pick(DESCRIPTIONS[kind]),
    position: [+(cx + rng.range(-slackX, slackX)).toFixed(2), +(cz + rng.range(-slackZ, slackZ)).toFixed(2)],
    size,
    height,
    floors,
    occupancy,
    capacity,
    founded: override.founded ?? rng.int(rule.founded[0], rule.founded[1]),
    status,
    color: override.color ?? (isLocked ? '#1c1726' : rng.pick(rule.walls)),
    accent: override.accent ?? (isLocked ? '#a78bfa' : rng.pick(rule.accents)),
    landmark: override.landmark ?? false,
    tags: override.tags ?? TAGS[kind] ?? [],
  }
}

export function generateDistrictBuildings(district: District): Building[] {
  const rule = DISTRICT_RULES[district.id]
  const rng = createRng(rule.seed ^ hashString(district.id))
  const landmarks = new Map(LANDMARKS[district.id].map((l) => [`${l.lot[0]}:${l.lot[1]}`, l]))
  const out: Building[] = []

  for (let row = 0; row < district.grid.rows; row++) {
    for (let col = 0; col < district.grid.cols; col++) {
      const lm = landmarks.get(`${col}:${row}`)
      if (lm) {
        const { lot: _lot, kind, ...override } = lm
        out.push(makeBuilding(rng, district, rule, kind, col, row, { ...override, landmark: true }))
        continue
      }
      if (rng.chance(rule.emptyChance)) continue
      out.push(makeBuilding(rng, district, rule, weightedPick(rng, rule.kinds), col, row))
    }
  }
  return out
}

/** The full static city. Later: replaced by data fetched from the API. */
export const BUILDINGS: Building[] = DISTRICTS.flatMap(generateDistrictBuildings)

export const BUILDING_BY_ID: Record<string, Building> = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]))

export const BUILDINGS_BY_DISTRICT = Object.fromEntries(
  DISTRICTS.map((d) => [d.id, BUILDINGS.filter((b) => b.districtId === d.id)]),
) as Record<DistrictId, Building[]>

export function computeStats(buildings: Building[]): DistrictStats {
  let residents = 0
  let jobs = 0
  let occ = 0
  let cap = 0
  for (const b of buildings) {
    if (RESIDENTIAL_KINDS.has(b.kind)) residents += b.occupancy
    else jobs += b.occupancy
    occ += b.occupancy
    cap += b.capacity
  }
  return {
    buildings: buildings.length,
    open: buildings.filter((b) => b.status === 'open').length,
    locked: buildings.filter((b) => b.status === 'locked').length,
    residents,
    jobs,
    occupancyRate: cap ? occ / cap : 0,
  }
}
