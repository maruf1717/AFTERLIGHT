import { useCity } from '../store/cityStore'
import { GaugeIcon, HomeIcon, ListIcon, MoonIcon, SunIcon } from './icons'

export function TopBar() {
  const night = useCity((s) => s.night)
  const quality = useCity((s) => s.quality)
  const directoryOpen = useCity((s) => s.directoryOpen)
  const toggleNight = useCity((s) => s.toggleNight)
  const toggleQuality = useCity((s) => s.toggleQuality)
  const resetView = useCity((s) => s.resetView)
  const setDirectoryOpen = useCity((s) => s.setDirectoryOpen)

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:p-5">
      <div className="pointer-events-auto glass flex items-center gap-3 rounded-2xl px-3.5 py-2.5">
        <Logo />
        <div className="leading-tight">
          <div className="font-display text-sm font-bold tracking-[0.22em] text-white">AFTERLIGHT</div>
          <div className="font-mono text-[10px] tracking-wider text-[var(--color-muted)]">MISSION 01 · v0.1</div>
        </div>
      </div>

      <div className="pointer-events-auto flex gap-2">
        <button
          className="icon-btn md:hidden"
          aria-pressed={directoryOpen}
          onClick={() => setDirectoryOpen(!directoryOpen)}
          aria-label="Справочник зданий"
        >
          <ListIcon />
        </button>
        <button className="icon-btn" onClick={resetView} title="Обзор района" aria-label="Обзор района">
          <HomeIcon />
        </button>
        <button
          className="icon-btn"
          onClick={toggleNight}
          aria-pressed={!night}
          title={night ? 'Включить день (N)' : 'Включить ночь (N)'}
          aria-label="День / ночь"
        >
          {night ? <MoonIcon /> : <SunIcon />}
        </button>
        <button
          className="icon-btn"
          onClick={toggleQuality}
          title="Качество графики: тени и сглаживание"
          aria-label="Качество графики"
        >
          <GaugeIcon />
          <span className="hidden font-mono text-xs sm:inline">{quality === 'high' ? 'HIGH' : 'LOW'}</span>
        </button>
      </div>
    </header>
  )
}

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#0d1322" />
      <path d="M9 24V13l4-3v14M15 24V7l5 3v14M22 24v-8l3 2v6" stroke="#5eead4" strokeWidth="2" fill="none" strokeLinejoin="round" />
    </svg>
  )
}
