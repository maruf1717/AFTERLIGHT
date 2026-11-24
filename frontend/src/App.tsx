import { Suspense, useEffect, useState } from 'react'
import { BUILDING_BY_ID, DISTRICTS } from './data/city'
import { KIND_LABEL } from './data/kinds'
import { CityCanvas } from './scene/CityCanvas'
import { useCity } from './store/cityStore'
import { KindArt } from './ui/art'
import { BuildingPanel } from './ui/BuildingPanel'
import { Directory } from './ui/Directory'
import { DistrictSwitcher } from './ui/DistrictSwitcher'
import { MobileTabBar, TopBar } from './ui/TopBar'
import { Welcome } from './ui/Welcome'

function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      const s = useCity.getState()
      if (s.helpOpen) return
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
    <div className="panel pointer-events-none fixed z-40 hidden items-center gap-2.5 rounded-2xl py-1.5 pr-3.5 pl-1.5 md:flex" style={{ left: pos.x + 18, top: pos.y + 18 }}>
      <KindArt kind={b.kind} size={36} />
      <div>
        <div className="text-sm font-semibold">{b.name}</div>
        <div className="text-xs text-[var(--color-muted)]">{KIND_LABEL[b.kind]} · нажми, чтобы узнать больше</div>
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

      <TopBar />
      <HoverTooltip />

      {/* Desktop: district info + building list on the left */}
      <div className="pointer-events-none absolute top-[92px] bottom-[108px] left-5 z-20 hidden w-[360px] md:block">
        <div className="panel pointer-events-auto h-full overflow-hidden rounded-[28px]">
          <Directory />
        </div>
      </div>

      {/* District switcher: under the header on phones, bottom centre on desktop */}
      <div className="pointer-events-none absolute inset-x-3 top-[calc(max(12px,env(safe-area-inset-top))+66px)] z-20 flex justify-center md:inset-x-auto md:top-auto md:bottom-5 md:left-1/2 md:-translate-x-1/2">
        <DistrictSwitcher />
      </div>

      {/* Building card: bottom sheet on phones, right card on desktop */}
      {selected ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex md:inset-x-auto md:top-[92px] md:right-5 md:bottom-auto">
          <BuildingPanel />
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex md:hidden">
          <div className="w-full">
            <MobileTabBar />
          </div>
        </div>
      )}

      {/* Phone: building list as a sheet */}
      {directoryOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button className="absolute inset-0 bg-[#17202b]/35" aria-label="Закрыть список" onClick={() => setDirectoryOpen(false)} />
          <div className="anim-sheet absolute inset-x-0 bottom-0 h-[80vh] overflow-hidden rounded-t-[28px] bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl">
            <Directory onClose={() => setDirectoryOpen(false)} />
          </div>
        </div>
      )}

      <div className="panel pointer-events-none absolute right-5 bottom-5 z-10 hidden rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed text-[var(--color-muted)] xl:block">
        <b className="text-[var(--color-ink)]">Мышь:</b> левая кнопка крутит, правая двигает, колёсико приближает
        <br />
        <b className="text-[var(--color-ink)]">Клавиши:</b> 1, 2, 3 районы · ← → здания · N ночь · Esc закрыть
      </div>

      <Welcome />
    </div>
  )
}
