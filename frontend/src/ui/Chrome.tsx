import type { ReactNode } from 'react'
import { useBalance, useGame, type Panel } from '../game/store'
import { useCity } from '../store/cityStore'
import { Directory } from './Directory'
import { AdminPanel } from './game/AdminPanel'
import { BusinessPanel } from './game/BusinessPanel'
import { CityPanel } from './game/CityPanel'
import { Money, fmt, useEscape } from './game/common'
import { GalleryPanel, HelpPanel, SettingsPanel } from './game/ExtraPanels'
import { ProjectsPanel } from './game/ProjectsPanel'
import { RatingPanel } from './game/RatingPanel'
import { TasksPanel } from './game/TasksPanel'
import { CloseIcon, GaugeIcon, HelpIcon, HomeIcon, MoonIcon, SunIcon } from './icons'
import { Logo } from './TopBar'

const I = (d: string) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
)
export const TAB_ICON: Record<Panel, ReactNode> = {
  city: I('M3 21V10l5-3v14M8 21V4l7 3v14M15 21v-9l6 2v7M2 21h20'),
  tasks: I('M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9'),
  projects: I('M4 21V9m0 0 8-6 8 6M4 9h16M8 21v-6h8v6M12 3v4'),
  business: I('M3 9l2-5h14l2 5M3 9h18M3 9v11h18V9M9 20v-6h6v6'),
  rating: I('M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 6h3v2a3 3 0 0 1-3 3M7 6H4v2a3 3 0 0 0 3 3'),
  buildings: I('M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01'),
  admin: I('M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z'),
  gallery: I('M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9h.01'),
  help: I('M9.1 9a3 3 0 1 1 4 2.8c-.7.3-1.1 1-1.1 1.7V14M12 18h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z'),
  settings: I('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 14H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 3V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z'),
}
export const TAB_LABEL: Record<Panel, string> = {
  city: 'Город',
  tasks: 'Задания',
  projects: 'Проекты',
  business: 'Бизнес',
  rating: 'Рейтинг',
  buildings: 'Здания',
  admin: 'Админ',
  gallery: 'Галерея',
  help: 'Помощь',
  settings: 'Настройки',
}

export function PanelBody({ panel }: { panel: Panel }) {
  switch (panel) {
    case 'city':
      return <CityPanel />
    case 'tasks':
      return <TasksPanel />
    case 'projects':
      return <ProjectsPanel />
    case 'business':
      return <BusinessPanel />
    case 'rating':
      return <RatingPanel />
    case 'buildings':
      return <Directory />
    case 'admin':
      return <AdminPanel />
    case 'gallery':
      return <GalleryPanel />
    case 'help':
      return <HelpPanel />
    case 'settings':
      return <SettingsPanel />
  }
}

/** City numbers at a glance. */
export function Hud({ compact = false }: { compact?: boolean }) {
  const city = useGame((s) => s.city)
  const balance = useBalance()
  const setPanel = useGame((s) => s.setPanel)
  if (!city) return null
  const problems = city.crises.length
  const next = city.level.next
  return (
    <button onClick={() => setPanel('city')} className="panel pointer-events-auto flex flex-col gap-1 rounded-2xl px-3 py-2 text-left desk:px-4" aria-label="Состояние города">
      <div className="flex items-center gap-3 desk:gap-4">
      <div>
        <div className="text-[10px] font-semibold whitespace-nowrap text-[var(--color-muted)] desk:text-[11px]">{compact ? 'Жители' : `${city.level.name} · день ${city.day}`}</div>
        <div className="font-display text-[15px] leading-tight font-bold tabular-nums desk:text-lg">{fmt.format(city.population)}</div>
      </div>
      <div className="h-8 w-px bg-black/10" />
      <div>
        <div className="text-[10px] font-semibold text-[var(--color-muted)] desk:text-[11px]">Счастье</div>
        <div className={`font-display text-[15px] leading-tight font-bold tabular-nums desk:text-lg ${city.happiness < 60 ? 'text-[#b3261e]' : ''}`}>{city.happiness}%</div>
      </div>
      {problems > 0 && (
        <>
          <div className="h-8 w-px bg-black/10" />
          <div className="flex items-center gap-1.5 rounded-xl bg-red-50 px-2 py-1 text-xs font-semibold text-red-800">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-600" />
            <span className="whitespace-nowrap">{compact ? problems : `${problems} ${problems === 1 ? 'кризис' : 'кризиса'}`}</span>
          </div>
        </>
      )}
      <div className="h-8 w-px bg-black/10" />
      <div>
        <div className="text-[10px] font-semibold text-[var(--color-muted)] desk:text-[11px]">Искры</div>
        <div className="text-[15px] leading-tight desk:text-lg">
          <Money value={balance} size={compact ? 14 : 17} short />
        </div>
      </div>
      </div>
      {next && (
        <div className="flex w-full items-center gap-2 text-[10px] font-semibold text-[var(--color-muted)] desk:text-[11px]">
          <span className="whitespace-nowrap">
            Цель: {fmt.format(next.from)} жит. — {next.name}
          </span>
          <span className="h-1.5 min-w-8 flex-1 overflow-hidden rounded-full bg-black/10">
            <span className="block h-full rounded-full bg-[#d9772b]" style={{ width: `${Math.min(100, (city.population / next.from) * 100)}%` }} />
          </span>
          <span className="whitespace-nowrap tabular-nums">
            {fmt.format(city.population)}/{fmt.format(next.from)}
          </span>
        </div>
      )}
    </button>
  )
}

export function TopControls() {
  const night = useCity((s) => s.night)
  const quality = useCity((s) => s.quality)
  const toggleNight = useCity((s) => s.toggleNight)
  const toggleQuality = useCity((s) => s.toggleQuality)
  const resetView = useCity((s) => s.resetView)
  const setPanel = useGame((s) => s.setPanel)
  return (
    <div className="pointer-events-auto flex gap-2">
      <button className="btn hidden xl:inline-flex" onClick={resetView} title="Показать весь район">
        <HomeIcon /> Обзор
      </button>
      <button className="btn hidden desk:inline-flex" onClick={toggleNight} title="Клавиша N">
        {night ? <SunIcon /> : <MoonIcon />} {night ? 'День' : 'Ночь'}
      </button>
      <button className="btn hidden lg:inline-flex" onClick={toggleQuality} title="Тени, отражения и мягкий свет. Выключи, если тормозит">
        <GaugeIcon /> <span className="whitespace-nowrap">{quality === 'high' ? 'Графика: макс.' : 'Графика: эконом'}</span>
      </button>
      <button className="btn !px-3" onClick={() => setPanel('settings')} aria-label="Настройки">
        {TAB_ICON.settings}
      </button>
      <button className="btn !px-3" onClick={() => setPanel('help')} aria-label="Помощь">
        <HelpIcon /> <span className="hidden desk:inline">Помощь</span>
      </button>
    </div>
  )
}

/** Desktop: tabs + the open panel on the left. */
export function SidePanel() {
  const panel = useGame((s) => s.panel) ?? 'city'
  const setPanel = useGame((s) => s.setPanel)
  const isOwner = useGame((s) => s.isOwner)
  const setSidebar = useGame((s) => s.setSidebar)
  const tabs: Panel[] = ['city', 'tasks', 'projects', 'business', 'rating', 'buildings', 'gallery', ...(isOwner ? (['admin'] as Panel[]) : [])]
  return (
    <div className="panel pointer-events-auto flex h-full flex-col overflow-hidden rounded-[28px]">
      <nav className="grid grid-cols-4 gap-1 border-b border-[var(--color-line)] p-1.5" aria-label="Разделы">
        <button onClick={() => setSidebar(false)} className="col-start-4 row-start-2 flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold text-[var(--color-muted)] hover:bg-black/[0.04]">
          {I('M15 18l-6-6 6-6')}
          Свернуть
        </button>
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setPanel(t)}
            aria-current={panel === t}
            className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold transition ${panel === t ? 'bg-[var(--color-ink)] text-white' : 'text-[var(--color-muted)] hover:bg-black/[0.04]'}`}
          >
            {TAB_ICON[t]}
            {TAB_LABEL[t]}
          </button>
        ))}
      </nav>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        <PanelBody panel={panel} />
      </div>
    </div>
  )
}

/** Phone: bottom tab bar. */
export function MobileNav({ onMore }: { onMore: () => void }) {
  const panel = useGame((s) => s.panel)
  const setPanel = useGame((s) => s.setPanel)
  const tabs: Panel[] = ['city', 'tasks', 'projects', 'business']
  const item = 'flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold'
  return (
    <nav className="panel pointer-events-auto mx-3 mb-[max(10px,env(safe-area-inset-bottom))] flex rounded-2xl p-1 desk:hidden land:mx-0 land:mb-0 land:ml-[max(8px,env(safe-area-inset-left))] land:w-[76px] land:flex-col land:gap-0.5" aria-label="Разделы">
      {tabs.map((t) => (
        <button key={t} className={`${item} ${panel === t ? 'bg-[var(--color-ink)] text-white' : 'text-[var(--color-ink)]'}`} onClick={() => setPanel(panel === t ? null : t)}>
          {TAB_ICON[t]}
          {TAB_LABEL[t]}
        </button>
      ))}
      <button className={`${item} text-[var(--color-ink)]`} onClick={onMore}>
        {I('M5 12h.01M12 12h.01M19 12h.01')}
        Ещё
      </button>
    </nav>
  )
}

export function MobileSheet() {
  const panel = useGame((s) => s.panel)
  const setPanel = useGame((s) => s.setPanel)
  if (!panel) return null
  return (
    <div className="fixed inset-0 z-40 desk:hidden">
      <button className="absolute inset-0 bg-[#17202b]/35" aria-label="Закрыть" onClick={() => setPanel(null)} />
      <div className="anim-sheet absolute inset-x-0 bottom-0 flex h-[84vh] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl land:inset-x-auto land:top-0 land:right-0 land:h-full land:w-[min(440px,58vw)] land:rounded-none land:rounded-l-[24px]">
        <div className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-3">
          <div className="flex items-center gap-2 font-display text-lg font-bold">
            {TAB_ICON[panel]} {TAB_LABEL[panel]}
          </div>
          <button className="btn-flat !h-9 !w-9 !px-0" onClick={() => setPanel(null)} aria-label="Закрыть">
            <CloseIcon />
          </button>
        </div>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
          <PanelBody panel={panel} />
        </div>
      </div>
    </div>
  )
}

export function MoreSheet({ onClose }: { onClose: () => void }) {
  const setPanel = useGame((s) => s.setPanel)
  const isOwner = useGame((s) => s.isOwner)
  const night = useCity((s) => s.night)
  const quality = useCity((s) => s.quality)
  const toggleNight = useCity((s) => s.toggleNight)
  const toggleQuality = useCity((s) => s.toggleQuality)
  const resetView = useCity((s) => s.resetView)
  useEscape(onClose)
  const row = 'flex w-full items-center gap-3 rounded-2xl bg-[var(--color-soft)] p-3 text-left text-sm font-semibold'
  const go = (p: Panel) => {
    setPanel(p)
    onClose()
  }
  return (
    <div className="fixed inset-0 z-40 desk:hidden">
      <button className="absolute inset-0 bg-[#17202b]/35" aria-label="Закрыть" onClick={onClose} />
      <div className="anim-sheet absolute inset-x-0 bottom-0 space-y-2 rounded-t-[28px] bg-white p-4 pb-[max(16px,env(safe-area-inset-bottom))] shadow-2xl land:inset-x-auto land:top-0 land:right-0 land:w-[min(420px,58vw)] land:overflow-y-auto land:rounded-none land:rounded-l-[24px]">
        <button className={row} onClick={() => go('rating')}>
          {TAB_ICON.rating} Рейтинг жителей
        </button>
        <button className={row} onClick={() => go('buildings')}>
          {TAB_ICON.buildings} Все здания района
        </button>
        <button className={row} onClick={() => go('gallery')}>
          {TAB_ICON.gallery} Галерея работ жителей
        </button>
        <button className={row} onClick={() => go('settings')}>
          {TAB_ICON.settings} Настройки
        </button>
        {isOwner && (
          <button className={`${row} !bg-[#17202b] !text-white`} onClick={() => go('admin')}>
            {TAB_ICON.admin} Админ-панель
          </button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button className={row} onClick={toggleNight}>
            {night ? <SunIcon /> : <MoonIcon />} {night ? 'День' : 'Ночь'}
          </button>
          <button className={row} onClick={toggleQuality}>
            <GaugeIcon /> {quality === 'high' ? 'Графика: макс' : 'Графика: эконом'}
          </button>
          <button
            className={row}
            onClick={() => {
              resetView()
              onClose()
            }}
          >
            <HomeIcon /> Обзор района
          </button>
          <button className={row} onClick={() => go('help')}>
            <HelpIcon /> Помощь
          </button>
        </div>
      </div>
    </div>
  )
}

export function MobileTop() {
  const setPanel = useGame((s) => s.setPanel)
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start gap-2 px-3 pt-[max(10px,env(safe-area-inset-top))] desk:hidden land:pt-2 land:pr-[max(12px,env(safe-area-inset-right))] land:pl-[96px]">
      <button className="pointer-events-auto rounded-2xl p-0.5" onClick={() => setPanel('city')} aria-label="Город">
        <Logo size={40} />
      </button>
      <div className="min-w-0 flex-1">
        <Hud compact />
      </div>
      <button className="btn pointer-events-auto !h-[46px] !px-3" onClick={() => setPanel('help')} aria-label="Помощь">
        <HelpIcon />
      </button>
    </div>
  )
}

export function Toasts() {
  const toasts = useGame((s) => s.toasts)
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(max(10px,env(safe-area-inset-bottom))+78px)] z-[70] flex flex-col-reverse items-center gap-2 px-4 desk:top-24 desk:bottom-auto desk:flex-col land:bottom-[84px] land:left-[88px]" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`anim-pop rounded-2xl px-4 py-2.5 text-sm font-semibold shadow-lg ${t.tone === 'good' ? 'bg-[#1f6b3a] text-white' : t.tone === 'bad' ? 'bg-[#8e1c1c] text-white' : 'bg-[#17202b] text-white'}`}
        >
          {t.text}
        </div>
      ))}
    </div>
  )
}

/** Big, obvious camera buttons: zoom and rotate without gestures. */
export function CameraPad() {
  const camera = useCity((s) => s.camera)
  const resetView = useCity((s) => s.resetView)
  const b = 'flex h-12 w-12 items-center justify-center text-[var(--color-ink)] active:bg-black/5'
  const svg = (d: string) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  )
  return (
    <div className="panel pointer-events-auto flex flex-col overflow-hidden rounded-2xl" role="group" aria-label="Камера">
      <button className={b} onClick={() => camera('in')} aria-label="Приблизить">
        {svg('M12 5v14M5 12h14')}
      </button>
      <div className="h-px bg-black/10" />
      <button className={b} onClick={() => camera('out')} aria-label="Отдалить">
        {svg('M5 12h14')}
      </button>
      <div className="h-px bg-black/10" />
      <button className={b} onClick={() => camera('left')} aria-label="Повернуть влево">
        {svg('M3 12a9 9 0 1 0 3-6.7M3 4v5h5')}
      </button>
      <div className="h-px bg-black/10" />
      <button className={b} onClick={() => camera('right')} aria-label="Повернуть вправо">
        {svg('M21 12a9 9 0 1 1-3-6.7M21 4v5h-5')}
      </button>
      <div className="h-px bg-black/10" />
      <button className={b} onClick={resetView} aria-label="Весь район">
        {svg('M3 10.5 12 3l9 7.5V21H3z')}
      </button>
    </div>
  )
}
