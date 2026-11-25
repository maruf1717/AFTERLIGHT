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
