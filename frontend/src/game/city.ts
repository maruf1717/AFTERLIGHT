import {
  BAD_MOOD,
  BAD_MOOD_MS,
  BUILDING_BY_ID,
  GOOD_MOOD,
  GRID,
  MOVE_IN_SHARE,
  NEEDS,
  OFFLINE_CAP_MS,
  POWER_PER_JOB,
  POWER_PER_RESIDENT,
  ROAD_BY_ID,
  SELL_SHARE,
  SNAPSHOT_EVERY_MS,
  START_MONEY,
  TAX_PER_JOB,
  TAX_PER_RESIDENT,
  WATER_PER_JOB,
  WATER_PER_RESIDENT,
  WORKERS_SHARE,
  type BuildingDef,
  type Need,
  type RoadKind,
} from './catalog'

/*
 * A player's city: a square field, roads and buildings the player put there, money, residents.
 * Everything here is plain data and pure functions, so the same city looks and behaves the
 * same on every device and in the tests.
 */

export type Rot = 0 | 1 | 2 | 3

export interface Placed {
  uid: number
  /** Building id from the catalog. */
  id: string
  /** Top-left cell of the footprint. */
  x: number
  z: number
  /** Quarter turns: the front faces +z, then -x, -z, +x. */
  r: Rot
}

/** What can be rolled back to. */
export interface Snapshot {
  money: number
  pop: number
  roads: Record<string, RoadKind>
  items: Placed[]
  at: number
}

export interface CityData {
  v: 3
  name: string
  money: number
  pop: number
  /** The most residents the city ever had (what is unlocked). */
  best: number
  roads: Record<string, RoadKind>
  items: Placed[]
  nextUid: number
  createdAt: number
  /** Last moment the city was simulated (money and residents are worked out up to here). */
  at: number
  /** Since when residents are very unhappy (null: they are not). */
  badSince: number | null
  /** The last good state, for the roll-back. */
  snapshot: Snapshot | null
  /** How many times the city fell apart and rolled back. */
  rollbacks: number
}

/** The highway into the city: three cells of road from the west edge, always there. */
export const ENTRY_Z = Math.floor(GRID / 2)
export const ENTRY: [number, number][] = [
  [0, ENTRY_Z],
  [1, ENTRY_Z],
  [2, ENTRY_Z],
]
export const key = (x: number, z: number) => `${x},${z}`
export const isEntry = (x: number, z: number) => ENTRY.some(([a, b]) => a === x && b === z)
export const inGrid = (x: number, z: number) => x >= 0 && z >= 0 && x < GRID && z < GRID

export function newCity(name: string, now: number): CityData {
  const roads: Record<string, RoadKind> = {}
  for (const [x, z] of ENTRY) roads[key(x, z)] = 'street'
  return { v: 3, name, money: START_MONEY, pop: 0, best: 0, roads, items: [], nextUid: 1, createdAt: now, at: now, badSince: null, snapshot: null, rollbacks: 0 }
}

/* Footprints ---------------------------------------------------------------- */

export function size(def: BuildingDef, r: Rot): [number, number] {
  return r % 2 ? [def.d, def.w] : [def.w, def.d]
}

export function cellsOf(p: { id: string; x: number; z: number; r: Rot }): [number, number][] {
  const [w, d] = size(BUILDING_BY_ID[p.id], p.r)
  const out: [number, number][] = []
  for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) out.push([p.x + i, p.z + j])
  return out
}

/** Centre of a building in cell units. */
export function centre(p: Placed): [number, number] {
  const [w, d] = size(BUILDING_BY_ID[p.id], p.r)
  return [p.x + w / 2, p.z + d / 2]
}

/** Which building (uid) stands on each cell. */
export function occupancy(c: CityData): Map<string, number> {
  const m = new Map<string, number>()
  for (const p of c.items) for (const [x, z] of cellsOf(p)) m.set(key(x, z), p.uid)
  return m
}

export const unlocked = (c: CityData, def: BuildingDef) => c.best >= def.unlock

/* Building and selling ----------------------------------------------------- */

export type Refusal = 'Нет денег' | 'Здесь занято' | 'За краем карты' | 'Ещё не открыто' | 'Въезд в город нельзя трогать' | 'Здесь пусто'

export function canBuild(c: CityData, id: string, x: number, z: number, r: Rot): Refusal | null {
  const def = BUILDING_BY_ID[id]
  if (!unlocked(c, def)) return 'Ещё не открыто'
  const occ = occupancy(c)
  for (const [cx, cz] of cellsOf({ id, x, z, r })) {
    if (!inGrid(cx, cz)) return 'За краем карты'
    if (occ.has(key(cx, cz)) || c.roads[key(cx, cz)]) return 'Здесь занято'
  }
  if (c.money < def.cost) return 'Нет денег'
  return null
}

export function build(c: CityData, id: string, x: number, z: number, r: Rot): CityData | Refusal {
  const why = canBuild(c, id, x, z, r)
  if (why) return why
  const def = BUILDING_BY_ID[id]
  return { ...c, money: c.money - def.cost, items: [...c.items, { uid: c.nextUid, id, x, z, r }], nextUid: c.nextUid + 1 }
}

export function canRoad(c: CityData, kind: RoadKind, x: number, z: number): Refusal | null {
  if (!inGrid(x, z)) return 'За краем карты'
  if (isEntry(x, z)) return 'Въезд в город нельзя трогать'
  if (occupancy(c).has(key(x, z))) return 'Здесь занято'
  const old = c.roads[key(x, z)]
  if (old === kind) return 'Здесь занято'
  if (c.money < ROAD_BY_ID[kind].cost) return 'Нет денег'
  return null
}

/** Lay a road on a cell (or change its kind: the old one is sold back at the usual share). */
export function road(c: CityData, kind: RoadKind, x: number, z: number): CityData | Refusal {
  const why = canRoad(c, kind, x, z)
  if (why) return why
  const old = c.roads[key(x, z)]
  const back = old ? Math.floor(ROAD_BY_ID[old].cost * SELL_SHARE) : 0
  return { ...c, money: c.money - ROAD_BY_ID[kind].cost + back, roads: { ...c.roads, [key(x, z)]: kind } }
}

/** Sell what stands on a cell (a building or a road) for part of its price. */
export function sell(c: CityData, x: number, z: number): { city: CityData; got: number; what: string } | Refusal {
  if (isEntry(x, z)) return 'Въезд в город нельзя трогать'
  const uid = occupancy(c).get(key(x, z))
  if (uid !== undefined) {
    const p = c.items.find((i) => i.uid === uid)!
    const def = BUILDING_BY_ID[p.id]
    const got = Math.floor(def.cost * SELL_SHARE)
    return { city: { ...c, money: c.money + got, items: c.items.filter((i) => i.uid !== uid) }, got, what: def.name }
  }
  const kind = c.roads[key(x, z)]
  if (!kind) return 'Здесь пусто'
  const got = Math.floor(ROAD_BY_ID[kind].cost * SELL_SHARE)
  const roads = { ...c.roads }
  delete roads[key(x, z)]
  return { city: { ...c, money: c.money + got, roads }, got, what: ROAD_BY_ID[kind].name }
}

/* How the city lives --------------------------------------------------------- */

export type Problem = Need | 'power' | 'water' | 'jobs' | 'smoke' | 'road'

export interface HomeState {
  uid: number
  /** Homes count only with a road to the highway. */
  connected: boolean
  happiness: number
  missing: Problem[]
}

export interface Stats {
  /** Buildings with a road to the highway. */
  connected: Set<number>
  /** Road cells reachable from the highway. */
  reachable: Set<string>
  homes: number
  jobs: number
  workers: number
  power: { made: number; used: number }
  water: { made: number; used: number }
  happiness: number
  /** The residents the homes can hold at this happiness. */
  target: number
  /** Money per minute (taxes minus running costs). */
  income: number
  upkeep: number
  taxes: number
  perHome: HomeState[]
  /** Needs active at this population, and how many homes (by people) have each. */
  needs: { id: Need; covered: number }[]
}

const N4: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

/** Road cells joined to the highway. */
export function reachableRoads(c: CityData): Set<string> {
  const seen = new Set<string>()
  const queue = ENTRY.map(([x, z]) => key(x, z))
  for (const k of queue) seen.add(k)
  while (queue.length) {
    const [x, z] = queue.shift()!.split(',').map(Number)
    for (const [dx, dz] of N4) {
      const k = key(x + dx, z + dz)
      if (!seen.has(k) && c.roads[k]) {
        seen.add(k)
        queue.push(k)
      }
    }
  }
  return seen
}

/** Does a building touch a road joined to the highway? */
export function touchesRoad(p: Placed, reachable: Set<string>) {
  for (const [x, z] of cellsOf(p)) for (const [dx, dz] of N4) if (reachable.has(key(x + dx, z + dz))) return true
  return false
}

const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1])

export function evaluate(c: CityData): Stats {
  const reachable = reachableRoads(c)
  const connected = new Set(c.items.filter((p) => touchesRoad(p, reachable)).map((p) => p.uid))
  const live = c.items.filter((p) => connected.has(p.uid))
  const defOf = (p: Placed) => BUILDING_BY_ID[p.id]

  let homes = 0
  let jobs = 0
  let made = 0
  let wmade = 0
  let upkeep = 0
  for (const p of c.items) upkeep += defOf(p).upkeep
  for (const p of live) {
    const d = defOf(p)
    homes += d.homes ?? 0
    jobs += d.jobs ?? 0
    made += d.power ?? 0
    wmade += d.water ?? 0
  }
  const pop = Math.min(c.pop, homes)
  const workers = Math.round(pop * WORKERS_SHARE)
  const filled = Math.min(workers, jobs)
  const powerUsed = pop * POWER_PER_RESIDENT + filled * POWER_PER_JOB
  const waterUsed = pop * WATER_PER_RESIDENT + filled * WATER_PER_JOB
  const powerOk = powerUsed <= 0 ? 1 : Math.min(1, made / powerUsed)
  const waterOk = waterUsed <= 0 ? 1 : Math.min(1, wmade / waterUsed)
  const unemployed = workers > 0 ? Math.max(0, workers - jobs) / workers : 0

  // Needs that matter at this size of town (by the most residents ever, so they do not flicker).
  const active = NEEDS.filter((n) => Math.max(c.best, pop) >= n.from)
  const services = live.filter((p) => defOf(p).covers?.length)
  const polluters = live.filter((p) => defOf(p).pollution)
  const pleasant = live.filter((p) => defOf(p).mood)

  const perHome: HomeState[] = []
  const coveredBy = new Map<Need, number>()
  let weighted = 0
  let weight = 0
  for (const p of c.items) {
    const d = defOf(p)
    if (!d.homes) continue
    if (!connected.has(p.uid)) {
      perHome.push({ uid: p.uid, connected: false, happiness: 0, missing: ['road'] })
      continue
    }
    const here = centre(p)
    const missing: Problem[] = []
    let got = 0
    for (const n of active) {
      const ok = services.some((s) => defOf(s).covers!.some((cv) => cv.need === n.id && dist(centre(s), here) <= cv.r + 0.5))
      if (ok) {
        got++
        coveredBy.set(n.id, (coveredBy.get(n.id) ?? 0) + d.homes)
      } else missing.push(n.id)
    }
    let h = 45 + 40 * (active.length ? got / active.length : 1)
    // Nice things nearby, and the kind of road outside.
    let bonus = 0
    for (const q of pleasant) if (q.uid !== p.uid && dist(centre(q), here) <= defOf(q).mood!.r + 0.5) bonus += defOf(q).mood!.v
    // The best road at the door counts (an avenue outside makes up for a dirt lane behind).
    let roadMood = -Infinity
    for (const [x, z] of cellsOf(p))
      for (const [dx, dz] of N4) {
        const k = c.roads[key(x + dx, z + dz)]
        if (k) roadMood = Math.max(roadMood, ROAD_BY_ID[k].mood)
      }
    if (roadMood === -Infinity) roadMood = 0
    h += Math.min(12, bonus) + roadMood
    if (polluters.some((s) => dist(centre(s), here) <= defOf(s).pollution! + 0.5)) {
      h -= 25
      missing.push('smoke')
    }
    if (powerOk < 1) {
      h -= 45 * (1 - powerOk)
      missing.push('power')
    }
    if (waterOk < 1) {
      h -= 45 * (1 - waterOk)
      missing.push('water')
    }
    if (unemployed > 0.05) {
      h -= Math.min(30, 50 * unemployed)
      missing.push('jobs')
    }
    h = Math.max(0, Math.min(100, h))
    perHome.push({ uid: p.uid, connected: true, happiness: h, missing })
    weighted += h * d.homes
    weight += d.homes
  }
  const happiness = weight ? Math.round(weighted / weight) : 60
  // Unhappy towns do not fill up.
  const target = Math.round(homes * Math.min(1, 0.35 + happiness / 100))
  const taxes = pop * TAX_PER_RESIDENT + filled * TAX_PER_JOB
  const income = Math.round((taxes - upkeep) * 10) / 10
  const needs = active.map((n) => ({ id: n.id, covered: weight ? (coveredBy.get(n.id) ?? 0) / weight : 0 }))
  return {
    connected,
    reachable,
    homes,
    jobs,
    workers,
    power: { made, used: Math.round(powerUsed) },
    water: { made: wmade, used: Math.round(waterUsed) },
    happiness,
    target,
    income,
    upkeep,
    taxes: Math.round(taxes),
    perHome,
    needs,
  }
}

export interface TickResult {
  city: CityData
  stats: Stats
  /** The city fell apart and was rolled back. */
  rolledBack: boolean
}

/**
 * Run the city up to `now`: money from taxes, residents moving in or out, and the roll-back
 * when residents stay very unhappy too long. Works for a few seconds and for hours away.
 */
export function advance(c0: CityData, now: number, offline = false): TickResult {
  let c = c0
  const elapsed = Math.max(0, now - c.at)
  if (elapsed <= 0) return { city: c, stats: evaluate(c), rolledBack: false }
  const counted = Math.min(elapsed, offline ? OFFLINE_CAP_MS : elapsed)
  let stats = evaluate(c)
  // Residents move in or out step by step (5-second steps, at most 60 of them).
  const steps = Math.min(60, Math.max(1, Math.round(counted / 5000)))
  let pop = c.pop
  for (let i = 0; i < steps; i++) {
    const gap = stats.target - pop
    pop += gap > 0 ? Math.max(1, Math.round(gap * MOVE_IN_SHARE)) : Math.min(-1, Math.round(gap * MOVE_IN_SHARE))
    if (Math.abs(stats.target - pop) <= 1) pop = stats.target
    pop = Math.max(0, Math.min(stats.homes, pop))
  }
  const money = c.money + (stats.income * counted) / 60_000
  c = { ...c, pop, best: Math.max(c.best, pop), money, at: now }
  stats = evaluate(c)

  // Very unhappy for too long: the city rolls back to the last good state.
  let rolledBack = false
  if (stats.happiness < BAD_MOOD && c.pop > 0) {
    const since = c.badSince ?? now
    c = { ...c, badSince: since }
    if (now - since >= BAD_MOOD_MS && c.snapshot && !offline) {
      const s = c.snapshot
      c = { ...c, money: s.money, pop: s.pop, roads: { ...s.roads }, items: s.items.map((p) => ({ ...p })), badSince: null, rollbacks: c.rollbacks + 1 }
      stats = evaluate(c)
      rolledBack = true
    }
  } else if (c.badSince !== null) c = { ...c, badSince: null }
  // Remember a good state.
  if (!rolledBack && stats.happiness >= GOOD_MOOD && c.pop > 0 && (!c.snapshot || now - c.snapshot.at >= SNAPSHOT_EVERY_MS)) {
    c = { ...c, snapshot: { money: c.money, pop: c.pop, roads: { ...c.roads }, items: c.items.map((p) => ({ ...p })), at: now } }
  }
  return { city: c, stats, rolledBack }
}

/** Seconds left before the roll-back, or null when residents are not that unhappy. */
export function rollbackIn(c: CityData, now: number): number | null {
  if (c.badSince === null) return null
  return Math.max(0, Math.ceil((BAD_MOOD_MS - (now - c.badSince)) / 1000))
}
