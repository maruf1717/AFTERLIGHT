/**
 * Core domain types for the AFTERLIGHT city.
 *
 * These are deliberately plain, serialisable objects: today they are generated
 * on the client, later the same shapes will come from the backend API
 * (`GET /districts`, `GET /buildings?district=...`).
 */

export type DistrictId = 'residential' | 'downtown' | 'industrial'

export type BuildingKind =
  | 'tower'
  | 'office'
  | 'hotel'
  | 'shop'
  | 'cafe'
  | 'library'
  | 'house'
  | 'apartment'
  | 'park'
  | 'school'
  | 'factory'
  | 'warehouse'
  | 'plant'
  | 'unknown'

export type BuildingStatus = 'open' | 'closed' | 'locked'

/** Visual style a building is rendered with. Decoupled from kind on purpose. */
export type BuildingShape = 'block' | 'house' | 'factory' | 'plant' | 'park' | 'mystery'

export interface Building {
  id: string
  districtId: DistrictId
  kind: BuildingKind
  shape: BuildingShape
  name: string
  description: string
  /** Center of the footprint on the ground plane (x, z) in world units. */
  position: [number, number]
  /** Footprint (width along x, depth along z). */
  size: [number, number]
  height: number
  floors: number
  /** People currently inside (residents for housing, workers/visitors otherwise). */
  occupancy: number
  capacity: number
  founded: number
  status: BuildingStatus
  /** Hex wall colour. */
  color: string
  /** Hex colour of lit windows / accent lights. */
  accent: string
  /** Is this a hand-authored landmark rather than procedural filler. */
  landmark: boolean
  tags: string[]
}

export interface District {
  id: DistrictId
  name: string
  subtitle: string
  description: string
  /** UI / map accent colour. */
  color: string
  /** World-space centre of the district. */
  origin: [number, number]
  grid: { cols: number; rows: number }
}

export interface DistrictStats {
  buildings: number
  open: number
  locked: number
  residents: number
  jobs: number
  occupancyRate: number
}
