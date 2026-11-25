import { describe, expect, it } from 'vitest'
import { migrateSnapshot } from '../backend'
import { DAILY_TASKS, START_BALANCE, TUTORIAL } from '../catalog'

/** The first «wires» also completes the first tutorial step. */
const FIRST = TUTORIAL[0].reward
import { deliveryTarget, taskDayOf } from '../sim'
import type { Action, LegacyPlayerDoc } from '../types'
import { config, HOUR, MIN, player, T0, world } from './helpers'

const reward = (id: string) => DAILY_TASKS.find((t) => t.id === id)!.reward

describe('ledger: nobody can write a balance', () => {
  it('a forged donation of 50 000 with 300 Искр does not fund the project', () => {
    const w = world({ cheat: player([{ t: T0 + MIN, k: 'donate', p: 'clinic', a: 50_000 }]) }, T0 + 2 * MIN)
    expect(w.city.projects.clinic.funded).toBe(0)
    expect(w.accounts.cheat.balance).toBe(START_BALANCE)
    expect(w.accounts.cheat.rejected[0].why).toBe('не хватает Искр')
  })

  it('a balance field written into the record is ignored', () => {
    const doc = { ...player([]), balance: 1_000_000 } as never
    const w = world({ cheat: doc }, T0 + MIN)
    expect(w.accounts.cheat.balance).toBe(START_BALANCE)
  })

  it('10 «wires» in one day pay once', () => {
    const acts: Action[] = Array.from({ length: 10 }, (_, i) => ({ t: T0 + (i + 1) * MIN, k: 'task', id: 'wires' }))
    const w = world({ a: player(acts) }, T0 + HOUR)
    expect(w.accounts.a.balance).toBe(START_BALANCE + reward('wires') + FIRST)
    expect(w.accounts.a.rejected).toHaveLength(9)
  })

  it('a task counts again on the next task day', () => {
    const next = T0 + 24 * HOUR
    const w = world({ a: player([{ t: T0 + MIN, k: 'task', id: 'wires' }, { t: next, k: 'task', id: 'wires' }]) }, next + MIN)
    expect(w.accounts.a.balance).toBe(START_BALANCE + 2 * reward('wires') + FIRST)
  })

  it('actions dated tomorrow do not count today', () => {
    const tomorrow = T0 + 24 * HOUR
    const w = world({ a: player([{ t: tomorrow, k: 'task', id: 'wires' }]) }, T0 + HOUR)
    expect(w.accounts.a.balance).toBe(START_BALANCE)
  })

  it('an action stamped earlier than the previous one is skipped', () => {
    const w = world({ a: player([{ t: T0 + 10 * MIN, k: 'task', id: 'wires' }, { t: T0 + 5 * MIN, k: 'task', id: 'survey', x: 0 }]) }, T0 + HOUR)
    expect(w.accounts.a.balance).toBe(START_BALANCE + reward('wires') + FIRST)
  })

  it('the delivery counts only at the right address', () => {
    const day = taskDayOf(T0)
    const right = deliveryTarget('a', day, config())
    const w1 = world({ a: player([{ t: T0 + MIN, k: 'task', id: 'delivery', x: 'b-nowhere' }]) }, T0 + HOUR)
    const w2 = world({ a: player([{ t: T0 + MIN, k: 'task', id: 'delivery', x: right }]) }, T0 + HOUR)
    expect(w1.accounts.a.balance).toBe(START_BALANCE)
    expect(w2.accounts.a.balance).toBe(START_BALANCE + reward('delivery'))
  })

  it('the patrol needs five real buildings', () => {
    const w = world({ a: player([{ t: T0 + MIN, k: 'task', id: 'patrol', ids: ['x', 'y'] }]) }, T0 + HOUR)
    expect(w.accounts.a.balance).toBe(START_BALANCE)
  })

  it('the owner cannot take a resident below zero', () => {
    const w = world({ a: player([]) }, T0 + HOUR, { grants: [{ id: 'g', to: 'a', amount: -5000, note: '', at: T0 + MIN }] })
    expect(w.accounts.a.balance).toBe(0)
  })

  it('one creative task pays once', () => {
    const r = (id: string, at: number) => ({ id, to: 'a', taskId: 'c-cat', status: 'approved' as const, rating: 5, reward: 300, featured: false, at })
    const w = world({ a: player([]) }, T0 + HOUR, { reviews: [r('1', T0 + MIN), r('2', T0 + 2 * MIN)] })
    expect(w.accounts.a.balance).toBe(START_BALANCE + 300)
  })

  it('a business can be opened only with a name and enough Искры', () => {
    const open = (name: string): Action => ({ t: T0 + MIN, k: 'open', lot: 'res-biz-1', type: 'coffee', name, color: '#b6463a', price: 2 })
    const grants = [{ id: 'g', to: 'a', amount: 10_000, note: '', at: T0 + 1 }]
    expect(world({ a: player([open('')]) }, T0 + HOUR, { grants }).accounts.a.business).toBeNull()
    expect(world({ a: player([open('Утро')]) }, T0 + HOUR).accounts.a.business).toBeNull()
    expect(world({ a: player([open('Утро')]) }, T0 + HOUR, { grants }).accounts.a.business?.name).toBe('Утро')
  })

  it('the till pays only what the business really earned', () => {
    const grants = [{ id: 'g', to: 'a', amount: 10_000, note: '', at: T0 + 1 }]
    const acts: Action[] = [
      { t: T0 + MIN, k: 'open', lot: 'res-biz-1', type: 'coffee', name: 'Утро', color: '#b6463a', price: 2 },
      { t: T0 + 2 * MIN, k: 'collect', lot: 'res-biz-1' },
      { t: T0 + 2 * MIN + 1, k: 'collect', lot: 'res-biz-1' },
      { t: T0 + 2 * MIN + 2, k: 'collect', lot: 'res-biz-1' },
    ]
    const w = world({ a: player(acts) }, T0 + 3 * MIN, { grants })
    const b = w.accounts.a.business!
    // One minute of a coffee shop: far less than a day's takings, and collecting again adds nothing.
    expect(b.totalEarned).toBeLessThan(100)
    expect(w.accounts.a.balance).toBe(START_BALANCE + 10_000 - 2500 + b.totalEarned)
  })
})

describe('restart and old saves', () => {
  it('restart returns everything a resident put into the city', () => {
    const grants = [{ id: 'g', to: 'a', amount: 10_000, note: '', at: T0 + 1 }]
    const acts: Action[] = [
      { t: T0 + MIN, k: 'donate', p: 'clinic', a: 1000 },
      { t: T0 + 2 * MIN, k: 'open', lot: 'res-biz-1', type: 'coffee', name: 'Утро', color: '#b6463a', price: 2 },
      { t: T0 + 3 * MIN, k: 'upgrade', lot: 'res-biz-1', u: 'greenery' },
    ]
    const before = world({ a: player(acts) }, T0 + 4 * MIN, { grants })
    const acc = before.accounts.a
    expect(acc.invested).toBe(1000 + 2500 + 800)
    // The owner's restart writes the opening balances (see adminRestart).
    const at = T0 + 4 * MIN
    const opening = { at, players: { a: { balance: Math.round(acc.balance + acc.invested), rep: acc.rep, donations: [], business: null, activity: [] } } }
    const after = world({ a: player(acts) }, at + MIN, { config: { startedAt: at }, opening, grants })
    expect(after.accounts.a.balance).toBe(Math.round(acc.balance) + 1000 + 2500 + 800)
    expect(after.accounts.a.business).toBeNull()
    expect(after.city.projects.clinic.funded).toBe(0)
  })

  it('an old save keeps its balance, business and donations', () => {
    const old: LegacyPlayerDoc = {
      joinedAt: T0,
      balance: 700,
      rep: 4,
      activity: [T0 + MIN],
      donations: [{ p: 'clinic', amt: 800, t: T0 + MIN }],
      business: { type: 'restaurant', name: 'SoBr', color: '#2e2e2e', price: 2, lot: 'res-biz-1', openedAt: T0 + 2 * MIN, lastCollect: T0 + 2 * MIN, upgrades: [], totalEarned: 0 },
      ratings: {},
      submissions: [],
    }
    const grants = [{ id: 'g', to: 'u', amount: 5000, note: '', at: T0 + 30 }]
    const snap = migrateSnapshot({ config: config(), opening: null, players: { u: old }, grants, reviews: [] }, T0 + 10 * MIN)
    expect(snap.opening!.players.u.balance).toBe(5700)
    expect((snap.players.u as { v: number }).v).toBe(2)
    const w = world(snap.players as never, T0 + 11 * MIN, { opening: snap.opening, grants })
    // The grant was already counted in the opening balance: not twice.
    expect(w.accounts.u.balance).toBe(5700)
    expect(w.accounts.u.business?.name).toBe('SoBr')
    expect(w.city.projects.clinic.funded).toBe(800)
  })
})

describe('first steps', () => {
  it('each step pays once, in order', () => {
    const grants = [{ id: 'g', to: 'a', amount: 10_000, note: '', at: T0 + 1 }]
    const acts: Action[] = [
      { t: T0 + MIN, k: 'task', id: 'wires' },
      { t: T0 + 2 * MIN, k: 'donate', p: 'clinic', a: 100 },
      { t: T0 + 3 * MIN, k: 'open', lot: 'res-biz-1', type: 'coffee', name: 'Утро', color: '#b6463a', price: 2 },
      { t: T0 + 3 * HOUR, k: 'collect', lot: 'res-biz-1' },
      { t: T0 + 3 * HOUR + 1, k: 'task', id: 'wires' },
    ]
    const w = world({ a: player(acts) }, T0 + 4 * HOUR, { grants })
    expect(w.accounts.a.tutorial).toBe(TUTORIAL.length)
    const paid = w.accounts.a.ledger.filter((l) => l.why.startsWith('Первые шаги')).reduce((s, l) => s + l.amount, 0)
    expect(paid).toBe(TUTORIAL.reduce((s, x) => s + x.reward, 0))
  })

  it('terrace and parking need a big enough plot', async () => {
    const { RESERVED_LOTS } = await import('../../data/lots')
    const small = RESERVED_LOTS.find((l) => l.use === 'business' && l.parcel.w * l.parcel.d < 90 && l.parcel.stage === 0)
    if (!small) return
    const grants = [{ id: 'g', to: 'a', amount: 10_000, note: '', at: T0 + 1 }]
    const acts: Action[] = [
      { t: T0 + MIN, k: 'open', lot: small.key, type: 'coffee', name: 'Утро', color: '#b6463a', price: 2 },
      { t: T0 + 2 * MIN, k: 'upgrade', lot: small.key, u: 'terrace' },
      { t: T0 + 3 * MIN, k: 'upgrade', lot: small.key, u: 'greenery' },
    ]
    const b = world({ a: player(acts) }, T0 + HOUR, { grants }).accounts.a.business!
    expect(b.upgrades).toEqual(['greenery'])
  })
})
