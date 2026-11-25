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
  | 'clinic'
  | 'hospital'
  | 'police'
  | 'fire'
  | 'watertower'
  | 'solar'
  | 'pump'
  | 'construction'
  | 'lot'
  | 'business'

/** Kinds that only the game creates (civic projects, lots, player businesses). */
export type GameKind = 'clinic' | 'hospital' | 'police' | 'fire' | 'watertower' | 'solar' | 'pump' | 'construction' | 'lot' | 'business'
/** Kinds the static map generator places. */
export type ProceduralKind = Exclude<BuildingKind, GameKind>

/** `limited`: working with interruptions (the plant during a power crisis). */
export type BuildingStatus = 'open' | 'closed' | 'locked' | 'limited'

/** Visual style a building is rendered with. Decoupled from kind on purpose. */
export type BuildingShape = 'block' | 'house' | 'factory' | 'plant' | 'park' | 'mystery' | 'civic' | 'construction' | 'lot' | 'business'

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
  /** Stood here before the game began (the starting settlement). */
  starter?: boolean
  /** Homes in this building when it is not worked out from its size (old five-storeys). */
  housing?: number
  tags: string[]
  /** Rotation about the vertical axis; the building's front (+z) faces its street. */
  rotation?: number
  /** Parcel of the city plan this object stands on. */
  parcel?: string
  /** Set on objects that come from the game rather than the static map. */
  meta?: BuildingMeta
}

export type BuildingMeta =
  | { type: 'civic'; projectId: string; visual: string }
  | { type: 'construction'; projectId?: string; progress: number }
  | { type: 'lot'; lotKey: string; use: 'civic' | 'business'; projectId?: string }
  /** A plot a resident can buy (`sale`) or already owns and has not built on (`owned`). */
  | { type: 'plot'; parcel: string; use: 'sale' | 'owned'; owner?: string; ownerName?: string; price: number }
  /** A building a resident put up on their own plot (or its building site). */
  | { type: 'property'; parcel: string; owner: string; ownerName: string; kind: string; ready: boolean; progress: number; readyAt: number }
  | { type: 'business'; owner: string; ownerName?: string; businessType: string; upgrades: string[]; price: number; smallPlot?: boolean }
  | { type: 'plant'; repaired: boolean }

export interface District {
  id: DistrictId
  name: string
  /** Short label for narrow screens. */
  shortName: string
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
