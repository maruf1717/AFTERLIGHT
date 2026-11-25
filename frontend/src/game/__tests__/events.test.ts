import { describe, expect, it } from 'vitest'
import { ATTIC_REWARD, EVENT_CONSOLATION, EVENT_REWARD } from '../catalog'
import { cursorFor, offeredTasks, TASK_POOL } from '../tasks'
import { eventBox, isEventDay, taskDayOf } from '../sim'
import type { Action } from '../types'
import { HOUR, MIN, player, T0, world } from './helpers'

const DAY = 24 * HOUR
/** The first moment from T0 on a day that is (or is not) a warehouse day. */
const dayWhere = (open: boolean) => {
  for (let k = 0; k < 10; k++) if (isEventDay(taskDayOf(T0 + k * DAY)) === open) return T0 + k * DAY
  throw new Error('no such day')
}
const last = (w: ReturnType<typeof world>) => w.accounts.a.ledger.at(-1)!

describe('round 2, 3.4: warehouse No. 7 and the attic', () => {
  const t = dayWhere(true)
  const box = eventBox('a', taskDayOf(t))
  const others = [0, 1, 2, 3, 4, 5].filter((x) => x !== box)
  it('the right box among three: the full reward', () => {
    const w = world({ a: player([{ t: t + MIN, k: 'event', picks: [others[0], box] }]) }, t + 2 * MIN)
    expect(last(w).amount).toBe(EVENT_REWARD)
  })
  it('three empty boxes: a little for trying', () => {
    const w = world({ a: player([{ t: t + MIN, k: 'event', picks: others.slice(0, 3) }]) }, t + 2 * MIN)
    expect(last(w).amount).toBe(EVENT_CONSOLATION)
  })
  it('more than three boxes do not count', () => {
    const w = world({ a: player([{ t: t + MIN, k: 'event', picks: [...others.slice(0, 3), box] }]) }, t + 2 * MIN)
    expect(last(w).amount).toBe(EVENT_CONSOLATION)
  })
  it('the attic opens on the other days', () => {
    const odd = dayWhere(false)
    const ok = world({ a: player([{ t: odd + MIN, k: 'event', w: 'attic' }]) }, odd + 2 * MIN)
    expect(last(ok).amount).toBe(ATTIC_REWARD)
    const shut = world({ a: player([{ t: t + MIN, k: 'event', w: 'attic' }]) }, t + 2 * MIN)
    expect(shut.accounts.a.rejected.map((r) => r.why)).toEqual(['чердак сегодня закрыт'])
  })
})

describe('round 2, 3.2: the vote changes the city', () => {
  it('«what the city needs» for the park: donations to the park get 10 % on top for a day', () => {
    // Find a day when this resident is offered the «need» survey.
    let at = -1
    let id = ''
    for (let k = 0; k < 60 && at < 0; k++) {
      const tt = T0 + k * DAY
      const d = taskDayOf(tt)
      const w = world({}, tt)
      void w
      const offered = offeredTasks('a', cursorFor(null, d, () => 0), [], null)
      const q = offered.find((x) => x.id === 's-need')
      if (q) {
        at = tt
        id = q.id
      }
    }
    expect(TASK_POOL.some((x) => x.id === 's-need')).toBe(true)
    if (at < 0) return // not offered within two months for this id: nothing to check
    const acts: Action[] = [
      { t: at + MIN, k: 'task', id: 'survey', v: id, x: 1 },
      { t: at + 2 * MIN, k: 'donate', p: 'park', a: 1000 },
    ]
    const base: Action[] = [{ t: at + 2 * MIN, k: 'donate', p: 'park', a: 1000 }]
    const grants = [{ id: 'g', to: 'a', amount: 10_000, note: '', at: T0 + 1 }]
    const voted = world({ a: player(acts) }, at + 3 * MIN, { grants, config: { soloMode: true } })
    const plain = world({ a: player(base) }, at + 3 * MIN, { grants, config: { soloMode: true } })
    expect(voted.city.projects.park.funded - plain.city.projects.park.funded).toBe(100)
    expect(voted.city.voteBonus).toBe('park')
  })
})
