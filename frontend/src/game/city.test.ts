import { describe, expect, it } from 'vitest'
import { BAD_MOOD_MS, BUILDING_BY_ID, OFFLINE_CAP_MS, ROAD_BY_ID, SELL_SHARE, START_MONEY } from './catalog'
import { advance, build, cellsOf, ENTRY, ENTRY_Z, evaluate, newCity, road, sell, type CityData } from './city'
import { makeComplaint } from './complaints'

const T = 1_800_000_000_000
const ok = (r: CityData | string): CityData => {
  if (typeof r === 'string') throw new Error(r)
  return r
}
/** A street from the highway eastwards along the entry row. */
function street(c: CityData, to: number) {
  for (let x = 3; x <= to; x++) c = ok(road(c, 'street', x, ENTRY_Z))
  return c
}

describe('building', () => {
  it('a new city has money and the highway', () => {
    const c = newCity('Тест', T)
    expect(c.money).toBe(START_MONEY)
    for (const [x, z] of ENTRY) expect(c.roads[`${x},${z}`]).toBe('street')
  })

  it('a building costs its price, cannot overlap, sells for half', () => {
    let c = newCity('Тест', T)
    c = ok(build(c, 'house', 5, 5, 0))
    expect(c.money).toBe(START_MONEY - BUILDING_BY_ID.house.cost)
    expect(build(c, 'house', 5, 5, 0)).toBe('Здесь занято')
    const s = sell(c, 5, 5)
    if (typeof s === 'string') throw new Error(s)
    expect(s.got).toBe(Math.floor(BUILDING_BY_ID.house.cost * SELL_SHARE))
    expect(s.city.items).toHaveLength(0)
  })

  it('turning a building swaps its sides', () => {
    expect(cellsOf({ id: 'school', x: 0, z: 0, r: 0 })).toHaveLength(6)
    const a = cellsOf({ id: 'school', x: 0, z: 0, r: 0 })
    const b = cellsOf({ id: 'school', x: 0, z: 0, r: 1 })
    expect(Math.max(...a.map((c) => c[0]))).toBe(2)
    expect(Math.max(...b.map((c) => c[0]))).toBe(1)
  })

  it('roads cost money and the highway cannot be removed', () => {
    let c = newCity('Тест', T)
    c = ok(road(c, 'avenue', 3, ENTRY_Z))
    expect(c.money).toBe(START_MONEY - ROAD_BY_ID.avenue.cost)
    expect(road(c, 'dirt', 0, ENTRY_Z)).toBe('Въезд в город нельзя трогать')
    expect(sell(c, 1, ENTRY_Z)).toBe('Въезд в город нельзя трогать')
  })

  it('locked buildings cannot be built yet', () => {
    expect(build(newCity('Тест', T), 'tower', 10, 10, 0)).toBe('Ещё не открыто')
  })
})

describe('the city lives', () => {
  it('a home works only with a road to the highway', () => {
    let c = newCity('Тест', T)
    c = ok(build(c, 'house', 5, ENTRY_Z + 1, 0))
    expect(evaluate(c).connected.size).toBe(0)
    c = street(c, 6)
    expect(evaluate(c).connected.size).toBe(1)
  })

  it('people move in, pay taxes; without electricity they are unhappy', () => {
    let c = street(newCity('Тест', T), 12)
    for (let x = 4; x <= 10; x++) c = ok(build(c, 'house', x, ENTRY_Z + 1, 0))
    c = ok(build(c, 'shop', 11, ENTRY_Z + 1, 0))
    const dark = advance(c, T + 120_000)
    expect(dark.city.pop).toBeGreaterThan(0)
    // People use electricity and water: none is made, so they complain about both.
    const missing = dark.stats.perHome.flatMap((h) => h.missing)
    expect(missing).toContain('power')
    expect(missing).toContain('water')
    let lit = ok(build(dark.city, 'wind', 4, ENTRY_Z - 1, 0))
    lit = ok(build(lit, 'waterTower', 5, ENTRY_Z - 1, 0))
    const after = evaluate(lit)
    expect(after.happiness).toBeGreaterThan(dark.stats.happiness)
    expect(after.perHome.flatMap((h) => h.missing)).not.toContain('power')
  })

  it('money comes from taxes over time', () => {
    let c = street(newCity('Тест', T), 12)
    for (let x = 4; x <= 10; x++) c = ok(build(c, 'house', x, ENTRY_Z + 1, 0))
    c = ok(build(c, 'shop', 11, ENTRY_Z + 1, 0))
    c = ok(build(c, 'wind', 4, ENTRY_Z - 1, 0))
    c = ok(build(c, 'waterTower', 5, ENTRY_Z - 1, 0))
    const a = advance(c, T + 300_000).city
    const b = advance(a, T + 600_000)
    expect(b.stats.income).toBeGreaterThan(0)
    expect(b.city.money).toBeGreaterThan(a.money)
  })

  it('money earned while away is capped', () => {
    let c = street(newCity('Тест', T), 12)
    for (let x = 4; x <= 10; x++) c = ok(build(c, 'house', x, ENTRY_Z + 1, 0))
    c = ok(build(c, 'wind', 4, ENTRY_Z - 1, 0))
    c = ok(build(c, 'waterTower', 5, ENTRY_Z - 1, 0))
    const settled = advance(c, T + 600_000).city
    const rate = evaluate(settled).income
    const away = advance(settled, settled.at + 10 * OFFLINE_CAP_MS, true).city
    expect(away.money - settled.money).toBeLessThanOrEqual((rate * OFFLINE_CAP_MS) / 60_000 + 1)
  })

  it('residents unhappy for too long: the city rolls back to the last good state', () => {
    let c = street(newCity('Тест', T), 12)
    for (let x = 4; x <= 10; x++) c = ok(build(c, 'house', x, ENTRY_Z + 1, 0))
    c = ok(build(c, 'shop', 11, ENTRY_Z + 1, 0))
    c = ok(build(c, 'wind', 4, ENTRY_Z - 1, 0))
    c = ok(build(c, 'waterTower', 5, ENTRY_Z - 1, 0))
    c = ok(build(c, 'gazebo', 6, ENTRY_Z - 1, 0))
    // Happy for a while: a good state is remembered.
    let t = T
    for (let i = 0; i < 30; i++) c = advance(c, (t += 10_000)).city
    expect(c.snapshot).not.toBeNull()
    const good = c.snapshot!
    // Sell the power and water: very unhappy.
    for (const x of [4, 5]) {
      const s = sell(c, x, ENTRY_Z - 1)
      if (typeof s === 'string') throw new Error(s)
      c = s.city
    }
    let rolled = false
    for (let i = 0; i < 20 && !rolled; i++) {
      const r = advance(c, (t += 10_000))
      c = r.city
      rolled = r.rolledBack
    }
    expect(rolled).toBe(true)
    expect(c.items.length).toBe(good.items.length)
    expect(c.rollbacks).toBe(1)
    expect(t - T).toBeGreaterThanOrEqual(BAD_MOOD_MS)
  })

  it('complaints name what is missing', () => {
    const c = makeComplaint([{ home: 1, missing: ['power'] }], 7)!
    expect(c.problem).toBe('power')
    expect(c.text.length).toBeGreaterThan(5)
    expect(makeComplaint([{ home: 1, missing: [] }], 7)).toBeNull()
  })
})
