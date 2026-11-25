import { PARCEL_BY_ID, stageFor } from '../city/plan'
import { BUILDINGS } from '../data/city'
import { RESERVED_BY_KEY } from '../data/lots'
import type { Building } from '../data/types'
import { hashString } from '../lib/random'
import {
  BUSINESS_COLORS,
  BUSINESS_TYPE_BY_ID,
  CASH_CAP_DAYS,
  CRISIS_AT,
  DAILY_TASKS,
  FUTURE_TOLERANCE_MS,
  levelFor,
  MAX_BUSINESSES,
  NEEDS,
  PATROL_COUNT,
  PROJECT_BY_ID,
  PROJECTS,
  REAL_DAY_MS,
  REP_DONATION_FROM,
  REP_PER_TASK,
  ROOMY_UPGRADES,
  SMALL_PLOT_AREA,
  START_BALANCE,
  TUTORIAL,
  SURVEY_QUESTIONS,
  TASK_TZ_OFFSET_MS,
  UPGRADE_BY_ID,
  WARN_AT,
  type DailyTaskId,
  type GameConfig,
  type NeedId,
} from './catalog'
import type { Action, Business, Donation, Grant, Opening, PlayerDoc, Review } from './types'

/**
 * The game engine. The city and every resident's account are a pure function of the
 * shared records (config, opening balances, residents' action logs, the owner's grants
 * and reviews) and the clock. Every device replays the same history day by day and
 * applies each action in time order, checking it against the rules; an action that breaks
 * a rule is skipped. Nobody can write a balance: there is no balance field anywhere.
 */

type Supply = Record<NeedId, number>

const zero = (): Supply => ({ power: 0, water: 0, housing: 0, jobs: 0, food: 0, health: 0, education: 0, safety: 0, leisure: 0 })

/* ------------------------------------------------------------------ */
/* Clocks                                                              */
/* ------------------------------------------------------------------ */

/** The task day (shared by everyone): days since 1970 at Tashkent midnight. */
export const taskDayOf = (t: number) => Math.floor((t + TASK_TZ_OFFSET_MS) / REAL_DAY_MS)
/** When a task day starts and ends (ms). */
export const taskDayStart = (day: number) => day * REAL_DAY_MS - TASK_TZ_OFFSET_MS

export interface DayClock {
  /** Fractional city day at time t (0 at the founding). */
  at(t: number): number
  /** When city day n starts. */
  start(n: number): number
  /** Length of the city day running at time t (ms). */
  lengthAt(t: number): number
}

/**
 * City days. The owner can change the day length; each change applies from the moment it
 * was saved, so days already lived keep their old length and the day count never jumps.
 */
export function dayClock(cfg: GameConfig): DayClock {
  const periods = [{ from: cfg.startedAt, minutes: cfg.dayMinutes }]
  if (cfg.dayPeriods?.length) {
    periods.length = 0
    const sorted = [...cfg.dayPeriods].filter((p) => p.from >= cfg.startedAt).sort((a, b) => a.from - b.from)
    if (!sorted.length || sorted[0].from > cfg.startedAt) periods.push({ from: cfg.startedAt, minutes: sorted[0]?.minutes ?? cfg.dayMinutes })
    periods.push(...sorted)
  }
  const len = periods.map((p) => Math.max(1, p.minutes) * 60_000)
  // Days completed at the start of each period.
  const base: number[] = [0]
  for (let i = 1; i < periods.length; i++) base.push(base[i - 1] + (periods[i].from - periods[i - 1].from) / len[i - 1])
  const periodAt = (t: number) => {
    let i = 0
    while (i + 1 < periods.length && periods[i + 1].from <= t) i++
    return i
  }
  return {
    at(t) {
      if (t <= cfg.startedAt) return 0
      const i = periodAt(t)
      return base[i] + (t - periods[i].from) / len[i]
    },
    start(n) {
      let i = 0
      while (i + 1 < periods.length && base[i + 1] <= n) i++
      return Math.round(periods[i].from + (n - base[i]) * len[i])
    },
    lengthAt(t) {
      return len[periodAt(t)]
    },
  }
}

/* ------------------------------------------------------------------ */
/* Buildings the city grows by itself                                  */
/* ------------------------------------------------------------------ */

/** What one ordinary building gives the city. */
export function buildingSupply(b: Building): Partial<Supply> {
  const f = Math.max(1, b.floors)
  if (b.housing !== undefined) return b.kind === 'apartment' && b.housing < 30 ? { housing: b.housing, food: 60, jobs: 4 } : { housing: b.housing }
  switch (b.kind) {
    case 'house':
      return { housing: 10 }
    case 'apartment':
      // About one resident per 4 m² of floor: a big courtyard block houses hundreds.
      return { housing: Math.round((f * b.size[0] * b.size[1]) / 4) }
    case 'tower':
      return { jobs: f * 22 }
    case 'office':
      return { jobs: f * 18 }
    case 'hotel':
      return { jobs: f * 4, leisure: 40 }
    case 'shop':
      return { jobs: 10, food: 150 }
    case 'cafe':
      return { jobs: 8, food: 90 }
    case 'factory':
      return { jobs: f * 25 }
    case 'warehouse':
      return { jobs: 25 }
    case 'school':
      return { education: 60, jobs: 20 }
    case 'plant':
      return { power: 85, jobs: 30 }
    default:
      return {}
  }
}

const stageOf = (b: Building) => (b.parcel ? PARCEL_BY_ID[b.parcel].stage : 0)
/** Closest to where the town started comes first, so the city grows outwards. */
const byGrowth = (a: Building, b: Building) =>
  stageOf(a) - stageOf(b) || (a.parcel ? PARCEL_BY_ID[a.parcel].order : 0) - (b.parcel ? PARCEL_BY_ID[b.parcel].order : 0)

/** The order in which the city builds ordinary buildings by itself as it grows. */
export const GROWTH = (() => {
  const grows = BUILDINGS.filter((b) => !b.landmark && !b.starter)
  const housing = grows.filter((b) => b.kind === 'house' || b.kind === 'apartment').sort(byGrowth)
  const jobs = grows.filter((b) => b.kind === 'factory' || b.kind === 'warehouse' || b.kind === 'office' || b.kind === 'hotel' || b.kind === 'tower').sort(byGrowth)
  const food = grows.filter((b) => b.kind === 'shop' || b.kind === 'cafe').sort(byGrowth)
  // Always standing: landmarks (school, the old plant, the night cafe, mystery houses) and the starting settlement.
  const fixed = BUILDINGS.filter((b) => b.landmark || b.starter)
  return { housing, jobs, food, fixed }
})()

const START_JOBS = 0
const START_FOOD = 0

/** How many more homes the settlement needs on top of its starting houses. */
function startHousing(cfg: GameConfig) {
  let n = 0
  let cap = GROWTH.fixed.reduce((s, b) => s + (buildingSupply(b).housing ?? 0), 0)
  while (cap < cfg.startPopulation * 1.25 && n < GROWTH.housing.length) {
    cap += buildingSupply(GROWTH.housing[n]).housing ?? 0
    n++
  }
  return n
}

/** Buildings standing from the first day: parcels for the delivery task come from here. */
export function starterBuildings(cfg: GameConfig): Building[] {
  return [
    ...GROWTH.fixed.filter((b) => b.kind !== 'unknown'),
    ...GROWTH.housing.slice(0, startHousing(cfg)),
    ...GROWTH.jobs.slice(0, START_JOBS),
    ...GROWTH.food.slice(0, START_FOOD),
  ].sort((a, b) => (a.id < b.id ? -1 : 1))
}

/** Today's parcel recipient for one resident: the same on every device. */
export function deliveryTarget(uid: string, day: number, cfg: GameConfig): string {
  const list = starterBuildings(cfg)
  return list[hashString(`${day}:${uid}`) % list.length].id
}

export const surveyIndex = (day: number) => hashString(String(day)) % SURVEY_QUESTIONS.length

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

export interface ProjectState {
  funded: number
  donors: number
  completedAt: number | null
  available: boolean
}

export interface NeedState {
  supply: number
  demand: number
  ratio: number
}

export interface BizState extends Business {
  owner: string
  /** Takings waiting in the till. */
  pending: number
  lastAccrue: number
}

export interface LedgerEntry {
  t: number
  amount: number
  why: string
}

export interface Account {
  uid: string
  /** When this account started counting (joined, converted or the city restarted). */
  since: number
  balance: number
  rep: number
  donations: Donation[]
  business: BizState | null
  /** Tasks done per task day. */
  tasks: Record<number, DailyTaskId[]>
  /** Last stars given to each business owner, with the task day. */
  ratings: Record<string, { s: number; day: number }>
  /** Survey answers per task day. */
  survey: Record<number, number>
  /** Last task day with a completed task. */
  activeDay: number
  /** Spent on the city since the account started: returned when the city restarts. */
  invested: number
  /** Creative tasks already paid for. */
  creativePaid: string[]
  /** First-steps tutorial: how many steps are done (and paid). */
  tutorial: number
  /** Every credit and debit (newest last, the last 200 kept). */
  ledger: LedgerEntry[]
  /** Actions that broke a rule and were skipped. */
  rejected: { t: number; k: string; why: string }[]
  lastActionAt: number
}

export interface CityState {
  now: number
  day: number
  dayProgress: number
  /** Length of the current city day (ms). */
  dayMs: number
  taskDay: number
  population: number
  happiness: number
  needs: Record<NeedId, NeedState>
  warnings: NeedId[]
  crises: NeedId[]
  built: Set<string>
  projects: Record<string, ProjectState>
  /** Population at the end of each of the last days, oldest first. */
  history: number[]
  /** Newcomers and leavers per day at today's conditions. */
  inflow: number
  outflow: number
  activeToday: number
  level: ReturnType<typeof levelFor>
  businesses: { owner: string; biz: BizState }[]
  /** Highest expansion stage the city has opened (streets and plots there are visible). */
  openStage: number
  /** City day on which each building that grew during the game went up. */
  builtDay: Record<string, number>
}

export interface World {
  city: CityState
  accounts: Record<string, Account>
}

export interface Inputs {
  config: GameConfig
  opening: Opening | null
  players: Record<string, PlayerDoc>
  grants: Grant[]
  reviews: Review[]
}

type Ev =
  | { t: number; o: number; e: 'open-acc'; uid: string }
  | { t: number; o: number; e: 'act'; uid: string; a: Action }
  | { t: number; o: number; e: 'grant'; g: Grant }
  | { t: number; o: number; e: 'review'; r: Review }
  | { t: number; o: number; e: 'old-donation'; uid: string; d: Donation }
  | { t: number; o: number; e: 'old-business'; uid: string; b: Business }
  | { t: number; o: number; e: 'old-activity'; uid: string }

/** Skipped actions are reported once, not on every replay. */
const WARNED = new Set<string>()
function warnOnce(uid: string, act: { t: number; k: string }, why: string) {
  const key = `${uid}|${act.t}|${act.k}`
  if (WARNED.has(key)) return
  WARNED.add(key)
  console.warn(`[afterlight] ${uid}: «${act.k}» не засчитано — ${why}`)
}

const DISTRICT_OF_LOT = (lot: string) => RESERVED_BY_KEY[lot]?.district ?? 'residential'

/* ------------------------------------------------------------------ */
/* Business economics                                                  */
/* ------------------------------------------------------------------ */

export interface EconomyContext {
  population: number
  needs: Record<NeedId, NeedState>
  businesses: { owner: string; biz: Business }[]
  ratings: (owner: string) => { avg: number; count: number }
}

/** Guests and money per city day for one business, in the city as it is at that moment. */
export function businessEconomics(owner: string, biz: Business, ctx: EconomyContext) {
  const def = BUSINESS_TYPE_BY_ID[biz.type]
  const district = DISTRICT_OF_LOT(biz.lot)
  const jobs = Math.min(ctx.needs.jobs.supply, ctx.population * 0.5)
  const potential =
    district === 'residential' ? ctx.population * 0.25 : district === 'downtown' ? ctx.population * 0.12 + jobs * 0.2 : jobs * 0.15
  const typeFit =
    biz.type === 'service' ? (district === 'industrial' ? 1.6 : 0.6) : biz.type === 'restaurant' && district === 'industrial' ? 0.5 : 1
  const priceFactor = [1.35, 1, 0.65][biz.price - 1]
  const upgrades = 1 + biz.upgrades.reduce((s, u) => s + UPGRADE_BY_ID[u].bonus, 0)
  const rivals = ctx.businesses.filter((b) => b.owner !== owner && b.biz.type === biz.type && DISTRICT_OF_LOT(b.biz.lot) === district).length
  const competition = 1 / (1 + 0.35 * rivals)
  const power = ctx.needs.power.ratio < WARN_AT ? 0.6 : 1
  const safety = ctx.needs.safety.ratio < CRISIS_AT ? 0.75 : 1
  const rating = ctx.ratings(owner)
  const ratingFactor = rating.count ? 0.8 + (rating.avg / 5) * 0.4 : 1
  const visits = potential * def.baseVisits * typeFit * priceFactor * upgrades * competition * power * safety * ratingFactor
  const check = def.check[biz.price - 1]
  const revenue = visits * check
  const profit = revenue - def.upkeep
  return { visits: Math.round(visits), check, revenue: Math.round(revenue), upkeep: def.upkeep, profit: Math.round(profit), rating, power: power < 1 }
}

/* ------------------------------------------------------------------ */
/* The replay                                                          */
/* ------------------------------------------------------------------ */

export function replay(inp: Inputs, now: number): World {
  const { config: cfg, opening, players, grants, reviews } = inp
  const clock = dayClock(cfg)
  const openAt = opening && opening.at >= cfg.startedAt ? opening.at : null
  const accounts: Record<string, Account> = {}

  /* Events in time order. ------------------------------------------- */
  const evs: Ev[] = []
  let order = 0
  const push = (e: Ev) => evs.push(e)
  const clampT = (t: number) => Math.max(cfg.startedAt, t)
  const horizon = now + FUTURE_TOLERANCE_MS
  const uids = new Set([...Object.keys(players), ...Object.keys(openAt !== null ? opening!.players : {})])
  for (const uid of uids) {
    const doc = players[uid]
    const old = openAt !== null ? opening!.players[uid] : undefined
    const since = old ? openAt! : clampT(Math.max(doc?.joinedAt ?? now, openAt ?? 0))
    push({ t: since, o: order++, e: 'open-acc', uid })
    if (old) {
      for (const d of old.donations) if (d.t >= cfg.startedAt && d.t < openAt!) push({ t: d.t, o: order++, e: 'old-donation', uid, d })
      if (old.business && old.business.openedAt >= cfg.startedAt) push({ t: clampT(old.business.openedAt), o: order++, e: 'old-business', uid, b: old.business })
      for (const a of old.activity) if (a >= cfg.startedAt && a < openAt!) push({ t: a, o: order++, e: 'old-activity', uid })
    }
    if (!doc) continue
    // A log only grows: an entry stamped before the one written ahead of it was back-dated.
    let lastT = -Infinity
    for (const a of doc.actions) {
      if (!a || typeof a.t !== 'number' || !Number.isFinite(a.t)) continue
      if (a.t < lastT) {
        warnOnce(uid, a, 'время идёт назад')
        continue
      }
      lastT = a.t
      if (a.t > horizon) continue
      push({ t: a.t, o: order++, e: 'act', uid, a })
    }
  }
  const creditFrom = openAt ?? 0
  for (const g of grants) if (g.at >= creditFrom && g.at >= cfg.startedAt - 0) push({ t: clampT(g.at), o: order++, e: 'grant', g })
  for (const r of reviews) if (r.at >= creditFrom) push({ t: clampT(r.at), o: order++, e: 'review', r })
  evs.sort((a, b) => a.t - b.t || a.o - b.o)

  /* City state. ------------------------------------------------------ */
  let nHousing = startHousing(cfg)
  let nJobs = START_JOBS
  let nFood = START_FOOD
  let pop = cfg.startPopulation
  let openStage = 0
  const builtDay: Record<string, number> = {}
  const history: number[] = []
  const projects: Record<string, { funded: number; donors: Set<string>; completedAt: number | null }> = {}
  for (const p of PROJECTS) projects[p.id] = { funded: 0, donors: new Set(), completedAt: null }
  const lots = new Map<string, string>()
  const businesses = () => Object.values(accounts).flatMap((a) => (a.business ? [{ owner: a.uid, biz: a.business }] : []))

  const evaluate = () => {
    const s = zero()
    for (const n of NEEDS) s[n.id] += n.base
    const add = (part: Partial<Supply>) => {
      for (const [key, v] of Object.entries(part)) s[key as NeedId] += v ?? 0
    }
    for (const b of GROWTH.fixed) add(buildingSupply(b))
    for (let i = 0; i < nHousing; i++) add(buildingSupply(GROWTH.housing[i]))
    for (let i = 0; i < nJobs && i < GROWTH.jobs.length; i++) add(buildingSupply(GROWTH.jobs[i]))
    for (let i = 0; i < nFood && i < GROWTH.food.length; i++) add(buildingSupply(GROWTH.food[i]))
    for (const p of PROJECTS) if (projects[p.id].completedAt !== null) add(p.effects)
    for (const { biz } of businesses()) add(BUSINESS_TYPE_BY_ID[biz.type].effects)
    const out = {} as Record<NeedId, NeedState>
    for (const n of NEEDS) {
      const demand = Math.max(1, pop * n.perResident)
      out[n.id] = { supply: s[n.id], demand, ratio: s[n.id] / demand }
    }
    return out
  }
  let needs = evaluate()

  const builtNow = () => {
    const built = new Set<string>(GROWTH.fixed.map((b) => b.id))
    GROWTH.housing.slice(0, nHousing).forEach((b) => built.add(b.id))
    GROWTH.jobs.slice(0, nJobs).forEach((b) => built.add(b.id))
    GROWTH.food.slice(0, nFood).forEach((b) => built.add(b.id))
    return built
  }

  /* Ratings, for the economy. --------------------------------------- */
  const ratingOf = (owner: string) => {
    const stars: number[] = []
    for (const a of Object.values(accounts)) if (a.uid !== owner && a.ratings[owner]) stars.push(a.ratings[owner].s)
    return { avg: stars.length ? stars.reduce((x, y) => x + y, 0) / stars.length : 0, count: stars.length }
  }
  const ctx = (): EconomyContext => ({ population: pop, needs, businesses: businesses(), ratings: ratingOf })

  /* Business tills fill up continuously. ----------------------------- */
  const accrue = (t: number) => {
    const c = ctx()
    for (const a of Object.values(accounts)) {
      const b = a.business
      if (!b || t <= b.lastAccrue) continue
      const D = clock.lengthAt(b.lastAccrue)
      const perDay = Math.max(0, businessEconomics(a.uid, b, c).profit)
      const cap = perDay * CASH_CAP_DAYS
      b.pending = Math.min(cap, b.pending + (perDay * (t - b.lastAccrue)) / D)
      b.lastAccrue = t
    }
  }

  /* Accounts. --------------------------------------------------------- */
  const credit = (a: Account, t: number, amount: number, why: string) => {
    a.balance += amount
    a.ledger.push({ t, amount, why })
    if (a.ledger.length > 240) a.ledger.splice(0, a.ledger.length - 200)
  }
  const reject = (a: Account, act: Action, why: string) => {
    a.rejected.push({ t: act.t, k: act.k, why })
    if (a.rejected.length > 50) a.rejected.shift()
    warnOnce(a.uid, act, why)
  }
  const newAccount = (uid: string, t: number): Account => ({
    uid,
    since: t,
    balance: 0,
    rep: 0,
    donations: [],
    business: null,
    tasks: {},
    ratings: {},
    survey: {},
    activeDay: -1,
    invested: 0,
    creativePaid: [],
    tutorial: 0,
    ledger: [],
    rejected: [],
    lastActionAt: t,
  })
  const ensure = (uid: string, t: number) => (accounts[uid] ??= newAccount(uid, t))
  /** Start counting: opening balance from the owner's record, or the starting Искры. */
  const openAccount = (uid: string, t: number) => {
    const old = openAt !== null ? opening!.players[uid] : undefined
    const acc = ensure(uid, t)
    acc.since = t
    acc.lastActionAt = t
    if (old) acc.rep = old.rep
    credit(acc, t, old ? old.balance : START_BALANCE, old ? 'Перенесено со старой версии' : 'Стартовые Искры')
  }

  const donate = (uid: string, p: string, amt: number, t: number) => {
    const st = projects[p]
    const def = PROJECT_BY_ID[p]
    st.funded += amt
    st.donors.add(uid)
    const enoughDonors = cfg.soloMode || !cfg.requireDonors || st.donors.size >= def.minDonors
    if (st.funded >= def.cost && enoughDonors) st.completedAt = t
  }

  const apply = (a: Account, act: Action, t: number) => {
    if (t < a.since) return reject(a, act, 'раньше начала счёта')
    if (t < a.lastActionAt) return reject(a, act, 'время идёт назад')
    a.lastActionAt = t
    const day = taskDayOf(t)
    switch (act.k) {
      case 'task': {
        const def = DAILY_TASKS.find((d) => d.id === act.id)
        if (!def) return reject(a, act, 'нет такого задания')
        const done = a.tasks[day] ?? []
        if (done.includes(act.id)) return reject(a, act, 'уже выполнено сегодня')
        if (act.id === 'delivery' && act.x !== deliveryTarget(a.uid, day, cfg)) return reject(a, act, 'не тот адрес')
        if (act.id === 'patrol') {
          const ids = Array.isArray(act.ids) ? act.ids : []
          const built = builtNow()
          if (new Set(ids).size < PATROL_COUNT || !ids.every((id) => built.has(id))) return reject(a, act, 'обход не завершён')
        }
        if (act.id === 'survey') {
          const q = SURVEY_QUESTIONS[surveyIndex(day)]
          if (typeof act.x !== 'number' || act.x < 0 || act.x >= q.options.length || !Number.isInteger(act.x)) return reject(a, act, 'нет такого ответа')
          a.survey[day] = act.x
        }
        if (act.id === 'reviews') {
          const others = businesses().filter((b) => b.owner !== a.uid)
          if (act.x === 'cafe') {
            if (others.length) return reject(a, act, 'есть заведения жителей')
          } else if (typeof act.x !== 'string' || !others.some((b) => b.owner === act.x) || a.ratings[act.x]?.day !== day) {
            return reject(a, act, 'оценки нет')
          }
        }
        a.tasks[day] = [...done, act.id]
        a.rep += REP_PER_TASK
        a.activeDay = day
        credit(a, t, def.reward, `Задание: ${def.title}`)
        return
      }
      case 'donate': {
        const def = PROJECT_BY_ID[act.p]
        const st = projects[act.p]
        if (!def || !st) return reject(a, act, 'нет такого проекта')
        if (st.completedAt !== null) return reject(a, act, 'проект уже построен')
        if (pop < def.minPopulation && st.funded <= 0) return reject(a, act, 'проект ещё закрыт')
        if (!Number.isInteger(act.a) || act.a <= 0) return reject(a, act, 'неверная сумма')
        if (act.a > a.balance) return reject(a, act, 'не хватает Искр')
        if (!cfg.soloMode) {
          const today = a.donations.filter((d) => taskDayOf(d.t) === day).reduce((s, d) => s + d.amt, 0)
          if (today + act.a > cfg.dailyDonationLimit) return reject(a, act, 'дневной лимит взносов')
        }
        const amt = Math.min(act.a, def.cost - st.funded)
        credit(a, t, -amt, `Взнос: ${def.name}`)
        a.invested += amt
        a.donations.push({ p: act.p, amt, t })
        if (amt >= REP_DONATION_FROM) a.rep += 1
        donate(a.uid, act.p, amt, t)
        return
      }
      case 'open': {
        const def = BUSINESS_TYPE_BY_ID[act.type]
        const lot = RESERVED_BY_KEY[act.lot]
        if (!def) return reject(a, act, 'нет такого типа')
        if (!lot || lot.use !== 'business') return reject(a, act, 'нет такого участка')
        if (lot.parcel.stage > openStage) return reject(a, act, 'участок ещё не открыт')
        if (lots.has(act.lot)) return reject(a, act, 'участок занят')
        if (MAX_BUSINESSES <= (a.business ? 1 : 0)) return reject(a, act, 'бизнес уже есть')
        const name = typeof act.name === 'string' ? act.name.trim() : ''
        if (name.length < 2 || name.length > 32) return reject(a, act, 'нет названия')
        if (!cfg.soloMode && a.rep < cfg.businessRep) return reject(a, act, 'мало репутации')
        if (a.balance < def.openCost) return reject(a, act, 'не хватает Искр')
        credit(a, t, -def.openCost, `Открытие: ${name}`)
        a.invested += def.openCost
        a.business = {
          owner: a.uid,
          type: act.type,
          name,
          color: BUSINESS_COLORS.includes(act.color) ? act.color : BUSINESS_COLORS[0],
          price: [1, 2, 3].includes(act.price) ? act.price : 2,
          lot: act.lot,
          openedAt: t,
          lastCollect: t,
          upgrades: [],
          totalEarned: 0,
          pending: 0,
          lastAccrue: t,
        }
        lots.set(act.lot, a.uid)
        return
      }
      case 'bizset': {
        const b = a.business
        if (!b || b.lot !== act.lot) return reject(a, act, 'нет бизнеса')
        if (act.name !== undefined) {
          const name = String(act.name).trim()
          if (name.length < 2 || name.length > 32) return reject(a, act, 'нет названия')
          b.name = name
        }
        if (act.color !== undefined && BUSINESS_COLORS.includes(act.color)) b.color = act.color
        if (act.price !== undefined && [1, 2, 3].includes(act.price)) b.price = act.price
        return
      }
      case 'upgrade': {
        const b = a.business
        const up = UPGRADE_BY_ID[act.u]
        if (!b || b.lot !== act.lot) return reject(a, act, 'нет бизнеса')
        if (!up) return reject(a, act, 'нет такого улучшения')
        const parcel = RESERVED_BY_KEY[b.lot]?.parcel
        if (ROOMY_UPGRADES.includes(act.u) && parcel && parcel.w * parcel.d < SMALL_PLOT_AREA) return reject(a, act, 'мало места')
        if (b.upgrades.includes(act.u)) return reject(a, act, 'уже куплено')
        if (a.balance < up.cost) return reject(a, act, 'не хватает Искр')
        credit(a, t, -up.cost, `Улучшение: ${up.label}`)
        a.invested += up.cost
        b.upgrades = [...b.upgrades, act.u]
        return
      }
      case 'collect': {
        const b = a.business
        if (!b || b.lot !== act.lot) return reject(a, act, 'нет бизнеса')
        const amount = Math.floor(b.pending)
        b.pending -= amount
        b.lastCollect = t
        b.totalEarned += amount
        if (amount > 0) credit(a, t, amount, `Выручка: ${b.name}`)
        return
      }
      case 'rate': {
        if (act.o === a.uid) return reject(a, act, 'своё заведение')
        if (!accounts[act.o]?.business) return reject(a, act, 'нет такого заведения')
        if (!Number.isInteger(act.s) || act.s < 1 || act.s > 5) return reject(a, act, 'неверная оценка')
        if (a.ratings[act.o]?.day === day) return reject(a, act, 'оценка уже стоит сегодня')
        a.ratings[act.o] = { s: act.s, day }
        return
      }
      default:
        return reject(a, act as Action, 'неизвестное действие')
    }
  }

  /** First steps pay a small reward the moment each one is done, in order. */
  const tutorialDone = (a: Account, step: number) => {
    switch (TUTORIAL[step]?.id) {
      case 'wires':
        return Object.values(a.tasks).some((d) => d.includes('wires'))
      case 'clinic':
        return a.donations.some((d) => d.p === 'clinic') || projects.clinic.completedAt !== null
      case 'business':
        return !!a.business
      case 'collect':
        return (a.business?.totalEarned ?? 0) > 0
      default:
        return false
    }
  }
  const progress = (a: Account | undefined, t: number) => {
    if (!a) return
    while (a.tutorial < TUTORIAL.length && tutorialDone(a, a.tutorial)) {
      const step = TUTORIAL[a.tutorial]
      credit(a, t, step.reward, `Первые шаги: ${step.title}`)
      a.tutorial++
    }
  }

  const handle = (ev: Ev) => {
    switch (ev.e) {
      case 'open-acc':
        return openAccount(ev.uid, ev.t)
      case 'act': {
        const a = accounts[ev.uid]
        if (a) apply(a, ev.a, ev.t)
        return
      }
      case 'grant': {
        const a = ensure(ev.g.to, ev.t)
        // The owner can take Искры back, but never below zero.
        const amount = ev.g.amount < 0 ? Math.max(ev.g.amount, -a.balance) : ev.g.amount
        if (amount) credit(a, ev.t, amount, ev.g.note ? `От основателя: ${ev.g.note}` : 'От основателя')
        return
      }
      case 'review': {
        const r = ev.r
        if (r.status !== 'approved') return
        const a = ensure(r.to, ev.t)
        if (a.creativePaid.includes(r.taskId)) return
        a.creativePaid.push(r.taskId)
        credit(a, ev.t, r.reward, 'Творческое задание')
        return
      }
      case 'old-donation': {
        const a = ensure(ev.uid, ev.t)
        const st = projects[ev.d.p]
        if (!st || st.completedAt !== null) return
        a.donations.push(ev.d)
        a.invested += ev.d.amt
        donate(ev.uid, ev.d.p, ev.d.amt, ev.t)
        return
      }
      case 'old-business': {
        const a = ensure(ev.uid, ev.t)
        if (lots.has(ev.b.lot)) return
        a.business = { ...ev.b, owner: ev.uid, pending: 0, lastAccrue: Math.max(ev.b.lastCollect, ev.t) }
        a.invested += BUSINESS_TYPE_BY_ID[ev.b.type]?.openCost ?? 0
        lots.set(ev.b.lot, ev.uid)
        return
      }
      case 'old-activity': {
        ensure(ev.uid, ev.t).activeDay = taskDayOf(ev.t)
        return
      }
    }
  }

  /* Day by day. ------------------------------------------------------ */
  const totalDays = Math.floor(clock.at(now))
  let ei = 0
  let happiness = 0
  let inflow = 0
  let outflow = 0
  const rates = () => {
    const ratios = NEEDS.filter((n) => n.id !== 'housing').map((n) => Math.min(1, needs[n.id].ratio))
    happiness = Math.round((100 * ratios.reduce((x, y) => x + y, 0)) / ratios.length)
    const crises = NEEDS.filter((n) => n.id !== 'housing' && needs[n.id].ratio < CRISIS_AT).length
    return crises
  }
  const activeAt = (t: number) => {
    const d = taskDayOf(t)
    let n = 0
    for (const a of Object.values(accounts)) if (a.activeDay === d) n++
    return n
  }

  for (let d = 0; d <= totalDays; d++) {
    const t1 = Math.min(now, clock.start(d + 1))
    while (ei < evs.length && evs[ei].t < t1) {
      const ev = evs[ei++]
      accrue(ev.t)
      handle(ev)
      if (ev.e === 'act') progress(accounts[ev.uid], ev.t)
      needs = evaluate()
    }
    accrue(t1)
    if (d === totalDays) break

    // End of the city day: people arrive and leave, the city builds what it lacks.
    needs = evaluate()
    const crises = rates()
    inflow = (cfg.baseInflow + cfg.perActive * activeAt(t1 - 1)) * (happiness / 100)
    outflow = pop * cfg.crisisOutflow * crises
    const cap = needs.housing.supply
    pop = Math.max(40, Math.min(cap, pop + inflow - outflow))
    const can = (list: Building[], n: number) => n < list.length && stageOf(list[n]) <= openStage
    if (pop >= cap * 0.85 && nHousing < GROWTH.housing.length) {
      openStage = Math.max(openStage, stageOf(GROWTH.housing[nHousing]))
      builtDay[GROWTH.housing[nHousing].id] = d + 1
      nHousing++
    }
    needs = evaluate()
    if (needs.jobs.ratio < 0.95 && can(GROWTH.jobs, nJobs)) builtDay[GROWTH.jobs[nJobs++].id] = d + 1
    if (needs.food.ratio < 0.9 && can(GROWTH.food, nFood)) builtDay[GROWTH.food[nFood++].id] = d + 1
    openStage = Math.max(openStage, stageFor(pop))
    needs = evaluate()
    history.push(Math.round(pop))
  }
  // Today's numbers at this very moment (not at the start of the day).
  needs = evaluate()
  const crisisCount = rates()
  inflow = (cfg.baseInflow + cfg.perActive * activeAt(now)) * (happiness / 100)
  outflow = pop * cfg.crisisOutflow * crisisCount

  const warnings = NEEDS.filter((n) => n.id !== 'housing' && needs[n.id].ratio < WARN_AT && needs[n.id].ratio >= CRISIS_AT).map((n) => n.id)
  const crises = NEEDS.filter((n) => n.id !== 'housing' && needs[n.id].ratio < CRISIS_AT).map((n) => n.id)
  if (needs.housing.supply - pop < 3) warnings.push('housing')

  const projectStates: Record<string, ProjectState> = {}
  for (const p of PROJECTS) {
    const st = projects[p.id]
    projectStates[p.id] = { funded: st.funded, donors: st.donors.size, completedAt: st.completedAt, available: pop >= p.minPopulation || st.funded > 0 }
  }
  const dayFloat = clock.at(now)
  const city: CityState = {
    now,
    day: Math.floor(dayFloat) + 1,
    dayProgress: dayFloat - Math.floor(dayFloat),
    dayMs: clock.lengthAt(now),
    taskDay: taskDayOf(now),
    population: Math.round(pop),
    happiness,
    needs,
    warnings,
    crises,
    built: builtNow(),
    projects: projectStates,
    history: history.slice(-48),
    inflow,
    outflow,
    activeToday: activeAt(now),
    level: levelFor(pop),
    businesses: businesses(),
    openStage,
    builtDay,
  }
  return { city, accounts }
}

/** Old entry point: the city only. */
export function simulate(inp: Inputs, now: number): CityState {
  return replay(inp, now).city
}

/** Star rating of one business from everybody else's latest stars. */
export function averageRating(owner: string, accounts: Record<string, Account>) {
  const stars: number[] = []
  for (const a of Object.values(accounts)) if (a.uid !== owner && a.ratings[owner]) stars.push(a.ratings[owner].s)
  return { avg: stars.length ? stars.reduce((x, y) => x + y, 0) / stars.length : 0, count: stars.length }
}

/** The economy context of the city as it is now. */
export function economyNow(city: CityState, accounts: Record<string, Account>): EconomyContext {
  return { population: city.population, needs: city.needs, businesses: city.businesses, ratings: (o) => averageRating(o, accounts) }
}
