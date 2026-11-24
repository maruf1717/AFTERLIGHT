import { BUILDINGS, BUILDINGS_BY_DISTRICT } from '../data/city'
import type { Building } from '../data/types'
import {
  BUSINESS_TYPE_BY_ID,
  CRISIS_AT,
  levelFor,
  NEEDS,
  PROJECTS,
  UPGRADE_BY_ID,
  WARN_AT,
  type GameConfig,
  type NeedId,
} from './catalog'
import type { Business, PlayerDoc } from './types'

/**
 * The city simulation. It is a pure function of the shared state (config + every
 * resident's record) and the clock, so every viewer computes the same city without a
 * server: replay day by day from the founding date.
 */

type Supply = Record<NeedId, number>

const zero = (): Supply => ({ power: 0, water: 0, housing: 0, jobs: 0, food: 0, health: 0, education: 0, safety: 0, leisure: 0 })

/** What one ordinary building gives the city. */
export function buildingSupply(b: Building): Partial<Supply> {
  const f = Math.max(1, b.floors)
  switch (b.kind) {
    case 'house':
      return { housing: 10 }
    case 'apartment':
      return { housing: f * 12 }
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

const byHeight = (a: Building, b: Building) => a.height - b.height

/** The order in which the city builds ordinary buildings by itself as it grows. */
export const GROWTH = (() => {
  const res = BUILDINGS_BY_DISTRICT.residential
  const dt = BUILDINGS_BY_DISTRICT.downtown
  const ind = BUILDINGS_BY_DISTRICT.industrial
  const housing = [
    ...res.filter((b) => b.kind === 'house'),
    ...res.filter((b) => b.kind === 'apartment').sort(byHeight),
    ...dt.filter((b) => b.kind === 'apartment').sort(byHeight),
  ]
  const jobs = [
    ...ind.filter((b) => b.kind === 'factory' || b.kind === 'warehouse'),
    ...dt.filter((b) => b.kind === 'office' || b.kind === 'hotel' || b.kind === 'tower').sort(byHeight),
  ]
  const food = [...res, ...dt, ...ind].filter((b) => b.kind === 'shop' || b.kind === 'cafe')
  // Always standing: landmarks that are not projects (school, the old plant, mystery houses).
  const fixed = BUILDINGS.filter((b) => b.kind === 'school' || b.kind === 'plant' || b.kind === 'unknown')
  return { housing, jobs, food, fixed }
})()

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

export interface CityState {
  now: number
  day: number
  dayProgress: number
  population: number
  happiness: number
  needs: Record<NeedId, NeedState>
  warnings: NeedId[]
  crises: NeedId[]
  built: Set<string>
  projects: Record<string, ProjectState>
  /** Population at the end of each of the last days, oldest first. */
  history: number[]
  inflow: number
  outflow: number
  activeToday: number
  level: ReturnType<typeof levelFor>
  businesses: { owner: string; biz: Business }[]
}

interface Players {
  [uid: string]: PlayerDoc
}

function projectTimeline(cfg: GameConfig, players: Players) {
  const all: { p: string; amt: number; t: number; uid: string }[] = []
  for (const [uid, pl] of Object.entries(players)) for (const d of pl.donations ?? []) if (d.t >= cfg.startedAt) all.push({ ...d, uid })
  all.sort((a, b) => a.t - b.t)
  const out: Record<string, { funded: number; donors: Set<string>; completedAt: number | null }> = {}
  for (const p of PROJECTS) out[p.id] = { funded: 0, donors: new Set(), completedAt: null }
  for (const d of all) {
    const st = out[d.p]
    const def = PROJECTS.find((x) => x.id === d.p)
    if (!st || !def || st.completedAt) continue
    st.funded += d.amt
    st.donors.add(d.uid)
    const enoughDonors = !cfg.requireDonors || st.donors.size >= def.minDonors
    if (st.funded >= def.cost && enoughDonors) st.completedAt = d.t
  }
  return out
}

export function simulate(cfg: GameConfig, players: Players, now: number): CityState {
  const D = Math.max(1, cfg.dayMinutes) * 60_000
  const elapsed = Math.max(0, now - cfg.startedAt)
  const totalDays = Math.floor(elapsed / D)
  // Very long histories are replayed in coarser steps so the page stays fast.
  const step = Math.max(1, Math.ceil(totalDays / 2000))

  const timeline = projectTimeline(cfg, players)
  const businesses = Object.entries(players)
    .filter(([, p]) => p.business && p.business.openedAt >= cfg.startedAt)
    .map(([owner, p]) => ({ owner, biz: p.business as Business }))

  const activeByDay = new Map<number, Set<string>>()
  for (const [uid, p] of Object.entries(players)) {
    for (const t of p.activity ?? []) {
      const d = Math.floor((t - cfg.startedAt) / D)
      if (d < 0) continue
      if (!activeByDay.has(d)) activeByDay.set(d, new Set())
      activeByDay.get(d)!.add(uid)
    }
  }

  // Start: a settlement with enough homes for its people and a few jobs.
  let nHousing = 0
  let housingCap = 0
  while (housingCap < cfg.startPopulation * 1.25 && nHousing < GROWTH.housing.length) {
    housingCap += buildingSupply(GROWTH.housing[nHousing]).housing ?? 0
    nHousing++
  }
  let nJobs = 2
  let nFood = 1

  let pop = cfg.startPopulation
  const history: number[] = []
  let inflow = 0
  let outflow = 0
  let needs = {} as Record<NeedId, NeedState>
  let happiness = 0

  const evaluate = (t: number) => {
    const s = zero()
    for (const n of NEEDS) s[n.id] += n.base
    const add = (part: Partial<Supply>, k = 1) => {
      for (const [key, v] of Object.entries(part)) s[key as NeedId] += (v ?? 0) * k
    }
    for (const b of GROWTH.fixed) add(buildingSupply(b))
    for (let i = 0; i < nHousing; i++) add(buildingSupply(GROWTH.housing[i]))
    for (let i = 0; i < nJobs && i < GROWTH.jobs.length; i++) add(buildingSupply(GROWTH.jobs[i]))
    for (let i = 0; i < nFood && i < GROWTH.food.length; i++) add(buildingSupply(GROWTH.food[i]))
    for (const p of PROJECTS) {
      const done = timeline[p.id].completedAt
      if (done !== null && done <= t) add(p.effects)
    }
    for (const { biz } of businesses) if (biz.openedAt <= t) add(BUSINESS_TYPE_BY_ID[biz.type].effects)

    const out = {} as Record<NeedId, NeedState>
    for (const n of NEEDS) {
      const demand = Math.max(1, pop * n.perResident)
      out[n.id] = { supply: s[n.id], demand, ratio: s[n.id] / demand }
    }
    return out
  }

  for (let d = 0; d <= totalDays; d += step) {
    const t = cfg.startedAt + d * D
    needs = evaluate(t)
    const ratios = NEEDS.filter((n) => n.id !== 'housing').map((n) => Math.min(1, needs[n.id].ratio))
    happiness = Math.round((100 * ratios.reduce((a, b) => a + b, 0)) / ratios.length)
    const crises = NEEDS.filter((n) => n.id !== 'housing' && needs[n.id].ratio < CRISIS_AT).length

    let active = 0
    for (let k = d; k < d + step; k++) active += activeByDay.get(k)?.size ?? 0
    inflow = (cfg.baseInflow * step + cfg.perActive * active) * (happiness / 100)
    outflow = pop * cfg.crisisOutflow * crises * step
    const cap = needs.housing.supply
    pop = Math.max(40, Math.min(cap, pop + inflow - outflow))

    // The city builds ordinary buildings by itself when it runs short.
    for (let k = 0; k < step; k++) {
      if (pop >= cap * 0.85 && nHousing < GROWTH.housing.length) nHousing++
      if (needs.jobs.ratio < 0.95 && nJobs < GROWTH.jobs.length) nJobs++
      if (needs.food.ratio < 0.9 && nFood < GROWTH.food.length) nFood++
    }
    history.push(Math.round(pop))
  }

  needs = evaluate(now)
  const warnings = NEEDS.filter((n) => n.id !== 'housing' && needs[n.id].ratio < WARN_AT && needs[n.id].ratio >= CRISIS_AT).map((n) => n.id)
  const crises = NEEDS.filter((n) => n.id !== 'housing' && needs[n.id].ratio < CRISIS_AT).map((n) => n.id)
  if (needs.housing.supply - pop < 3) warnings.push('housing')

  const built = new Set<string>(GROWTH.fixed.map((b) => b.id))
  GROWTH.housing.slice(0, nHousing).forEach((b) => built.add(b.id))
  GROWTH.jobs.slice(0, nJobs).forEach((b) => built.add(b.id))
  GROWTH.food.slice(0, nFood).forEach((b) => built.add(b.id))

  const projects: Record<string, ProjectState> = {}
  for (const p of PROJECTS) {
    const tl = timeline[p.id]
    projects[p.id] = {
      funded: tl.funded,
      donors: tl.donors.size,
      completedAt: tl.completedAt,
      available: pop >= p.minPopulation || tl.funded > 0,
    }
  }

  const today = Math.floor(elapsed / D)
  return {
    now,
    day: today + 1,
    dayProgress: (elapsed % D) / D,
    population: Math.round(pop),
    happiness,
    needs,
    warnings,
    crises,
    built,
    projects,
    history: history.slice(-48),
    inflow,
    outflow,
    activeToday: activeByDay.get(today)?.size ?? 0,
    level: levelFor(pop),
    businesses,
  }
}

/* ------------------------------------------------------------------ */
/* Business economics                                                  */
/* ------------------------------------------------------------------ */

const DISTRICT_OF_LOT = (lot: string) => (lot.startsWith('res') ? 'residential' : lot.startsWith('dt') ? 'downtown' : 'industrial')

export function averageRating(owner: string, players: Record<string, PlayerDoc>) {
  const stars: number[] = []
  for (const [uid, p] of Object.entries(players)) {
    if (uid === owner) continue
    const s = p.ratings?.[owner]
    if (s) stars.push(s)
  }
  return { avg: stars.length ? stars.reduce((a, b) => a + b, 0) / stars.length : 0, count: stars.length }
}

/** Guests and money per city day for one business, in the city as it is now. */
export function businessEconomics(owner: string, biz: Business, city: CityState, players: Record<string, PlayerDoc>) {
  const def = BUSINESS_TYPE_BY_ID[biz.type]
  const district = DISTRICT_OF_LOT(biz.lot)
  const jobs = Math.min(city.needs.jobs.supply, city.population * 0.5)
  const potential =
    district === 'residential' ? city.population * 0.25 : district === 'downtown' ? city.population * 0.12 + jobs * 0.2 : jobs * 0.15
  const typeFit =
    biz.type === 'service' ? (district === 'industrial' ? 1.6 : 0.6) : biz.type === 'restaurant' && district === 'industrial' ? 0.5 : 1
  const priceFactor = [1.35, 1, 0.65][biz.price - 1]
  const upgrades = 1 + biz.upgrades.reduce((s, u) => s + UPGRADE_BY_ID[u].bonus, 0)
  const rivals = city.businesses.filter((b) => b.owner !== owner && b.biz.type === biz.type && DISTRICT_OF_LOT(b.biz.lot) === district).length
  const competition = 1 / (1 + 0.35 * rivals)
  const power = city.needs.power.ratio < WARN_AT ? 0.6 : 1
  const safety = city.needs.safety.ratio < CRISIS_AT ? 0.75 : 1
  const rating = averageRating(owner, players)
  const ratingFactor = rating.count ? 0.8 + (rating.avg / 5) * 0.4 : 1
  const visits = potential * def.baseVisits * typeFit * priceFactor * upgrades * competition * power * safety * ratingFactor
  const check = def.check[biz.price - 1]
  const revenue = visits * check
  const profit = revenue - def.upkeep
  return { visits: Math.round(visits), check, revenue: Math.round(revenue), upkeep: def.upkeep, profit: Math.round(profit), rating, power: power < 1 }
}

/** Money waiting to be collected: profit per city day × days since the last collection (at most 3). */
export function pendingIncome(owner: string, biz: Business, city: CityState, players: Record<string, PlayerDoc>, cfg: GameConfig) {
  const D = cfg.dayMinutes * 60_000
  const days = Math.min(3, Math.max(0, (city.now - biz.lastCollect) / D))
  return Math.max(0, Math.round(businessEconomics(owner, biz, city, players).profit * days))
}
