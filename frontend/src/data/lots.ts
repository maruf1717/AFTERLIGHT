import { PLAN } from '../city/plan'
import type { Parcel } from '../city/planner'
import type { DistrictId } from './types'

/**
 * Parcels the city keeps free: civic sites get a project once residents fund it, plots are
 * for sale to players for their own businesses. Both come from the city plan.
 * Keys: civic sites and the first plots keep their old names (e.g. "res-park", "res-biz-1")
 * so saved games still point at them; other plots use the parcel id.
 */
export interface ReservedLot {
  key: string
  district: DistrictId
  use: 'civic' | 'business'
  parcel: Parcel
}

export const RESERVED_LOTS: ReservedLot[] = PLAN.parcels
  .filter((p) => p.use === 'civic' || p.use === 'plot')
  .map((p) => ({ key: p.key ?? p.id, district: p.zone, use: p.use === 'civic' ? 'civic' : 'business', parcel: p }))

export const RESERVED_BY_KEY = Object.fromEntries(RESERVED_LOTS.map((l) => [l.key, l])) as Record<string, ReservedLot>
