import { DISTRICTS } from '../data/city'
import { useCity } from '../store/cityStore'
import { DistrictArt } from './art'

export function DistrictSwitcher() {
  const active = useCity((s) => s.activeDistrictId)
  const setDistrict = useCity((s) => s.setDistrict)

  return (
    <nav aria-label="Районы" className="panel pointer-events-auto flex w-full gap-1 rounded-2xl p-1.5 land:w-auto land:p-1 desk:w-auto">
      {DISTRICTS.map((d) => {
        const isActive = d.id === active
        return (
          <button
            key={d.id}
            onClick={() => setDistrict(d.id)}
            aria-current={isActive}
            aria-label={d.name}
            className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl p-1.5 text-center transition land:h-10 land:flex-row land:justify-center land:p-1 desk:min-w-[190px] desk:flex-row desk:gap-2.5 desk:pr-4 desk:text-left ${
              isActive ? 'text-white shadow-md' : 'hover:bg-black/[0.04]'
            }`}
            style={isActive ? { background: d.color } : undefined}
          >
            <DistrictArt id={d.id} size={32} />
            {/* Phone on its side: icons only, the bar no taller than 48 px (round 2, 4.1). */}
            <span className="min-w-0 max-w-full land:hidden">
              <span className="block truncate font-display text-[12px] font-semibold desk:text-[15px]">
                <span className="desk:hidden">{d.shortName}</span>
                <span className="hidden desk:inline">{d.name}</span>
              </span>
              <span className={`hidden truncate text-xs desk:block ${isActive ? 'text-white/80' : 'text-[var(--color-muted)]'}`}>
                {d.subtitle}
              </span>
            </span>
          </button>
        )
      })}
    </nav>
  )
}
