import { describe, expect, it } from 'vitest'
import { restartOpening, taskDayOf } from '../sim'
import type { Action } from '../types'
import { HOUR, MIN, player, T0, world } from './helpers'

describe('round 2, 2.5: a city restart', () => {
  const acts: Action[] = [
    { t: T0 + MIN, k: 'donate', p: 'clinic', a: 500 },
    { t: T0 + 2 * MIN, k: 'open', lot: 'res-biz-1', type: 'coffee', name: 'Утро', color: '#b6463a', price: 2 },
    { t: T0 + 3 * MIN, k: 'login' },
  ]
  const grants = [{ id: 'g', to: 'a', amount: 20_000, note: '', at: T0 + 1 }]
  const before = world({ a: player(acts) }, T0 + 5 * HOUR, { grants })
  const at = T0 + 5 * HOUR
  const opening = { at, players: restartOpening(before.accounts) }
  // The same resident logs in again after the restart.
  const again: Action[] = [...acts, { t: at + 25 * HOUR, k: 'login' }]
  const after = world({ a: player(again) }, at + 26 * HOUR, { grants, opening, config: { startedAt: at } })
  const a0 = before.accounts.a
  const a1 = after.accounts.a

  it('keeps achievements and first steps, and pays none of them twice', () => {
    expect(a0.achievements.length).toBeGreaterThan(0)
    expect(a1.achievements).toEqual(expect.arrayContaining(a0.achievements))
    expect(a1.tutorial).toBeGreaterThanOrEqual(a0.tutorial)
    const paidTwice = a1.ledger.filter((l) => l.t > at && (l.why.startsWith('Достижение') || l.why.startsWith('Первые шаги')))
    // Only rewards for things reached after the restart could appear; none here.
    expect(paidTwice).toEqual([])
  })

  it('gives back the till together with everything invested', () => {
    const tills = Math.floor(a0.businesses[0].pending)
    expect(tills).toBeGreaterThan(0)
    const entry = opening.players.a
    expect(entry.refund!.tills).toBe(tills)
    expect(entry.balance).toBe(Math.round(a0.balance + a0.invested + tills))
  })

  it('keeps the old history and explains the refund', () => {
    expect(a1.ledger.some((l) => l.why.startsWith('Возврат после перезапуска города:') && l.why.includes('касса'))).toBe(true)
    expect(a1.ledger.some((l) => l.why === 'Стартовые Искры')).toBe(true)
    expect(taskDayOf(at)).toBeGreaterThan(0)
  })
})
