import { describe, expect, it } from 'vitest'
import { PLAN } from './plan'
import { TrafficSim } from './traffic'
import { BUS_LINES, BUS_STOPS, STOP_ON } from './transit'

describe('buses', () => {
  it('every line is a closed loop without U-turns', () => {
    expect(BUS_LINES.length).toBeGreaterThanOrEqual(2)
    for (const l of BUS_LINES)
      l.steps.forEach((a, i) => {
        const b = l.steps[(i + 1) % l.steps.length]
        const ea = PLAN.edges[a.edge]
        const eb = PLAN.edges[b.edge]
        expect(a.dir === 1 ? ea.b : ea.a).toBe(b.dir === 1 ? eb.a : eb.b)
        expect(b.edge).not.toBe(a.edge)
      })
  })
  it('each line has stops', () => {
    for (const l of BUS_LINES) expect(BUS_STOPS.filter((s) => s.line === l.id).length).toBeGreaterThanOrEqual(3)
  })
  it('buses stop at the stops and traffic never locks up', () => {
    const sim = new TrafficSim(0, 70, 77, undefined, { lines: BUS_LINES, stopAt: (l, e, d) => STOP_ON.get(`${l}:${e}:${d}`)?.s ?? null, busesPerLine: 3 })
    const buses = sim.cars.filter((c) => c.bus)
    expect(buses.length).toBe(BUS_LINES.length * 3)
    let dwelt = 0
    const still = new Map<number, number>()
    let longest = 0
    for (let t = 0; t < 900; t += 0.1) {
      sim.step(0.1)
      for (const b of buses) if (b.bus!.dwell > 0) dwelt += 0.1
      for (const c of sim.cars) {
        const v = c.v < 0.05 ? (still.get(c.id) ?? 0) + 0.1 : 0
        still.set(c.id, v)
        longest = Math.max(longest, v)
      }
    }
    expect(dwelt).toBeGreaterThan(60)
    expect(longest).toBeLessThan(60)
  })
})
