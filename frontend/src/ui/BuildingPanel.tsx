import { BUILDING_BY_ID, BUILDINGS_BY_DISTRICT, DISTRICT_BY_ID } from '../data/city'
import { KIND_LABEL, RESIDENTIAL_KINDS, STATUS_COLOR, STATUS_LABEL } from '../data/kinds'
import { useCity } from '../store/cityStore'
import { ChevronLeft, ChevronRight, CloseIcon, LockIcon, TargetIcon } from './icons'

const fmt = new Intl.NumberFormat('ru-RU')

export function BuildingPanel() {
  const id = useCity((s) => s.selectedBuildingId)
  const selectBuilding = useCity((s) => s.selectBuilding)
  const cycleBuilding = useCity((s) => s.cycleBuilding)
  const focus = useCity((s) => s.focus)

  const b = id ? BUILDING_BY_ID[id] : null
  if (!b) return null

  const district = DISTRICT_BY_ID[b.districtId]
  const list = BUILDINGS_BY_DISTRICT[b.districtId]
  const index = list.findIndex((x) => x.id === b.id)
  const locked = b.status === 'locked'
  const fill = b.capacity ? b.occupancy / b.capacity : 0
  const peopleLabel = RESIDENTIAL_KINDS.has(b.kind) ? 'Жители' : b.kind === 'park' ? 'Посетители' : 'Внутри сейчас'

  return (
    <aside
      key={b.id}
      className="glass anim-sheet pointer-events-auto !bg-[#0b0d16]/95 md:!bg-[var(--color-panel)] flex max-h-[58vh] w-full flex-col overflow-hidden rounded-t-3xl md:max-h-[calc(100vh-2.5rem)] md:w-[360px] md:rounded-3xl"
      aria-label={`Здание: ${b.name}`}
    >
      {/* accent header */}
      <div
        className="relative px-5 pt-4 pb-4"
        style={{ background: `linear-gradient(160deg, color-mix(in srgb, ${b.accent} 22%, transparent), transparent 70%)` }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 md:hidden" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold tracking-[0.18em] uppercase">
              <span style={{ color: district.color }}>{district.name}</span>
              <span className="text-slate-600">/</span>
              <span className="text-slate-400">{locked ? 'Неизвестно' : KIND_LABEL[b.kind]}</span>
              {b.landmark && <span className="rounded bg-amber-300/15 px-1.5 py-0.5 text-amber-200">Достопримечательность</span>}
            </div>
            <h3 className="mt-1.5 font-display text-lg leading-snug font-bold text-white">{b.name}</h3>
          </div>
          <button className="icon-btn !h-9 !min-w-9 shrink-0 !px-0" onClick={() => selectBuilding(null)} aria-label="Закрыть (Esc)">
            <CloseIcon />
          </button>
        </div>
        <span
          className="mt-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold"
          style={{ color: STATUS_COLOR[b.status], borderColor: `${STATUS_COLOR[b.status]}55` }}
        >
          {locked ? <LockIcon width={12} height={12} /> : <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLOR[b.status] }} />}
          {STATUS_LABEL[b.status]}
        </span>
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-4">
        <p className="text-sm leading-relaxed text-slate-300">{b.description}</p>

        {locked ? (
          <div className="rounded-2xl border border-violet-400/25 bg-violet-400/[0.06] p-4 text-sm text-violet-100">
            <div className="flex items-center gap-2 font-semibold">
              <LockIcon width={16} height={16} /> Здание ещё не исследовано
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-violet-200/70">
              Характеристики скрыты. Такие места будут открываться через события и исследования жителей.
            </p>
          </div>
        ) : (
          <>
            <dl className="grid grid-cols-3 gap-2">
              <div className="stat">
                <dt>Высота</dt>
                <dd>{Math.round(b.height)} м</dd>
              </div>
              <div className="stat">
                <dt>Этажей</dt>
                <dd>{b.floors || '—'}</dd>
              </div>
              <div className="stat">
                <dt>Основано</dt>
                <dd>{b.founded}</dd>
              </div>
            </dl>
            <div>
              <div className="flex justify-between text-xs">
                <span className="text-[var(--color-muted)]">{peopleLabel}</span>
                <span className="font-mono text-slate-200">
                  {fmt.format(b.occupancy)} / {fmt.format(b.capacity)}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full transition-all" style={{ width: `${fill * 100}%`, background: b.accent }} />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 text-xs">
              <span className="chip pointer-events-none">
                Площадь {Math.round(b.size[0] * b.size[1])} м²
              </span>
              {b.tags.map((t) => (
                <span key={t} className="chip pointer-events-none">
                  #{t}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-white/8 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button className="icon-btn !px-0" onClick={() => cycleBuilding(-1)} aria-label="Предыдущее здание (←)">
          <ChevronLeft />
        </button>
        <span className="font-mono text-xs text-slate-500">
          {index + 1}/{list.length}
        </span>
        <button className="icon-btn !px-0" onClick={() => cycleBuilding(1)} aria-label="Следующее здание (→)">
          <ChevronRight />
        </button>
        <button className="icon-btn ml-auto" onClick={focus}>
          <TargetIcon width={16} height={16} /> Показать
        </button>
      </div>
    </aside>
  )
}
