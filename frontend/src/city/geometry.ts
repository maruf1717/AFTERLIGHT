/** Small 2D geometry kit for the planner (x = east, z = south). */

export interface V2 {
  x: number
  z: number
}

export const v = (x: number, z: number): V2 => ({ x, z })
export const add = (a: V2, b: V2): V2 => ({ x: a.x + b.x, z: a.z + b.z })
export const sub = (a: V2, b: V2): V2 => ({ x: a.x - b.x, z: a.z - b.z })
export const mul = (a: V2, k: number): V2 => ({ x: a.x * k, z: a.z * k })
export const len = (a: V2) => Math.hypot(a.x, a.z)
export const dist = (a: V2, b: V2) => Math.hypot(a.x - b.x, a.z - b.z)
export const norm = (a: V2): V2 => {
  const l = len(a) || 1
  return { x: a.x / l, z: a.z / l }
}
/** Right-hand side of a direction (y up). */
export const right = (d: V2): V2 => ({ x: -d.z, z: d.x })
export const fromAngle = (a: number): V2 => ({ x: Math.cos(a), z: Math.sin(a) })
export const angleOf = (d: V2) => Math.atan2(d.z, d.x)

/** Centripetal-ish Catmull-Rom through control points, resampled every `step` units. */
export function spline(ctrl: V2[], step = 2): V2[] {
  const dense: V2[] = []
  const pts = [ctrl[0], ...ctrl, ctrl[ctrl.length - 1]]
  for (let i = 1; i < pts.length - 2; i++) {
    const [p0, p1, p2, p3] = [pts[i - 1], pts[i], pts[i + 1], pts[i + 2]]
    const n = Math.max(4, Math.ceil(dist(p1, p2) / 0.5))
    for (let k = 0; k < n; k++) {
      const t = k / n
      const t2 = t * t
      const t3 = t2 * t
      dense.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        z: 0.5 * (2 * p1.z + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3),
      })
    }
  }
  dense.push(ctrl[ctrl.length - 1])
  return resample(dense, step)
}

/** Points spaced evenly along a polyline. */
export function resample(pts: V2[], step: number): V2[] {
  if (pts.length < 2) return pts.slice()
  const out: V2[] = [pts[0]]
  let carry = 0
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    const seg = dist(a, b)
    let t = step - carry
    while (t <= seg) {
      out.push({ x: a.x + ((b.x - a.x) * t) / seg, z: a.z + ((b.z - a.z) * t) / seg })
      t += step
    }
    carry = seg - (t - step)
  }
  const last = pts[pts.length - 1]
  if (dist(out[out.length - 1], last) > step * 0.3) out.push(last)
  else out[out.length - 1] = last
  return out
}

export function polylineLength(pts: V2[]) {
  let l = 0
  for (let i = 1; i < pts.length; i++) l += dist(pts[i - 1], pts[i])
  return l
}

/** Cumulative arc lengths, for walking along a polyline. */
export function arcTable(pts: V2[]) {
  const cum = [0]
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]))
  return cum
}

/** Point and unit tangent at arc length s. */
export function pointAt(pts: V2[], cum: number[], s: number): { p: V2; t: V2 } {
  const L = cum[cum.length - 1]
  const x = Math.max(0, Math.min(L, s))
  let i = 1
  while (i < cum.length - 1 && cum[i] < x) i++
  const a = pts[i - 1]
  const b = pts[i]
  const seg = cum[i] - cum[i - 1] || 1
  const f = (x - cum[i - 1]) / seg
  return { p: { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f }, t: norm(sub(b, a)) }
}

/** Segment-segment intersection (returns the point or null). */
export function segIntersect(a: V2, b: V2, c: V2, d: V2): V2 | null {
  const r = sub(b, a)
  const s = sub(d, c)
  const den = r.x * s.z - r.z * s.x
  if (Math.abs(den) < 1e-9) return null
  const t = ((c.x - a.x) * s.z - (c.z - a.z) * s.x) / den
  const u = ((c.x - a.x) * r.z - (c.z - a.z) * r.x) / den
  if (t < 0 || t > 1 || u < 0 || u > 1) return null
  return { x: a.x + r.x * t, z: a.z + r.z * t }
}

/* ------------------------------------------------------------------ */
/* Oriented rectangles (parcels)                                       */
/* ------------------------------------------------------------------ */

export interface OBB {
  c: V2
  /** Rotation about Y (three.js convention): local +x → (cos, -sin), local +z → (sin, cos). */
  rot: number
  hw: number
  hd: number
}

export const axes = (rot: number) => ({ ux: { x: Math.cos(rot), z: -Math.sin(rot) }, uz: { x: Math.sin(rot), z: Math.cos(rot) } })

export function corners(o: OBB): V2[] {
  const { ux, uz } = axes(o.rot)
  const out: V2[] = []
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ])
    out.push({ x: o.c.x + ux.x * o.hw * sx + uz.x * o.hd * sz, z: o.c.z + ux.z * o.hw * sx + uz.z * o.hd * sz })
  return out
}

/** Points along the outline and inside, used to test against roads. */
export function samplePoints(o: OBB, step = 2): V2[] {
  const { ux, uz } = axes(o.rot)
  const out: V2[] = []
  const nx = Math.max(1, Math.ceil((o.hw * 2) / step))
  const nz = Math.max(1, Math.ceil((o.hd * 2) / step))
  for (let i = 0; i <= nx; i++)
    for (let j = 0; j <= nz; j++) {
      if (i > 0 && i < nx && j > 0 && j < nz && (i + j) % 2) continue
      const a = -o.hw + (i / nx) * o.hw * 2
      const b = -o.hd + (j / nz) * o.hd * 2
      out.push({ x: o.c.x + ux.x * a + uz.x * b, z: o.c.z + ux.z * a + uz.z * b })
    }
  return out
}

export function obbContains(o: OBB, p: V2, margin = 0) {
  const { ux, uz } = axes(o.rot)
  const d = sub(p, o.c)
  return Math.abs(d.x * ux.x + d.z * ux.z) <= o.hw + margin && Math.abs(d.x * uz.x + d.z * uz.z) <= o.hd + margin
}

/** Separating-axis test with a minimum gap between the rectangles. */
export function obbOverlap(a: OBB, b: OBB, gap = 0) {
  const A = axes(a.rot)
  const B = axes(b.rot)
  const d = sub(b.c, a.c)
  for (const ax of [A.ux, A.uz, B.ux, B.uz]) {
    const ra = a.hw * Math.abs(A.ux.x * ax.x + A.ux.z * ax.z) + a.hd * Math.abs(A.uz.x * ax.x + A.uz.z * ax.z)
    const rb = b.hw * Math.abs(B.ux.x * ax.x + B.ux.z * ax.z) + b.hd * Math.abs(B.uz.x * ax.x + B.uz.z * ax.z)
    if (Math.abs(d.x * ax.x + d.z * ax.z) > ra + rb + gap) return false
  }
  return true
}

/* ------------------------------------------------------------------ */
/* Spatial hash                                                        */
/* ------------------------------------------------------------------ */

export class Grid<T extends V2> {
  private cells = new Map<string, T[]>()
  constructor(private size: number) {}
  private key(x: number, z: number) {
    return `${Math.floor(x / this.size)},${Math.floor(z / this.size)}`
  }
  insert(item: T) {
    const k = this.key(item.x, item.z)
    let c = this.cells.get(k)
    if (!c) this.cells.set(k, (c = []))
    c.push(item)
  }
  near(p: V2, r: number): T[] {
    const out: T[] = []
    const x0 = Math.floor((p.x - r) / this.size)
    const x1 = Math.floor((p.x + r) / this.size)
    const z0 = Math.floor((p.z - r) / this.size)
    const z1 = Math.floor((p.z + r) / this.size)
    for (let i = x0; i <= x1; i++)
      for (let j = z0; j <= z1; j++) {
        const c = this.cells.get(`${i},${j}`)
        if (c) for (const it of c) if (dist(it, p) <= r) out.push(it)
      }
    return out
  }
}
