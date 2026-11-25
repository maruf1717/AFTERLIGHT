import type { DistrictId } from '../data/types'
import { createRng, type Rng } from '../lib/random'
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
  spline,
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
  const a = Math.atan2(z / RZ, x / RX)
  return 1 + 0.08 * Math.sin(3 * a + 1) + 0.05 * Math.sin(5 * a + 2)
}
/** Inside the city outline (with a margin in world units). */
export function inBounds(p: V2, margin = 0) {
  const r = cityRadiusAt(p.x, p.z)
  const e = Math.hypot(p.x / (RX * r - margin), p.z / (RZ * r - margin))
  return e < 1
}
/** How far outside the city a point is, 0 inside. */
export function outsideBy(p: V2) {
  const r = cityRadiusAt(p.x, p.z)
  const e = Math.hypot(p.x / (RX * r), p.z / (RZ * r))
  return Math.max(0, (e - 1) * Math.min(RX, RZ))
}

export function zoneAt(p: V2): DistrictId {
  const u = p.x + 10 * Math.sin(p.z / 24)
  if (u < -62 * K) return 'industrial'
  if (u > 42 * K) return 'residential'
  return 'downtown'
}


export function generateCity(seed = 20261124): CityPlan {
  const rng = createRng(seed)

  // 1. Arterials: a curving boulevard west–east, two north–south avenues, a diagonal to the factories.
  const jitter = (pts: [number, number][], j: number) =>
    pts.map(([x, z], i) => {
      const far = i === 0 || i === pts.length - 1 ? 1.25 : 1
      return v((x + rng.range(-j, j)) * K * far, (z + rng.range(-j, j)) * K * far)
    })
  const arterials = [
    spline(jitter([[-185, 14], [-120, 4], [-60, -6], [0, 6], [62, -4], [118, 8], [185, 0]], 4)),
    spline(jitter([[-6, -140], [4, -70], [0, 6], [-10, 60], [2, 140]], 3)),
    spline(jitter([[92, -135], [80, -60], [66, -4], [84, 50], [78, 135]], 3)),
    spline(jitter([[-20, 40], [-70, 62], [-130, 70], [-190, 84]], 3)),
    spline(jitter([[-100, -120], [-108, -50], [-96, 4]], 3)),
  ]

  // 2. Each zone gets its own street pattern: a grid with its own rotation and spacing,
  //    bent by a smooth displacement field so no street is straight for long.
  type Line = { pts: V2[]; family: 0 | 1 }
  const lines: Line[] = []
  const artGrid = new Grid<V2 & { tx: number; tz: number }>(10)
  for (const a of arterials)
    a.forEach((p, i) => {
      const t = norm(sub(a[Math.min(a.length - 1, i + 1)], a[Math.max(0, i - 1)]))
      artGrid.insert({ x: p.x, z: p.z, tx: t.x, tz: t.z })
    })
  const ph = [rng.range(0, 6), rng.range(0, 6), rng.range(0, 6), rng.range(0, 6)]
  const PATTERN: Record<DistrictId, { ang: number; du: number; dv: number; warp: number }> = {
    residential: { ang: 0.42 + rng.range(-0.1, 0.1), du: 31, dv: 42, warp: 7 },
    downtown: { ang: -0.2 + rng.range(-0.08, 0.08), du: 36, dv: 38, warp: 3.5 },
    industrial: { ang: 0.1 + rng.range(-0.08, 0.08), du: 50, dv: 46, warp: 2.5 },
  }
  const warp = (p: V2, amp: number): V2 => ({
    x: p.x + amp * (Math.sin(p.z / 23 + ph[0]) + 0.6 * Math.sin((p.x + p.z) / 37 + ph[1])),
    z: p.z + amp * (Math.cos(p.x / 27 + ph[2]) + 0.6 * Math.sin((p.x - p.z) / 31 + ph[3])),
  })
  const R = 260
  for (const zone of ['residential', 'downtown', 'industrial'] as DistrictId[]) {
    const P = PATTERN[zone]
    const ux = fromAngle(P.ang)
    const uz = right(ux)
    const origin = zone === 'residential' ? SETTLEMENT : zone === 'downtown' ? v(0, 6 * K) : v(-100 * K, 0)
    for (const fam of [0, 1] as const) {
      const along = fam === 0 ? ux : uz
      const across = fam === 0 ? uz : ux
      const step = fam === 0 ? P.dv : P.du
      const off = rng.range(0, step)
      for (let c = -R + off; c <= R; c += step * rng.range(0.85, 1.15)) {
        // Sample the straight line, bend it, keep the runs that lie in this zone.
        let run: V2[] = []
        const flush = () => {
          if (run.length > 6) lines.push({ pts: run, family: fam })
          run = []
        }
        for (let t = -R; t <= R; t += 2) {
          const base = add(origin, add(mul(along, t), mul(across, c)))
          const p = warp(base, P.warp)
          const inZone = zoneAt(p) === zone || zoneAt(add(p, mul(along, 12))) === zone || zoneAt(add(p, mul(along, -12))) === zone
          if (!inBounds(p, -6) || !inZone) {
            flush()
            continue
          }
          // Drop streets that would run right next to a main road, alongside it.
          const near = artGrid.near(p, 13)
          const dir = along
          if (near.some((q) => dist(q, p) < 13 && Math.abs(q.tx * dir.x + q.tz * dir.z) > 0.75)) {
            flush()
            continue
          }
          run.push(p)
        }
        flush()
      }
    }
  }

  // 4. Junctions where lines cross, then cut every line at its junctions.
  type Poly = { pts: V2[]; kind: RoadKind }
  const polys: Poly[] = [
    ...arterials.map((pts) => ({ pts, kind: 'arterial' as RoadKind })),
    ...lines.map((l) => ({ pts: l.pts, kind: (l.family === 0 ? 'secondary' : 'local') as RoadKind })),
  ]
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
    // Dangling ends: keep as cul-de-sacs when long enough to serve houses.
    const head = slice(0, at(my[0]), pl.pts[0], my[0].p)
    if (polylineLength(head) > 14 && pl.kind !== 'arterial') {
      const n = nodes.length
      nodes.push({ id: n, x: head[0].x, z: head[0].z, edges: [], deadEnd: true })
      pushEdge(n, nodeAt(my[0].p), pl.kind, resample(head, 2))
    } else if (pl.kind === 'arterial') {
      const n = nodes.length
      nodes.push({ id: n, x: head[0].x, z: head[0].z, edges: [], deadEnd: true })
      pushEdge(n, nodeAt(my[0].p), pl.kind, resample(head, 2))
    }
    for (let k = 0; k < my.length - 1; k++) {
      const pts = slice(at(my[k]), at(my[k + 1]), my[k].p, my[k + 1].p)
      if (polylineLength(pts) < 2.5) continue
      pushEdge(nodeAt(my[k].p), nodeAt(my[k + 1].p), pl.kind, resample(pts, 2))
    }
    const lastCut = my[my.length - 1]
    const tail = slice(at(lastCut), pl.pts.length - 1, lastCut.p, pl.pts[pl.pts.length - 1])
    if (polylineLength(tail) > 14 || pl.kind === 'arterial') {
      const n = nodes.length
      nodes.push({ id: n, x: tail[tail.length - 1].x, z: tail[tail.length - 1].z, edges: [], deadEnd: true })
      pushEdge(nodeAt(lastCut.p), n, pl.kind, resample(tail, 2))
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
  for (const e of [...edges].sort(() => rng.next() - 0.5)) {
    if (e.kind !== 'local' || !rng.chance(0.22)) continue
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

  // Expansion stages: main roads exist from day one, the rest by distance from the settlement.
  for (const e of edges) {
    const mid = e.points[Math.floor(e.points.length / 2)]
    const d = dist(mid, SETTLEMENT)
    e.stage = e.kind === 'arterial' || e.kind === 'ring' ? 0 : d < 50 ? 0 : d < 90 ? 1 : d < 135 ? 2 : 3
  }

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
    entries.push({ node: n, ang: Math.atan2(onRing.z - centre.z, onRing.x - centre.x) })
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
      pts.push(v(centre.x + Math.cos(a) * R, centre.z + Math.sin(a) * R))
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

  const ordered = [...edges].filter((e) => e.kind !== 'ring').sort((a, b) => ['local', 'secondary', 'arterial'].indexOf(a.kind) - ['local', 'secondary', 'arterial'].indexOf(b.kind))
  for (const pass of [0, 1] as const)
  for (const e of ordered) {
    for (const side of [1, -1] as const) {
      let s = 7
      while (s < e.length - 7) {
        const here = pointAt(e.points, e.cum, s).p
        const zone = zoneAt(here)
        const table =
          pass === 0
            ? SIZES[zone]
            : [{ size: 'small' as ParcelSize, p: 1, w: (zone === 'residential' ? [10, 15] : [8, 11]) as [number, number], d: [7, 12] as [number, number] }]
        let r = rng.next()
        const pick = table.find((t) => (r -= t.p) <= 0) ?? table[table.length - 1]
        let w = rng.range(pick.w[0], pick.w[1])
        let d = rng.range(pick.d[0], pick.d[1])
        if (s + w > e.length - 7) w = e.length - 7 - s
        if (w < 8) break

        let placed = false
        {
          // How deep can the parcel go before it meets another street?
          let room = Infinity
          for (const f of [0.25, 0.5, 0.75]) {
            const { p, t } = pointAt(e.points, e.cum, s + w * f)
            const n = mul(right(t), side)
            const start = e.width / 2 + SIDEWALK + 1.3
            for (let k = start; k < start + 34; k += 1) {
              const q = add(p, mul(n, k))
              // Only a street lying across the ray faces this one; a street running alongside it is a side street.
              const road = roadGrid
                .near(q, 9)
                .find((r) => dist(r, q) < r.half + SIDEWALK + 0.6 && dist(r, p) > e.width / 2 + 1 && Math.abs(r.tx * n.x + r.tz * n.z) < 0.6)
              if (road) {
                // Another street ahead: its parcels need the other half of the block.
                room = Math.min(room, (k - start) / 2 - 0.8)
                break
              }
              if (parcelGrid.near(q, 30).some((g) => obbContains(out[g.i], q, 1.2))) {
                room = Math.min(room, k - start - 1)
                break
              }
            }
          }
          if (room < d) d = room
        }
        for (let attempt = 0; attempt < 3 && !placed && d >= 6; attempt++) {
          const { p, t } = pointAt(e.points, e.cum, s + w / 2)
          const n = mul(right(t), side)
          const off = e.width / 2 + SIDEWALK + 1.3 + d / 2
          const c = add(p, mul(n, off))
          if (!inBounds(c, -14)) break
          const front = mul(n, -1)
          const rot = Math.atan2(front.x, front.z)
          const o: OBB = { c, rot, hw: w / 2, hd: d / 2 }
          const rc = roadClear(o)
          const pc = rc && parcelClear(o)
          if (rc && pc) {
            const area = w * d
            const size: ParcelSize = area < 115 ? 'small' : area < 270 ? 'medium' : 'large'
            const parcel: Parcel = { ...o, id: `p${out.length}`, zone, edge: e.id, stage: e.stage, size, w, d, use: 'building', order: dist(c, SETTLEMENT) }
            parcelGrid.insert({ x: c.x, z: c.z, i: out.length })
            out.push(parcel)
            placed = true
          } else {
            d *= 0.8
            w *= attempt === 1 ? 0.8 : 1
            if (d < 6 || w < 8) break
          }
        }
        s += (placed ? w : 2.5) + rng.range(1.6, 3)
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
      if (!rng.chance(zoneAt(p) === 'industrial' ? 0.18 : 0.34)) continue
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
