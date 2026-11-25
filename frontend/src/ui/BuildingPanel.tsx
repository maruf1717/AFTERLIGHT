import { useMemo } from 'react'
import { DISTRICT_BY_ID } from '../data/city'
import { KIND_LABEL, STATUS_COLOR, STATUS_LABEL } from '../data/kinds'
import type { Building } from '../data/types'
import { BUSINESS_TYPE_BY_ID, PROJECT_BY_ID } from '../game/catalog'
import { buildingSupply, businessEconomics, economyNow } from '../game/sim'
import { displayName, useGame, useMe } from '../game/store'
import { useCity } from '../store/cityStore'
import { KindArt } from './art'
import { preselect } from './game/BusinessPanel'
import { fmt, Stars } from './game/common'
import { ProjectCard } from './game/ProjectsPanel'
import { CalendarIcon, ChevronLeft, ChevronRight, CloseIcon, LockIcon, PeopleIcon, RulerIcon, StairsIcon, ZoomIcon } from './icons'

export function BuildingPanel() {
  const id = useCity((s) => s.selectedBuildingId)
  const selectBuilding = useCity((s) => s.selectBuilding)
  const cycleBuilding = useCity((s) => s.cycleBuilding)
  const focus = useCity((s) => s.focus)
  const b = useGame((s) => (id ? s.objectById[id] : undefined))
  const objects = useGame((s) => s.objects)
  const list = useMemo(() => (b ? objects.filter((o) => o.districtId === b.districtId) : []), [objects, b])
  if (!b) return null

  const district = DISTRICT_BY_ID[b.districtId]
  const index = list.findIndex((x) => x.id === b.id)
  const locked = b.status === 'locked'
  const statusLabel = b.kind === 'lot' ? 'Свободно' : b.kind === 'construction' ? 'Идёт стройка' : STATUS_LABEL[b.status]

  return (
    <aside
      key={b.id}
      className="panel anim-sheet pointer-events-auto flex max-h-[64vh] w-full flex-col overflow-hidden rounded-t-[28px] !bg-white desk:max-h-[calc(100vh-7rem)] desk:w-[390px] desk:rounded-[28px] desk:!bg-[var(--color-panel)] land:h-[100dvh] land:max-h-none land:w-[min(400px,55vw)] land:rounded-none land:rounded-l-[24px]"
      aria-label={`Здание: ${b.name}`}
    >
      <div className="relative p-4 pb-3">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-black/15 desk:hidden" />
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
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ color: STATUS_COLOR[b.status], background: `${STATUS_COLOR[b.status]}1f` }}>
                {locked && <LockIcon width={12} height={12} />}
                {statusLabel}
              </span>
              {b.meta?.type === 'civic' && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">★ Построено жителями</span>}
            </div>
          </div>
          <button className="btn-flat !h-9 !w-9 shrink-0 !px-0" onClick={() => selectBuilding(null)} aria-label="Закрыть карточку">
            <CloseIcon />
          </button>
        </div>
      </div>

      <div className="scroll-thin min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
        <p className="text-[14px] leading-relaxed text-[#3a4554]">{b.description}</p>
        <GameDetails b={b} />
      </div>

      <div className="flex items-center gap-2 border-t border-[var(--color-line)] p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <button className="btn-flat" onClick={() => cycleBuilding(-1)} aria-label="Предыдущее здание">
          <ChevronLeft width={18} height={18} /> <span className="sr-only">Назад</span>
        </button>
        <span className="text-xs whitespace-nowrap text-[var(--color-faint)] tabular-nums">
          {index + 1} из {list.length}
        </span>
        <button className="btn-flat" onClick={() => cycleBuilding(1)} aria-label="Следующее здание">
          <span className="sr-only">Дальше</span> <ChevronRight width={18} height={18} />
        </button>
        <button className="btn-primary ml-auto" onClick={focus}>
          <ZoomIcon width={18} height={18} /> Приблизить
        </button>
      </div>
    </aside>
  )
}

function GameDetails({ b }: { b: Building }) {
  const city = useGame((s) => s.city)
  const accounts = useGame((s) => s.accounts)
  useGame((s) => s.names)
  const uid = useGame((s) => s.uid)
  const setPanel = useGame((s) => s.setPanel)
  const rate = useGame((s) => s.rate)
  const me = useMe()
  const target = me.daily.target === b.id && !me.daily.done.includes('delivery')
  if (!city) return null
  const meta = b.meta

  if (meta?.type === 'construction' || (meta?.type === 'lot' && meta.use === 'civic' && meta.projectId)) {
    const pid = meta.type === 'construction' ? meta.projectId : meta.projectId!
    return <ProjectCard p={PROJECT_BY_ID[pid]} compact />
  }
  if (meta?.type === 'lot' && meta.use === 'business') {
    return (
      <div className="rounded-2xl bg-[#e9f5ec] p-3">
        <div className="text-sm font-semibold text-[#1f6b3a]">Здесь можно открыть своё заведение</div>
        <p className="mt-1 text-[13px] text-[#1f6b3a]/80">Кофейня, магазин, ресторан или автосервис. Название и цвет выбираешь сам.</p>
        <button
          className="btn-primary mt-2 !h-9"
          onClick={() => {
            preselect.lot = meta.lotKey
            setPanel('business')
          }}
        >
          Открыть бизнес здесь
        </button>
      </div>
    )
  }
  if (meta?.type === 'business') {
    const biz = accounts[meta.owner]?.business
    if (!biz) return null
    const eco = businessEconomics(meta.owner, biz, economyNow(city, accounts))
    const own = meta.owner === uid
    return (
      <div className="space-y-3">
        <dl className="grid grid-cols-3 gap-2">
          <div className="stat">
            <dt className="label">Владелец</dt>
            <dd className="truncate text-sm font-semibold">{displayName(meta.owner)}</dd>
          </div>
          <div className="stat">
            <dt className="label">Гостей в день</dt>
            <dd className="value">{fmt.format(eco.visits)}</dd>
          </div>
          <div className="stat">
            <dt className="label">Рейтинг</dt>
            <dd className="value">{eco.rating.count ? eco.rating.avg.toFixed(1) : '—'}</dd>
          </div>
        </dl>
        <div className="text-xs text-[var(--color-muted)]">
          {BUSINESS_TYPE_BY_ID[biz.type].label} · цены {['низкие', 'средние', 'высокие'][biz.price - 1]} · средний чек {eco.check}
        </div>
        {own ? (
          <button className="btn-primary !h-9" onClick={() => setPanel('business')}>
            Управлять
          </button>
        ) : (
          <div className="flex items-center justify-between rounded-2xl bg-[var(--color-soft)] p-3">
            <span className="text-sm font-semibold">Твоя оценка</span>
            <Stars value={me.ratings[meta.owner] ?? 0} onChange={(v) => void rate(meta.owner, v)} />
          </div>
        )}
      </div>
    )
  }
  if (meta?.type === 'civic') {
    const p = PROJECT_BY_ID[meta.projectId]
    return (
      <div className="rounded-2xl bg-[#f1f8f3] p-3 text-[13px] text-[#1f6b3a]">
        Построено на деньги жителей. Работает с {new Date(city.projects[p.id].completedAt!).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}.
      </div>
    )
  }

  // Ordinary building: show its share of the simulated city.
  if (b.status === 'locked') {
    return (
      <div className="flex gap-3 rounded-2xl bg-amber-50 p-4 text-amber-900">
        <LockIcon width={20} height={20} className="mt-0.5 shrink-0" />
        <div>
          <div className="text-sm font-semibold">Внутрь пока не попасть</div>
          <p className="mt-1 text-[13px] leading-relaxed text-amber-900/75">Что внутри, никто не знает. Двери заперты.</p>
        </div>
      </div>
    )
  }
  const sup = buildingSupply(b)
  const housing = sup.housing ?? 0
  const jobs = sup.jobs ?? 0
  const occ = housing
    ? Math.round(housing * Math.min(1, city.population / Math.max(1, city.needs.housing.supply)))
    : Math.round(jobs * Math.min(1, (city.population * 0.5) / Math.max(1, city.needs.jobs.supply)))
  const cap = housing || jobs
  const plant = b.kind === 'plant'
  const repaired = !!city.projects['tec-repair']?.completedAt

  return (
    <div className="space-y-3">
      {target && <div className="rounded-2xl bg-[#e9f5ec] p-3 text-sm font-semibold text-[#1f6b3a]">Посылка доставлена!</div>}
      {plant && (
        <div className={`rounded-2xl p-3 text-[13px] ${repaired ? 'bg-[#f1f8f3] text-[#1f6b3a]' : 'bg-amber-50 text-amber-900'}`}>
          {repaired ? 'Станция отремонтирована и работает на полную мощность.' : 'Станция изношена. Жители собирают деньги на ремонт во вкладке «Проекты».'}
        </div>
      )}
      <dl className="grid grid-cols-3 gap-2">
        <div className="stat">
          <dt className="label">
            <RulerIcon width={14} height={14} /> Высота
          </dt>
          <dd className="value">{Math.round(b.height)} м</dd>
        </div>
        <div className="stat">
          <dt className="label">
            <StairsIcon width={14} height={14} /> Этажей
          </dt>
          <dd className="value">{b.floors || 'нет'}</dd>
        </div>
        <div className="stat">
          <dt className="label">
            <CalendarIcon width={14} height={14} /> Построено
          </dt>
          <dd className="value">{b.founded}</dd>
        </div>
      </dl>
      {cap > 0 && (
        <div className="rounded-2xl bg-[var(--color-soft)] p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 font-medium text-[var(--color-muted)]">
              <PeopleIcon width={16} height={16} /> {housing ? 'Живут здесь' : 'Работают здесь'}
            </span>
            <span className="font-display font-semibold tabular-nums">
              {fmt.format(occ)} <span className="text-[var(--color-faint)]">из {fmt.format(cap)}</span>
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10">
            <div className="h-full rounded-full" style={{ width: `${(occ / cap) * 100}%`, background: DISTRICT_BY_ID[b.districtId].color }} />
          </div>
        </div>
      )}
      {sup.food ? <div className="text-xs text-[var(--color-muted)]">Кормит и снабжает {fmt.format(sup.food)} жителей.</div> : null}
    </div>
  )
}
