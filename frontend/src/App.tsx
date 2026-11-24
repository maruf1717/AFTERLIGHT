import { Suspense, useEffect, useState } from 'react'
import { BUILDING_BY_ID, DISTRICTS } from './data/city'
import { KIND_LABEL } from './data/kinds'
import { CityCanvas } from './scene/CityCanvas'
import { useCity } from './store/cityStore'
import { BuildingPanel } from './ui/BuildingPanel'
import { Directory } from './ui/Directory'
import { DistrictSwitcher } from './ui/DistrictSwitcher'
import { TopBar } from './ui/TopBar'

function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      const s = useCity.getState()
      if (e.key === 'Escape') {
        if (s.selectedBuildingId) s.selectBuilding(null)
        else s.setDirectoryOpen(false)
      } else if (e.key === 'ArrowRight') s.cycleBuilding(1)
      else if (e.key === 'ArrowLeft') s.cycleBuilding(-1)
      else if (e.key === 'n' || e.key === 'N' || e.key === 'т' || e.key === 'Т') s.toggleNight()
      else if (['1', '2', '3'].includes(e.key)) s.setDistrict(DISTRICTS[Number(e.key) - 1].id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

/** Desktop-only label that follows the cursor while hovering a building. */
function HoverTooltip() {
  const id = useCity((s) => s.hoveredBuildingId)
  const selected = useCity((s) => s.selectedBuildingId)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  useEffect(() => {
    const onMove = (e: PointerEvent) => setPos({ x: e.clientX, y: e.clientY })
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])
  const b = id ? BUILDING_BY_ID[id] : null
  if (!b || b.id === selected) return null
  return (
    <div
      className="glass pointer-events-none fixed z-40 hidden rounded-xl px-3 py-2 md:block"
      style={{ left: pos.x + 16, top: pos.y + 16 }}
    >
      <div className="text-sm font-semibold text-white">{b.name}</div>
      <div className="text-xs text-[var(--color-muted)]">
        {b.status === 'locked' ? 'Не исследовано' : KIND_LABEL[b.kind]} · нажми, чтобы открыть
      </div>
    </div>
  )
}

function Intro() {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 1400)
    return () => clearTimeout(t)
  }, [])
  if (!visible) return null
  return (
    <div className="anim-fade pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-ink)]/0">
      <div className="text-center">
        <div className="font-display text-3xl font-bold tracking-[0.4em] text-white drop-shadow-[0_0_24px_rgba(94,234,212,0.5)] md:text-5xl">
          AFTERLIGHT
        </div>
        <div className="mt-3 font-mono text-xs tracking-[0.3em] text-teal-200/70">ГОРОД ПРОСЫПАЕТСЯ</div>
      </div>
    </div>
  )
}

export default function App() {
  useKeyboard()
  const selected = useCity((s) => s.selectedBuildingId)
  const directoryOpen = useCity((s) => s.directoryOpen)
  const setDirectoryOpen = useCity((s) => s.setDirectoryOpen)

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0">
        <Suspense fallback={null}>
          <CityCanvas />
        </Suspense>
      </div>

      <Intro />
      <TopBar />
      <HoverTooltip />

      {/* Desktop: left sidebar with district info + directory */}
      <div className="pointer-events-none absolute top-24 bottom-28 left-5 z-20 hidden w-[340px] md:block">
        <div className="glass pointer-events-auto h-full overflow-hidden rounded-3xl">
          <Directory />
        </div>
      </div>

      {/* District switcher: under the top bar on phones, bottom-centre on desktop */}
      <div className="pointer-events-none absolute inset-x-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+4.25rem)] z-20 flex justify-center md:inset-x-auto md:top-auto md:bottom-5 md:left-1/2 md:-translate-x-1/2">
        <DistrictSwitcher />
      </div>

      {/* Building info: bottom sheet on phones, right card on desktop */}
      {selected && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex md:inset-x-auto md:top-24 md:right-5 md:bottom-auto">
          <BuildingPanel />
        </div>
      )}

      {/* Mobile directory sheet */}
      {directoryOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button className="absolute inset-0 bg-black/50" aria-label="Закрыть справочник" onClick={() => setDirectoryOpen(false)} />
          <div className="glass anim-sheet absolute inset-x-0 bottom-0 h-[78vh] !bg-[#0b0d16]/95 overflow-hidden rounded-t-3xl pb-[env(safe-area-inset-bottom)]">
            <Directory onClose={() => setDirectoryOpen(false)} />
          </div>
        </div>
      )}

      {!selected && !directoryOpen && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-center text-[11px] text-slate-500 md:hidden">
          Тап по зданию — информация · Два пальца — поворот и зум
        </div>
      )}
      <div className="pointer-events-none absolute right-5 bottom-6 z-10 hidden text-right font-mono text-[10px] leading-relaxed text-slate-500 md:block">
        ЛКМ — вращение · ПКМ — сдвиг · колесо — зум
        <br />
        1·2·3 — районы · ←/→ — здания · N — день/ночь · Esc — закрыть
      </div>
    </div>
  )
}
