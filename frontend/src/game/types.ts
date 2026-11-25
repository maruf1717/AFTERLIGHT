import type { BusinessType, DailyTaskId, GameConfig, PlayerBuildingId, UpgradeId } from './catalog'

export interface Donation {
  p: string
  amt: number
  t: number
}

export interface Business {
  type: BusinessType
  name: string
  color: string
  price: 1 | 2 | 3
  lot: string
  openedAt: number
  lastCollect: number
  upgrades: UpgradeId[]
  totalEarned: number
}

export interface Submission {
  id: string
  taskId: string
  kind: 'text' | 'drawing'
  text?: string
  /** Small JPEG data URL for drawings. */
  image?: string
  at: number
}

/**
 * Everything a resident does is one entry in their own log. The log is the only thing a
 * resident writes; balance, reputation, donations and businesses are worked out from all
 * logs by the same rules on every device (see engine.ts), so a forged entry earns nothing.
 * `t` is the time the device stamped (corrected to server time when available).
 */
export type Action =
  | { t: number; k: 'task'; id: DailyTaskId; x?: string | number; ids?: string[] }
  | { t: number; k: 'donate'; p: string; a: number }
  | { t: number; k: 'open'; lot: string; type: BusinessType; name: string; color: string; price: 1 | 2 | 3 }
  | { t: number; k: 'bizset'; lot: string; name?: string; color?: string; price?: 1 | 2 | 3 }
  | { t: number; k: 'upgrade'; lot: string; u: UpgradeId }
  | { t: number; k: 'collect'; lot: string }
  | { t: number; k: 'sell'; lot: string }
  | { t: number; k: 'rate'; o: string; s: number }
  /** Buy a plot (a parcel id) to build on. */
  | { t: number; k: 'buylot'; lot: string }
  /** Start a building on my plot. */
  | { t: number; k: 'build'; lot: string; kind: PlayerBuildingId }
  /** Finish my building site at once. */
  | { t: number; k: 'rush'; lot: string }
  /** I opened the game today (login streak). */
  | { t: number; k: 'login' }
  /** I found the parcel in Warehouse No. 7. */
  | { t: number; k: 'event' }

export type ActionKind = Action['k']

/** A resident's own record (format 2). Only that resident writes it. */
export interface PlayerDoc {
  v: 2
  joinedAt: number
  name?: string
  actions: Action[]
  /** Old saves only: creative works now live in `submissions/{uid}` (T2). */
  submissions?: Submission[]
}

/** Format 1, kept for reading old saves. Its numbers are trusted only through the owner's opening balances. */
export interface LegacyPlayerDoc {
  joinedAt: number
  balance: number
  rep: number
  activity: number[]
  daily?: unknown
  donations: Donation[]
  business: Business | null
  ratings: Record<string, number>
  survey?: Record<string, number>
  submissions: Submission[]
}

/**
 * Opening balances, written only by the owner (when old saves are converted and when the
 * city restarts). Everything a resident had before `at` is summed up here.
 */
export interface OpeningEntry {
  balance: number
  rep: number
  /** Donations made before `at`, still counted towards projects of the current city. */
  donations: Donation[]
  business: Business | null
  /** Times the resident was active before `at` (city growth). */
  activity: number[]
}

export interface Opening {
  at: number
  players: Record<string, OpeningEntry>
}

export interface Grant {
  id: string
  to: string
  amount: number
  note: string
  at: number
}

export interface Review {
  id: string
  to: string
  taskId: string
  status: 'approved' | 'rejected'
  rating: number
  reward: number
  featured: boolean
  at: number
}

export type { GameConfig }

export function emptyPlayer(now: number): PlayerDoc {
  return { v: 2, joinedAt: now, actions: [] }
}

/**
 * T2: creative works (drawings are large) move out of the player's record into their own
 * document, so loading the city does not load everybody's pictures.
 */
export function splitSubmissions(doc: PlayerDoc): { doc: PlayerDoc; moved: Submission[] } {
  const moved = doc.submissions ?? []
  const rest: PlayerDoc = { v: 2, joinedAt: doc.joinedAt, actions: doc.actions, ...(doc.name ? { name: doc.name } : {}) }
  return { doc: rest, moved }
}

export function isLegacy(doc: unknown): doc is LegacyPlayerDoc {
  return !!doc && typeof doc === 'object' && (doc as { v?: number }).v !== 2
}

/** Read any stored record as format 2 (old numbers are dropped; they live in the opening balances). */
export function normalizePlayer(doc: unknown, now: number): PlayerDoc {
  const d = (doc ?? {}) as Partial<PlayerDoc & LegacyPlayerDoc>
  const subs = d.submissions?.length ? { submissions: d.submissions } : {}
  if (d.v === 2) return { v: 2, joinedAt: d.joinedAt ?? now, name: d.name, actions: Array.isArray(d.actions) ? d.actions : [], ...subs }
  return { v: 2, joinedAt: d.joinedAt ?? now, actions: [], ...subs }
}

/** What an old record had, as an opening entry (used once, when the owner converts saves). */
export function openingFromLegacy(d: LegacyPlayerDoc, grantsAndRewards: number): OpeningEntry {
  return {
    balance: Math.round((d.balance ?? 0) + grantsAndRewards),
    rep: d.rep ?? 0,
    donations: d.donations ?? [],
    business: d.business ?? null,
    activity: (d.activity ?? []).slice(-300),
  }
}
