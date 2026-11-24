import { DISTRICTS } from '../data/city'
import { useCity } from '../store/cityStore'

export function DistrictSwitcher() {
  const active = useCity((s) => s.activeDistrictId)
  const setDistrict = useCity((s) => s.setDistrict)

  return (
    <nav
      aria-label="Районы"
      className="glass pointer-events-auto flex w-full gap-1 rounded-2xl p-1 md:w-auto"
    >
      {DISTRICTS.map((d, i) => {
        const isActive = d.id === active
        return (
          <button
            key={d.id}
            onClick={() => setDistrict(d.id)}
            aria-current={isActive}
            className={`group relative flex min-w-0 flex-1 flex-col items-start rounded-xl px-2 py-2 sm:px-3 text-left transition md:min-w-[150px] ${
              isActive ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'
            }`}
          >
            <span className="flex items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: d.color, boxShadow: isActive ? `0 0 12px ${d.color}` : 'none' }}
              />
              <span className={`truncate font-display text-[10px] font-medium tracking-[0.06em] uppercase sm:text-[11px] sm:tracking-[0.14em] ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>
                {d.name}
              </span>
            </span>
            <span className="mt-0.5 hidden pl-4 text-[11px] text-[var(--color-muted)] sm:block">
              {d.subtitle} <span className="font-mono opacity-60">· {i + 1}</span>
            </span>
            {isActive && (
              <span className="absolute inset-x-3 -bottom-px h-px" style={{ background: d.color }} />
            )}
          </button>
        )
      })}
    </nav>
  )
}
