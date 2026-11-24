import { create } from 'zustand'
import { useCityRef, useGame } from '../game/store'
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
  /** Welcome / help screen. Shown on first visit. */
  helpOpen: boolean
  search: string
  kindFilter: BuildingKind | null
  /** Bumped whenever the camera should (re)fly to the current focus. */
  focusNonce: number
  /** Building to frame without opening its card (after an action, "show on map"). */
  viewTargetId: string | null
  /** One-off camera nudges from the on-screen buttons. */
  camCommand: { type: 'in' | 'out' | 'left' | 'right'; nonce: number } | null

  flyTo: (id: string) => void
  camera: (type: 'in' | 'out' | 'left' | 'right') => void

  setDistrict: (id: DistrictId) => void
  selectBuilding: (id: string | null) => void
  hoverBuilding: (id: string | null) => void
  cycleBuilding: (delta: 1 | -1) => void
  focus: () => void
  resetView: () => void
  toggleNight: () => void
  toggleQuality: () => void
  setDirectoryOpen: (open: boolean) => void
  setHelpOpen: (open: boolean) => void
  setSearch: (q: string) => void
  setKindFilter: (k: BuildingKind | null) => void
}

const forced = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('q') : null
const prefersLow =
  forced === 'low' || (forced !== 'high' && typeof window !== 'undefined' && (window.matchMedia?.('(max-width: 768px)').matches ?? false))

function readFlag(key: string) {
  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}
function writeFlag(key: string) {
  try {
    window.localStorage.setItem(key, '1')
  } catch {
    /* storage unavailable: the welcome screen will simply show again next time */
  }
}

export const useCity = create<CityState>((set, get) => ({
  activeDistrictId: 'residential',
  selectedBuildingId: null,
  hoveredBuildingId: null,
  night: false,
  quality: prefersLow ? 'low' : 'high',
  directoryOpen: false,
  helpOpen: !readFlag('afterlight:welcomed'),
  search: '',
  kindFilter: null,
  focusNonce: 0,
  viewTargetId: null,
  camCommand: null,

  flyTo: (id) => {
    const b = useGame.getState().objectById[id]
    if (!b) return
    set((s) => ({ viewTargetId: id, selectedBuildingId: null, activeDistrictId: b.districtId, focusNonce: s.focusNonce + 1 }))
  },
  camera: (type) => set((s) => ({ camCommand: { type, nonce: (s.camCommand?.nonce ?? 0) + 1 } })),

  setDistrict: (id) =>
    set((s) => ({
      activeDistrictId: id,
      selectedBuildingId: null,
      viewTargetId: null,
      hoveredBuildingId: null,
      kindFilter: null,
      search: '',
      focusNonce: s.focusNonce + 1,
    })),

  selectBuilding: (id) =>
    set((s) => {
      if (id === null) return { selectedBuildingId: null }
      const b = useGame.getState().objectById[id]
      if (!b) return {}
      queueMicrotask(() => useGame.getState().onBuildingOpened(id))
      return {
        selectedBuildingId: id,
        viewTargetId: null,
        hoveredBuildingId: null,
        activeDistrictId: b.districtId,
        focusNonce: s.focusNonce + 1,
      }
    }),

  hoverBuilding: (id) => set({ hoveredBuildingId: id }),

  cycleBuilding: (delta) => {
    const { activeDistrictId, selectedBuildingId, selectBuilding } = get()
    const list = useGame.getState().objects.filter((b) => b.districtId === activeDistrictId)
    if (!list.length) return
    const idx = list.findIndex((b) => b.id === selectedBuildingId)
    const next = idx === -1 ? (delta === 1 ? 0 : list.length - 1) : (idx + delta + list.length) % list.length
    selectBuilding(list[next].id)
  },

  focus: () => set((s) => ({ focusNonce: s.focusNonce + 1 })),
  resetView: () => set((s) => ({ selectedBuildingId: null, viewTargetId: null, focusNonce: s.focusNonce + 1 })),
  toggleNight: () => set((s) => ({ night: !s.night })),
  toggleQuality: () => set((s) => ({ quality: s.quality === 'high' ? 'low' : 'high' })),
  setDirectoryOpen: (open) => set({ directoryOpen: open }),
  setHelpOpen: (open) => {
    if (!open) writeFlag('afterlight:welcomed')
    set({ helpOpen: open })
  },
  setSearch: (q) => set({ search: q }),
  setKindFilter: (k) => set({ kindFilter: k }),
}))

useCityRef.current = useCity
