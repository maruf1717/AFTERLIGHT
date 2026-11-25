import * as dm from '../lib/dmath'
import type { DistrictId } from '../data/types'
import { createRng, shuffle, type Rng } from '../lib/random'
import {
  add,
  arcTable,
  dist,
  fromAngle,
  Grid,
  len,
  mul,
  norm,
  obbContains,
  obbOverlap,
  pointAt,
  polylineLength,
  resample,
  right,
  samplePoints,
  segIntersect,
  sub,
  v,
  type OBB,
  type V2,
} from './geometry'

/**
 * Procedural city plan. Order of work, like a real planner would do it:
 *   1. main roads (arterials) across the territory,
 *   2. secondary roads grown out of them, then residential streets out of those,
 *      each new road starting on an existing one and ending on another (T-junction)
 *      or in a cul-de-sac, so the network is always connected,
 *   3. junctions and a roundabout, the network turned into a graph of nodes and edges,
 *   4. building parcels laid out along every road, facing it, sized by zone,
 *   5. parcel uses (homes, shops, civic sites, plots for players, squares),
 *   6. lawns, trees and footpaths in what is left between them.
 * Everything is deterministic from the seed, so every player sees the same city.
 */

export type RoadKind = 'arterial' | 'secondary' | 'local' | 'ring'
export const ROAD_WIDTH: Record<RoadKind, number> = { arterial: 10, secondary: 7, local: 5.4, ring: 7 }
/** Distance of each travel lane from the road centre line. */
export const LANE: Record<RoadKind, number> = { arterial: 2.5, secondary: 1.7, local: 1.3, ring: 1.7 }
export const SIDEWALK = 1.8

export interface RoadNode {
  id: number
  x: number
  z: number
  edges: number[]
  deadEnd: boolean
}

export interface RoadEdge {
  id: number
  a: number
  b: number
  kind: RoadKind
  width: number
  points: V2[]
  cum: number[]
  length: number
  /** Ring segments are one-way (counter-clockwise from above). */
  oneway: boolean
  /** Expansion stage: 0 is built from the start, higher stages open as the city grows. */
  stage: number
}

export type ParcelSize = 'small' | 'medium' | 'large'
export type ParcelUse = 'building' | 'civic' | 'plot' | 'green' | 'landmark'

export interface Parcel extends OBB {
  id: string
  zone: DistrictId
  edge: number
  stage: number
  size: ParcelSize
  w: number
  d: number
  use: ParcelUse
  /** For civic and legacy plots: the reserved key (e.g. "res-park"). */
  key?: string
  /** For landmark parcels: which landmark. */
  landmark?: string
  /** For green parcels: what kind of green. */
  green?: 'square' | 'garden'
  /** Kept for residents: the city never builds here by itself (stage 2.4, round 2). */
  forPlayers?: boolean
  /** Distance from the settlement the city grew from. */
  order: number
}

export interface CityPlan {
  nodes: RoadNode[]
  edges: RoadEdge[]
  parcels: Parcel[]
  paths: V2[][]
  lawnTrees: { x: number; z: number; s: number; conifer: boolean }[]
  roundabouts: { c: V2; r: number }[]
  origin: V2
  zoneCentroid: Record<DistrictId, V2>
}

/* ------------------------------------------------------------------ */

/** Overall scale of the layout: smaller is denser. */
const K = 1.25
const SETTLEMENT = v(70 * K, 0)
const RX = 150 * K
const RZ = 98 * K

export function cityRadiusAt(x: number, z: number) {
  const a = dm.atan2(z / RZ, x / RX)
  return 1 + 0.08 * dm.sin(3 * a + 1) + 0.05 * dm.sin(5 * a + 2)
}
/** Inside the city outline (with a margin in world units). */
export function inBounds(p: V2, margin = 0) {
  const r = cityRadiusAt(p.x, p.z)
  const e = dm.hypot(p.x / (RX * r - margin), p.z / (RZ * r - margin))
  return e < 1
}
/** How far outside the city a point is, 0 inside. */
export function outsideBy(p: V2) {
  const r = cityRadiusAt(p.x, p.z)
  const e = dm.hypot(p.x / (RX * r), p.z / (RZ * r))
  return Math.max(0, (e - 1) * Math.min(RX, RZ))
}

/** District borders: the two north–south avenues. */
const WEST_AVE = -80 * K * 0.8
const EAST_AVE = 60 * K * 0.8
export function zoneAt(p: V2): DistrictId {
  if (p.x < WEST_AVE) return 'industrial'
  if (p.x > EAST_AVE) return 'residential'
  return 'downtown'
}

/** The ring road runs along this fraction of the city outline. */
const RING_AT = 0.86

/** Points of a closed ellipse-like loop at `scale` of the city outline. */
function outline(scale: number, step = 2.5): V2[] {
  const pts: V2[] = []
  const n = Math.ceil((2 * Math.PI * Math.max(RX, RZ) * scale) / step)
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2
    const r = cityRadiusAt(dm.cos(a) * RX, dm.sin(a) * RZ) * scale
    pts.push(v(dm.cos(a) * RX * r, dm.sin(a) * RZ * r))
  }
  return pts
}

export function generateCity(seed = 20261125): CityPlan {
  const rng = createRng(seed)

  /*
   * 1. Main roads: a ring road around the whole city, the boulevard across it west to east
   *    and three avenues north to south (between the districts and through the centre).
   *    Every street of the districts runs from one main road or street to another, so the
   *    network has no dead ends and a car can get from anywhere to anywhere.
   */
  const inside = (p: V2, extra = 0.03) => inBounds(p, 0) && dm.hypot(p.x / RX, p.z / RZ) / cityRadiusAt(p.x, p.z) < RING_AT + extra
  const clip = (pts: V2[]) => {
    const runs: V2[][] = []
    let run: V2[] = []
    for (const p of pts) {
      if (inside(p)) run.push(p)
      else if (run.length) {
        runs.push(run)
        run = []
      }
    }
    if (run.length) runs.push(run)
    return runs.filter((r) => r.length > 3)
  }
  const line = (a: V2, b: V2, bend = 0, phase = 0): V2[] => {
    const L = dist(a, b)
    const n = Math.max(2, Math.ceil(L / 2))
    const d = norm(sub(b, a))
    const nrm = right(d)
    const out: V2[] = []
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const p = add(a, mul(sub(b, a), t))
      out.push(add(p, mul(nrm, bend * dm.sin(t * Math.PI * 2 + phase))))
    }
    return out
  }
  const ZX = RX * 1.2
  const ZZ = RZ * 1.2
  type Poly = { pts: V2[]; kind: RoadKind; closed?: boolean }
  const polys: Poly[] = []
  // Ring road (closed loop).
  polys.push({ pts: outline(RING_AT), kind: 'arterial', closed: true })
  // Boulevard and avenues.
  for (const r of clip(line(v(-ZX, 3), v(ZX, -3), 3, 0.5))) polys.push({ pts: r, kind: 'arterial' })
  for (const x of [WEST_AVE, 0, EAST_AVE]) for (const r of clip(line(v(x, -ZZ), v(x, ZZ), x === 0 ? 0 : 2.5, 1.3))) polys.push({ pts: r, kind: 'arterial' })

  // 2. District streets: a regular grid in each district, the block size by what is built there.
  const GRID: Record<DistrictId, { x0: number; x1: number; dx: number; dz: number }> = {
    industrial: { x0: -ZX, x1: WEST_AVE, dx: 52, dz: 50 },
    downtown: { x0: WEST_AVE, x1: EAST_AVE, dx: 38, dz: 36 },
    residential: { x0: EAST_AVE, x1: ZX, dx: 42, dz: 42 },
  }
  for (const zone of ['industrial', 'downtown', 'residential'] as DistrictId[]) {
    const G = GRID[zone]
    // East–west streets, from the district's west border to its east border.
    for (let z = G.dz; z < ZZ; z += G.dz)
      for (const zz of [z, -z])
        for (const r of clip(line(v(G.x0 - 3, zz), v(G.x1 + 3, zz + rng.range(-2, 2)), 1.2, zz)))
          if (polylineLength(r) > 20) polys.push({ pts: r, kind: zone === 'downtown' || Math.abs(zz) < G.dz * 1.5 ? 'secondary' : 'local' })
    // North–south streets between the avenues.
    const span = G.x1 - G.x0
    const n = Math.max(1, Math.round(Math.min(span, 2 * RX) / G.dx))
    const step = (Math.min(G.x1, RX) - Math.max(G.x0, -RX)) / n
    for (let i = 1; i < n; i++) {
      const x = Math.max(G.x0, -RX) + i * step
      if (Math.abs(x) < G.dx * 0.6 || Math.abs(x - WEST_AVE) < G.dx * 0.6 || Math.abs(x - EAST_AVE) < G.dx * 0.6) continue
      for (const r of clip(line(v(x, -ZZ), v(x + rng.range(-3, 3), ZZ), 1.5, x))) if (polylineLength(r) > 20) polys.push({ pts: r, kind: 'local' })
    }
  }

  // 4. Junctions where lines cross, then cut every line at its junctions.
  const segGrid = new Grid<V2 & { poly: number; seg: number }>(8)
  polys.forEach((pl, pi) => pl.pts.forEach((p, si) => si < pl.pts.length - 1 && segGrid.insert({ x: p.x, z: p.z, poly: pi, seg: si })))
  const cuts: { poly: number; seg: number; t: number; p: V2 }[] = []
  polys.forEach((pl, pi) => {
    for (let si = 0; si < pl.pts.length - 1; si++) {
      const a = pl.pts[si]
      const b = pl.pts[si + 1]
      for (const q of segGrid.near(a, 6)) {
        if (q.poly <= pi) continue
        const c = polys[q.poly].pts[q.seg]
        const d = polys[q.poly].pts[q.seg + 1]
        const x = segIntersect(a, b, c, d)
        if (!x) continue
        cuts.push({ poly: pi, seg: si, t: dist(a, x) / Math.max(1e-6, dist(a, b)), p: x }, { poly: q.poly, seg: q.seg, t: dist(c, x) / Math.max(1e-6, dist(c, d)), p: x })
      }
    }
  })
  const nodes: RoadNode[] = []
  const nodeAt = (p: V2) => {
    const ex = nodes.find((n) => dist(n, p) < 3)
    if (ex) return ex.id
    nodes.push({ id: nodes.length, x: p.x, z: p.z, edges: [], deadEnd: false })
    return nodes.length - 1
  }
  const edges: RoadEdge[] = []
  const pushEdge = (a: number, b: number, kind: RoadKind, pts: V2[], oneway = false) => {
    if (pts.length < 2 || a === b) return
    const cum = arcTable(pts)
    const e: RoadEdge = { id: edges.length, a, b, kind, width: ROAD_WIDTH[kind], points: pts, cum, length: cum[cum.length - 1], oneway, stage: 0 }
    edges.push(e)
    nodes[a].edges.push(e.id)
    nodes[b].edges.push(e.id)
  }
  polys.forEach((pl, pi) => {
    const my = cuts.filter((c) => c.poly === pi).sort((a, b) => a.seg + a.t - (b.seg + b.t))
    if (!my.length) return // touches nothing: not part of the network
    const at = (c: { seg: number; t: number }) => c.seg + c.t
    // Points between two cut positions, inclusive of the exact cut points.
    const slice = (from: number, to: number, pFrom: V2, pTo: V2) => {
      const out: V2[] = [pFrom]
      for (let i = Math.floor(from) + 1; i <= Math.floor(to) && i < pl.pts.length; i++) if (i > from && i < to) out.push(pl.pts[i])
      out.push(pTo)
      return out
    }
    // Pieces between junctions become streets. Ends sticking out past the last junction are
    // dropped (no dead ends); a closed loop joins its last piece to its first.
    for (let k = 0; k < my.length - 1; k++) {
      const pts = slice(at(my[k]), at(my[k + 1]), my[k].p, my[k + 1].p)
      if (polylineLength(pts) < 2.5) continue
      pushEdge(nodeAt(my[k].p), nodeAt(my[k + 1].p), pl.kind, resample(pts, 2))
    }
    if (pl.closed && my.length > 1) {
      const lastCut = my[my.length - 1]
      const tail = slice(at(lastCut), pl.pts.length - 1, lastCut.p, pl.pts[pl.pts.length - 1])
      const head = slice(0, at(my[0]), pl.pts[0], my[0].p)
      pushEdge(nodeAt(lastCut.p), nodeAt(my[0].p), pl.kind, resample([...tail, ...head.slice(1)], 2))
    }
  })

  // 5. Variety: drop some short cross streets (T-junctions, bigger blocks), keep the network connected.
  const removed = new Set<number>()
  const connected = () => {
    const live = edges.filter((e) => !removed.has(e.id))
    const start = live[0].a
    const seen = new Set([start])
    const stack = [start]
    while (stack.length) {
      const n = stack.pop()!
      for (const eid of nodes[n].edges) {
        if (removed.has(eid)) continue
        const e = edges[eid]
        for (const m of [e.a, e.b]) {
          if (!seen.has(m)) {
            seen.add(m)
            stack.push(m)
          }
        }
      }
    }
    return live.every((e) => seen.has(e.a) && seen.has(e.b))
  }
  const degree = (n: number) => nodes[n].edges.filter((id) => !removed.has(id)).length
  // Any street still ending in nothing goes (repeat: removing one can expose another).
  for (let again = true; again; ) {
    again = false
    for (const e of edges) {
      if (removed.has(e.id)) continue
      if (degree(e.a) < 2 || degree(e.b) < 2 || e.a === e.b) {
        removed.add(e.id)
        again = true
      }
    }
  }
  // Variety: a few short side streets go (bigger blocks), never leaving a dead end.
  for (const e of shuffle([...edges], rng)) {
    if (removed.has(e.id) || e.kind !== 'local' || !rng.chance(0.12)) continue
    if (degree(e.a) < 4 || degree(e.b) < 4) continue
    removed.add(e.id)
    if (!connected()) removed.delete(e.id)
  }
  // Keep only the part of the network linked to the main roads.
  {
    const live = edges.filter((e) => !removed.has(e.id))
    const start = live.find((e) => e.kind === 'arterial')!.a
    const seen = new Set([start])
    const stack = [start]
    while (stack.length) {
      const n = stack.pop()!
      for (const eid of nodes[n].edges) {
        if (removed.has(eid)) continue
        const e = edges[eid]
        for (const m of [e.a, e.b]) {
          if (!seen.has(m)) {
            seen.add(m)
            stack.push(m)
          }
        }
      }
    }
    for (const e of edges) if (!seen.has(e.a)) removed.add(e.id)
  }
  // Two junctions a few metres apart (streets of neighbouring districts meeting a main road
  // almost opposite each other) become one crossroads: a tiny piece of road between them would
  // be a trap where cars block each other.
  for (let again = true; again; ) {
    again = false
    for (const e of edges) {
      if (removed.has(e.id) || e.length >= 14 || e.a === e.b) continue
      const A = nodes[e.a]
      const B = nodes[e.b]
      const m = v((A.x + B.x) / 2, (A.z + B.z) / 2)
      removed.add(e.id)
      for (const id of [...A.edges, ...B.edges]) {
        if (removed.has(id)) continue
        const x = edges[id]
        if (x.a === B.id) x.a = A.id
        if (x.b === B.id) x.b = A.id
        if (x.a === x.b) {
          removed.add(id)
          continue
        }
        const pts = x.points.slice()
        if (x.a === A.id) pts[0] = m
        if (x.b === A.id) pts[pts.length - 1] = m
        x.points = pts
        x.cum = arcTable(pts)
        x.length = x.cum[x.cum.length - 1]
      }
      A.x = m.x
      A.z = m.z
      A.edges = [...new Set([...A.edges, ...B.edges])].filter((id) => !removed.has(id))
      B.edges = []
      again = true
      break
    }
  }
  // Compact the arrays.
  const keep = edges.filter((e) => !removed.has(e.id))
  const idMap = new Map<number, number>()
  keep.forEach((e, i) => idMap.set(e.id, i))
  edges.length = 0
  keep.forEach((e, i) => edges.push({ ...e, id: i }))
  for (const n of nodes) n.edges = n.edges.filter((id) => idMap.has(id)).map((id) => idMap.get(id)!)
  for (const n of nodes) n.deadEnd = n.edges.length === 1

  // A roundabout where the boulevard meets the central avenue.
  const roundabouts: { c: V2; r: number }[] = []
  const centre = nodes
    .filter((n) => n.edges.length >= 4 && n.edges.every((e) => edges[e].kind === 'arterial'))
    .sort((p, q) => dist(p, v(0, 6 * K)) - dist(q, v(0, 6 * K)))[0]
  if (centre) makeRoundabout(centre, 11, nodes, edges, pushEdge, roundabouts)

  // Every road is there from day one; whole quarters (their plots) open as the city grows.
  for (const e of edges) e.stage = 0

  // 4. Parcels along every road.
  const parcels = layParcels(edges, nodes, rng)

  // 5. Uses.
  assignUses(parcels, rng)

  // 6. Lawns, trees and footpaths in what is left.
  const { lawnTrees, paths } = greenery(edges, parcels, rng)

  const zoneCentroid = {} as Record<DistrictId, V2>
  for (const z of ['industrial', 'downtown', 'residential'] as DistrictId[]) {
    const ps = parcels.filter((p) => p.zone === z)
    zoneCentroid[z] = ps.length ? v(ps.reduce((s, p) => s + p.c.x, 0) / ps.length, ps.reduce((s, p) => s + p.c.z, 0) / ps.length) : v(0, 0)
  }
  return { nodes, edges, parcels, paths, lawnTrees, roundabouts, origin: SETTLEMENT, zoneCentroid }
}

/** Expansion stage of a place: the core of each district first, then outwards, quarter by quarter. */
const DISTRICT_CORE: Record<DistrictId, V2> = { residential: SETTLEMENT, downtown: v(0, 0), industrial: v(-118 * K * 0.8, 0) }
export function stageAt(p: V2, zone: DistrictId) {
  const c = DISTRICT_CORE[zone]
  const d = dm.hypot((p.x - c.x) * 1.15, p.z - c.z)
  return d < 80 ? 0 : d < 102 ? 1 : d < 124 ? 2 : 3
}

/* ------------------------------------------------------------------ */

function makeRoundabout(
  centre: RoadNode,
  R: number,
  nodes: RoadNode[],
  edges: RoadEdge[],
  pushEdge: (a: number, b: number, kind: RoadKind, pts: V2[], oneway?: boolean) => void,
  out: { c: V2; r: number }[],
) {
  const entries: { node: number; ang: number }[] = []
  for (const eid of [...centre.edges]) {
    const e = edges[eid]
    const atStart = e.a === centre.id
    const pts = atStart ? e.points.slice() : e.points.slice().reverse()
    // Drop points inside the circle, end exactly on it.
    let k = 0
    while (k < pts.length - 1 && dist(pts[k], centre) < R) k++
    const inner = pts[Math.max(0, k - 1)]
    const outer = pts[k]
    const t = (R - dist(inner, centre)) / Math.max(0.001, dist(outer, centre) - dist(inner, centre))
    const onRing = add(inner, mul(sub(outer, inner), Math.max(0, Math.min(1, t))))
    const kept = [onRing, ...pts.slice(k)]
    const n = nodes.length
    nodes.push({ id: n, x: onRing.x, z: onRing.z, edges: [eid], deadEnd: false })
    const final = atStart ? kept : kept.slice().reverse()
    e.points = final
    e.cum = arcTable(final)
    e.length = e.cum[e.cum.length - 1]
    if (atStart) e.a = n
    else e.b = n
    entries.push({ node: n, ang: dm.atan2(onRing.z - centre.z, onRing.x - centre.x) })
  }
  centre.edges = []
  entries.sort((p, q) => p.ang - q.ang)
  // Counter-clockwise seen from above (x right, z down) is decreasing angle.
  for (let i = 0; i < entries.length; i++) {
    const from = entries[i]
    const to = entries[(i - 1 + entries.length) % entries.length]
    let a1 = to.ang
    if (a1 > from.ang) a1 -= Math.PI * 2
    const steps = Math.max(4, Math.ceil(((from.ang - a1) * R) / 2))
    const pts: V2[] = []
    for (let s = 0; s <= steps; s++) {
      const a = from.ang + ((a1 - from.ang) * s) / steps
      pts.push(v(centre.x + dm.cos(a) * R, centre.z + dm.sin(a) * R))
    }
    pushEdge(from.node, to.node, 'ring', pts, true)
  }
  out.push({ c: v(centre.x, centre.z), r: R })
}

/* ------------------------------------------------------------------ */

const SIZES: Record<DistrictId, { size: ParcelSize; p: number; w: [number, number]; d: [number, number] }[]> = {
  residential: [
    { size: 'small', p: 0.38, w: [9, 11], d: [9, 11.5] },
    { size: 'medium', p: 0.44, w: [14, 18], d: [12, 16] },
    { size: 'large', p: 0.18, w: [21, 27], d: [16, 21] },
  ],
  downtown: [
    { size: 'small', p: 0.28, w: [9, 12], d: [9, 12] },
    { size: 'medium', p: 0.47, w: [13, 17], d: [13, 17] },
    { size: 'large', p: 0.25, w: [18, 24], d: [17, 22] },
  ],
  industrial: [
    { size: 'medium', p: 0.5, w: [18, 24], d: [16, 21] },
    { size: 'large', p: 0.5, w: [25, 33], d: [21, 28] },
  ],
}

const MAX_DEPTH: Record<DistrictId, number> = { residential: 17, downtown: 15, industrial: 22 }

function layParcels(edges: RoadEdge[], nodes: RoadNode[], rng: Rng): Parcel[] {
  const roadGrid = new Grid<V2 & { half: number; tx: number; tz: number }>(10)
  for (const e of edges)
    e.points.forEach((p, i) => {
      const t = norm(sub(e.points[Math.min(e.points.length - 1, i + 1)], e.points[Math.max(0, i - 1)]))
      roadGrid.insert({ x: p.x, z: p.z, half: e.width / 2, tx: t.x, tz: t.z })
    })
  // Junction discs count as road too.
  for (const n of nodes) if (n.edges.length > 2) roadGrid.insert({ x: n.x, z: n.z, half: 4, tx: 0, tz: 0 })
  const parcelGrid = new Grid<V2 & { i: number }>(16)
  const out: Parcel[] = []

  const roadClear = (o: OBB) =>
    samplePoints(o, 2).every((p) =>
      roadGrid.near(p, 9).every((s) => {
        const ok = dist(s, p) > s.half + SIDEWALK + 0.1
        return ok
      }),
    )
  const parcelClear = (o: OBB) => parcelGrid.near(o.c, 40).every((q) => !obbOverlap(o, out[q.i], 1.2))

  // Main streets first: their frontage is the most valuable, side streets fill what is left.
  const ordered = [...edges].filter((e) => e.kind !== 'ring').sort((a, b) => ['arterial', 'secondary', 'local'].indexOf(a.kind) - ['arterial', 'secondary', 'local'].indexOf(b.kind))
  const tryPlace = (e: RoadEdge, side: 1 | -1, s: number, w: number, d: number, zone: DistrictId) => {
    const { p, t } = pointAt(e.points, e.cum, s + w / 2)
    const n = mul(right(t), side)
    const c = add(p, mul(n, e.width / 2 + SIDEWALK + 1.3 + d / 2))
    if (!inBounds(c, -10)) return false
    const front = mul(n, -1)
    const o: OBB = { c, rot: dm.atan2(front.x, front.z), hw: w / 2, hd: d / 2 }
    if (!roadClear(o) || !parcelClear(o)) return false
    const area = w * d
    const size: ParcelSize = area < 115 ? 'small' : area < 270 ? 'medium' : 'large'
    parcelGrid.insert({ x: c.x, z: c.z, i: out.length })
    out.push({ ...o, id: `p${out.length}`, zone, edge: e.id, stage: stageAt(c, zone), size, w, d, use: 'building', order: dist(c, SETTLEMENT) })
    return true
  }
  for (const pass of [0, 1] as const)
    for (const e of ordered) {
      for (const side of [1, -1] as const) {
        let s = 3
        while (s < e.length - 6) {
          const zone = zoneAt(pointAt(e.points, e.cum, s).p)
          const table =
            pass === 0 ? SIZES[zone] : [{ size: 'small' as ParcelSize, p: 1, w: (zone === 'residential' ? [10, 14] : [8, 11]) as [number, number], d: [7, 12] as [number, number] }]
          let r = rng.next()
          const pick = table.find((t) => (r -= t.p) <= 0) ?? table[table.length - 1]
          let w = Math.min(rng.range(pick.w[0], pick.w[1]), e.length - 3 - s)
          if (w < 7) break
          // As deep as the block allows (up to the district's limit), then narrower if needed.
          let placed = false
          for (let tryW = 0; tryW < 3 && !placed; tryW++, w *= 0.8) {
            if (w < 7) break
            for (let d = pass === 0 ? MAX_DEPTH[zone] : pick.d[1]; d >= 6 && !placed; d -= 1.5) placed = tryPlace(e, side, s, w, d, zone)
          }
          s += placed ? w + rng.range(1.4, 2.6) : 1.5
        }
      }
    }
  return out
}

/* ------------------------------------------------------------------ */

interface Want {
  key: string
  zone: DistrictId
  minArea: number
  anchor: V2
  use: ParcelUse
  landmark?: string
}

function assignUses(parcels: Parcel[], rng: Rng) {
  const area = (p: Parcel) => p.w * p.d
  const take = (want: Want) => {
    // Business plots of the starting settlement must sit on streets that exist from day one.
    const early = want.use === 'plot' && want.key.startsWith('res-biz')
    const ok = (p: Parcel, min: number) => p.use === 'building' && p.zone === want.zone && area(p) >= min
    let cands = parcels.filter((p) => ok(p, early ? 70 : want.minArea) && (!early || p.stage === 0))
    if (!cands.length) cands = parcels.filter((p) => ok(p, want.minArea))
    const best = cands.sort((a, b) => dist(a.c, want.anchor) + a.stage * 35 - (dist(b.c, want.anchor) + b.stage * 35))[0]
    if (!best) return
    best.use = want.use
    // Landmarks and project sites are part of the city from day one, wherever they are.
    if (want.use !== 'plot') best.stage = 0
    if (want.use === 'landmark') best.landmark = want.landmark
    else best.key = want.key
  }
  const S = SETTLEMENT
  const wants: Want[] = [
    // Landmarks that stand from day one.
    { key: '', zone: 'industrial', minArea: 450, anchor: v(-95 * K, 10 * K), use: 'landmark', landmark: 'plant' },
    { key: '', zone: 'residential', minArea: 150, anchor: add(S, v(14 * K, 18 * K)), use: 'landmark', landmark: 'school' },
    { key: '', zone: 'downtown', minArea: 60, anchor: v(20 * K, -14 * K), use: 'landmark', landmark: 'midnight' },
    { key: '', zone: 'residential', minArea: 80, anchor: add(S, v(50 * K, -55 * K)), use: 'landmark', landmark: 'mystery-res' },
    { key: '', zone: 'industrial', minArea: 300, anchor: v(-140 * K, -40 * K), use: 'landmark', landmark: 'mystery-ind' },
    { key: '', zone: 'downtown', minArea: 200, anchor: v(14, -14), use: 'landmark', landmark: 'mall' },
    // Civic projects.
    { key: 'res-clinic', zone: 'residential', minArea: 150, anchor: add(S, v(-6 * K, -16 * K)), use: 'civic' },
    { key: 'res-park', zone: 'residential', minArea: 260, anchor: add(S, v(22 * K, -4 * K)), use: 'civic' },
    { key: 'res-school', zone: 'residential', minArea: 200, anchor: add(S, v(30 * K, 30 * K)), use: 'civic' },
    { key: 'res-hospital', zone: 'residential', minArea: 330, anchor: add(S, v(10 * K, 44 * K)), use: 'civic' },
    { key: 'dt-spire', zone: 'downtown', minArea: 260, anchor: v(16 * K, 20 * K), use: 'civic' },
    { key: 'dt-library', zone: 'downtown', minArea: 200, anchor: v(-20 * K, -18 * K), use: 'civic' },
    { key: 'dt-police', zone: 'downtown', minArea: 150, anchor: v(30 * K, -20 * K), use: 'civic' },
    { key: 'dt-fire', zone: 'downtown', minArea: 170, anchor: v(-24 * K, 28 * K), use: 'civic' },
    { key: 'ind-water', zone: 'industrial', minArea: 200, anchor: v(-70 * K, -20 * K), use: 'civic' },
    { key: 'ind-solar', zone: 'industrial', minArea: 450, anchor: v(-120 * K, 40 * K), use: 'civic' },
    { key: 'ind-pump', zone: 'industrial', minArea: 350, anchor: v(-80 * K, 50 * K), use: 'civic' },
    // Plots for players' businesses (keys kept from earlier saves).
    { key: 'res-biz-1', zone: 'residential', minArea: 120, anchor: add(S, v(4 * K, 6 * K)), use: 'plot' },
    { key: 'res-biz-2', zone: 'residential', minArea: 120, anchor: add(S, v(-12 * K, 12 * K)), use: 'plot' },
    { key: 'res-biz-3', zone: 'residential', minArea: 100, anchor: add(S, v(18 * K, -22 * K)), use: 'plot' },
    { key: 'res-biz-4', zone: 'residential', minArea: 100, anchor: add(S, v(-4 * K, 30 * K)), use: 'plot' },
    { key: 'dt-biz-1', zone: 'downtown', minArea: 100, anchor: v(-6 * K, 22 * K), use: 'plot' },
    { key: 'dt-biz-2', zone: 'downtown', minArea: 100, anchor: v(22 * K, 2 * K), use: 'plot' },
    { key: 'dt-biz-3', zone: 'downtown', minArea: 100, anchor: v(-26 * K, 0 * K), use: 'plot' },
    { key: 'dt-biz-4', zone: 'downtown', minArea: 100, anchor: v(8 * K, -26 * K), use: 'plot' },
    { key: 'ind-biz-1', zone: 'industrial', minArea: 200, anchor: v(-72 * K, 14 * K), use: 'plot' },
    { key: 'ind-biz-2', zone: 'industrial', minArea: 200, anchor: v(-110 * K, -14 * K), use: 'plot' },
    // Added later: after every older key, so their plots stay where they are.
    { key: 'res-playground', zone: 'residential', minArea: 90, anchor: add(S, v(-20 * K, -4 * K)), use: 'civic' },
  ]
  wants.forEach(take)

  // More plots for sale along the busier roads; squares and gardens here and there.
  const rest = parcels.filter((p) => p.use === 'building')
  rest.forEach((p, i) => {
    if (p.zone !== 'industrial' && p.size !== 'large' && rng.chance(0.11)) {
      p.use = 'green'
      p.green = p.zone === 'downtown' ? 'square' : 'garden'
    } else if (p.size !== 'large' && i % 6 === 3) {
      p.use = 'plot'
    }
  })
  // Every quarter of the microdistrict keeps plots for residents' own homes (the largest
  // ones, so a low-rise fits): at least three, about 40 % of what is free there.
  for (const stage of [0, 1, 2, 3]) {
    const list = parcels.filter((p) => p.zone === 'residential' && p.stage === stage && p.use === 'building').sort((a, b) => b.w * b.d - a.w * a.d)
    list.slice(0, Math.max(3, Math.round(list.length * 0.4))).forEach((p) => (p.forPlayers = true))
  }
}

/* ------------------------------------------------------------------ */

function greenery(edges: RoadEdge[], parcels: Parcel[], rng: Rng) {
  const roadGrid = new Grid<V2 & { half: number }>(10)
  for (const e of edges) for (const p of e.points) roadGrid.insert({ x: p.x, z: p.z, half: e.width / 2 })
  const parcelGrid = new Grid<V2 & { i: number }>(16)
  parcels.forEach((p, i) => parcelGrid.insert({ x: p.c.x, z: p.c.z, i }))
  const free = (p: V2, roadMargin: number, parcelMargin: number) =>
    roadGrid.near(p, 12).every((s) => dist(s, p) > s.half + roadMargin) && parcelGrid.near(p, 30).every((q) => !obbContains(parcels[q.i], p, parcelMargin))

  // Trees on lawns inside blocks and along the edge of town.
  const lawnTrees: { x: number; z: number; s: number; conifer: boolean }[] = []
  for (let x = -175 * K; x <= 175 * K; x += 4.5)
    for (let z = -118 * K; z <= 118 * K; z += 4.5) {
      const p = v(x + rng.range(-1.8, 1.8), z + rng.range(-1.8, 1.8))
      if (!inBounds(p, -8)) continue
      if (!free(p, SIDEWALK + 2.2, 1.2)) continue
      if (!rng.chance(zoneAt(p) === 'industrial' ? 0.05 : 0.1)) continue
      lawnTrees.push({ x: p.x, z: p.z, s: rng.range(0.8, 1.3), conifer: rng.chance(0.2) })
    }

  // Footpaths cutting through blocks between two different streets.
  const paths: V2[][] = []
  for (let k = 0; k < 220 && paths.length < 34; k++) {
    const p = v(rng.range(-140 * K, 140 * K), rng.range(-90 * K, 90 * K))
    if (!inBounds(p, 10) || !free(p, SIDEWALK + 3, 1.5)) continue
    const heading = rng.range(0, Math.PI)
    const dir = fromAngle(heading)
    const ends: V2[] = []
    for (const sgn of [1, -1]) {
      let q = p
      let found: V2 | null = null
      for (let s = 0; s < 40; s += 1.5) {
        q = add(p, mul(dir, s * sgn))
        const near = roadGrid.near(q, 10).find((r) => dist(r, q) < r.half + SIDEWALK)
        if (near) {
          found = q
          break
        }
        if (!free(q, -10, 0.6)) break
      }
      if (!found) break
      ends.push(found)
    }
    if (ends.length === 2 && len(sub(ends[0], ends[1])) > 14) paths.push([ends[1], ends[0]])
  }
  return { lawnTrees, paths }
}

/* ------------------------------------------------------------------ */

export function pointOnEdge(e: RoadEdge, s: number) {
  return pointAt(e.points, e.cum, s)
}
