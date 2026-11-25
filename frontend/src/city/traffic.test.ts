import { describe, expect, it } from 'vitest'
import { CYCLE_S, driveRange, GAP, GREEN_S, lightFor, SIGNALS, TrafficSim, YELLOW_S } from './traffic'

describe('traffic lights', () => {
  it('there are signalled junctions', () => {
    expect(SIGNALS.size).toBeGreaterThan(5)
  })
  it('crossing directions are never green together', () => {
    for (const sig of SIGNALS.values()) {
      const edges = Object.keys(sig.group).map(Number)
      for (let t = 0; t < CYCLE_S; t += 0.5) {
        const greens = new Set(edges.filter((e) => lightFor(sig.node, e, t) !== 'red').map((e) => sig.group[e]))
        expect(greens.size).toBeLessThanOrEqual(1)
      }
    }
  })
  it('20 s green and 3 s yellow per direction', () => {
    const sig = [...SIGNALS.values()][0]
    const e = Number(Object.keys(sig.group)[0])
    let green = 0
    let yellow = 0
    for (let t = 0; t < CYCLE_S; t += 0.1) {
      const l = lightFor(sig.node, e, t)
      if (l === 'green') green += 0.1
      if (l === 'yellow') yellow += 0.1
    }
    expect(green).toBeCloseTo(GREEN_S, 0)
    expect(yellow).toBeCloseTo(YELLOW_S, 0)
  })
})

describe('cars', () => {
  const sim = new TrafficSim(3, 90)
  const lines: { car: number; before: boolean }[] = []
  let ranThroughRed = 0
  let tooClose = 0
  let moved = 0
  for (let i = 0; i < 30 * 90; i++) {
    const before = sim.cars.map((c) => ({ edge: c.edge, dir: c.dir, s: c.s, turn: !!c.turn }))
    sim.step(1 / 30)
    sim.cars.forEach((c, k) => {
      const b = before[k]
      if (b.turn || c.turn || b.edge !== c.edge) return
      const r = driveRange(c.edge, c.dir)
      const line = r.end - 1.5
      if (lightFor(r.endNode, c.edge, sim.time) === 'red' && b.s < line - 2 && c.s > line + 0.05) ranThroughRed++
      moved += c.s - b.s
    })
    const lanes = new Map<number, number[]>()
    for (const c of sim.cars) {
      if (c.turn) continue
      const k = c.edge * 2 + (c.dir === 1 ? 1 : 0)
      lanes.set(k, [...(lanes.get(k) ?? []), c.s])
    }
    for (const list of lanes.values()) {
      list.sort((a, b) => a - b)
      for (let j = 1; j < list.length; j++) if (list[j] - list[j - 1] < GAP - 0.5) tooClose++
    }
  }
  void lines

  it('never pass through each other (keep the gap in a lane)', () => {
    expect(tooClose).toBe(0)
  })
  it('stop at red lights', () => {
    expect(ranThroughRed).toBe(0)
  })
  it('keep moving: no permanent jam', () => {
    // 90 s of simulation: on average every car drove at least 1 m/s.
    expect(moved / sim.cars.length / 90).toBeGreaterThan(1)
  })
})
