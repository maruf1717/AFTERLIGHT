import type { BusinessType, DailyTaskId, GameConfig, UpgradeId } from './catalog'

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

/** One resident's own record. Only that resident writes it (the owner can too). */
export interface PlayerDoc {
  joinedAt: number
  /** Own earnings minus own spending. Grants and approved creative rewards are added on top. */
  balance: number
  rep: number
  /** Timestamps of completed tasks; the simulation turns them into "active residents per day". */
  activity: number[]
  daily: { date: string; done: DailyTaskId[]; target?: string; surveyIdx?: number; visited?: string[] }
  donations: Donation[]
  business: Business | null
  /** Stars this resident gave to other residents' businesses, keyed by owner id. */
  ratings: Record<string, number>
  survey: Record<string, number>
  submissions: Submission[]
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
  return {
    joinedAt: now,
    balance: 300,
    rep: 0,
    activity: [],
    daily: { date: '', done: [] },
    donations: [],
    business: null,
    ratings: {},
    survey: {},
    submissions: [],
  }
}
