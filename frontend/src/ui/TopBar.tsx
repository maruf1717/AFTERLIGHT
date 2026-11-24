import { useCity } from '../store/cityStore'
import { GaugeIcon, HelpIcon, HomeIcon, MoonIcon, SunIcon } from './icons'

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden className="shrink-0">
      <defs>
        <linearGradient id="logo-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6c37a" />
          <stop offset="1" stopColor="#e88d5a" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#logo-sky)" />
      <circle cx="28" cy="13" r="4.5" fill="#fff3d9" />
      <path d="M6 32V20h5v-4h5v16M18 32V9h7v23M27 32V21h7v11" fill="#17202b" />
      <rect x="6" y="32" width="28" height="2.5" fill="#17202b" />
      <path d="M20 13h1.5M20 17h1.5M20 21h1.5M22.5 13H24M22.5 17H24" stroke="#f6c37a" strokeWidth="1.4" />
    </svg>
  )
}

export function TopBar() {
  const night = useCity((s) => s.night)
  const quality = useCity((s) => s.quality)
  const toggleNight = useCity((s) => s.toggleNight)
  const toggleQuality = useCity((s) => s.toggleQuality)
  const resetView = useCity((s) => s.resetView)
  const setHelpOpen = useCity((s) => s.setHelpOpen)

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 px-[max(12px,env(safe-area-inset-left))] pt-[max(12px,env(safe-area-inset-top))] md:px-5 md:pt-5">
      <div className="panel pointer-events-auto flex items-center gap-3 rounded-2xl py-2 pr-4 pl-2">
        <Logo />
        <div className="leading-tight">
          <div className="font-display text-[15px] font-bold tracking-[0.12em]">AFTERLIGHT</div>
          <div className="text-xs text-[var(--color-muted)]">Город, который строят жители</div>
        </div>
      </div>

      <div className="pointer-events-auto flex gap-2">
        <button className="btn hidden md:inline-flex" onClick={resetView} title="Показать весь район">
          <HomeIcon /> Обзор района
        </button>
        <button className="btn hidden md:inline-flex" onClick={toggleNight} title="Клавиша N">
          {night ? <SunIcon /> : <MoonIcon />} {night ? 'Сделать день' : 'Сделать ночь'}
        </button>
        <button className="btn hidden lg:inline-flex" onClick={toggleQuality} title="Тени и сглаживание. Выключи, если тормозит">
          <GaugeIcon /> Графика: {quality === 'high' ? 'максимум' : 'эконом'}
        </button>
        <button className="btn !px-3" onClick={() => setHelpOpen(true)} aria-label="Как пользоваться">
          <HelpIcon /> <span className="hidden md:inline">Помощь</span>
        </button>
      </div>
    </header>
  )
}

/** Phone-only bottom bar with labelled actions. */
export function MobileTabBar() {
  const night = useCity((s) => s.night)
  const quality = useCity((s) => s.quality)
  const toggleNight = useCity((s) => s.toggleNight)
  const toggleQuality = useCity((s) => s.toggleQuality)
  const resetView = useCity((s) => s.resetView)
  const setDirectoryOpen = useCity((s) => s.setDirectoryOpen)

  const item = 'flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-semibold text-[var(--color-ink)] active:bg-black/5'
  return (
    <nav className="panel pointer-events-auto mx-3 mb-[max(10px,env(safe-area-inset-bottom))] flex rounded-2xl p-1 md:hidden" aria-label="Действия">
      <button className={item} onClick={() => setDirectoryOpen(true)}>
        <BuildingsGlyph /> Здания
      </button>
      <button className={item} onClick={resetView}>
        <HomeIcon width={20} height={20} /> Обзор
      </button>
      <button className={item} onClick={toggleNight}>
        {night ? <SunIcon width={20} height={20} /> : <MoonIcon width={20} height={20} />} {night ? 'День' : 'Ночь'}
      </button>
      <button className={item} onClick={toggleQuality}>
        <GaugeIcon width={20} height={20} /> {quality === 'high' ? 'Графика: макс' : 'Графика: эконом'}
      </button>
    </nav>
  )
}

function BuildingsGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
      <path d="M3 21V10l5-3v14M8 21V4l7 3v14M15 21v-9l6 2v7M2 21h20" />
    </svg>
  )
}
