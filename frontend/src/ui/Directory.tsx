import { useMemo } from 'react'
import { BUILDINGS_BY_DISTRICT, computeStats, DISTRICT_BY_ID } from '../data/city'
import { KIND_LABEL, STATUS_COLOR } from '../data/kinds'
import type { BuildingKind } from '../data/types'
import { useCity } from '../store/cityStore'
import { CloseIcon, LockIcon, SearchIcon } from './icons'

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
  const all = BUILDINGS_BY_DISTRICT[districtId]
  const stats = useMemo(() => computeStats(all), [all])

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
      <div className="border-b border-white/8 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[10px] font-semibold tracking-[0.2em] uppercase" style={{ color: district.color }}>
              {district.subtitle}
            </div>
            <h2 className="mt-1 font-display text-xl font-bold text-white">{district.name}</h2>
          </div>
          {onClose && (
            <button className="icon-btn !h-9 !min-w-9 !px-0" onClick={onClose} aria-label="Закрыть">
              <CloseIcon />
            </button>
          )}
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-400">{district.description}</p>
        <dl className="mt-3 grid grid-cols-3 gap-2">
          <div className="stat">
            <dt>Зданий</dt>
            <dd>{stats.buildings}</dd>
          </div>
          <div className="stat">
            <dt>Жителей</dt>
            <dd>{fmt.format(stats.residents)}</dd>
          </div>
          <div className="stat">
            <dt>Рабочих мест</dt>
            <dd>{fmt.format(stats.jobs)}</dd>
          </div>
        </dl>
        <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--color-muted)]">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full" style={{ width: `${stats.occupancyRate * 100}%`, background: district.color }} />
          </div>
          <span className="font-mono">{Math.round(stats.occupancyRate * 100)}% заполнено</span>
          {stats.locked > 0 && (
            <span className="inline-flex items-center gap-1 text-violet-300">
              <LockIcon width={12} height={12} /> {stats.locked}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2.5 border-b border-white/8 p-4">
        <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 focus-within:border-teal-300/40">
          <SearchIcon className="shrink-0 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Найти здание…"
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-slate-500 hover:text-white" aria-label="Очистить поиск">
              <CloseIcon width={14} height={14} />
            </button>
          )}
        </label>
        <div className="flex flex-wrap gap-1.5">
          <button className="chip" aria-pressed={kindFilter === null} onClick={() => setKindFilter(null)}>
            Все <span className="opacity-50">{all.length}</span>
          </button>
          {kinds.map(([k, n]) => (
            <button key={k} className="chip" aria-pressed={kindFilter === k} onClick={() => setKindFilter(kindFilter === k ? null : k)}>
              {KIND_LABEL[k]} <span className="opacity-50">{n}</span>
            </button>
          ))}
        </div>
      </div>

      <ul className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-2">
        {list.length === 0 && <li className="p-6 text-center text-sm text-slate-500">Ничего не найдено</li>}
        {list.map((b) => {
          const active = b.id === selectedId
          return (
            <li key={b.id}>
              <button
                onClick={() => {
                  selectBuilding(b.id)
                  onClose?.()
                }}
                onMouseEnter={() => hoverBuilding(b.id)}
                onMouseLeave={() => hoverBuilding(null)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                  active ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
                }`}
              >
                <span
                  className="h-8 w-1 shrink-0 rounded-full"
                  style={{ background: b.accent, opacity: b.status === 'locked' ? 0.5 : 0.9 }}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-white">{b.name}</span>
                    {b.landmark && <span className="text-[10px] text-amber-300">★</span>}
                  </span>
                  <span className="block text-xs text-[var(--color-muted)]">
                    {KIND_LABEL[b.kind]}
                    {b.floors > 0 && b.status !== 'locked' && ` · ${b.floors} эт.`}
                  </span>
                </span>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS_COLOR[b.status] }} />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
