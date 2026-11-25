/**
 * Everything the game is made of, as data: the city's needs, civic projects residents
 * fund together, business types, tasks and the default balance numbers. The admin panel
 * can override the balance numbers at runtime (see GameConfig).
 */

export type NeedId = 'power' | 'water' | 'housing' | 'jobs' | 'food' | 'health' | 'education' | 'safety' | 'leisure'

export interface NeedDef {
  id: NeedId
  label: string
  /** What runs short, in words people use. */
  short: string
  unit: string
  /** Demand per resident. */
  perResident: number
  /** Supply the city has from day one, before any building counts. */
  base: number
  /** What happens when it runs out (shown on the crisis card). */
  crisis: string
}

export const NEEDS: NeedDef[] = [
  { id: 'power', label: 'Электричество', short: 'тока', unit: 'кВт', perResident: 1, base: 0, crisis: 'Вечерами гаснет свет. Заведения работают вполсилы, люди уезжают.' },
  { id: 'water', label: 'Вода', short: 'воды', unit: 'м³', perResident: 1, base: 160, crisis: 'Перебои с водой. Растут болезни, семьи уезжают.' },
  { id: 'housing', label: 'Жильё', short: 'жилья', unit: 'мест', perResident: 1, base: 0, crisis: 'Новым жителям негде жить. Город перестаёт расти.' },
  { id: 'jobs', label: 'Работа', short: 'рабочих мест', unit: 'мест', perResident: 0.5, base: 0, crisis: 'Безработица. Люди уезжают искать работу в другие города.' },
  { id: 'food', label: 'Еда и магазины', short: 'магазинов', unit: 'чел.', perResident: 1, base: 40, crisis: 'Пустые полки. Цены растут, настроение падает.' },
  { id: 'health', label: 'Здоровье', short: 'врачей', unit: 'пациентов', perResident: 1, base: 0, crisis: 'Некому лечить. Каждый день город теряет жителей.' },
  { id: 'education', label: 'Образование', short: 'мест в школах', unit: 'учеников', perResident: 0.15, base: 0, crisis: 'Детям негде учиться. Семьи не переезжают в город.' },
  { id: 'safety', label: 'Безопасность', short: 'полиции', unit: 'чел.', perResident: 1, base: 300, crisis: 'Кражи и пожары. Бизнесы теряют выручку.' },
  { id: 'leisure', label: 'Отдых', short: 'парков', unit: 'чел.', perResident: 1, base: 150, crisis: 'Скучно и серо. Счастье медленно падает.' },
]

export const NEED_BY_ID = Object.fromEntries(NEEDS.map((n) => [n.id, n])) as Record<NeedId, NeedDef>

/** Coverage below this is a warning, below the second a crisis that drives people away. */
export const WARN_AT = 0.8
export const CRISIS_AT = 0.5

export type CivicVisual =
  | 'park'
  | 'clinic'
  | 'hospital'
  | 'water-tower'
  | 'police'
  | 'fire'
  | 'school'
  | 'library'
  | 'solar'
  | 'pump'
  | 'spire'
  | 'plant-repair'

export interface ProjectDef {
  id: string
  name: string
  /** The name after «под» / «открыть»: «водонапорную башню». */
  nameAcc: string
  description: string
  cost: number
  /** Minimum number of different residents who chipped in. */
  minDonors: number
  /** Population needed before the project opens. */
  minPopulation: number
  effects: Partial<Record<NeedId, number>>
  /** Lot key from RESERVED_LOTS, or null when it upgrades an existing building. */
  lot: string | null
  visual: CivicVisual
}

export const PROJECTS: ProjectDef[] = [
  {
    id: 'tec-repair',
    name: 'Ремонт ТЭЦ «Искра»',
    nameAcc: 'ремонт ТЭЦ «Искра»',
    description: 'Старая станция даёт меньше тока, чем нужно городу. Новые турбины закроют дефицит на первое время.',
    cost: 3000,
    minDonors: 2,
    minPopulation: 0,
    effects: { power: 120 },
    lot: null,
    visual: 'plant-repair',
  },
  {
    id: 'clinic',
    name: 'Поликлиника',
    nameAcc: 'поликлинику',
    description: 'В городе нет ни одного врача. Поликлиника закроет кризис со здоровьем.',
    cost: 5000,
    minDonors: 3,
    minPopulation: 0,
    effects: { health: 250, jobs: 40 },
    lot: 'res-clinic',
    visual: 'clinic',
  },
  {
    id: 'water-tower',
    name: 'Водонапорная башня',
    nameAcc: 'водонапорную башню',
    description: 'Без неё город упрётся в нехватку воды при 160 жителях.',
    cost: 2500,
    minDonors: 2,
    minPopulation: 0,
    effects: { water: 600 },
    lot: 'ind-water',
    visual: 'water-tower',
  },
  {
    id: 'park',
    name: 'Парк Светлячков',
    nameAcc: 'Парк Светлячков',
    description: 'Фонтан, беседка, деревья и скамейки в сердце микрорайона. Поднимает счастье.',
    cost: 4000,
    minDonors: 3,
    minPopulation: 0,
    effects: { leisure: 900 },
    lot: 'res-park',
    visual: 'park',
  },
  {
    id: 'playground',
    name: 'Детская площадка',
    nameAcc: 'детскую площадку',
    description: 'Горки, качели и песочница во дворе микрорайона. Небольшая, но дети и родители будут счастливее.',
    cost: 1500,
    minDonors: 2,
    minPopulation: 0,
    effects: { leisure: 150 },
    lot: 'res-playground',
    visual: 'park',
  },
  {
    id: 'police',
    name: 'Полицейский участок',
    nameAcc: 'полицейский участок',
    description: 'Участковый пункт перестанет справляться, когда жителей станет больше 300.',
    cost: 4500,
    minDonors: 3,
    minPopulation: 200,
    effects: { safety: 1800, jobs: 30 },
    lot: 'dt-police',
    visual: 'police',
  },
  {
    id: 'solar',
    name: 'Солнечная станция',
    nameAcc: 'солнечную станцию',
    description: 'Поле солнечных панелей на окраине промзоны. Даёт ток для следующего этапа роста.',
    cost: 8000,
    minDonors: 4,
    minPopulation: 250,
    effects: { power: 900, jobs: 15 },
    lot: 'ind-solar',
    visual: 'solar',
  },
  {
    id: 'library',
    name: 'Центральная библиотека',
    nameAcc: 'центральную библиотеку',
    description: 'Здесь будет храниться история города и лучшие работы жителей.',
    cost: 7000,
    minDonors: 4,
    minPopulation: 400,
    effects: { education: 150, leisure: 500, jobs: 20 },
    lot: 'dt-library',
    visual: 'library',
  },
  {
    id: 'school2',
    name: 'Новая школа',
    nameAcc: 'новую школу',
    description: 'Вторая школа в микрорайоне. Без неё семьи с детьми перестанут переезжать.',
    cost: 9000,
    minDonors: 5,
    minPopulation: 500,
    effects: { education: 400, jobs: 50 },
    lot: 'res-school',
    visual: 'school',
  },
  {
    id: 'fire',
    name: 'Пожарная часть',
    nameAcc: 'пожарную часть',
    description: 'Защищает центр от пожаров. Нужна, когда город переходит за 800 жителей.',
    cost: 6000,
    minDonors: 4,
    minPopulation: 600,
    effects: { safety: 2500, jobs: 30 },
    lot: 'dt-fire',
    visual: 'fire',
  },
  {
    id: 'pump',
    name: 'Насосная станция',
    nameAcc: 'насосную станцию',
    description: 'Большой водозабор и очистные сооружения. Без них не вырасти больше полутора тысяч жителей.',
    cost: 10000,
    minDonors: 5,
    minPopulation: 700,
    effects: { water: 3500, jobs: 25 },
    lot: 'ind-pump',
    visual: 'pump',
  },
  {
    id: 'hospital',
    name: 'Городская больница',
    nameAcc: 'городскую больницу',
    description: 'Настоящая больница с вертолётной площадкой. Закрывает здоровье для большого города.',
    cost: 20000,
    minDonors: 6,
    minPopulation: 450,
    effects: { health: 5000, jobs: 200 },
    lot: 'res-hospital',
    visual: 'hospital',
  },
  {
    id: 'spire',
    name: 'Шпиль Афтерлайт',
    nameAcc: 'Шпиль Афтерлайт',
    description: 'Символ города: 92 метра стекла и стали, обзорная площадка и офисы на 500 человек.',
    cost: 50000,
    minDonors: 10,
    minPopulation: 2000,
    effects: { leisure: 2500, jobs: 500 },
    lot: 'dt-spire',
    visual: 'spire',
  },
]

export const PROJECT_BY_ID = Object.fromEntries(PROJECTS.map((p) => [p.id, p])) as Record<string, ProjectDef>

/* ------------------------------------------------------------------ */
/* Player businesses                                                   */
/* ------------------------------------------------------------------ */

export type BusinessType = 'coffee' | 'restaurant' | 'diner' | 'store' | 'service'

export interface BusinessTypeDef {
  id: BusinessType
  label: string
  description: string
  openCost: number
  /** Running costs per real hour. */
  upkeep: number
  /** Average check at price levels 1..3. */
  check: [number, number, number]
  /** Guests per real hour in a settlement of 120 people at middle prices. */
  baseVisits: number
  /** How well the type fits each district. */
  fit: Record<'residential' | 'downtown' | 'industrial', number>
  effects: Partial<Record<NeedId, number>>
}

/*
 * Business economy (G2): a coffee shop in the microdistrict at middle prices earns about
 * 60 Искр an hour once the plant is repaired (with the owner's task bonus), ~1400 a day
 * when collected every 8 hours — about 1.8× all daily tasks together. See docs/BALANCE.md.
 */
export const BUSINESS_TYPES: BusinessTypeDef[] = [
  { id: 'coffee', label: 'Кофейня', description: 'Кофе и выпечка. Хорошо идёт в микрорайоне и в центре.', openCost: 1800, upkeep: 12, check: [6, 10, 16], baseVisits: 5, fit: { residential: 1, downtown: 1, industrial: 0.7 }, effects: { food: 80, jobs: 6 } },
  { id: 'diner', label: 'Закусочная', description: 'Быстро и сытно. Рабочие промзоны её обожают.', openCost: 1500, upkeep: 10, check: [5, 8, 12], baseVisits: 6, fit: { residential: 1, downtown: 0.9, industrial: 1.3 }, effects: { food: 120, jobs: 8 } },
  { id: 'restaurant', label: 'Ресторан', description: 'Дорого открыть, но чек большой. Лучше всего в центре с высокими ценами.', openCost: 6000, upkeep: 30, check: [14, 24, 40], baseVisits: 2.8, fit: { residential: 0.9, downtown: 1.2, industrial: 0.5 }, effects: { food: 100, jobs: 15, leisure: 60 } },
  { id: 'store', label: 'Магазин', description: 'Продукты и мелочи. Больше всех закрывает потребность города в еде.', openCost: 3500, upkeep: 14, check: [7, 11, 18], baseVisits: 4.6, fit: { residential: 1.1, downtown: 1, industrial: 0.8 }, effects: { food: 220, jobs: 10 } },
  { id: 'service', label: 'Автосервис', description: 'Ремонт машин. Окупается только в промзоне.', openCost: 4500, upkeep: 18, check: [20, 35, 55], baseVisits: 1.5, fit: { residential: 0.6, downtown: 0.6, industrial: 1.6 }, effects: { jobs: 12 } },
]

/**
 * Guests at each price level, by district (G6): the best price depends on where you are.
 * Microdistrict: low or middle prices; downtown: middle or high; industrial zone: low.
 */
export const PRICE_VISITS: Record<'residential' | 'downtown' | 'industrial', [number, number, number]> = {
  residential: [1.35, 1, 0.55],
  downtown: [1.15, 1, 0.8],
  industrial: [1.7, 0.95, 0.5],
}
/** Each business with high prices takes 1 % off the city's happiness (at most 5 %). */
export const HIGH_PRICE_UNHAPPY = 1
export const HIGH_PRICE_UNHAPPY_MAX = 5
/** Takings grow with the city, but slowly (×1 at 120 residents, at most ×1.6). */
export const growthFactor = (population: number) => Math.min(1.6, Math.sqrt(Math.sqrt(Math.max(1, population) / 120)))
/** Extra takings on a task day when the owner completed at least this many tasks. */
export const ACTIVE_OWNER_TASKS = 3
export const ACTIVE_OWNER_BONUS = 0.5
/** Round 2, 2.2: a resident's second business earns 80 % of its takings, the third 60 %. */
export const BUSINESS_RANK_SHARE = [1, 0.8, 0.6]
/** Opening up to this many businesses; the third one only from this city level. */
export const BUSINESS_SLOTS = 3
export const THIRD_BUSINESS_LEVEL = 1
/** Selling a business returns this share of what was put into it. */
export const SELL_SHARE = 0.5

/* ------------------------------------------------------------------ */
/* Building by residents (G1)                                          */
/* ------------------------------------------------------------------ */

export type PlayerBuildingId = 'house' | 'lowrise' | 'shop' | 'office' | 'workshop'

export interface PlayerBuildingDef {
  id: PlayerBuildingId
  label: string
  description: string
  cost: number
  /** City days the building site takes. */
  days: number
  /** Districts where it may be built. */
  zones: ('residential' | 'downtown' | 'industrial')[]
  /** Smallest plot that fits it (m²). */
  minArea: number
  effects: Partial<Record<NeedId, number>>
  /** Rent the owner collects, per real hour. */
  rent: number
  height: number
}

export const PLAYER_BUILDINGS: PlayerBuildingDef[] = [
  { id: 'house', label: 'Частный дом', description: 'Дом на большую семью. +12 мест жилья.', cost: 700, days: 2, zones: ['residential', 'downtown'], minArea: 50, effects: { housing: 12 }, rent: 0, height: 5 },
  { id: 'lowrise', label: 'Малоэтажка', description: 'Трёхэтажный дом на несколько семей. +40 мест жилья.', cost: 4000, days: 4, zones: ['residential', 'downtown'], minArea: 80, effects: { housing: 40 }, rent: 0, height: 10 },
  { id: 'shop', label: 'Магазин у дома', description: 'Продукты рядом с домом. Еда для 150 жителей и 8 рабочих мест.', cost: 2500, days: 3, zones: ['residential', 'downtown', 'industrial'], minArea: 60, effects: { food: 150, jobs: 8 }, rent: 0, height: 4.5 },
  { id: 'office', label: 'Офис', description: 'Небольшой офисный центр. 60 рабочих мест.', cost: 5000, days: 4, zones: ['downtown', 'residential'], minArea: 90, effects: { jobs: 60 }, rent: 0, height: 13 },
  { id: 'workshop', label: 'Мастерская', description: 'Цех для ремонта и мелкого производства. 40 рабочих мест.', cost: 3000, days: 3, zones: ['industrial'], minArea: 80, effects: { jobs: 40 }, rent: 0, height: 7 },
]

export const PLAYER_BUILDING_BY_ID = Object.fromEntries(PLAYER_BUILDINGS.map((b) => [b.id, b])) as Record<PlayerBuildingId, PlayerBuildingDef>

/** Plot price per m², by district. */
/**
 * Rent (round 2, 2.1): a building earns from what is really used in it — 1.3 Искры an hour
 * per resident living there, 1.1 per job taken, 0.2 per meal sold. With the city full, a
 * low-rise brings 52 an hour and pays back (plot + building) in about four days.
 */
export const RENT_PER: Partial<Record<NeedId, number>> = { housing: 1.3, jobs: 1.1, food: 0.2 }
/** Rent an hour when everything in the building is used. */
export const fullRent = (effects: Partial<Record<NeedId, number>>) =>
  Object.entries(effects).reduce((s, [k, v]) => s + (v ?? 0) * (RENT_PER[k as NeedId] ?? 0), 0)
for (const b of PLAYER_BUILDINGS) b.rent = Math.round(fullRent(b.effects))

export const LOT_PRICE_M2: Record<'residential' | 'downtown' | 'industrial', number> = { residential: 8, downtown: 14, industrial: 6 }
export const lotPrice = (zone: 'residential' | 'downtown' | 'industrial', area: number) => Math.round((LOT_PRICE_M2[zone] * area) / 10) * 10
/** Finishing a building site at once costs this share of the building price for the days left. */
export const RUSH_SHARE = 0.5

export const BUSINESS_TYPE_BY_ID = Object.fromEntries(BUSINESS_TYPES.map((b) => [b.id, b])) as Record<BusinessType, BusinessTypeDef>

export type UpgradeId = 'terrace' | 'parking' | 'drivethru' | 'greenery'

export const UPGRADES: { id: UpgradeId; label: string; description: string; cost: number; bonus: number }[] = [
  { id: 'terrace', label: 'Летняя терраса', description: 'Столики с зонтами на улице. +15% гостей.', cost: 1500, bonus: 0.15 },
  { id: 'parking', label: 'Парковка', description: 'Люди приезжают даже издалека. +20% гостей.', cost: 2000, bonus: 0.2 },
  { id: 'drivethru', label: 'Окно выдачи для машин', description: 'Можно забрать заказ, не выходя из машины. +15% гостей.', cost: 2500, bonus: 0.15 },
  { id: 'greenery', label: 'Озеленение', description: 'Кусты, цветы и деревья у входа. +8% гостей.', cost: 800, bonus: 0.08 },
]

export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u])) as Record<UpgradeId, (typeof UPGRADES)[number]>

export const BUSINESS_COLORS = ['#b6463a', '#2f6f6a', '#c58a2a', '#3d5a99', '#7a4b8c', '#2e2e2e', '#e8e2d4', '#5b7f3a']

/* ------------------------------------------------------------------ */
/* Tasks                                                               */
/* ------------------------------------------------------------------ */

export type DailyTaskId = 'wires' | 'delivery' | 'survey' | 'patrol' | 'reviews'

export const DAILY_TASKS: { id: DailyTaskId; title: string; text: string; reward: number }[] = [
  { id: 'wires', title: 'Почини проводку на ТЭЦ', text: 'Соедини провода одного цвета. Без этого станция работает с перебоями.', reward: 180 },
  { id: 'delivery', title: 'Доставь посылку', text: 'Найди нужное здание на карте и нажми на него.', reward: 240 },
  { id: 'survey', title: 'Опрос горожан', text: 'Ответь на вопрос мэрии. Результаты видят все.', reward: 90 },
  { id: 'patrol', title: 'Обход района', text: 'Найди на карте и нажми на пять разных зданий в любом районе.', reward: 150 },
  { id: 'reviews', title: 'Оцени заведение', text: 'Поставь оценку бизнесу другого жителя.', reward: 120 },
]

export interface CreativeTask {
  id: string
  title: string
  text: string
  kind: 'text' | 'drawing'
}

export const DEFAULT_CREATIVE: CreativeTask[] = [
  { id: 'c-cat', title: 'Кот на крыше ТЭЦ', text: 'Нарисуй кота, который живёт на крыше ТЭЦ и следит за городом.', kind: 'drawing' },
  { id: 'c-window', title: 'Одно окно', text: 'Продолжи историю: «В ту ночь свет погас во всём городе, кроме одного окна…»', kind: 'text' },
  { id: 'c-square', title: 'Имя для площади', text: 'Придумай название и короткую легенду для новой площади в центре.', kind: 'text' },
  { id: 'c-sign', title: 'Вывеска мечты', text: 'Нарисуй вывеску для заведения, которое ты открыл бы в этом городе.', kind: 'drawing' },
]

export const SURVEY_QUESTIONS = [
  { q: 'Что городу нужнее всего прямо сейчас?', options: ['Больница', 'Парк', 'Новая электростанция'] },
  { q: 'Как назвать реку, которая течёт через город?', options: ['Светлая', 'Тихая', 'Искрянка'] },
  { q: 'Где открыть следующий рынок?', options: ['Жилой квартал', 'Центр', 'У реки'] },
  { q: 'Что добавить в парк?', options: ['Сцену для концертов', 'Каток', 'Сад скульптур'] },
]

/* ------------------------------------------------------------------ */
/* Balance (editable in the admin panel)                               */
/* ------------------------------------------------------------------ */

export interface GameConfig {
  /** When the city was founded (ms). Changing it restarts the simulation. */
  startedAt: number
  /** How many real minutes one city day lasts. */
  dayMinutes: number
  /** Day length changes: each applies from its moment on, so past days keep their length. */
  dayPeriods?: { from: number; minutes: number }[]
  /** Test only (one-player mode or a local game): how far the game clock is moved forward. */
  timeOffsetMs?: number
  startPopulation: number
  /** Base newcomers per day with nobody playing. */
  baseInflow: number
  /** Newcomers per day per active resident. */
  perActive: number
  /** Share of residents who leave per day for each crisis. */
  crisisOutflow: number
  /** Most a resident may donate per real day. */
  dailyDonationLimit: number
  /** Require several different donors for projects. */
  requireDonors: boolean
  /** Testing alone: every rule that needs other people is switched off. */
  soloMode: boolean
  /** Reputation needed to open a business. */
  businessRep: number
  /** Reward for a creative task per rating point. */
  creativePerStar: number
  creativeTasks: CreativeTask[]
}

export const DEFAULT_CONFIG: Omit<GameConfig, 'startedAt'> = {
  dayMinutes: 15,
  startPopulation: 120,
  baseInflow: 2,
  perActive: 4,
  crisisOutflow: 0.015,
  dailyDonationLimit: 5000,
  requireDonors: true,
  soloMode: true,
  businessRep: 3,
  creativePerStar: 60,
  creativeTasks: DEFAULT_CREATIVE,
}

/* ------------------------------------------------------------------ */
/* Rules of the ledger (not editable: changing them rewrites history)  */
/* ------------------------------------------------------------------ */

/** What a new resident starts with. */
export const START_BALANCE = 1500
/** Task days follow one clock for everyone: midnight in Tashkent (UTC+5). */
export const TASK_TZ_OFFSET_MS = 5 * 3600_000
export const REAL_DAY_MS = 24 * 3600_000
/** Entries stamped further ahead than this of the known server time are ignored. */
export const FUTURE_TOLERANCE_MS = 10 * 60_000
/** A till (business or rent) keeps at most this many real hours of takings. */
export const CASH_CAP_HOURS = 12
/** A donor counts towards «several participants» from this much: 5 % of the cost or 200 Искр. */
export const donorThreshold = (cost: number) => Math.min(200, Math.round(cost * 0.05))
/** Wires solved this fast (seconds) pay 20 % more. */
export const WIRES_FAST_S = 10
export const WIRES_FAST_BONUS = 0.2
/** Logging in this many task days in a row pays the streak reward. */
export const STREAK_DAYS = 7
export const STREAK_REWARD = 500
/** The Warehouse No. 7 event: open every second task day, one parcel per resident. */
export const EVENT_REWARD = 300
/** Round 2, 3.4: three boxes opened, the parcel not among them — a little for trying. */
export const EVENT_CONSOLATION = 50
export const EVENT_BOXES = 6
export const EVENT_TRIES = 3
/** The attic of the old house on the outskirts (odd days). */
export const ATTIC_REWARD = 200
/** Distinct buildings to open for the patrol task. */
export const PATROL_COUNT = 5
/** Reputation for completing a task, and for a donation at least this big. */
export const REP_PER_TASK = 1
export const REP_DONATION_FROM = 500

/** Allowed ranges for the numbers the owner can change. */
export const CONFIG_LIMITS: Partial<Record<keyof GameConfig, { min: number; max: number; integer?: boolean }>> = {
  dayMinutes: { min: 1, max: 1440, integer: true },
  baseInflow: { min: 0, max: 100 },
  perActive: { min: 0, max: 100 },
  crisisOutflow: { min: 0, max: 0.2 },
  dailyDonationLimit: { min: 0, max: 1_000_000, integer: true },
  businessRep: { min: 0, max: 100, integer: true },
  creativePerStar: { min: 0, max: 10_000, integer: true },
}

/** Why a value can't be saved, or null when it is fine. */
export function configError(key: keyof GameConfig, raw: string | number): string | null {
  const lim = CONFIG_LIMITS[key]
  if (!lim) return null
  if (typeof raw === 'string' && raw.trim() === '') return 'Впиши число'
  const v = Number(raw)
  if (!Number.isFinite(v)) return 'Впиши число'
  if (lim.integer && !Number.isInteger(v)) return 'Нужно целое число'
  if (v < lim.min || v > lim.max) return `От ${lim.min} до ${lim.max.toLocaleString('ru-RU')}`
  return null
}

/** First steps for a new resident: each one pays a small reward (worked out by the engine). */
export const TUTORIAL = [
  { id: 'wires', title: 'Выполни первое задание', hint: 'Задания → любое задание', reward: 50 },
  { id: 'clinic', title: 'Вложи в поликлинику', hint: 'Проекты → «Поликлиника»', reward: 50 },
  { id: 'business', title: 'Открой своё заведение', hint: 'Бизнес → выбери тип и участок', reward: 100 },
  { id: 'collect', title: 'Собери первую выручку', hint: 'Бизнес → «Собрать»', reward: 100 },
] as const

/** Long-term goals (G16): each pays once, the moment it is reached. */
export const ACHIEVEMENTS = [
  { id: 'first-task', title: 'Первое задание', text: 'Выполни любое ежедневное задание.', reward: 100 },
  { id: 'all-tasks', title: 'Полный день', text: 'Выполни все 5 заданий за один день.', reward: 200 },
  { id: 'first-donation', title: 'Первый взнос', text: 'Вложи Искры в любой проект.', reward: 100 },
  { id: 'patron', title: 'Меценат', text: 'Вложи в проекты 5 000 Искр.', reward: 300 },
  { id: 'first-business', title: 'Своё дело', text: 'Открой своё заведение.', reward: 200 },
  { id: 'first-collect', title: 'Первая выручка', text: 'Собери выручку своего заведения.', reward: 100 },
  { id: 'first-lot', title: 'Землевладелец', text: 'Купи участок под застройку.', reward: 100 },
  { id: 'first-building', title: 'Строитель', text: 'Дострой своё здание.', reward: 200 },
  { id: 'city-400', title: 'Городок', text: 'Город дорос до 400 жителей, пока ты в нём живёшь.', reward: 300 },
  { id: 'streak-7', title: 'Неделя в городе', text: 'Заходи в игру 7 дней подряд.', reward: 300 },
] as const
export type AchievementId = (typeof ACHIEVEMENTS)[number]['id']

/** Upgrades that need room around the building: not on a small plot. */
export const ROOMY_UPGRADES: UpgradeId[] = ['terrace', 'parking']
/** Plots smaller than this (m²) are small. */
export const SMALL_PLOT_AREA = 90

/** The city's calendar: the year it was founded. One year is 365 city days. */
export const FOUNDING_YEAR = 2026
export const yearOfDay = (day: number) => FOUNDING_YEAR + Math.floor(Math.max(0, day) / 365)

export const LEVELS = [
  { name: 'Посёлок', from: 0 },
  { name: 'Городок', from: 400 },
  { name: 'Город', from: 800 },
  { name: 'Большой город', from: 1600 },
]

export function levelFor(pop: number) {
  let idx = 0
  LEVELS.forEach((l, i) => {
    if (pop >= l.from) idx = i
  })
  return { ...LEVELS[idx], index: idx, next: LEVELS[idx + 1] ?? null }
}

export const CURRENCY = 'Искры'
