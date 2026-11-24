import { useState } from 'react'
import { NEED_BY_ID, PROJECTS, type NeedId, type ProjectDef } from '../../game/catalog'
import { useBalance, useGame } from '../../game/store'
import { useCity } from '../../store/cityStore'
import { KindArt } from '../art'
import { Bar, fmt, KIND_BY_VISUAL, Money, NEED_COLOR } from './common'

export function ProjectsPanel() {
  const city = useGame((s) => s.city)
  if (!city) return null
  const rank = (p: ProjectDef) => {
    const st = city.projects[p.id]
    if (st.completedAt) return 3
    if (!st.available) return 2
    return st.funded > 0 ? 0 : 1
  }
  const list = [...PROJECTS].sort((a, b) => rank(a) - rank(b) || a.minPopulation - b.minPopulation)
  return (
    <div className="space-y-3 p-4">
      <p className="text-[13px] leading-relaxed text-[var(--color-muted)]">
        Большие здания город строит только на деньги жителей. Скидывайтесь вместе: когда сумма собрана, стройка заканчивается и здание сразу начинает работать.
      </p>
      {list.map((p) => (
        <ProjectCard key={p.id} p={p} />
      ))}
    </div>
  )
}

export function ProjectCard({ p, compact = false }: { p: ProjectDef; compact?: boolean }) {
  const st = useGame((s) => s.city?.projects[p.id])
  const config = useGame((s) => s.config)
  const donate = useGame((s) => s.donate)
  const balance = useBalance()
  const objects = useGame((s) => s.objects)
  const selectBuilding = useCity((s) => s.selectBuilding)
  const [custom, setCustom] = useState('')
  if (!st) return null
  const done = !!st.completedAt
  const left = Math.max(0, p.cost - st.funded)
  const obj = objects.find((o) => o.id === `civic:${p.id}` || o.id === `build:${p.id}` || (o.meta?.type === 'lot' && o.meta.projectId === p.id))
  const donorsOk = !config.requireDonors || st.donors >= p.minDonors

  return (
    <div className={`rounded-3xl border p-3.5 ${done ? 'border-green-200 bg-[#f1f8f3]' : 'border-[var(--color-line)] bg-white'}`}>
      <div className="flex gap-3">
        {!compact && <KindArt kind={KIND_BY_VISUAL[p.visual]} size={52} />}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="font-display text-[15px] leading-tight font-semibold">{p.name}</div>
            {done ? (
              <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">Построено</span>
            ) : !st.available ? (
              <span className="shrink-0 rounded-full bg-[var(--color-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--color-muted)]">с {fmt.format(p.minPopulation)} жит.</span>
            ) : null}
          </div>
          {!compact && <p className="mt-1 text-[13px] leading-snug text-[var(--color-muted)]">{p.description}</p>}
          <div className="mt-2 flex flex-wrap gap-1">
            {(Object.entries(p.effects) as [NeedId, number][]).map(([n, v]) => (
              <span key={n} className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${NEED_COLOR[n]}1c`, color: NEED_COLOR[n] }}>
                +{fmt.format(v)} {NEED_BY_ID[n].label.toLowerCase()}
              </span>
            ))}
          </div>
        </div>
      </div>
      {!done && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs">
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Money value={st.funded} size={13} /> <span className="text-[var(--color-muted)]">из {fmt.format(p.cost)}</span>
            </span>
            {config.requireDonors && (
              <span className={`tabular-nums ${donorsOk ? 'text-[#1f8a4c]' : 'text-[var(--color-muted)]'}`}>
                участников {st.donors} из {p.minDonors}
              </span>
            )}
          </div>
          <Bar value={st.funded / p.cost} color="#d9772b" />
          {st.funded >= p.cost && !donorsOk && (
            <p className="mt-1.5 text-xs text-amber-800">Деньги собраны, но нужно больше разных участников. Позови друзей вложить хотя бы по 1 Искре.</p>
          )}
          {st.available && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {[100, 500, 1000].map((a) => (
                <button key={a} className="btn-flat !h-9 !text-[13px]" disabled={balance < Math.min(a, left || 1)} onClick={() => void donate(p.id, a)}>
                  +{fmt.format(a)}
                </button>
              ))}
              <form
                className="flex items-center gap-1"
                onSubmit={(e) => {
                  e.preventDefault()
                  const v = Math.floor(Number(custom))
                  if (v > 0) void donate(p.id, v).then((ok) => ok && setCustom(''))
                }}
              >
                <label htmlFor={`don-${p.id}`} className="sr-only">
                  Своя сумма
                </label>
                <input
                  id={`don-${p.id}`}
                  inputMode="numeric"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value.replace(/\D/g, ''))}
                  placeholder="сумма"
                  className="h-9 w-20 rounded-xl bg-[var(--color-soft)] px-2 text-[13px] outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
                />
                <button className="btn-primary !h-9 !px-3 !text-[13px]" type="submit">
                  Вложить
                </button>
              </form>
            </div>
          )}
        </div>
      )}
      {obj && !compact && (
        <button className="mt-2 text-xs font-semibold text-[var(--color-brand)]" onClick={() => selectBuilding(obj.id)}>
          Показать на карте →
        </button>
      )}
    </div>
  )
}
