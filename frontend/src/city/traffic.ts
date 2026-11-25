import { createRng, hashString } from '../lib/random'
import { pointAt, right, type V2 } from './geometry'
import { PLAN, roadOpen } from './plan'
import { LANE, type RoadKind } from './planner'

/*
 * Traffic as a small simulation, independent of drawing:
 * - traffic lights at busy junctions, two phase groups (along / across),
 *   20 s green, 3 s yellow, then red while the other group goes;
 * - each car keeps its distance to the car ahead in its lane and stops at a red light;
 * - at a junction a car follows a smooth curve from its lane to the lane of the next street.
 */

export type Light = 'green' | 'yellow' | 'red'
export const GREEN_S = 20
export const YELLOW_S = 3
export const CYCLE_S = 2 * (GREEN_S + YELLOW_S)
/** Cars keep at least this much road (metres, centre to centre) to the car ahead. */
export const GAP = 6
const ACCEL = 3
const DECEL = 7
export const SPEED: Record<RoadKind, number> = { arterial: 11, secondary: 8, local: 5.5, ring: 6 }

/* Junctions ---------------------------------------------------------------- */

/** How far from a junction centre its asphalt disc reaches (same rule as the drawn junction). */
export function junctionRadius(node: number): number {
  const n = PLAN.nodes[node]
  if (n.edges.length < 3) return 0
  return Math.max(...n.edges.map((e) => PLAN.edges[e].width)) / 2 + 0.4
}

/** Direction in which an edge leaves a node. */
function leaving(edgeId: number, node: number): V2 {
  const e = PLAN.edges[edgeId]
  const pts = e.points
  const [a, b] = e.a === node ? [pts[0], pts[Math.min(2, pts.length - 1)]] : [pts[pts.length - 1], pts[Math.max(0, pts.length - 3)]]
  const l = Math.hypot(b.x - a.x, b.z - a.z) || 1
  return { x: (b.x - a.x) / l, z: (b.z - a.z) / l }
}

export interface Signal {
  node: number
  /** Phase group (0 or 1) of each road entering the junction. */
  group: Record<number, 0 | 1>
  /** Seconds the cycle is shifted, so not every junction switches at once. */
  offset: number
}

/** Junctions with lights: three or more roads, at least one of them a main road, not the roundabout. */
export const SIGNALS: Map<number, Signal> = (() => {
  const out = new Map<number, Signal>()
  for (const n of PLAN.nodes) {
    if (n.edges.length < 3) continue
    const kinds = n.edges.map((e) => PLAN.edges[e].kind)
    if (kinds.includes('ring')) continue
    if (!kinds.some((k) => k === 'arterial' || k === 'secondary')) continue
    const base = leaving(n.edges[0], n.id)
    const axis = Math.atan2(base.z, base.x)
    const group: Record<number, 0 | 1> = {}
    for (const eid of n.edges) {
      const d = leaving(eid, n.id)
      let diff = Math.abs(Math.atan2(d.z, d.x) - axis) % Math.PI
      if (diff > Math.PI / 2) diff = Math.PI - diff
      group[eid] = diff < Math.PI / 4 ? 0 : 1
    }
    out.set(n.id, { node: n.id, group, offset: hashString(`sig${n.id}`) % CYCLE_S })
  }
  return out
})()

/** The light a road shows at a junction at time t (seconds). Roads without lights are always green. */
export function lightFor(node: number, edgeId: number, t: number): Light {
  const sig = SIGNALS.get(node)
  if (!sig || sig.group[edgeId] === undefined) return 'green'
  const c = (((t + sig.offset) % CYCLE_S) + CYCLE_S) % CYCLE_S
  const g = sig.group[edgeId]
  // Group 0: green, yellow, then red. Group 1: red, then green, yellow.
  const local = g === 0 ? c : (c + GREEN_S + YELLOW_S) % CYCLE_S
  if (local < GREEN_S) return 'green'
  if (local < GREEN_S + YELLOW_S) return 'yellow'
  return 'red'
}

/* Lanes -------------------------------------------------------------------- */

export const laneOffset = (edgeId: number) => {
  const e = PLAN.edges[edgeId]
  return e.oneway ? 0.9 : LANE[e.kind]
}

/** A point on the right-hand lane, s metres along the direction of travel. */
export function lanePoint(edgeId: number, dir: 1 | -1, s: number): { p: V2; d: V2 } {
  const e = PLAN.edges[edgeId]
  const along = Math.max(0, Math.min(e.length, dir === 1 ? s : e.length - s))
  const { p, t } = pointAt(e.points, e.cum, along)
  const d = dir === 1 ? t : { x: -t.x, z: -t.z }
  const n = right(d)
  const lane = laneOffset(edgeId)
  return { p: { x: p.x + n.x * lane, z: p.z + n.z * lane }, d }
}

/** Where on an edge a car drives: from the edge of one junction disc to the other. */
export function driveRange(edgeId: number, dir: 1 | -1) {
  const e = PLAN.edges[edgeId]
  const startNode = dir === 1 ? e.a : e.b
  const endNode = dir === 1 ? e.b : e.a
  let r0 = junctionRadius(startNode)
  let r1 = junctionRadius(endNode)
  if (r0 + r1 > e.length - 2) r0 = r1 = 0
  return { start: r0, end: e.length - r1, endNode, startNode }
}

/* Cars --------------------------------------------------------------------- */

interface Turn {
  p0: V2
  c1: V2
  c2: V2
  p2: V2
  len: number
  t: number
}

export interface Car {
  id: number
  edge: number
  dir: 1 | -1
  s: number
  v: number
  /** Personal speed factor (0.8–1.1 of the street's speed). */
  pace: number
  next: { edge: number; dir: 1 | -1 }
  turn: Turn | null
  pose: { x: number; z: number; yaw: number }
  /** Waiting at a red light right now. */
  stopped: boolean
}

const bez = (a: V2, b: V2, c: V2, d: V2, t: number): V2 => {
  const u = 1 - t
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    z: u * u * u * a.z + 3 * u * u * t * b.z + 3 * u * t * t * c.z + t * t * t * d.z,
  }
}

export class TrafficSim {
  cars: Car[]
  private open: Set<number>
  private rng
  /** Seconds since the simulation started (drives the lights). */
  time = 0

  constructor(stage: number, count: number, seed = 77, cars?: Omit<Car, 'next' | 'turn' | 'pose' | 'stopped' | 'v'>[]) {
    this.open = new Set(PLAN.edges.filter((e) => roadOpen(e.id, stage)).map((e) => e.id))
    this.rng = createRng(seed)
    const edges = PLAN.edges.filter((e) => this.open.has(e.id))
    const weighted = edges.flatMap((e) => Array(e.kind === 'arterial' ? 4 : e.kind === 'secondary' ? 2 : 1).fill(e))
    // Starting spots: never closer than the gap to a car already placed in the same lane.
    const placed: { id: number; edge: number; dir: 1 | -1; s: number; pace: number }[] = []
    for (let id = 0; !cars && id < count; id++) {
      for (let attempt = 0; attempt < 30; attempt++) {
        const e = this.rng.pick(weighted)
        const dir: 1 | -1 = e.oneway || this.rng.chance(0.5) ? 1 : -1
        const r = driveRange(e.id, dir)
        if (r.end - r.start < 2) continue
        const s = this.rng.range(r.start, r.end)
        if (placed.some((o) => o.edge === e.id && o.dir === dir && Math.abs(o.s - s) < GAP + 1)) continue
        placed.push({ id, edge: e.id, dir, s, pace: this.rng.range(0.8, 1.1) })
        break
      }
    }
    const init = cars ?? placed
    this.cars = init.map((c) => ({ ...c, v: 0, next: this.pickNext(c.edge, c.dir), turn: null, pose: { x: 0, z: 0, yaw: 0 }, stopped: false }))
    for (const c of this.cars) this.place(c)
  }

  private pickNext(edgeId: number, dir: 1 | -1): { edge: number; dir: 1 | -1 } {
    const e = PLAN.edges[edgeId]
    const node = dir === 1 ? e.b : e.a
    const options = PLAN.nodes[node].edges.filter((id) => {
      if (!this.open.has(id) || id === edgeId) return false
      const x = PLAN.edges[id]
      return !x.oneway || x.a === node
    })
    if (!options.length) return { edge: edgeId, dir: dir === 1 ? -1 : 1 } // dead end: turn back
    const pick = options[Math.floor(this.rng.next() * options.length)]
    return { edge: pick, dir: PLAN.edges[pick].a === node ? 1 : -1 }
  }

  private laneKey(edge: number, dir: 1 | -1) {
    return edge * 2 + (dir === 1 ? 1 : 0)
  }

  private lanes() {
    const map = new Map<number, Car[]>()
    for (const c of this.cars) {
      if (c.turn) continue
      const k = this.laneKey(c.edge, c.dir)
      const list = map.get(k)
      if (list) list.push(c)
      else map.set(k, [c])
    }
    for (const list of map.values()) list.sort((a, b) => a.s - b.s)
    return map
  }

  private place(c: Car) {
    if (c.turn) {
      const t = Math.min(1, c.turn.t)
      const p = bez(c.turn.p0, c.turn.c1, c.turn.c2, c.turn.p2, t)
      const q = bez(c.turn.p0, c.turn.c1, c.turn.c2, c.turn.p2, Math.min(1, t + 0.02))
      const dx = q.x - p.x
      const dz = q.z - p.z
      c.pose.x = p.x
      c.pose.z = p.z
      if (Math.hypot(dx, dz) > 1e-4) c.pose.yaw = Math.atan2(-dz, dx)
      return
    }
    const { p, d } = lanePoint(c.edge, c.dir, c.s)
    c.pose.x = p.x
    c.pose.z = p.z
    c.pose.yaw = Math.atan2(-d.z, d.x)
  }

  private startTurn(c: Car) {
    const r1 = driveRange(c.next.edge, c.next.dir)
    const a = lanePoint(c.edge, c.dir, c.s)
    const b = lanePoint(c.next.edge, c.next.dir, r1.start)
    const L = Math.max(2, Math.hypot(b.p.x - a.p.x, b.p.z - a.p.z))
    const k = c.next.edge === c.edge ? 4 : L / 2.4
    const turn: Turn = {
      p0: a.p,
      c1: { x: a.p.x + a.d.x * k, z: a.p.z + a.d.z * k },
      c2: { x: b.p.x - b.d.x * k, z: b.p.z - b.d.z * k },
      p2: b.p,
      len: 0,
      t: 0,
    }
    let prev = turn.p0
    for (let i = 1; i <= 10; i++) {
      const q = bez(turn.p0, turn.c1, turn.c2, turn.p2, i / 10)
      turn.len += Math.hypot(q.x - prev.x, q.z - prev.z)
      prev = q
    }
    c.turn = turn
  }

  /** Is the start of a lane free enough to drive into? */
  private entryFree(lanes: Map<number, Car[]>, edge: number, dir: 1 | -1, self: Car) {
    const r = driveRange(edge, dir)
    const list = lanes.get(this.laneKey(edge, dir))
    if (list && list.length && list[0].s < r.start + GAP) return false
    // Another car already curving into the same lane.
    return !this.cars.some((o) => o !== self && o.turn && o.next.edge === edge && o.next.dir === dir)
  }

  step(dt: number) {
    const h = Math.min(dt, 0.1)
    this.time += h
    const lanes = this.lanes()
    for (const c of this.cars) {
      const e = PLAN.edges[c.edge]
      const vmax = SPEED[e.kind] * c.pace
      if (c.turn) {
        // Junctions are taken at a gentle speed.
        const target = Math.min(vmax, 6)
        c.v += Math.max(-DECEL * h, Math.min(ACCEL * h, target - c.v))
        c.turn.t += (c.v * h) / Math.max(0.5, c.turn.len)
        if (c.turn.t >= 1) {
          c.edge = c.next.edge
          c.dir = c.next.dir
          c.s = driveRange(c.edge, c.dir).start
          c.turn = null
          c.next = this.pickNext(c.edge, c.dir)
        }
        this.place(c)
        continue
      }
      const r = driveRange(c.edge, c.dir)
      let cap = r.end
      // The car ahead in the same lane.
      const list = lanes.get(this.laneKey(c.edge, c.dir))!
      const i = list.indexOf(c)
      const ahead = list[i + 1]
      if (ahead) cap = Math.min(cap, ahead.s - GAP)
      // The light at the end of the road: stop at the line unless already too close to brake.
      const light = lightFor(r.endNode, c.edge, this.time)
      const stopLine = r.end - 1.5
      const brakeDist = (c.v * c.v) / (2 * DECEL)
      c.stopped = false
      if (light === 'red' || (light === 'yellow' && stopLine - c.s > brakeDist + 0.5)) {
        if (c.s <= stopLine + 0.01) {
          cap = Math.min(cap, stopLine)
          c.stopped = stopLine - c.s < 4
        }
      }
      // Wait for room in the next street.
      if (cap >= r.end && !this.entryFree(lanes, c.next.edge, c.next.dir, c)) cap = Math.min(cap, r.end - 0.3)
      const room = Math.max(0, cap - c.s)
      const target = Math.min(vmax, Math.sqrt(2 * DECEL * room))
      c.v += Math.max(-DECEL * 2 * h, Math.min(ACCEL * h, target - c.v))
      c.v = Math.max(0, c.v)
      c.s = Math.min(c.s + c.v * h, Math.max(c.s, cap))
      if (c.s >= r.end - 0.01 && cap >= r.end) this.startTurn(c)
      this.place(c)
    }
  }
}

/** Where the moving cars are right now (shared with the pedestrians). */
export const CAR_POSITIONS: { x: number; z: number }[] = []
