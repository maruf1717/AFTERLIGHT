import { describe, expect, it } from 'vitest'
import { cursorFor, deliveryFor, offeredTasks, TASK_POOL, TASKS_PER_DAY, TASKS_SHOWN } from '../tasks'
import { deliveryCandidatesFor, taskDayOf } from '../sim'
import type { Action } from '../types'
import { config, MIN, player, T0, world } from './helpers'

const day = taskDayOf(T0)
const shown = (uid: string, acts: Action[], now: number, solo = false) => {
  const w = world({ [uid]: player(acts) }, now, { config: { soloMode: solo } })
  const a = w.accounts[uid]
  const d = taskDayOf(now)
  return { w, list: offeredTasks(uid, cursorFor(a?.taskCur ?? null, d, (x) => a?.tasks[x]?.length ?? 0), a?.tasks[d] ?? [], solo ? null : TASKS_PER_DAY) }
}
/** An action that completes a task of the bank the way the screens do it. */
function finish(uid: string, taskId: string, t: number): Action {
  const v = TASK_POOL.find((x) => x.id === taskId)!
  const d = taskDayOf(t)
  if (v.kind === 'delivery') return { t, k: 'task', id: 'delivery', v: v.id, x: deliveryFor(uid, d, v.id, deliveryCandidatesFor(config())) }
  if (v.kind === 'survey') return { t, k: 'task', id: 'survey', v: v.id, x: 0 }
  if (v.kind === 'reviews') return { t, k: 'task', id: 'reviews', v: v.id, x: 'cafe' }
  if (v.kind === 'wires') return { t, k: 'task', id: 'wires', v: v.id, x: 15 }
  return { t, k: 'task', id: 'patrol', v: v.id, ids: [] }
}

describe('task bank', () => {
  it('has between 150 and 200 tasks with unique ids', () => {
    expect(TASK_POOL.length).toBeGreaterThanOrEqual(150)
    expect(TASK_POOL.length).toBeLessThanOrEqual(200)
    expect(new Set(TASK_POOL.map((t) => t.id)).size).toBe(TASK_POOL.length)
  })

  it('a finished task disappears and another takes its place', () => {
    const { list } = shown('a', [], T0)
    expect(list).toHaveLength(TASKS_SHOWN)
    const easy = list.find((t) => t.kind !== 'patrol')!
    const after = shown('a', [finish('a', easy.id, T0 + MIN)], T0 + 2 * MIN)
    expect(after.w.accounts.a.rejected).toEqual([])
    expect(after.list).toHaveLength(TASKS_SHOWN)
    expect(after.list.map((t) => t.id)).not.toContain(easy.id)
  })

  it('tomorrow brings different tasks', () => {
    const today = shown('a', [], T0).list.map((t) => t.id)
    const tomorrow = shown('a', [], T0 + 24 * 3600_000).list.map((t) => t.id)
    expect(tomorrow.filter((id) => today.includes(id))).toEqual([])
  })

  it('a task that is not offered right now does not pay', () => {
    const offered = shown('a', [], T0).list.map((t) => t.id)
    const other = TASK_POOL.find((t) => !offered.includes(t.id) && t.kind === 'survey')!
    const w = world({ a: player([finish('a', other.id, T0 + MIN)]) }, T0 + 2 * MIN)
    expect(w.accounts.a.rejected.map((r) => r.why)).toEqual(['задание не выдано'])
  })

  it(`a shared city pays ${TASKS_PER_DAY} tasks a day; the one-player test mode has no limit`, () => {
    const run = (solo: boolean) => {
      const acts: Action[] = []
      for (let i = 0; i < 9; i++) {
        const next = shown('a', acts, T0 + i * MIN + 1, solo).list.find((t) => t.kind !== 'patrol')
        if (!next) break
        acts.push(finish('a', next.id, T0 + (i + 1) * MIN))
      }
      return world({ a: player(acts) }, T0 + 20 * MIN, { config: { soloMode: solo } }).accounts.a.tasks[day]?.length ?? 0
    }
    expect(run(false)).toBe(TASKS_PER_DAY)
    expect(run(true)).toBe(9)
  })
})

describe('wiring: the speed bonus comes from the ledger (round 2, 3.1)', () => {
  const wires = (() => {
    for (let k = 0; k < 400; k++) {
      const t = T0 + k * 24 * 3600_000
      const w = shown('a', [], t).list.find((x) => x.kind === 'wires')
      if (w) return { w, t }
    }
    throw new Error('no wiring task')
  })()
  const run = (acts: Action[]) => world({ a: player(acts) }, wires.t + 10 * MIN).accounts.a.ledger.find((l) => l.why.startsWith('Задание'))!.amount
  it('no «started» in the ledger: no bonus, whatever the device says', () => {
    expect(run([{ t: wires.t + MIN, k: 'task', id: 'wires', v: wires.w.id, x: 4 }])).toBe(wires.w.reward)
  })
  it('started 6 s before: bonus', () => {
    const t = wires.t + MIN
    expect(run([{ t, k: 'begin', v: wires.w.id }, { t: t + 6000, k: 'task', id: 'wires', v: wires.w.id, x: 6 }])).toBeGreaterThan(wires.w.reward)
  })
  it('started a second before (impossible by hand): no bonus', () => {
    const t = wires.t + MIN
    expect(run([{ t, k: 'begin', v: wires.w.id }, { t: t + 1000, k: 'task', id: 'wires', v: wires.w.id, x: 1 }])).toBe(wires.w.reward)
  })
})
