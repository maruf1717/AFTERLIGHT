import { DESK_QUERY } from '../ui/layout'
import { create } from 'zustand'
import { useCityRef, useGame } from '../game/store'
import type { DistrictId } from '../data/types'

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
  kindFilter: string | null
  /** Bumped whenever the camera should (re)fly to the current focus. */
  focusNonce: number
  /** Building to frame without opening its card (after an action, "show on map"). */
  viewTargetId: string | null
  /** One-off camera nudges from the on-screen buttons. */
  camCommand: { type: 'in' | 'out' | 'left' | 'right'; nonce: number } | null

  /** Choosing a plot for a new business: free plots light up and a tap picks one. */
  /** Picking a plot on the map: for a business, or one to buy. */
  /** Frames per second, averaged over the last 5 seconds (0 until measured). */
  fps: number
  setFps: (fps: number) => void
  pickPlot: false | 'business' | 'buy'
  setPickPlot: (on: false | 'business' | 'buy' | boolean) => void
  /** Objects the camera should frame all at once (free plots while picking). */
  fitIds: string[] | null
  flyTo: (id: string) => void
  /** A circle on the ground where something is (the delivery: the house is somewhere inside). */
  areaMark: { x: number; z: number; r: number } | null
  showArea: (a: { x: number; z: number; r: number } | null) => void
  camera: (type: 'in' | 'out' | 'left' | 'right') => void

  setDistrict: (id: DistrictId) => void
  /** Where the card was opened from: only a tap on the map counts for map tasks. */
  selectBuilding: (id: string | null, source?: 'map' | 'pager' | 'directory') => void
  hoverBuilding: (id: string | null) => void
  cycleBuilding: (delta: 1 | -1) => void
  focus: () => void
  resetView: () => void
  toggleNight: () => void
  toggleQuality: () => void
  setDirectoryOpen: (open: boolean) => void
  setHelpOpen: (open: boolean) => void
  setSearch: (q: string) => void
  setKindFilter: (k: string | null) => void
}

const forced = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('q') : null
const prefersLow =
  forced === 'low' || (forced !== 'high' && typeof window !== 'undefined' && !(window.matchMedia?.(DESK_QUERY).matches ?? true))

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
  pickPlot: false,
  fps: 0,
  setFps: (fps) => set({ fps }),
  fitIds: null,
  setPickPlot: (raw) =>
    set((s) => {
      const on = raw === true ? 'business' : raw
      if (!on) return { pickPlot: false, fitIds: null }
      // Frame every free plot of the district (or of the whole city when it has none).
      const me = useGame.getState().uid
      const free = useGame
        .getState()
        .objects.filter((o) =>
          on === 'buy'
            ? o.meta?.type === 'plot' && o.meta.use === 'sale'
            : (o.meta?.type === 'lot' && o.meta.use === 'business') || (o.meta?.type === 'plot' && o.meta.use === 'owned' && o.meta.owner === me),
        )
      const here = free.filter((o) => o.districtId === s.activeDistrictId)
      const ids = (here.length ? here : free).map((o) => o.id)
      return { pickPlot: on, selectedBuildingId: null, viewTargetId: null, fitIds: ids.length ? ids : null, focusNonce: s.focusNonce + 1 }
    }),

  areaMark: null,
  showArea: (a) => set((s) => ({ areaMark: a, selectedBuildingId: null, viewTargetId: null, fitIds: null, focusNonce: s.focusNonce + 1 })),
  flyTo: (id) => {
    const b = useGame.getState().objectById[id]
    if (!b) return
    set((s) => ({ viewTargetId: id, selectedBuildingId: null, areaMark: null, activeDistrictId: b.districtId, focusNonce: s.focusNonce + 1 }))
  },
  camera: (type) => set((s) => ({ camCommand: { type, nonce: (s.camCommand?.nonce ?? 0) + 1 } })),

  setDistrict: (id) =>
    set((s) => ({
      activeDistrictId: id,
      selectedBuildingId: null,
      viewTargetId: null,
      areaMark: null,
      hoveredBuildingId: null,
      kindFilter: null,
      search: '',
      focusNonce: s.focusNonce + 1,
    })),

  selectBuilding: (id, source = 'map') =>
    set((s) => {
      if (id === null) return { selectedBuildingId: null }
      const b = useGame.getState().objectById[id]
      if (!b) return {}
      queueMicrotask(() => useGame.getState().onBuildingOpened(id, source))
      // On a computer the menu folds away so the map and the card share the screen.
      if (typeof window !== 'undefined' && window.matchMedia?.(DESK_QUERY).matches) queueMicrotask(() => useGame.getState().setSidebar(false))
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
    selectBuilding(list[next].id, 'pager')
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
