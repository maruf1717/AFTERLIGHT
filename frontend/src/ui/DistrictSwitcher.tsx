import { DISTRICTS } from '../data/city'
import { useCity } from '../store/cityStore'
import { DistrictArt } from './art'

export function DistrictSwitcher() {
  const active = useCity((s) => s.activeDistrictId)
  const setDistrict = useCity((s) => s.setDistrict)

  return (
    <nav aria-label="Районы" className="panel pointer-events-auto flex w-full gap-1 rounded-2xl p-1.5 md:w-auto">
      {DISTRICTS.map((d) => {
        const isActive = d.id === active
        return (
          <button
            key={d.id}
            onClick={() => setDistrict(d.id)}
            aria-current={isActive}
            className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl p-1.5 text-center transition md:min-w-[190px] md:flex-row md:gap-2.5 md:pr-4 md:text-left ${
              isActive ? 'text-white shadow-md' : 'hover:bg-black/[0.04]'
            }`}
            style={isActive ? { background: d.color } : undefined}
          >
            <DistrictArt id={d.id} size={32} />
            <span className="min-w-0 max-w-full">
              <span className="block truncate font-display text-[12px] font-semibold md:text-[15px]">
                <span className="md:hidden">{d.shortName}</span>
                <span className="hidden md:inline">{d.name}</span>
              </span>
              <span className={`hidden truncate text-xs md:block ${isActive ? 'text-white/80' : 'text-[var(--color-muted)]'}`}>
                {d.subtitle}
              </span>
            </span>
          </button>
        )
      })}
    </nav>
  )
}
