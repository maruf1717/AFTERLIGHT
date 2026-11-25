import { describe, expect, it } from 'vitest'
import { simulate } from '../sim'
import { config, player, T0, world } from './helpers'

const cfg = config()
const inputs = (players = {}) => ({ config: cfg, opening: null, players, grants: [], reviews: [] })

describe('city simulation', () => {
  it('starts with 120 residents', () => {
    expect(simulate(inputs(), T0).population).toBe(120)
  })

  it('has a health crisis at the start', () => {
    expect(simulate(inputs(), T0).crises).toContain('health')
  })

  it('has no health crisis once the clinic is built', () => {
    const w = world({ a: player([{ t: T0 + 1000, k: 'donate', p: 'clinic', a: 5000 }]) }, T0 + 2000, { grants: [{ id: 'g', to: 'a', amount: 10000, note: '', at: T0 + 500 }] })
    expect(w.city.projects.clinic.completedAt).not.toBeNull()
    expect(w.city.crises).not.toContain('health')
  })

  it('counts the days from the founding date', () => {
    expect(simulate(inputs(), T0 + 3.5 * cfg.dayMinutes * 60_000).day).toBe(4)
  })

  it('a project is not finished before its cost is collected', () => {
    const w = world({ a: player([{ t: T0 + 1000, k: 'donate', p: 'clinic', a: 4999 }]) }, T0 + 2000, { grants: [{ id: 'g', to: 'a', amount: 10000, note: '', at: T0 + 500 }] })
    expect(w.city.projects.clinic.completedAt).toBeNull()
    expect(w.city.projects.clinic.funded).toBe(4999)
  })

  it('is deterministic', () => {
    const now = T0 + 50 * cfg.dayMinutes * 60_000
    expect(simulate(inputs(), now).population).toBe(simulate(inputs(), now).population)
  })
})

describe('format', () => {
  it('signs numbers by value and shows zero plainly', async () => {
    const { fmtSigned } = await import('../../ui/game/common')
    expect(fmtSigned(1.73)).toBe('+1,7')
    expect(fmtSigned(-42)).toBe('−42,0')
    expect(fmtSigned(-0.01)).toBe('0')
    expect(fmtSigned(0.3, 1, 'minus')).toBe('−0,3')
    expect(fmtSigned(0, 1, 'minus')).toBe('0')
  })
})

describe('M1: today’s numbers update at once', () => {
  it('happiness is 100 and nobody leaves right after the clinic and the plant repair', () => {
    const grants = [{ id: 'g', to: 'a', amount: 20_000, note: '', at: T0 + 1 }]
    // Ten minutes into the first day: the day has not ended yet.
    const acts = [
      { t: T0 + 60_000, k: 'donate' as const, p: 'clinic', a: 5000 },
      { t: T0 + 120_000, k: 'donate' as const, p: 'tec-repair', a: 3000 },
    ]
    const w = world({ a: player(acts) }, T0 + 10 * 60_000, { grants, config: { soloMode: true } })
    expect(w.city.crises).toEqual([])
    expect(w.city.happiness).toBe(100)
    expect(w.city.outflow).toBe(0)
  })
})

describe('M7: changing the day length', () => {
  it('does not rewrite the days already lived', () => {
    const tenMin = T0 + 10 * 60_000
    const before = world({}, tenMin)
    expect(before.city.day).toBe(1)
    const periods = { dayPeriods: [{ from: T0, minutes: 15 }, { from: tenMin, minutes: 1 }] }
    const right = world({}, tenMin + 1, { config: periods })
    expect(right.city.day).toBe(1)
    // From then on one day per minute: 10/15 of a day lived + 5 one-minute days.
    const later = world({}, tenMin + 5 * 60_000 + 1000, { config: periods })
    expect(later.city.day).toBe(6)
  })
})

describe('M4: building names', () => {
  it('no two buildings share a name', async () => {
    const { BUILDINGS } = await import('../../data/city')
    const names = BUILDINGS.map((b) => b.name)
    expect(new Set(names).size).toBe(names.length)
  })
})
