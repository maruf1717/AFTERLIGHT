import { describe, expect, it } from 'vitest'
import { PLAN } from '../../city/plan'
import { BUSINESS_TYPE_BY_ID, DAILY_TASKS, EVENT_REWARD, PLAYER_BUILDING_BY_ID, STREAK_DAYS, STREAK_REWARD, WIRES_FAST_BONUS, lotPrice } from '../catalog'
import { buyableParcel, businessEconomics, deliveryTarget, isEventDay, replay, starterBuildings, taskDayOf, taskDayStart, type EconomyContext } from '../sim'
import type { Action } from '../types'
import { config, HOUR, MIN, player, T0, world } from './helpers'

const paid = (w: ReturnType<typeof world>, uid: string, why: string) => w.accounts[uid].ledger.filter((l) => l.why.startsWith(why)).reduce((s, l) => s + l.amount, 0)
const rich = (to = 'a') => [{ id: 'g', to, amount: 100_000, note: '', at: T0 + 1 }]

describe('G1: residents build the city', () => {
  const start = world({}, T0)
  const plot = PLAN.parcels.find((p) => buyableParcel(p, 0) && !start.city.built.has(`b-${p.id}`) && p.w * p.d >= PLAYER_BUILDING_BY_ID.lowrise.minArea && p.zone !== 'industrial')!

  it('there are plots to buy on day one', () => {
    expect(plot).toBeTruthy()
  })

  it('buy a plot, build a low-rise: after the build days the city has 40 more homes', () => {
    const acts: Action[] = [
      { t: T0 + MIN, k: 'buylot', lot: plot.id },
      { t: T0 + 2 * MIN, k: 'build', lot: plot.id, kind: 'lowrise' },
    ]
    const days = PLAYER_BUILDING_BY_ID.lowrise.days * config().dayMinutes * MIN
    const during = world({ a: player(acts) }, T0 + 3 * MIN, { grants: rich() })
    const after = world({ a: player(acts) }, T0 + 2 * MIN + days + MIN, { grants: rich() })
    const base = world({ a: player([]) }, T0 + 2 * MIN + days + MIN, { grants: rich() })
    expect(during.accounts.a.properties[0].readyAt).toBeGreaterThan(T0 + 3 * MIN)
    expect(after.city.needs.housing.supply - base.city.needs.housing.supply).toBe(40)
    expect(paid(after, 'a', 'Покупка участка')).toBe(-lotPrice(plot.zone, plot.w * plot.d))
    expect(paid(after, 'a', 'Стройка')).toBe(-PLAYER_BUILDING_BY_ID.lowrise.cost)
  })

  it('nobody can build on somebody else’s plot or buy it twice', () => {
    const w = world(
      {
        a: player([{ t: T0 + MIN, k: 'buylot', lot: plot.id }]),
        b: player([
          { t: T0 + 2 * MIN, k: 'buylot', lot: plot.id },
          { t: T0 + 3 * MIN, k: 'build', lot: plot.id, kind: 'house' },
        ]),
      },
      T0 + HOUR,
      { grants: [...rich('a'), { id: 'g2', to: 'b', amount: 100_000, note: '', at: T0 + 1 }] },
    )
    expect(w.city.owned[plot.id]).toBe('a')
    expect(w.accounts.b.properties).toHaveLength(0)
  })

  it('rushing finishes the site at once', () => {
    const acts: Action[] = [
      { t: T0 + MIN, k: 'buylot', lot: plot.id },
      { t: T0 + 2 * MIN, k: 'build', lot: plot.id, kind: 'house' },
      { t: T0 + 3 * MIN, k: 'rush', lot: plot.id },
    ]
    const w = world({ a: player(acts) }, T0 + 4 * MIN, { grants: rich() })
    expect(w.accounts.a.properties[0].readyAt).toBe(T0 + 3 * MIN)
    expect(paid(w, 'a', 'Ускорение')).toBeLessThan(0)
  })

  it('the city does not grow by itself onto a plot a resident owns', () => {
    const acts: Action[] = [{ t: T0 + MIN, k: 'buylot', lot: plot.id }]
    const late = T0 + 600 * config().dayMinutes * MIN
    const w = world({ a: player(acts) }, late, { grants: rich() })
    expect(w.city.built.has(`b-${plot.id}`)).toBe(false)
  })
})

/** A diligent resident: all five tasks every day and collecting three times a day. */
function diligentWeek(days: number) {
  const cfg = config({ soloMode: true })
  const acts: Action[] = []
  const lot = 'res-biz-1'
  // Joined the evening before; plays from the next morning.
  const day0 = taskDayOf(T0) + 1
  for (let d = 0; d < days; d++) {
    const s = taskDayStart(day0 + d)
    const day = day0 + d
    acts.push({ t: s + 8 * HOUR, k: 'task', id: 'survey', x: 0 })
    acts.push({ t: s + 8.5 * HOUR, k: 'task', id: 'delivery', x: deliveryTarget('a', day, cfg) })
    acts.push({ t: s + 9 * HOUR, k: 'task', id: 'patrol', ids: starterBuildings(cfg).slice(0, 5).map((b) => b.id) })
    acts.push({ t: s + 9.5 * HOUR, k: 'task', id: 'reviews', x: 'cafe' })
    acts.push({ t: s + 10 * HOUR, k: 'task', id: 'wires', x: 15 })
    if (d === 0) acts.push({ t: s + 10.5 * HOUR, k: 'open', lot, type: 'coffee', name: 'Утро', color: '#b6463a', price: 2 })
    for (const h of [7.5, 15.5, 23.5]) acts.push({ t: s + h * HOUR, k: 'collect', lot })
  }
  acts.sort((a, b) => a.t - b.t)
  const end = taskDayStart(day0 + days)
  // Two neighbours repaired the plant on the first day, as a normal city would.
  // Two neighbours repaired the plant on the first day and built the solar farm once the city
  // was big enough (a growing city needs more power), as a normal city would.
  const solarAt = taskDayStart(day0 + 1)
  const fixers = {
    b: player([{ t: T0 + MIN, k: 'donate', p: 'tec-repair', a: 1500 }, { t: solarAt, k: 'donate', p: 'solar', a: 4000 }]),
    c: player([{ t: T0 + MIN, k: 'donate', p: 'tec-repair', a: 1500 }, { t: solarAt, k: 'donate', p: 'solar', a: 4000 }]),
  }
  const grants = [{ id: 'gb', to: 'b', amount: 5000, note: '', at: T0 + 1 }, { id: 'gc', to: 'c', amount: 5000, note: '', at: T0 + 1 }]
  return replay({ config: cfg, opening: null, players: { a: player(acts), ...fixers }, grants, reviews: [] }, end)
}

describe('G2: tasks stay worth it', () => {
  it('over a week, tasks bring at least 30 % of what a diligent resident earns', () => {
    const w = diligentWeek(7)
    const tasks = paid(w, 'a', 'Задание')
    const takings = paid(w, 'a', 'Выручка')
    expect(tasks).toBeGreaterThan(0)
    expect(takings).toBeGreaterThan(0)
    expect(tasks / (tasks + takings)).toBeGreaterThanOrEqual(0.3)
    // And the business is a real income: at least 1.5× and at most 2.5× the tasks.
    expect(takings / tasks).toBeGreaterThan(1.5)
    expect(takings / tasks).toBeLessThan(2.5)
  })

  it('all daily tasks together are worth about 780', () => {
    expect(DAILY_TASKS.reduce((s, t) => s + t.reward, 0)).toBe(780)
  })

  it('the first business is affordable on day one', () => {
    const w = world({ a: player([]) }, T0 + MIN)
    expect(w.accounts.a.balance).toBeGreaterThanOrEqual(BUSINESS_TYPE_BY_ID.diner.openCost)
  })
})

describe('G4: an active resident counts for the whole task day', () => {
  it('after a morning task, every city day until midnight sees the resident active', () => {
    const morning = taskDayStart(taskDayOf(T0) + 1) + 8 * HOUR
    for (const h of [0.5, 3, 9, 15.5]) {
      const w = world({ a: player([{ t: morning, k: 'task', id: 'wires' }]) }, morning + h * HOUR)
      expect(w.city.activeToday).toBeGreaterThanOrEqual(1)
    }
  })
})

describe('G6: prices are a real choice', () => {
  const ctx = (): EconomyContext => {
    const w = world({}, T0)
    return { population: w.city.population, needs: w.city.needs, businesses: [], ratings: () => ({ avg: 0, count: 0 }) }
  }
  const biz = (lot: string, price: 1 | 2 | 3) => ({ type: 'coffee' as const, name: 'x', color: '#b6463a', price, lot, openedAt: 0, lastCollect: 0, upgrades: [], totalEarned: 0 })
  it('coffee in the microdistrict: middle prices beat high ones', () => {
    expect(businessEconomics('a', biz('res-biz-1', 2), ctx()).profit).toBeGreaterThan(businessEconomics('a', biz('res-biz-1', 3), ctx()).profit)
  })
  it('coffee downtown: high prices beat middle ones', () => {
    expect(businessEconomics('a', biz('dt-biz-1', 3), ctx()).profit).toBeGreaterThan(businessEconomics('a', biz('dt-biz-1', 2), ctx()).profit)
  })
  it('high prices cost the city a little happiness', () => {
    const open = (price: 1 | 2 | 3): Action => ({ t: T0 + MIN, k: 'open', lot: 'res-biz-1', type: 'coffee', name: 'Утро', color: '#b6463a', price })
    const mid = world({ a: player([open(2)]) }, T0 + 2 * MIN, { grants: rich() })
    const high = world({ a: player([open(3)]) }, T0 + 2 * MIN, { grants: rich() })
    expect(mid.city.happiness - high.city.happiness).toBe(1)
  })
})

describe('G11 + G13 + G16', () => {
  it('one Искра does not make a participant', () => {
    const w = world({ a: player([{ t: T0 + MIN, k: 'donate', p: 'park', a: 1 }]), b: player([{ t: T0 + MIN, k: 'donate', p: 'park', a: 200 }]) }, T0 + HOUR)
    expect(w.city.projects.park.donors).toBe(1)
  })

  it('a third business only from the level «Город»; selling returns half', () => {
    const open = (t: number, lot: string): Action => ({ t, k: 'open', lot, type: 'diner', name: 'Сытно', color: '#b6463a', price: 2 })
    const acts: Action[] = [open(T0 + MIN, 'res-biz-1'), open(T0 + 2 * MIN, 'res-biz-2'), open(T0 + 3 * MIN, 'res-biz-3')]
    const w = world({ a: player(acts) }, T0 + HOUR, { grants: rich() })
    expect(w.accounts.a.businesses).toHaveLength(2)
    expect(w.accounts.a.rejected.at(-1)?.why).toBe('третий бизнес позже')
    const sold = world({ a: player([...acts, { t: T0 + 4 * MIN, k: 'sell', lot: 'res-biz-1' }]) }, T0 + HOUR, { grants: rich() })
    expect(sold.accounts.a.businesses).toHaveLength(1)
    expect(paid(sold, 'a', 'Продажа')).toBeGreaterThanOrEqual(BUSINESS_TYPE_BY_ID.diner.openCost / 2)
  })

  it('seven days in a row pay the streak reward once', () => {
    const d0 = taskDayOf(T0) + 1
    const acts: Action[] = Array.from({ length: STREAK_DAYS }, (_, i) => ({ t: taskDayStart(d0 + i) + 9 * HOUR, k: 'login' as const }))
    const w = world({ a: player(acts) }, taskDayStart(d0 + STREAK_DAYS))
    expect(paid(w, 'a', `${STREAK_DAYS} дней подряд`)).toBe(STREAK_REWARD)
  })

  it('Warehouse No. 7 opens every second day, one parcel per resident', () => {
    const d0 = taskDayOf(T0)
    const even = isEventDay(d0) ? d0 : d0 + 1
    const acts: Action[] = [
      { t: taskDayStart(even) + 9 * HOUR, k: 'event' },
      { t: taskDayStart(even) + 10 * HOUR, k: 'event' },
      { t: taskDayStart(even + 1) + 9 * HOUR, k: 'event' },
    ]
    const w = world({ a: player(acts) }, taskDayStart(even + 2))
    expect(paid(w, 'a', 'Посылка со Склада')).toBe(EVENT_REWARD)
  })

  it('wires solved fast pay 20 % more', () => {
    const slow = world({ a: player([{ t: T0 + MIN, k: 'task', id: 'wires', x: 15 }]) }, T0 + HOUR)
    const fast = world({ a: player([{ t: T0 + MIN, k: 'task', id: 'wires', x: 8 }]) }, T0 + HOUR)
    expect(paid(fast, 'a', 'Задание')).toBe(Math.round(paid(slow, 'a', 'Задание') * (1 + WIRES_FAST_BONUS)))
  })

  it('achievements pay once', () => {
    const w = world({ a: player([{ t: T0 + MIN, k: 'task', id: 'survey', x: 0 }, { t: T0 + 24 * HOUR, k: 'task', id: 'survey', x: 0 }]) }, T0 + 25 * HOUR)
    expect(w.accounts.a.ledger.filter((l) => l.why === 'Достижение: Первое задание')).toHaveLength(1)
  })
})
