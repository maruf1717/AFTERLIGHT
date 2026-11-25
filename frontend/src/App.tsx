import { Suspense, useEffect, useState } from 'react'
import { DISTRICTS } from './data/city'
import { KIND_LABEL } from './data/kinds'
import { useGame } from './game/store'
import { CityCanvas } from './scene/CityCanvas'
import { useCity } from './store/cityStore'
import { KindArt } from './ui/art'
import { BuildingPanel } from './ui/BuildingPanel'
import { CameraPad, Hud, MobileNav, MobileSheet, MobileTop, MoreSheet, SidePanel, Toasts, TopControls } from './ui/Chrome'
import { DistrictSwitcher } from './ui/DistrictSwitcher'
import { Logo } from './ui/TopBar'
import { Welcome } from './ui/Welcome'
import { NamePrompt } from './ui/game/ExtraPanels'
import { TutorialCard } from './ui/game/Tutorial'
import { closeTopWindow } from './ui/game/common'
import { useIsMobile } from './ui/layout'

function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useCity.getState()
      if (e.key === 'Escape') {
        // The topmost window first (welcome, dialogs, sheets), then the card, then the panel.
        if (e.target instanceof HTMLElement) e.target.blur()
        if (closeTopWindow()) return
        if (s.pickPlot) s.setPickPlot(false)
        else if (s.selectedBuildingId) s.selectBuilding(null)
        else if (useGame.getState().panel) useGame.getState().setPanel(null)
        return
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (s.helpOpen) return
      if (e.key === 'ArrowRight') s.cycleBuilding(1)
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
  const b = useGame((s) => (id ? s.objectById[id] : undefined))
  const [pos, setPos] = useState({ x: 0, y: 0 })
  useEffect(() => {
    const onMove = (e: PointerEvent) => setPos({ x: e.clientX, y: e.clientY })
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])
  if (!b || b.id === selected) return null
  return (
    <div className="panel pointer-events-none fixed z-40 hidden items-center gap-2.5 rounded-2xl py-1.5 pr-3.5 pl-1.5 desk:flex" style={{ left: pos.x + 18, top: pos.y + 18 }}>
      <KindArt kind={b.kind} size={36} />
      <div>
        <div className="text-sm font-semibold">{b.name}</div>
        <div className="text-xs text-[var(--color-muted)]">{KIND_LABEL[b.kind]} · нажми, чтобы узнать больше</div>
      </div>
    </div>
  )
}

function StatusOverlay() {
  const status = useGame((s) => s.status)
  const error = useGame((s) => s.error)
  if (status === 'ready' && !error) return null
  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-[#c9dbe8]/70 p-6 backdrop-blur-sm">
      <div className="panel max-w-sm rounded-3xl p-6 text-center">
        <div className="mx-auto w-fit">
          <Logo size={48} />
        </div>
        {error ? (
          <>
            <div className="mt-3 font-display text-lg font-bold">Не получается связаться с городом</div>
            <p className="mt-1 text-sm text-[var(--color-muted)]">Проверь интернет и обнови страницу. Если не помогает, попроси основателя проверить доступ к странице.</p>
          </>
        ) : status === 'waiting-owner' ? (
          <>
            <div className="mt-3 font-display text-lg font-bold">Город ещё не основан</div>
            <p className="mt-1 text-sm text-[var(--color-muted)]">Основатель должен открыть эту страницу первым. После этого здесь появится город.</p>
          </>
        ) : (
          <>
            <div className="mt-3 font-display text-lg font-bold">Город просыпается…</div>
            <p className="mt-1 text-sm text-[var(--color-muted)]">Загружаем жителей и последние новости.</p>
          </>
        )}
      </div>
    </div>
  )
}

function PickPlotBanner() {
  const on = useCity((s) => s.pickPlot)
  const setPickPlot = useCity((s) => s.setPickPlot)
  if (!on) return null
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[calc(max(10px,env(safe-area-inset-top))+166px)] z-40 flex justify-center px-4 desk:top-24 land:top-16 land:left-[88px]">
      <div className="panel pointer-events-auto flex items-center gap-3 rounded-2xl py-2 pr-2 pl-4">
        <span className="h-3 w-3 animate-pulse rounded-full bg-[#3bd16f]" />
        <span className="text-sm font-semibold">Нажми на свободный участок, он подсвечен зелёным</span>
        <button
          className="btn-flat !h-9"
          onClick={() => {
            setPickPlot(false)
            useGame.getState().setPanel('business')
          }}
        >
          Отмена
        </button>
      </div>
    </div>
  )
}

function ModeBanner() {
  const mode = useGame((s) => s.mode)
  const canWrite = useGame((s) => s.canWrite)
  const status = useGame((s) => s.status)
  const [full, setFull] = useState(true)
  useEffect(() => {
    if (status !== 'ready') return
    const t = setTimeout(() => setFull(false), 5000)
    return () => clearTimeout(t)
  }, [status])
  const text = !canWrite ? 'Ты можешь смотреть, но не играть: попроси у основателя доступ на изменение.' : mode === 'local' ? 'Тестовый режим: город хранится только в этом браузере.' : null
  if (status !== 'ready' || !text) return null
  // Shown for five seconds at start, then folded into a small icon that opens it again.
  if (!full)
    return (
      <button className="panel pointer-events-auto absolute bottom-[90px] left-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold desk:bottom-6 desk:left-auto desk:right-[88px] land:bottom-3 land:left-[92px]" onClick={() => setFull(true)} aria-label="Режим игры">
        i
      </button>
    )
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[86px] z-10 flex justify-center px-4 desk:bottom-24 land:bottom-[82px]">
      <button className="pointer-events-auto rounded-full bg-[#17202b]/85 px-3 py-1.5 text-xs font-medium text-white" onClick={() => setFull(false)}>
        {text}
      </button>
    </div>
  )
}

export default function App() {
  useKeyboard()
  const mobile = useIsMobile()
  const selected = useCity((s) => s.selectedBuildingId)
  const panel = useGame((s) => s.panel)
  const sidebarOpen = useGame((s) => s.sidebarOpen)
  const setSidebar = useGame((s) => s.setSidebar)
  const [more, setMore] = useState(false)

  useEffect(() => {
    void useGame.getState().init()
  }, [])

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0">
        <Suspense fallback={null}>
          <CityCanvas />
        </Suspense>
      </div>

      {/* Desktop header */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 hidden items-start justify-between gap-3 p-5 desk:flex">
        <div className="panel pointer-events-auto flex items-center gap-3 rounded-2xl py-2 pr-4 pl-2">
          <Logo />
          <div className="leading-tight">
            <div className="font-display text-[15px] font-bold tracking-[0.12em]">AFTERLIGHT</div>
            <div className="text-xs text-[var(--color-muted)]">Город, который строят жители</div>
          </div>
        </div>
        <Hud />
        <TopControls />
      </header>
      {mobile && <MobileTop />}
      <HoverTooltip />

      {/* Desktop: tabs and panels on the left */}
      {!mobile && sidebarOpen && (
        <div className="pointer-events-none absolute top-[92px] bottom-5 left-5 z-20 w-[400px]">
          <SidePanel />
        </div>
      )}
      {!mobile && !sidebarOpen && (
        <button className="btn pointer-events-auto absolute top-[92px] left-5 z-20" onClick={() => setSidebar(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          Меню игры
        </button>
      )}
      {/* camera buttons */}
      {!selected && (
        <div className="pointer-events-none absolute right-3 bottom-[96px] z-20 desk:right-5 desk:bottom-28 land:right-[max(12px,env(safe-area-inset-right))] land:bottom-3">
          <CameraPad />
        </div>
      )}

      {/* District switcher */}
      <div className={`pointer-events-none absolute inset-x-3 top-[calc(max(10px,env(safe-area-inset-top))+78px)] z-20 flex justify-center desk:inset-x-auto desk:top-auto desk:bottom-5 land:top-auto land:right-[76px] land:bottom-2 land:left-[92px] ${sidebarOpen && !mobile ? 'desk:left-[calc(50%+210px)]' : 'desk:left-1/2'} desk:-translate-x-1/2`}>
        <DistrictSwitcher />
      </div>

      {selected ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex desk:inset-x-auto desk:top-[92px] desk:right-5 desk:bottom-auto land:inset-x-auto land:top-0 land:right-0">
          <BuildingPanel />
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex desk:hidden land:inset-x-auto land:top-0 land:left-0 land:items-center">
          <div className="w-full land:w-auto">
            <MobileNav onMore={() => setMore(true)} />
          </div>
        </div>
      )}
      {mobile && panel && <MobileSheet />}
      {mobile && more && <MoreSheet onClose={() => setMore(false)} />}

      <ModeBanner />
      <PickPlotBanner />
      <Toasts />
      <StatusOverlay />
      <Welcome />
      <NamePrompt />
      <TutorialCard />
    </div>
  )
}
