import { useState } from 'react'
import { donorThreshold, NEED_BY_ID, PROJECT_BY_ID, PROJECTS, type NeedId, type ProjectDef } from '../../game/catalog'
import { useBalance, useGame } from '../../game/store'
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
      {city.voteBonus && PROJECT_BY_ID[city.voteBonus] && !city.projects[city.voteBonus].completedAt && (
        <div className="rounded-2xl bg-[#eef3fb] p-3 text-[13px] leading-snug">
          <b>Выбор жителей: {PROJECT_BY_ID[city.voteBonus].name}.</b> По итогам опроса «Что городу нужнее всего» сутки город добавляет 10% к каждому взносу в этот проект.
        </div>
      )}
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
  const showOnMap = useGame((s) => s.showOnMap)
  const mine = useGame((s) => s.accounts[s.uid]?.donations.some((d) => d.p === p.id))
  const [custom, setCustom] = useState('')
  const [confirm, setConfirm] = useState<number | null>(null)
  const [started, setStarted] = useState(false)
  if (!st) return null
  const done = !!st.completedAt
  const left = Math.max(0, p.cost - st.funded)
  // A project without its own plot (the plant repair) is shown on the building it upgrades.
  const obj =
    objects.find((o) => o.id === `civic:${p.id}` || o.id === `build:${p.id}` || (o.meta?.type === 'lot' && o.meta.projectId === p.id)) ??
    (p.lot ? undefined : objects.find((o) => o.kind === 'plant'))
  const needDonors = config.requireDonors && !config.soloMode
  const trimmed = custom.trim()
  const customValue = /^\d+$/.test(trimmed) ? Number(trimmed) : 0
  const customError = trimmed === '' ? null : !/^\d+$/.test(trimmed) ? 'Только целое число' : customValue <= 0 ? 'Больше нуля' : customValue > balance ? 'Не хватает Искр' : null
  const customOk = trimmed !== '' && !customError
  /** Big amounts (over 1000 or over half of what I have) need a second tap. */
  const give = async (amount: number, confirmed = false) => {
    const amt = Math.min(amount, left)
    if (!confirmed && (amt > 1000 || amt > balance / 2)) {
      setConfirm(amt)
      return
    }
    setConfirm(null)
    const first = !mine
    const ok = await donate(p.id, amt)
    if (ok) {
      setCustom('')
      if (first) setStarted(true)
    }
  }
  const donorsOk = !needDonors || st.donors >= p.minDonors

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
            {needDonors && (
              <span className={`tabular-nums ${donorsOk ? 'text-[#1f8a4c]' : 'text-[var(--color-muted)]'}`}>
                участников {st.donors} из {p.minDonors} (от {fmt.format(donorThreshold(p.cost))})
              </span>
            )}
          </div>
          <Bar value={st.funded / p.cost} color="#d9772b" />
          {st.funded >= p.cost && !donorsOk && (
            <p className="mt-1.5 text-xs text-amber-800">Деньги собраны, но нужно больше разных участников. Участником считается тот, кто вложил хотя бы {fmt.format(donorThreshold(p.cost))} Искр.</p>
          )}
          {st.available && confirm !== null && (
            <div className="mt-3 rounded-2xl bg-[#fff6e8] p-3">
              <p className="text-sm font-semibold">
                Вложить {fmt.format(confirm)} {sparks(confirm)} в «{p.name}»?
              </p>
              <div className="mt-2 flex gap-2">
                <button className="btn-primary !h-9 flex-1 !text-[13px]" onClick={() => void give(confirm, true)}>
                  Да, вложить
                </button>
                <button className="btn-flat !h-9 !text-[13px]" onClick={() => setConfirm(null)}>
                  Отмена
                </button>
              </div>
            </div>
          )}
          {st.available && confirm === null && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {[100, 500, 1000].map((a) => (
                <button key={a} className="btn-flat !h-9 !text-[13px]" disabled={balance < Math.min(a, left || 1)} onClick={() => void give(a)}>
                  +{fmt.format(a)}
                </button>
              ))}
              <form
                className="flex items-start gap-1"
                noValidate
                onSubmit={(e) => {
                  e.preventDefault()
                  if (customOk) void give(customValue)
                }}
              >
                <div>
                  <label htmlFor={`don-${p.id}`} className="sr-only">
                    Своя сумма
                  </label>
                  <input
                    id={`don-${p.id}`}
                    inputMode="numeric"
                    value={custom}
                    aria-invalid={!!customError}
                    onChange={(e) => setCustom(e.target.value)}
                    placeholder="сумма"
                    className={`h-9 w-24 rounded-xl px-2 text-[13px] outline-none focus:ring-2 ${customError ? 'border-2 border-[#d93a2f] bg-[#fdecea] focus:ring-[#d93a2f]' : 'bg-[var(--color-soft)] focus:ring-[var(--color-brand)]'}`}
                  />
                  {customError && <div className="mt-0.5 text-[11px] font-semibold text-[#d93a2f]">{customError}</div>}
                </div>
                <button className="btn-primary !h-9 !px-3 !text-[13px]" type="submit" disabled={!customOk}>
                  Вложить
                </button>
              </form>
            </div>
          )}
          {started && obj && !compact && (
            <button className="btn-flat mt-2 !h-9 !text-[13px]" onClick={() => showOnMap(obj.id)}>
              Посмотреть стройку
            </button>
          )}
        </div>
      )}
      {obj && !compact && (
        <button className="mt-2 text-xs font-semibold text-[var(--color-brand)]" onClick={() => showOnMap(obj.id)}>
          Показать на карте →
        </button>
      )}
    </div>
  )
}

const sparks = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? 'Искру' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'Искры' : 'Искр')
