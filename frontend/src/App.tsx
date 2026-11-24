import { Suspense, useEffect, useState } from 'react'
import { DISTRICTS } from './data/city'
import { KIND_LABEL } from './data/kinds'
import { useGame } from './game/store'
import { CityCanvas } from './scene/CityCanvas'
import { useCity } from './store/cityStore'
import { KindArt } from './ui/art'
import { BuildingPanel } from './ui/BuildingPanel'
import { Hud, MobileNav, MobileSheet, MobileTop, MoreSheet, SidePanel, Toasts, TopControls } from './ui/Chrome'
import { DistrictSwitcher } from './ui/DistrictSwitcher'
import { Logo } from './ui/TopBar'
import { Welcome } from './ui/Welcome'

function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const s = useCity.getState()
      if (s.helpOpen) return
      if (e.key === 'Escape') {
        if (s.selectedBuildingId) s.selectBuilding(null)
        else useGame.getState().setPanel(null)
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
  const b = useGame((s) => (id ? s.objectById[id] : undefined))
  const [pos, setPos] = useState({ x: 0, y: 0 })
  useEffect(() => {
    const onMove = (e: PointerEvent) => setPos({ x: e.clientX, y: e.clientY })
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])
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

function ModeBanner() {
  const mode = useGame((s) => s.mode)
  const canWrite = useGame((s) => s.canWrite)
  const status = useGame((s) => s.status)
  if (status !== 'ready') return null
  const text = !canWrite ? 'Ты можешь смотреть, но не играть: попроси у основателя доступ на изменение.' : mode === 'local' ? 'Тестовый режим: город хранится только в этом браузере.' : null
  if (!text) return null
  return <div className="pointer-events-none absolute inset-x-0 bottom-[86px] z-10 flex justify-center px-4 md:bottom-24"><div className="rounded-full bg-[#17202b]/85 px-3 py-1.5 text-xs font-medium text-white">{text}</div></div>
}

function useIsMobile() {
  const q = '(max-width: 767px)'
  const [m, setM] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const on = () => setM(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return m
}

export default function App() {
  useKeyboard()
  const mobile = useIsMobile()
  const selected = useCity((s) => s.selectedBuildingId)
  const panel = useGame((s) => s.panel)
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
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 hidden items-start justify-between gap-3 p-5 md:flex">
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
      {!mobile && (
        <div className="pointer-events-none absolute top-[92px] bottom-5 left-5 z-20 w-[400px]">
          <SidePanel />
        </div>
      )}

      {/* District switcher */}
      <div className="pointer-events-none absolute inset-x-3 top-[calc(max(10px,env(safe-area-inset-top))+62px)] z-20 flex justify-center md:inset-x-auto md:top-auto md:bottom-5 md:left-[calc(50%+210px)] md:-translate-x-1/2">
        <DistrictSwitcher />
      </div>

      {selected ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex md:inset-x-auto md:top-[92px] md:right-5 md:bottom-auto">
          <BuildingPanel />
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex md:hidden">
          <div className="w-full">
            <MobileNav onMore={() => setMore(true)} />
          </div>
        </div>
      )}
      {mobile && panel && <MobileSheet />}
      {mobile && more && <MoreSheet onClose={() => setMore(false)} />}

      <ModeBanner />
      <Toasts />
      <StatusOverlay />
      <Welcome />
    </div>
  )
}
