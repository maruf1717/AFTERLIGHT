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
