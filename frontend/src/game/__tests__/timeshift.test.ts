import { describe, expect, it } from 'vitest'
import { PLAN } from '../../city/plan'
import { PLAYER_BUILDING_BY_ID } from '../catalog'
import { buyableParcel } from '../sim'
import type { Action } from '../types'
import { config, HOUR, MIN, player, T0, world } from './helpers'

/**
 * Этап 1 (круг 2): the test clock moves the game «now» forward. The engine only ever sees
 * «now», so moving it 6 hours ahead must give exactly 6 hours of everything.
 */
describe('test clock', () => {
  const start = world({}, T0)
  const plot = PLAN.parcels.find((p) => buyableParcel(p, 0) && !start.city.built.has(`b-${p.id}`) && PLAYER_BUILDING_BY_ID.house.zones.includes(p.zone) && p.w * p.d >= 60)!
  const acts: Action[] = [
    { t: T0 + MIN, k: 'open', lot: 'res-biz-1', type: 'coffee', name: 'Утро', color: '#b6463a', price: 2 },
    { t: T0 + 2 * MIN, k: 'buylot', lot: plot.id },
    { t: T0 + 3 * MIN, k: 'build', lot: plot.id, kind: 'house' },
  ]
  const grants = [{ id: 'g', to: 'a', amount: 100_000, note: '', at: T0 + 1 }]
  const at = (h: number) => world({ a: player(acts) }, T0 + 3 * MIN + h * HOUR, { grants, config: { soloMode: true } })

  it('+6 hours: the till holds six hours of takings', () => {
    const one = at(1).accounts.a.businesses[0]
    const six = at(6).accounts.a.businesses[0]
    expect(one.pending).toBeGreaterThan(0)
    // Linear in time (the city barely changes in a few hours): about six times one hour.
    expect(six.pending / one.pending).toBeGreaterThan(5)
    expect(six.pending / one.pending).toBeLessThan(7)
  })

  it('+1 hour: a house started an hour ago is finished, and rent then runs for the rest of the time', () => {
    const buildMs = PLAYER_BUILDING_BY_ID.house.days * config().dayMinutes * MIN
    expect(buildMs).toBeLessThanOrEqual(HOUR)
    const w1 = at(1)
    const pr1 = w1.accounts.a.properties[0]
    expect(pr1.readyAt).toBeLessThanOrEqual(w1.city.now)
    const w6 = at(6)
    const pr6 = w6.accounts.a.properties[0]
    const hoursOfRent = (w6.city.now - pr6.readyAt) / HOUR
    expect(hoursOfRent).toBeGreaterThan(5)
    expect(pr6.pending).toBeGreaterThan(0)
  })

  it('+1 day: a new task day starts', () => {
    expect(at(24).city.taskDay).toBe(at(0).city.taskDay + 1)
    expect(at(24).city.day).toBeGreaterThan(at(0).city.day + 90)
  })
})
