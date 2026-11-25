import { describe, expect, it } from 'vitest'
import { PLAN } from '../../city/plan'
import { BUSINESS_TYPE_BY_ID, fullRent, lotPrice, PLAYER_BUILDING_BY_ID } from '../catalog'
import { businessEconomics, deliveryCandidatesFor, replay, taskDayOf, taskDayStart, type EconomyContext } from '../sim'
import { cursorFor, deliveryFor, offeredTasks } from '../tasks'
import type { Action } from '../types'
import { config, HOUR, MIN, player, T0, world } from './helpers'

const paid = (w: ReturnType<typeof world>, uid: string, why: string) => w.accounts[uid].ledger.filter((l) => l.why.startsWith(why)).reduce((s, l) => s + l.amount, 0)
/** A typical plot for the building: the smaller half of the microdistrict plots it fits on. */
const avgLot = (kind: 'lowrise' | 'house') => {
  const def = PLAYER_BUILDING_BY_ID[kind]
  const all = PLAN.parcels.filter((p) => p.zone === 'residential' && p.w * p.d >= def.minArea).sort((a, b) => a.w * a.d - b.w * b.d)
  const list = all.slice(0, Math.ceil(all.length / 2))
  return list.reduce((s, p) => s + lotPrice(p.zone, p.w * p.d), 0) / list.length
}

describe('round 2, 2.1: building pays back', () => {
  it('a low-rise, full, pays back plot and building in 3–5 days', () => {
    const hours = (avgLot('lowrise') + PLAYER_BUILDING_BY_ID.lowrise.cost) / fullRent(PLAYER_BUILDING_BY_ID.lowrise.effects)
    expect(hours / 24).toBeGreaterThanOrEqual(3)
    expect(hours / 24).toBeLessThanOrEqual(5)
  })
  it('a private house, full, pays back in 3–5 days too', () => {
    const hours = (avgLot('house') + PLAYER_BUILDING_BY_ID.house.cost) / fullRent(PLAYER_BUILDING_BY_ID.house.effects)
    expect(hours / 24).toBeGreaterThanOrEqual(3)
    expect(hours / 24).toBeLessThanOrEqual(5)
  })
  it('a coffee shop pays back in 1–3 days', () => {
    const w = world({}, T0 + 24 * HOUR)
    const ctx: EconomyContext = { population: w.city.population, needs: w.city.needs, businesses: [], ratings: () => ({ avg: 0, count: 0 }) }
    const biz = { type: 'coffee' as const, name: 'x', color: '#b6463a', price: 2 as const, lot: 'res-biz-1', openedAt: 0, lastCollect: 0, upgrades: [], totalEarned: 0 }
    const hours = BUSINESS_TYPE_BY_ID.coffee.openCost / businessEconomics('a', biz, ctx).profit
    expect(hours / 24).toBeGreaterThanOrEqual(1)
    expect(hours / 24).toBeLessThanOrEqual(3)
  })
  it('rent follows the homes really lived in', () => {
    const plot = PLAN.parcels.find((p) => p.forPlayers && p.stage === 0 && p.w * p.d >= PLAYER_BUILDING_BY_ID.lowrise.minArea)!
    const acts: Action[] = [
      { t: T0 + MIN, k: 'buylot', lot: plot.id },
      { t: T0 + 2 * MIN, k: 'build', lot: plot.id, kind: 'lowrise' },
      { t: T0 + 3 * MIN, k: 'rush', lot: plot.id },
    ]
    const w = world({ a: player(acts) }, T0 + 2 * HOUR, { grants: [{ id: 'g', to: 'a', amount: 100_000, note: '', at: T0 + 1 }] })
    const pr = w.accounts.a.properties[0]
    const share = Math.min(1, w.city.population / w.city.needs.housing.supply)
    // The rate is from the last moment the till was updated: within a couple of Искры of now.
    expect(Math.abs(pr.rate! - fullRent(PLAYER_BUILDING_BY_ID.lowrise.effects) * share)).toBeLessThan(2)
    expect(pr.rate!).toBeLessThan(fullRent(PLAYER_BUILDING_BY_ID.lowrise.effects) + 0.01)
  })
})

describe('round 2, 2.1: the city never stops for good', () => {
  it('with no residents playing, homes full, it still grows at least 30 in 20 city days', () => {
    // A city whose needs are met (the projects are funded once at the start), nobody plays after.
    const funds: Action[] = ['tec-repair', 'clinic', 'water-tower', 'playground', 'park'].map((p, i) => ({ t: T0 + (i + 1) * MIN, k: 'donate', p, a: 9000 }))
    const cfg = { soloMode: true }
    const grants = [{ id: 'g', to: 'a', amount: 1_000_000, note: '', at: T0 + 1 }]
    const day = config().dayMinutes * MIN
    // Find when homes first run out, then look 20 city days later.
    let full = -1
    for (let d = 1; d < 400 && full < 0; d += 2) {
      const w = world({ a: player(funds) }, T0 + d * day, { grants, config: cfg })
      if (w.city.needs.housing.supply - w.city.population < w.city.needs.housing.supply * 0.1) full = d
    }
    expect(full).toBeGreaterThan(0)
    const a = world({ a: player(funds) }, T0 + full * day, { grants, config: cfg }).city.population
    const b = world({ a: player(funds) }, T0 + (full + 20) * day, { grants, config: cfg }).city.population
    expect(b - a).toBeGreaterThanOrEqual(30)
  })
})

describe('round 2, 2.2: tasks stay worth doing next to three businesses', () => {
  it('7 days, three businesses, all tasks, collecting three times a day: tasks are at least 20 % of income', () => {
    const cfg = config({ soloMode: true })
    const day0 = taskDayOf(T0) + 1
    const acts: Action[] = []
    const lots = ['res-biz-1', 'dt-biz-1', 'res-biz-2']
    // The city is already a Городок (400 residents), so a third business is allowed: the owner
    // got there with grants and low-rises; here it is enough to give the city homes and people.
    const opening = { at: T0, players: {} }
    void opening
    let t = taskDayStart(day0) + 7 * HOUR
    lots.forEach((lot, i) => acts.push({ t: t + i * MIN, k: 'open', lot, type: i === 1 ? 'diner' : 'coffee', name: `Б${i}`, color: '#b6463a', price: 2 }))
    for (let d = 0; d < 7; d++) {
      const s = taskDayStart(day0 + d)
      // The five tasks shown in the morning, done one after another.
      for (let k = 0; k < 5; k++) {
        t = s + 8 * HOUR + k * 10 * MIN
        const w = replay({ config: cfg, opening: null, players: { a: player([...acts]) }, grants: [{ id: 'g', to: 'a', amount: 50_000, note: '', at: T0 + 1 }], reviews: [] }, t)
        const acc = w.accounts.a
        const td = taskDayOf(t)
        const task = offeredTasks('a', cursorFor(acc.taskCur, td, (x) => acc.tasks[x]?.length ?? 0), acc.tasks[td] ?? [], null).find((x) => x.kind !== 'patrol')
        if (!task) continue
        const x = task.kind === 'delivery' ? deliveryFor('a', td, task.id, deliveryCandidatesFor(cfg)) : task.kind === 'survey' ? 0 : task.kind === 'reviews' ? 'cafe' : 15
        acts.push({ t, k: 'task', id: task.kind, v: task.id, x })
      }
      for (const h of [7.5, 15.5, 23.5]) for (const lot of lots) acts.push({ t: s + h * HOUR + lots.indexOf(lot), k: 'collect', lot })
    }
    acts.sort((a, b) => a.t - b.t)
    const w = replay({ config: cfg, opening: null, players: { a: player(acts) }, grants: [{ id: 'g', to: 'a', amount: 50_000, note: '', at: T0 + 1 }], reviews: [] }, taskDayStart(day0 + 7))
    const tasks = paid(w, 'a', 'Задание')
    const takings = paid(w, 'a', 'Выручка')
    expect(tasks).toBeGreaterThan(0)
    expect(takings).toBeGreaterThan(0)
    expect(tasks / (tasks + takings)).toBeGreaterThanOrEqual(0.2)
  })
})
