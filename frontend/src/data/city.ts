import { PARCEL_BY_ID, PLAN, STARTER_IDS, STARTER_PARCELS } from '../city/plan'
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
  plant: { shape: 'plant', height: [24, 24], width: [16, 16], depth: [14, 14], density: 0.05 },
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
    founded: [1972, 2010],
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
    founded: [1960, 1995],
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
    founded: [1965, 2005],
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

const STREETS = ['Ивовая', 'Липовая', 'Тихая', 'Кленовая', 'Рассветная', 'Северная', 'Звёздная', 'Каменная', 'Медная', 'Портовая', 'Садовая', 'Луговая', 'Зелёная', 'Школьная', 'Заводская', 'Огородная']

/** The street a parcel faces: one name per road. */
const streetOf = (parcel: Parcel) => STREETS[parcel.edge % STREETS.length]

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

const LANDMARK_DEFS: Record<string, { kind: ProceduralKind; name: string; description?: string; color?: string; accent?: string; founded?: number; tags?: string[]; height?: number }> = {
  plant: { kind: 'plant', name: 'ТЭЦ «Искра»', founded: 1978 },
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
    height: 7,
    color: '#8d8f8c',
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

/** Height of one row of windows on each kind's facade (glass 3.4, punched 3.2, strip 4.5, shopfront 4). */
const FLOOR_HEIGHT: Record<ProceduralKind, number> = {
  tower: 3.4,
  office: 3.4,
  hotel: 3.4,
  apartment: 3.2,
  library: 3.2,
  school: 3.2,
  house: 3.2,
  unknown: 3.2,
  shop: 4,
  cafe: 4,
  warehouse: 4.5,
  factory: 4.5,
  plant: 4.5,
  park: 1,
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
  // Floors are counted the way the facade draws its rows of windows (see CELL_SIZE in facade.ts).
  const floors = kind === 'park' ? 0 : kind === 'plant' ? 2 : Math.max(1, Math.round(height / FLOOR_HEIGHT[kind]))
  const capacity = kind === 'unknown' ? 0 : Math.max(4, Math.round((Math.max(floors, 1) * w * d * kr.density) / 10) * 2)
  const isLocked = kind === 'unknown'
  // The draw is kept so the rest of the city stays the same; the status itself comes from the simulation.
  void rng.chance(rule.closedChance)
  const status = override.status ?? (isLocked ? 'locked' : 'open')
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

/**
 * The starting settlement: low and old. Five-storeys and private houses in the
 * microdistrict, two-to-four-storey shops and offices downtown, old warehouses and garages
 * by the plant. Uses its own random stream, so the rest of the city stays the same.
 */
function starterBuilding(p: Parcel, i: number, base: Building, rng: Rng): Building {
  const year = rng.int(1962, 1998)
  const street = streetOf(p)
  if (p.zone === 'residential') {
    // The three largest plots of the settlement hold the old five-storeys.
    const byArea = [...STARTER_PARCELS.residential].sort((a, b) => b.w * b.d - a.w * a.d)
    const big = byArea.indexOf(p) < 3
    const kind: ProceduralKind = big ? 'apartment' : 'house'
    const b = makeBuilding(rng, p, kind, big ? { height: 16, founded: year } : { height: 4.6, founded: year })
    return {
      ...b,
      id: base.id,
      name: big ? `Пятиэтажка, ул. ${street}, ${i + 3}` : `Частный дом, ул. ${street}, ${i + 11}`,
      description: big ? 'Старая пятиэтажка из первых домов посёлка. Во дворе сохнет бельё и стоит турник.' : 'Частный дом с огородом. Здесь живут с тех пор, как посёлок только появился.',
      housing: big ? 45 : 10,
      starter: true,
    }
  }
  if (p.zone === 'downtown') {
    const plan: [ProceduralKind, string, string][] = [
      ['office', 'Администрация посёлка', 'Здесь решают, где класть асфальт и когда чинить фонари.'],
      ['shop', 'Почта', 'Письма, посылки и пенсии. По утрам очередь до дверей.'],
      ['shop', 'Универмаг «Центральный»', 'Всё для дома и немного для души. Работает с 1974 года.'],
      ['shop', 'Аптека', 'Небольшая аптека на первом этаже.'],
      ['office', 'Дом быта', 'Ремонт обуви, ателье и фотостудия под одной крышей.'],
      ['shop', 'Гастроном «Угловой»', 'Хлеб, молоко и свежие новости от продавщицы.'],
      ['apartment', 'Дом с магазином', 'Трёхэтажный дом: внизу магазин, наверху квартиры.'],
    ]
    const [kind, name, description] = plan[i % plan.length]
    const b = makeBuilding(rng, p, kind, { height: +rng.range(6.5, 12.5).toFixed(1), founded: year })
    return { ...b, id: base.id, name, description, starter: true, ...(kind === 'apartment' ? { housing: 20 } : {}) }
  }
  const garages = i === 2
  const b = makeBuilding(rng, p, 'warehouse', { height: garages ? 3.2 : 7, founded: year })
  return {
    ...b,
    id: base.id,
    name: garages ? 'Гаражный кооператив' : `Старый склад №${i + 2}`,
    description: garages ? 'Ряд кирпичных гаражей. По выходным здесь чинят машины всем посёлком.' : 'Старый склад у ТЭЦ. Хранит уголь и запчасти для станции.',
    starter: true,
  }
}

/** Ordinary buildings and landmarks on the plan's parcels. */
function generateBuildings(): Building[] {
  const rng = createRng(4401)
  const starterRng = createRng(1962)
  const out: Building[] = []
  for (const p of PLAN.parcels) {
    if (STARTER_IDS.has(p.id)) {
      // Keep the main stream unchanged: draw the ordinary building, then replace it.
      const base = makeBuilding(rng, p, kindFor(p, rng))
      const list = STARTER_PARCELS[p.zone]
      out.push(starterBuilding(p, list.indexOf(p), base, starterRng))
    } else if (p.use === 'landmark' && p.landmark) {
      const def = LANDMARK_DEFS[p.landmark]
      const { kind, ...rest } = def
      out.push(makeBuilding(rng, p, kind, { ...rest, landmark: true }))
    } else if (p.use === 'building') {
      out.push(makeBuilding(rng, p, kindFor(p, rng)))
    }
  }
  return out
}

/**
 * Every building gets a unique name: when a name repeats (or for plain houses and
 * warehouses) the address is added — «ЖК «Плющ», ул. Медная, 12».
 */
function uniqueNames(list: Building[]): Building[] {
  const count = new Map<string, number>()
  for (const b of list) count.set(b.name, (count.get(b.name) ?? 0) + 1)
  const houseNo = new Map<string, number>()
  const used = new Set<string>()
  const sorted = [...list].sort((a, b) => (PARCEL_BY_ID[a.parcel!]?.order ?? 0) - (PARCEL_BY_ID[b.parcel!]?.order ?? 0))
  const rename = new Map<string, string>()
  for (const b of sorted) {
    const base = b.name.split(', ул.')[0]
    const plain = b.kind === 'house' || b.kind === 'warehouse'
    let name = base
    if (plain || (count.get(b.name) ?? 0) > 1 || used.has(name)) {
      const parcel = b.parcel ? PARCEL_BY_ID[b.parcel] : undefined
      const street = parcel ? streetOf(parcel) : STREETS[0]
      do {
        const n = (houseNo.get(street) ?? 0) + 1
        houseNo.set(street, n)
        name = `${base}, ул. ${street}, ${n}`
      } while (used.has(name))
    }
    used.add(name)
    rename.set(b.id, name)
  }
  return list.map((b) => ({ ...b, name: rename.get(b.id) ?? b.name }))
}

/** The full static city. Later: replaced by data fetched from the API. */
export const BUILDINGS: Building[] = uniqueNames(generateBuildings())

export const BUILDING_BY_ID: Record<string, Building> = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]))

export const BUILDINGS_BY_DISTRICT = Object.fromEntries(
  DISTRICTS.map((d) => [d.id, BUILDINGS.filter((b) => b.districtId === d.id)]),
) as Record<DistrictId, Building[]>

/** The night cafe: used by the "go to the cafe" task when nobody else runs a business. */
export const MIDNIGHT_ID = BUILDINGS.find((b) => b.landmark && b.kind === 'cafe')?.id ?? ''

/**
 * What a district looks like right now: only what is really there. Lines about the clinic,
 * the park or the workers' homes appear once they are built.
 */
export function districtDescription(id: DistrictId, built: Set<string>, done: (projectId: string) => boolean): string {
  const has = (kinds: string[]) => BUILDINGS.some((b) => b.districtId === id && built.has(b.id) && kinds.includes(b.kind))
  if (id === 'industrial') {
    let t = 'Западный край города: заводы, склады и ТЭЦ «Искра», которая питает весь город.'
    if (has(['house', 'apartment', 'shop'])) t += ' Между цехами стоят дома рабочих и магазины.'
    if (done('water-tower')) t += ' Над промзоной поднялась водонапорная башня.'
    return t
  }
  if (id === 'downtown') {
    let t = 'Сердце города, где растут офисы и магазины.'
    if (has(['tower'])) t += ' Небоскрёбы стоят вперемешку с жилыми домами и кафе.'
    if (done('police')) t += ' Здесь работает полицейский участок.'
    return t
  }
  let t = 'Восточный микрорайон, где живёт большинство горожан: дома с дворами и школа.'
  if (done('clinic')) t += ' Есть поликлиника.'
  if (done('park')) t += ' В парке Светлячков стоит беседка.'
  return t
}
