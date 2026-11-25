import { describe, expect, it } from 'vitest'
import { clearCheckpoints, replay } from '../sim'
import type { Action } from '../types'
import { config, HOUR, player, T0 } from './helpers'

const cfg = config()
const DAY = cfg.dayMinutes * 60_000
const players = Object.fromEntries(
  Array.from({ length: 20 }, (_, i) => [
    `p${i}`,
    player(Array.from({ length: 300 }, (_, k): Action => ({ t: T0 + (k + 1) * 2 * HOUR + i, k: 'task', id: 'survey', x: 0 }))),
  ]),
)
const run = (now: number) => replay({ config: cfg, opening: null, players, grants: [], reviews: [] }, now)

describe('T3: checkpoints', () => {
  it('give the same city as one long replay', () => {
    const end = T0 + 3000 * DAY + 123_456
    clearCheckpoints()
    const whole = run(end)
    clearCheckpoints()
    run(T0 + 1500 * DAY)
    const resumed = run(end)
    expect(resumed.city.population).toBe(whole.city.population)
    expect(resumed.city.built.size).toBe(whole.city.built.size)
    expect(resumed.city.history).toEqual(whole.city.history)
    for (const id of Object.keys(whole.accounts)) expect(resumed.accounts[id].balance).toBeCloseTo(whole.accounts[id].balance, 6)
  })

  it('a changed past is noticed: the replay starts over', () => {
    clearCheckpoints()
    const end = T0 + 600 * DAY
    run(end)
    const changed = { ...players, p0: player([{ t: T0 + 60_000, k: 'task', id: 'wires' }, ...players.p0.actions]) }
    const fresh = replay({ config: cfg, opening: null, players: changed, grants: [], reviews: [] }, end)
    clearCheckpoints()
    const truth = replay({ config: cfg, opening: null, players: changed, grants: [], reviews: [] }, end)
    expect(fresh.accounts.p0.balance).toBe(truth.accounts.p0.balance)
  })

  it('a tick on 3000 days takes under 5 ms once checkpoints exist', () => {
    clearCheckpoints()
    const end = T0 + 3000 * DAY + 1000
    run(end)
    const times: number[] = []
    for (let i = 0; i < 10; i++) {
      const t = performance.now()
      run(end + i * 4000)
      times.push(performance.now() - t)
    }
    times.sort((a, b) => a - b)
    // The middle of the fast half: other test files run at the same time and steal the CPU.
    expect(times[3]).toBeLessThan(5)
  })
})
