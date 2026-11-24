import { create } from 'zustand'
import { BUILDING_BY_ID, BUILDINGS_BY_DISTRICT } from '../data/city'
import type { BuildingKind, DistrictId } from '../data/types'

export type Quality = 'high' | 'low'

interface CityState {
  activeDistrictId: DistrictId
  selectedBuildingId: string | null
  hoveredBuildingId: string | null
  night: boolean
  quality: Quality
  /** Mobile: is the building directory sheet open. Desktop: sidebar collapsed state. */
  directoryOpen: boolean
  search: string
  kindFilter: BuildingKind | null
  /** Bumped whenever the camera should (re)fly to the current focus. */
  focusNonce: number

  setDistrict: (id: DistrictId) => void
  selectBuilding: (id: string | null) => void
  hoverBuilding: (id: string | null) => void
  cycleBuilding: (delta: 1 | -1) => void
  focus: () => void
  resetView: () => void
  toggleNight: () => void
  toggleQuality: () => void
  setDirectoryOpen: (open: boolean) => void
  setSearch: (q: string) => void
  setKindFilter: (k: BuildingKind | null) => void
}

const prefersLow =
  typeof window !== 'undefined' && (window.matchMedia?.('(max-width: 768px)').matches ?? false)

export const useCity = create<CityState>((set, get) => ({
  activeDistrictId: 'downtown',
  selectedBuildingId: null,
  hoveredBuildingId: null,
  night: true,
  quality: prefersLow ? 'low' : 'high',
  directoryOpen: false,
  search: '',
  kindFilter: null,
  focusNonce: 0,

  setDistrict: (id) =>
    set((s) => ({
      activeDistrictId: id,
      selectedBuildingId: null,
      hoveredBuildingId: null,
      kindFilter: null,
      search: '',
      focusNonce: s.focusNonce + 1,
    })),

  selectBuilding: (id) =>
    set((s) => {
      if (id === null) return { selectedBuildingId: null }
      const b = BUILDING_BY_ID[id]
      if (!b) return {}
      return {
        selectedBuildingId: id,
        hoveredBuildingId: null,
        activeDistrictId: b.districtId,
        focusNonce: s.focusNonce + 1,
      }
    }),

  hoverBuilding: (id) => set({ hoveredBuildingId: id }),

  cycleBuilding: (delta) => {
    const { activeDistrictId, selectedBuildingId, selectBuilding } = get()
    const list = BUILDINGS_BY_DISTRICT[activeDistrictId]
    const idx = list.findIndex((b) => b.id === selectedBuildingId)
    const next = idx === -1 ? (delta === 1 ? 0 : list.length - 1) : (idx + delta + list.length) % list.length
    selectBuilding(list[next].id)
  },

  focus: () => set((s) => ({ focusNonce: s.focusNonce + 1 })),
  resetView: () => set((s) => ({ selectedBuildingId: null, focusNonce: s.focusNonce + 1 })),
  toggleNight: () => set((s) => ({ night: !s.night })),
  toggleQuality: () => set((s) => ({ quality: s.quality === 'high' ? 'low' : 'high' })),
  setDirectoryOpen: (open) => set({ directoryOpen: open }),
  setSearch: (q) => set({ search: q }),
  setKindFilter: (k) => set({ kindFilter: k }),
}))
