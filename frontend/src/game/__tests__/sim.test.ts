import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, type GameConfig } from '../catalog'
import { simulate } from '../sim'
import { emptyPlayer, type PlayerDoc } from '../types'

const T0 = Date.UTC(2026, 10, 24, 6, 0, 0)
const cfg: GameConfig = { ...DEFAULT_CONFIG, startedAt: T0 }

function withDonations(list: { p: string; amt: number; t: number }[]): Record<string, PlayerDoc> {
  return { a: { ...emptyPlayer(T0), balance: 100000, donations: list } }
}

describe('simulate', () => {
  it('starts with 120 residents', () => {
    expect(simulate(cfg, {}, T0).population).toBe(120)
  })

  it('has a health crisis at the start', () => {
    expect(simulate(cfg, {}, T0).crises).toContain('health')
  })

  it('has no health crisis once the clinic is built', () => {
    const players = withDonations([{ p: 'clinic', amt: 5000, t: T0 + 1000 }])
    const city = simulate(cfg, players, T0 + 2000)
    expect(city.projects.clinic.completedAt).not.toBeNull()
    expect(city.crises).not.toContain('health')
  })

  it('counts the days from the founding date', () => {
    const city = simulate(cfg, {}, T0 + 3.5 * cfg.dayMinutes * 60_000)
    expect(city.day).toBe(4)
  })

  it('a project is not finished before its cost is collected', () => {
    const city = simulate(cfg, withDonations([{ p: 'clinic', amt: 4999, t: T0 + 1000 }]), T0 + 2000)
    expect(city.projects.clinic.completedAt).toBeNull()
    expect(city.projects.clinic.funded).toBe(4999)
  })

  it('is deterministic', () => {
    const now = T0 + 50 * cfg.dayMinutes * 60_000
    expect(simulate(cfg, {}, now).population).toBe(simulate(cfg, {}, now).population)
  })
})
