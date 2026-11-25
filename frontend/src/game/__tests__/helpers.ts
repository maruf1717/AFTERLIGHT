import { DEFAULT_CONFIG, type GameConfig } from '../catalog'
import { replay } from '../sim'
import type { Action, Grant, Opening, PlayerDoc, Review } from '../types'

/** 2026-11-24 11:00 in Tashkent (06:00 UTC): well inside one task day. */
export const T0 = Date.UTC(2026, 10, 24, 6, 0, 0)
export const MIN = 60_000
export const HOUR = 3600_000

export function config(patch: Partial<GameConfig> = {}): GameConfig {
  return { ...DEFAULT_CONFIG, soloMode: false, requireDonors: false, businessRep: 0, startedAt: T0, ...patch }
}

export function player(actions: Action[], joinedAt = T0): PlayerDoc {
  return { v: 2, joinedAt, actions, submissions: [] }
}

export function world(
  players: Record<string, PlayerDoc>,
  now: number,
  extra: { config?: Partial<GameConfig>; opening?: Opening | null; grants?: Grant[]; reviews?: Review[] } = {},
) {
  return replay({ config: config(extra.config), opening: extra.opening ?? null, players, grants: extra.grants ?? [], reviews: extra.reviews ?? [] }, now)
}
