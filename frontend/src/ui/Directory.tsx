import { useMemo } from 'react'
import { DISTRICT_BY_ID } from '../data/city'
import { useGame } from '../game/store'
import { KIND_LABEL, STATUS_COLOR, STATUS_LABEL } from '../data/kinds'
import type { BuildingKind } from '../data/types'
import { useCity } from '../store/cityStore'
import { DistrictArt, KindArt } from './art'
import { BriefcaseIcon, BuildingIcon, CloseIcon, PeopleIcon, SearchIcon } from './icons'

const fmt = new Intl.NumberFormat('ru-RU')

/** District overview + searchable list of its buildings. */
export function Directory({ onClose }: { onClose?: () => void }) {
  const districtId = useCity((s) => s.activeDistrictId)
  const selectedId = useCity((s) => s.selectedBuildingId)
  const search = useCity((s) => s.search)
  const kindFilter = useCity((s) => s.kindFilter)
  const setSearch = useCity((s) => s.setSearch)
  const setKindFilter = useCity((s) => s.setKindFilter)
  const selectBuilding = useCity((s) => s.selectBuilding)
  const hoverBuilding = useCity((s) => s.hoverBuilding)

  const district = DISTRICT_BY_ID[districtId]
  const objects = useGame((s) => s.objects)
  const all = useMemo(() => objects.filter((o) => o.districtId === districtId), [objects, districtId])
  const stats = useMemo(
    () => ({
      buildings: all.filter((o) => o.kind !== 'lot' && o.kind !== 'construction').length,
      building: all.filter((o) => o.kind === 'construction').length,
      free: all.filter((o) => o.kind === 'lot').length,
    }),
    [all],
  )

  const kinds = useMemo(() => {
    const counts = new Map<BuildingKind, number>()
    for (const b of all) counts.set(b.kind, (counts.get(b.kind) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [all])

  const list = useMemo(() => {
    const q = search.trim().toLowerCase()
    return all
      .filter((b) => !kindFilter || b.kind === kindFilter)
      .filter((b) => !q || b.name.toLowerCase().includes(q) || KIND_LABEL[b.kind].toLowerCase().includes(q))
      .sort((a, b) => Number(b.landmark) - Number(a.landmark) || b.height - a.height)
  }, [all, search, kindFilter])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="p-4 pb-3">
        <div className="flex items-start gap-3">
          <DistrictArt id={district.id} size={52} />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold" style={{ color: district.color }}>
              {district.subtitle}
            </div>
            <h2 className="font-display text-xl leading-tight font-bold">{district.name}</h2>
          </div>
          {onClose && (
            <button className="btn-flat !h-9 !w-9 !px-0" onClick={onClose} aria-label="Закрыть список">
              <CloseIcon />
            </button>
          )}
        </div>
        <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--color-muted)]">{district.description}</p>
        <dl className="mt-3 grid grid-cols-3 gap-2">
          <div className="stat">
            <dt className="label"><BuildingIcon width={14} height={14} /> Зданий</dt>
            <dd className="value">{stats.buildings}</dd>
          </div>
          <div className="stat">
            <dt className="label"><PeopleIcon width={14} height={14} /> Стройки</dt>
            <dd className="value">{fmt.format(stats.building)}</dd>
          </div>
          <div className="stat">
            <dt className="label"><BriefcaseIcon width={14} height={14} /> Участки</dt>
            <dd className="value">{fmt.format(stats.free)}</dd>
          </div>
        </dl>
      </div>

      <div className="space-y-2.5 border-t border-[var(--color-line)] px-4 pt-3 pb-3">
        <label htmlFor="building-search" className="flex items-center gap-2 rounded-xl bg-[var(--color-soft)] px-3 py-2.5 focus-within:ring-2 focus-within:ring-[var(--color-brand)]">
          <SearchIcon className="shrink-0 text-[var(--color-faint)]" />
          <input
            id="building-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию"
            className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--color-faint)]"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-[var(--color-faint)] hover:text-[var(--color-ink)]" aria-label="Очистить поиск">
              <CloseIcon width={16} height={16} />
            </button>
          )}
        </label>
        <div className="scroll-thin -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
          <button className="chip plain shrink-0" aria-pressed={kindFilter === null} onClick={() => setKindFilter(null)}>
            Все · {all.length}
          </button>
          {kinds.map(([k, n]) => (
            <button key={k} className="chip shrink-0" aria-pressed={kindFilter === k} onClick={() => setKindFilter(kindFilter === k ? null : k)}>
              <KindArt kind={k} size={24} /> {KIND_LABEL[k]} · {n}
            </button>
          ))}
        </div>
      </div>

      <ul className="scroll-thin min-h-0 flex-1 overflow-y-auto border-t border-[var(--color-line)] p-2">
        {list.length === 0 && <li className="p-6 text-center text-sm text-[var(--color-muted)]">Ничего не найдено. Попробуй другое название.</li>}
        {list.map((b) => {
          const active = b.id === selectedId
          return (
            <li key={b.id}>
              <button
                onClick={() => {
                  selectBuilding(b.id, 'directory')
                  onClose?.()
                }}
                onMouseEnter={() => hoverBuilding(b.id)}
                onMouseLeave={() => hoverBuilding(null)}
                className={`row flex w-full items-center gap-3 rounded-2xl p-2 text-left transition ${active ? 'bg-[var(--color-soft)]' : 'hover:bg-black/[0.035]'}`}
              >
                <KindArt kind={b.kind} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold">{b.name}</span>
                    {b.landmark && <span title="Достопримечательность" className="text-[13px] text-amber-500">★</span>}
                  </span>
                  <span className="block truncate text-xs text-[var(--color-muted)]">
                    {KIND_LABEL[b.kind]}
                    {b.floors > 0 && b.status !== 'locked' && ` · ${b.floors} эт.`}
                  </span>
                </span>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{ color: STATUS_COLOR[b.status], background: `${STATUS_COLOR[b.status]}1f` }}
                >
                  {STATUS_LABEL[b.status]}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
