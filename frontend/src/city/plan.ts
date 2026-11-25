import type { DistrictId } from '../data/types'
import { dist, Grid, type V2 } from './geometry'
import { generateCity, outsideBy, type CityPlan, type Parcel } from './planner'

/** The one city layout everybody shares (deterministic). */
export const PLAN: CityPlan = generateCity()

export const PARCEL_BY_ID: Record<string, Parcel> = Object.fromEntries(PLAN.parcels.map((p) => [p.id, p]))

/** Which expansion stage is open at a given population. */
export function stageFor(population: number) {
  return population < 300 ? 0 : population < 550 ? 1 : population < 800 ? 2 : 3
}

const roadGrid = new Grid<V2 & { half: number }>(10)
for (const e of PLAN.edges) for (const p of e.points) roadGrid.insert({ x: p.x, z: p.z, half: e.width / 2 })
const parcelGrid = new Grid<V2 & { i: number }>(16)
PLAN.parcels.forEach((p, i) => parcelGrid.insert({ x: p.c.x, z: p.c.z, i }))

/** Distance from a point to the edge of the nearest road surface (Infinity if none nearby). */
export function roadClearance(p: V2, radius = 14) {
  let best = Infinity
  for (const s of roadGrid.near(p, radius)) best = Math.min(best, dist(s, p) - s.half)
  return best
}

export function inParcel(p: V2, margin = 0) {
  return parcelGrid.near(p, 30).some((q) => {
    const o = PLAN.parcels[q.i]
    const dx = p.x - o.c.x
    const dz = p.z - o.c.z
    const ux = { x: Math.cos(o.rot), z: -Math.sin(o.rot) }
    const uz = { x: Math.sin(o.rot), z: Math.cos(o.rot) }
    return Math.abs(dx * ux.x + dz * ux.z) <= o.hw + margin && Math.abs(dx * uz.x + dz * uz.z) <= o.hd + margin
  })
}

export { outsideBy }

export const ZONE_CENTROID: Record<DistrictId, V2> = PLAN.zoneCentroid

/* ------------------------------------------------------------------ */
/* The settlement on day one                                           */
/* ------------------------------------------------------------------ */

const byDistance = (to: V2) => (a: Parcel, b: Parcel) => dist(a.c, to) - dist(b.c, to)
const edgeStage = (p: Parcel) => PLAN.edges[p.edge].stage
const landmarkParcel = (name: string) => PLAN.parcels.find((p) => p.landmark === name)

/**
 * Parcels built from the very first day, so every district looks lived in: old five-storeys
 * and private houses in the microdistrict, low-rise shops and offices around the downtown
 * ring, two old warehouses and garages next to the plant.
 */
export const STARTER_PARCELS: { residential: Parcel[]; downtown: Parcel[]; industrial: Parcel[] } = (() => {
  const free = (zone: DistrictId) => PLAN.parcels.filter((p) => p.zone === zone && p.use === 'building')
  const residential = free('residential')
    .sort((a, b) => edgeStage(a) - edgeStage(b) || a.order - b.order)
    .slice(0, 7)
  // Downtown starts around the roundabout: the roads to it open with them.
  const ring = PLAN.roundabouts[0]?.c ?? PLAN.zoneCentroid.downtown
  const downtown = free('downtown').sort(byDistance(ring)).slice(0, 7)
  const plant = landmarkParcel('plant')
  const industrial = free('industrial')
    .sort(byDistance(plant ? plant.c : PLAN.zoneCentroid.industrial))
    .slice(0, 3)
  return { residential, downtown, industrial }
})()

export const STARTER_IDS = new Set(Object.values(STARTER_PARCELS).flatMap((l) => l.map((p) => p.id)))

/**
 * The stage at which each road appears. Roads leading to the plant, the landmarks and the
 * starting buildings are there from day one (the shortest way to the open network); the
 * parcels along them still open with their own stage.
 */
export const EDGE_STAGE: number[] = (() => {
  const st = PLAN.edges.map((e) => e.stage)
  const anchors = PLAN.parcels.filter((p) => p.use === 'landmark' || STARTER_IDS.has(p.id))
  const openNode = (n: number) => PLAN.nodes[n].edges.some((e) => st[e] === 0)
  for (const p of anchors) {
    const e0 = PLAN.edges[p.edge]
    if (st[e0.id] === 0) continue
    st[e0.id] = 0
    // Breadth-first from both ends of the parcel's road to the nearest open junction.
    const prev = new Map<number, { node: number; edge: number }>()
    const queue = [e0.a, e0.b]
    const seen = new Set(queue)
    let goal = -1
    while (queue.length) {
      const n = queue.shift()!
      if (openNode(n)) {
        goal = n
        break
      }
      for (const eid of PLAN.nodes[n].edges) {
        const e = PLAN.edges[eid]
        const m = e.a === n ? e.b : e.a
        if (seen.has(m)) continue
        seen.add(m)
        prev.set(m, { node: n, edge: eid })
        queue.push(m)
      }
    }
    for (let n = goal; prev.has(n); n = prev.get(n)!.node) st[prev.get(n)!.edge] = 0
  }
  return st
})()

/** Is this road visible (and driven on) with the city opened up to `stage`? */
export const roadOpen = (edgeId: number, stage: number) => EDGE_STAGE[edgeId] <= stage
