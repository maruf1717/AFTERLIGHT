import { dist, right, v, type V2 } from './geometry'
import { PLAN } from './plan'
import { SIDEWALK } from './planner'
import { laneOffset, lanePoint } from './traffic'

/*
 * Public transport: bus lines that loop through the districts on the main roads, with stops
 * every few blocks. A line is a closed sequence of (street, direction) steps without U-turns;
 * buses follow it, pull up at every stop on their side of the road and wait there.
 */

export interface Step {
  edge: number
  dir: 1 | -1
}
export interface Stop {
  id: number
  line: number
  edge: number
  dir: 1 | -1
  /** Where along the street (in the direction of travel) the bus stops. */
  s: number
  /** The shelter on the sidewalk, and the direction it faces (towards the road). */
  at: V2
  face: V2
}
export interface BusLine {
  id: number
  name: string
  color: string
  steps: Step[]
}

const endNode = (st: Step) => (st.dir === 1 ? PLAN.edges[st.edge].b : PLAN.edges[st.edge].a)
const startNode = (st: Step) => (st.dir === 1 ? PLAN.edges[st.edge].a : PLAN.edges[st.edge].b)
const key = (st: Step) => st.edge * 2 + (st.dir === 1 ? 1 : 0)
const COST: Record<string, number> = { arterial: 1, ring: 1.1, secondary: 1.4, local: 3 }

/** Where a vehicle may go next from the end of a step (no U-turns, one-way streets respected). */
export function nextSteps(st: Step): Step[] {
  const node = endNode(st)
  const out: Step[] = []
  for (const id of PLAN.nodes[node].edges) {
    if (id === st.edge) continue
    const e = PLAN.edges[id]
    if (e.oneway && e.a !== node) continue
    out.push({ edge: id, dir: e.a === node ? 1 : -1 })
  }
  return out
}

/** Cheapest way from a step to the first step that satisfies `goal` (both included). */
function route(from: Step, goal: (s: Step) => boolean): Step[] | null {
  const best = new Map<number, number>([[key(from), 0]])
  const prev = new Map<number, Step>()
  const open: { s: Step; c: number }[] = [{ s: from, c: 0 }]
  while (open.length) {
    open.sort((a, b) => a.c - b.c)
    const { s, c } = open.shift()!
    if (c > (best.get(key(s)) ?? Infinity)) continue
    if (s !== from && goal(s)) {
      const path = [s]
      for (let k = key(s); prev.has(k); ) {
        const p = prev.get(k)!
        path.unshift(p)
        k = key(p)
      }
      return path
    }
    for (const n of nextSteps(s)) {
      const e = PLAN.edges[n.edge]
      const nc = c + e.length * (COST[e.kind] ?? 2)
      if (nc < (best.get(key(n)) ?? Infinity)) {
        best.set(key(n), nc)
        prev.set(key(n), s)
        open.push({ s: n, c: nc })
      }
    }
  }
  return null
}

/** The junction closest to a point (only junctions on main roads when possible). */
function nodeNear(p: V2) {
  let best = PLAN.nodes[0]
  let bd = Infinity
  for (const n of PLAN.nodes) {
    if (n.edges.length < 3) continue
    const main = n.edges.some((e) => PLAN.edges[e].kind === 'arterial' || PLAN.edges[e].kind === 'secondary')
    const d = dist(n, p) * (main ? 1 : 1.6)
    if (d < bd) {
      bd = d
      best = n
    }
  }
  return best.id
}

/** A closed line through the given places, in this order. */
function makeLine(places: V2[]): Step[] {
  const targets = places.map(nodeNear)
  const firstNode = targets[0]
  const e0 = PLAN.nodes[firstNode].edges.map((id) => PLAN.edges[id]).find((e) => !e.oneway)!
  const first: Step = { edge: e0.id, dir: e0.a === firstNode ? 1 : -1 }
  const steps: Step[] = [first]
  for (let i = 1; i < targets.length; i++) {
    const leg = route(steps[steps.length - 1], (s) => endNode(s) === targets[i])
    if (!leg) return []
    steps.push(...leg.slice(1))
  }
  // Back to the start, arriving so that the first step follows without a U-turn.
  const back = route(steps[steps.length - 1], (s) => endNode(s) === startNode(first) && nextSteps(s).some((n) => key(n) === key(first)))
  if (!back) return []
  steps.push(...back.slice(1))
  return steps
}

export const BUS_LINES: BusLine[] = (() => {
  const C = PLAN.zoneCentroid
  const lines: { name: string; color: string; places: V2[] }[] = [
    // Through all three districts along the boulevard and back by the northern streets.
    { name: '1', color: '#e0832f', places: [v(C.residential.x + 25, 8), v(0, 0), v(C.industrial.x - 10, 8), v(C.industrial.x, -45), v(0, -45), v(C.residential.x, -45)] },
    // The southern loop: microdistrict, centre, factories.
    { name: '2', color: '#2b6cb0', places: [v(C.residential.x, 45), v(C.downtown.x, 45), v(C.industrial.x, 45), v(C.downtown.x - 20, 8)] },
  ]
  return lines.map((l, id) => ({ id, name: l.name, color: l.color, steps: makeLine(l.places) })).filter((l) => l.steps.length > 3)
})()

/** Stops along each line: on streets long enough, about every 90 m, on the right-hand side. */
export const BUS_STOPS: Stop[] = (() => {
  const out: Stop[] = []
  for (const line of BUS_LINES) {
    let since = 60
    for (const st of line.steps) {
      const e = PLAN.edges[st.edge]
      since += e.length
      if (e.kind === 'ring' || e.length < 26 || since < 90) continue
      const s = e.length * 0.55
      // The lane point is laneOffset to the right of the centre line; the shelter stands on the
      // outer half of the sidewalk, facing the road.
      const { p, d } = lanePoint(st.edge, st.dir, s)
      const nrm = right(d)
      const off = e.width / 2 + SIDEWALK * 0.6 - laneOffset(st.edge)
      const at = { x: p.x + nrm.x * off, z: p.z + nrm.z * off }
      if (out.some((o) => dist(o.at, at) < 30)) continue
      out.push({ id: out.length, line: line.id, edge: st.edge, dir: st.dir, s, at, face: { x: -nrm.x, z: -nrm.z } })
      since = 0
    }
  }
  return out
})()

/** The stop (if any) on a step of a line. */
export const STOP_ON = new Map<string, Stop>(BUS_STOPS.map((s) => [`${s.line}:${s.edge}:${s.dir}`, s]))
