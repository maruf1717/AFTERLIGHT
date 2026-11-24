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
    description: 'Старая станция даёт меньше тока, чем нужно городу. Новые турбины закроют дефицит на первое время.',
    cost: 3000,
    minDonors: 2,
    minPopulation: 0,
    effects: { power: 170 },
    lot: null,
    visual: 'plant-repair',
  },
  {
    id: 'clinic',
    name: 'Поликлиника',
    description: 'В городе нет ни одного врача. Поликлиника закроет кризис со здоровьем.',
    cost: 5000,
    minDonors: 3,
    minPopulation: 0,
    effects: { health: 700, jobs: 40 },
    lot: 'res-clinic',
    visual: 'clinic',
  },
  {
    id: 'water-tower',
    name: 'Водонапорная башня',
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
    description: 'Фонтан, беседка, деревья и скамейки в сердце микрорайона. Поднимает счастье.',
    cost: 4000,
    minDonors: 3,
    minPopulation: 150,
    effects: { leisure: 900 },
    lot: 'res-park',
    visual: 'park',
  },
  {
    id: 'police',
    name: 'Полицейский участок',
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
    description: 'Настоящая больница с вертолётной площадкой. Закрывает здоровье для большого города.',
    cost: 20000,
    minDonors: 6,
    minPopulation: 1000,
    effects: { health: 5000, jobs: 200 },
    lot: 'res-hospital',
    visual: 'hospital',
  },
  {
    id: 'spire',
    name: 'Шпиль Афтерлайт',
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
  upkeep: number
  /** Average check at price levels 1..3. */
  check: [number, number, number]
  baseVisits: number
  effects: Partial<Record<NeedId, number>>
}

export const BUSINESS_TYPES: BusinessTypeDef[] = [
  { id: 'coffee', label: 'Кофейня', description: 'Кофе и выпечка. Лучше всего рядом с домами и офисами.', openCost: 2500, upkeep: 60, check: [6, 10, 16], baseVisits: 1.0, effects: { food: 80, jobs: 6 } },
  { id: 'diner', label: 'Закусочная', description: 'Быстро и сытно. Рабочие промзоны её обожают.', openCost: 2000, upkeep: 50, check: [5, 8, 12], baseVisits: 1.1, effects: { food: 120, jobs: 8 } },
  { id: 'restaurant', label: 'Ресторан', description: 'Дорого, но и чек большой. Нужен богатый район.', openCost: 6000, upkeep: 150, check: [14, 24, 40], baseVisits: 0.6, effects: { food: 100, jobs: 15, leisure: 60 } },
  { id: 'store', label: 'Магазин', description: 'Продукты и мелочи. Закрывает потребность в еде.', openCost: 3500, upkeep: 80, check: [7, 11, 18], baseVisits: 0.9, effects: { food: 200, jobs: 10 } },
  { id: 'service', label: 'Автосервис', description: 'Ремонт машин. Хорошо идёт в промзоне.', openCost: 4500, upkeep: 90, check: [20, 35, 55], baseVisits: 0.35, effects: { jobs: 12 } },
]

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
  { id: 'wires', title: 'Почини проводку на ТЭЦ', text: 'Соедини провода одного цвета. Без этого станция работает с перебоями.', reward: 60 },
  { id: 'delivery', title: 'Доставь посылку', text: 'Найди нужное здание на карте и нажми на него.', reward: 80 },
  { id: 'survey', title: 'Опрос горожан', text: 'Ответь на вопрос мэрии. Результаты видят все.', reward: 30 },
  { id: 'patrol', title: 'Обход района', text: 'Открой карточки пяти разных зданий в любом районе.', reward: 50 },
  { id: 'reviews', title: 'Оцени заведение', text: 'Поставь оценку бизнесу другого жителя.', reward: 40 },
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

export const LEVELS = [
  { name: 'Посёлок', from: 0 },
  { name: 'Городок', from: 600 },
  { name: 'Город', from: 2500 },
  { name: 'Большой город', from: 6000 },
]

export function levelFor(pop: number) {
  let idx = 0
  LEVELS.forEach((l, i) => {
    if (pop >= l.from) idx = i
  })
  return { ...LEVELS[idx], index: idx, next: LEVELS[idx + 1] ?? null }
}

export const CURRENCY = 'Искры'
