import { BUILDING_BY_ID, BUILDINGS_BY_DISTRICT, DISTRICT_BY_ID } from '../data/city'
import { KIND_LABEL, RESIDENTIAL_KINDS, STATUS_COLOR, STATUS_LABEL } from '../data/kinds'
import { useCity } from '../store/cityStore'
import { KindArt } from './art'
import { CalendarIcon, ChevronLeft, ChevronRight, CloseIcon, LockIcon, PeopleIcon, RulerIcon, StairsIcon, ZoomIcon } from './icons'

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
  const peopleLabel = RESIDENTIAL_KINDS.has(b.kind) ? 'Живут здесь' : b.kind === 'park' ? 'Гуляют сейчас' : 'Сейчас внутри'

  return (
    <aside
      key={b.id}
      className="panel anim-sheet pointer-events-auto flex max-h-[62vh] w-full flex-col overflow-hidden rounded-t-[28px] !bg-white md:max-h-[calc(100vh-7rem)] md:w-[380px] md:rounded-[28px] md:!bg-[var(--color-panel)]"
      aria-label={`Здание: ${b.name}`}
    >
      <div className="relative p-4 pb-3">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-black/15 md:hidden" />
        <div className="flex items-start gap-3.5">
          <KindArt kind={b.kind} size={72} />
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex flex-wrap items-center gap-x-1.5 text-xs font-semibold">
              <span style={{ color: district.color }}>{district.name}</span>
              <span className="text-[var(--color-faint)]">·</span>
              <span className="text-[var(--color-muted)]">{KIND_LABEL[b.kind]}</span>
            </div>
            <h3 className="mt-0.5 font-display text-[19px] leading-snug font-bold">{b.name}</h3>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                style={{ color: STATUS_COLOR[b.status], background: `${STATUS_COLOR[b.status]}1f` }}
              >
                {locked && <LockIcon width={12} height={12} />}
                {STATUS_LABEL[b.status]}
              </span>
              {b.landmark && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">★ Достопримечательность</span>
              )}
            </div>
          </div>
          <button className="btn-flat !h-9 !w-9 shrink-0 !px-0" onClick={() => selectBuilding(null)} aria-label="Закрыть карточку">
            <CloseIcon />
          </button>
        </div>
      </div>

      <div className="scroll-thin min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
        <p className="text-[14px] leading-relaxed text-[#3a4554]">{b.description}</p>

        {locked ? (
          <div className="flex gap-3 rounded-2xl bg-amber-50 p-4 text-amber-900">
            <LockIcon width={20} height={20} className="mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-semibold">Внутрь пока не попасть</div>
              <p className="mt-1 text-[13px] leading-relaxed text-amber-900/75">
                Что внутри, никто не знает. Такие здания будут открываться через городские события и исследования жителей.
              </p>
            </div>
          </div>
        ) : (
          <>
            <dl className="grid grid-cols-3 gap-2">
              <div className="stat">
                <dt className="label"><RulerIcon width={14} height={14} /> Высота</dt>
                <dd className="value">{Math.round(b.height)} м</dd>
              </div>
              <div className="stat">
                <dt className="label"><StairsIcon width={14} height={14} /> Этажей</dt>
                <dd className="value">{b.floors || 'нет'}</dd>
              </div>
              <div className="stat">
                <dt className="label"><CalendarIcon width={14} height={14} /> Построено</dt>
                <dd className="value">{b.founded}</dd>
              </div>
            </dl>
            <div className="rounded-2xl bg-[var(--color-soft)] p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 font-medium text-[var(--color-muted)]">
                  <PeopleIcon width={16} height={16} /> {peopleLabel}
                </span>
                <span className="font-display font-semibold tabular-nums">
                  {fmt.format(b.occupancy)} <span className="text-[var(--color-faint)]">из {fmt.format(b.capacity)}</span>
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10">
                <div className="h-full rounded-full transition-all" style={{ width: `${fill * 100}%`, background: district.color }} />
              </div>
            </div>
            {b.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {b.tags.map((t) => (
                  <span key={t} className="rounded-full border border-[var(--color-line)] px-2.5 py-1 text-xs font-medium text-[var(--color-muted)]">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-[var(--color-line)] p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <button className="btn-flat" onClick={() => cycleBuilding(-1)} aria-label="Предыдущее здание">
          <ChevronLeft width={18} height={18} /> <span className="hidden sm:inline">Назад</span>
        </button>
        <span className="text-xs text-[var(--color-faint)] tabular-nums">
          {index + 1} из {list.length}
        </span>
        <button className="btn-flat" onClick={() => cycleBuilding(1)} aria-label="Следующее здание">
          <span className="hidden sm:inline">Дальше</span> <ChevronRight width={18} height={18} />
        </button>
        <button className="btn-primary ml-auto" onClick={focus}>
          <ZoomIcon width={18} height={18} /> Приблизить
        </button>
      </div>
    </aside>
  )
}
