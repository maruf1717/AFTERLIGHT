import type { DistrictId } from './types'

/**
 * Lots kept free of procedural buildings. Civic lots receive a city project once residents
 * fund it; business lots are where players open their own places.
 */
export interface ReservedLot {
  key: string
  district: DistrictId
  col: number
  row: number
  use: 'civic' | 'business'
}

export const RESERVED_LOTS: ReservedLot[] = [
  // Residential
  { key: 'res-park', district: 'residential', col: 2, row: 2, use: 'civic' },
  { key: 'res-clinic', district: 'residential', col: 3, row: 0, use: 'civic' },
  { key: 'res-water', district: 'residential', col: 4, row: 4, use: 'civic' },
  { key: 'res-police', district: 'residential', col: 0, row: 2, use: 'civic' },
  { key: 'res-biz-1', district: 'residential', col: 1, row: 2, use: 'business' },
  { key: 'res-biz-2', district: 'residential', col: 3, row: 2, use: 'business' },
  { key: 'res-biz-3', district: 'residential', col: 2, row: 4, use: 'business' },
  { key: 'res-biz-4', district: 'residential', col: 1, row: 0, use: 'business' },
  // Downtown
  { key: 'dt-spire', district: 'downtown', col: 2, row: 2, use: 'civic' },
  { key: 'dt-library', district: 'downtown', col: 0, row: 4, use: 'civic' },
  { key: 'dt-hospital', district: 'downtown', col: 2, row: 4, use: 'civic' },
  { key: 'dt-fire', district: 'downtown', col: 4, row: 4, use: 'civic' },
  { key: 'dt-school', district: 'downtown', col: 0, row: 0, use: 'civic' },
  { key: 'dt-biz-1', district: 'downtown', col: 1, row: 1, use: 'business' },
  { key: 'dt-biz-2', district: 'downtown', col: 3, row: 3, use: 'business' },
  { key: 'dt-biz-3', district: 'downtown', col: 1, row: 3, use: 'business' },
  { key: 'dt-biz-4', district: 'downtown', col: 3, row: 1, use: 'business' },
  // Industrial
  { key: 'ind-solar', district: 'industrial', col: 0, row: 4, use: 'civic' },
  { key: 'ind-pump', district: 'industrial', col: 4, row: 0, use: 'civic' },
  { key: 'ind-biz-1', district: 'industrial', col: 1, row: 3, use: 'business' },
  { key: 'ind-biz-2', district: 'industrial', col: 3, row: 1, use: 'business' },
]

export const RESERVED_BY_KEY = Object.fromEntries(RESERVED_LOTS.map((l) => [l.key, l])) as Record<string, ReservedLot>

export function isReserved(district: DistrictId, col: number, row: number) {
  return RESERVED_LOTS.some((l) => l.district === district && l.col === col && l.row === row)
}
