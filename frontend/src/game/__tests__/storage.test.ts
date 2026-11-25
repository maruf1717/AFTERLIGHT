import { describe, expect, it } from 'vitest'
import { moveSubmissions } from '../backend'
import { taskDayOf, taskDayStart } from '../sim'
import type { Action, PlayerDoc, Submission } from '../types'
import { config, HOUR, player, T0 } from './helpers'

const drawing: Submission = { id: 'x1', taskId: 'c-cat', kind: 'drawing', image: `data:image/jpeg;base64,${'A'.repeat(40_000)}`, at: T0 }

describe('T2: player records stay small', () => {
  it('old creative works move out of the record (migration)', () => {
    const doc: PlayerDoc = { ...player([{ t: T0 + 1, k: 'task', id: 'wires' }]), submissions: [drawing] }
    const snap = moveSubmissions({ config: config(), opening: null, players: { u: doc }, grants: [], reviews: [] })
    const moved = snap.players.u as PlayerDoc
    expect(moved.submissions).toBeUndefined()
    expect(moved.actions).toHaveLength(1)
    expect(snap.submissions?.u?.[0].id).toBe('x1')
  })

  it('a month of daily play keeps the record under 20 KB', () => {
    const acts: Action[] = []
    const d0 = taskDayOf(T0) + 1
    for (let d = 0; d < 30; d++) {
      const s = taskDayStart(d0 + d)
      acts.push({ t: s + 7 * HOUR, k: 'login' })
      acts.push({ t: s + 8 * HOUR, k: 'task', id: 'survey', x: 1 })
      acts.push({ t: s + 8.2 * HOUR, k: 'task', id: 'delivery', x: 'b-p123' })
      acts.push({ t: s + 8.4 * HOUR, k: 'task', id: 'patrol', ids: ['b-p1', 'b-p2', 'b-p3', 'b-p4', 'b-p5'] })
      acts.push({ t: s + 8.6 * HOUR, k: 'task', id: 'reviews', x: 'u_p5mRIdB45LOTm7lEfDYZgA' })
      acts.push({ t: s + 8.8 * HOUR, k: 'task', id: 'wires', x: 12 })
      for (const h of [9, 17, 23]) acts.push({ t: s + h * HOUR, k: 'collect', lot: 'res-biz-1' })
    }
    const size = new TextEncoder().encode(JSON.stringify({ ...player(acts), name: 'Маруф' })).length
    expect(size).toBeLessThan(20_000)
  })
})
