import { createRng, hashString } from '../lib/random'
import { pointAt, right, type V2 } from './geometry'
import { PLAN, roadClearance } from './plan'
import { Grid } from './geometry'
import { SIDEWALK } from './planner'

/*
 * Where trees, lamps and other street furniture may stand. Nothing is placed inside a plot
 * meant for a building (homes, civic sites, business plots, landmarks) or closer than one
 * metre to it, so no tree grows through a wall and no lamp post stands on a terrace.
 */

const lots = PLAN.parcels.filter((p) => p.use !== 'green')
const lotGrid = new Grid<V2 & { i: number }>(16)
lots.forEach((p, i) => lotGrid.insert({ x: p.c.x, z: p.c.z, i }))

/** Is the point inside any building plot, grown by `margin` metres on every side? */
export function inBuildingPlot(p: V2, margin = 1) {
  return lotGrid.near(p, 32).some((q) => {
    const o = lots[q.i]
    const dx = p.x - o.c.x
    const dz = p.z - o.c.z
    const lx = dx * Math.cos(o.rot) - dz * Math.sin(o.rot)
    const lz = dx * Math.sin(o.rot) + dz * Math.cos(o.rot)
    return Math.abs(lx) <= o.hw + margin && Math.abs(lz) <= o.hd + margin
  })
}

/** May a piece of decor stand here? */
export const decorAllowed = (p: V2, margin = 1) => !inBuildingPlot(p, margin)

export interface TreeSpot {
  x: number
  z: number
  s: number
  r: number
  c: string
}
export interface LampSpot {
  x: number
  z: number
  /** Unit vector from the post towards the road. */
  to: V2
}

const yaw = (t: V2) => Math.atan2(-t.z, t.x)

/** Street trees on the outer edge of the sidewalks and lamps on the kerb, for the open roads. */
export function streetDecor(stage: number): { trees: TreeSpot[]; lamps: (LampSpot & { r: number })[] } {
  // Every street exists from day one, so the furniture is the same at every stage.
  void stage
  const rng = createRng(77)
  const trees: TreeSpot[] = []
  const lamps: (LampSpot & { r: number })[] = []
  for (const e of PLAN.edges) {
    for (const side of [1, -1]) {
      for (let s = 10; s < e.length - 10; s += rng.range(8, 11)) {
        const { p, t } = pointAt(e.points, e.cum, s)
        const n = right(t)
        const off = e.width / 2 + SIDEWALK - 0.45
        const q = { x: p.x + n.x * off * side, z: p.z + n.z * off * side }
        const keep = rng.chance(e.kind === 'local' ? 0.3 : 0.45)
        const sc = rng.range(0.85, 1.15)
        const r = rng.range(0, 6)
        const c = rng.pick(['#4f8a3c', '#5e9a46', '#3f7a35', '#6aa24f', '#77a845'])
        if (e.kind === 'ring' || !keep) continue
        if (roadClearance(q) < SIDEWALK - 0.6) continue
        // The crown is about a metre wide: keep it off the plots.
        if (!decorAllowed(q, Math.max(1, 1.1 * sc))) continue
        trees.push({ x: q.x, z: q.z, s: sc, r, c })
      }
      for (let s = 14; s < e.length - 10; s += 26) {
        const { p, t } = pointAt(e.points, e.cum, s + (side > 0 ? 0 : 13))
        const n = right(t)
        const off = e.width / 2 + 0.35
        const q = { x: p.x + n.x * off * side, z: p.z + n.z * off * side }
        if (!decorAllowed(q, 1)) continue
        const to = { x: -n.x * side, z: -n.z * side }
        lamps.push({ x: q.x, z: q.z, to, r: yaw(to) })
      }
    }
  }
  return { trees, lamps }
}

/** Trees on the lawns between blocks, away from the roads and the plots. */
export function lawnDecor(): { x: number; z: number; s: number; r: number; conifer: boolean }[] {
  return PLAN.lawnTrees
    .filter((t) => roadClearance(t) >= 2.5 && decorAllowed(t, 1.2 * t.s))
    .map((t) => ({ x: t.x, z: t.z, s: t.s, r: hashString(`${t.x}`) % 6, conifer: !!t.conifer }))
}
