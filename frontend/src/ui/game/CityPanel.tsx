import { NEED_BY_ID, NEEDS, PLAYER_BUILDING_BY_ID, PROJECTS, type NeedId } from '../../game/catalog'
import { nextNeed, useGame } from '../../game/store'
import { Bar, NEED_COLOR, Section, Sparkline, fmt, fmtSigned } from './common'

function needLine(id: NeedId, supply: number, demand: number) {
  if (id === 'housing') return `${fmt.format(Math.round(supply - demand))} свободных мест`
  return `${fmt.format(Math.round(supply))} из ${fmt.format(Math.round(demand))}`
}

export function CityPanel() {
  const city = useGame((s) => s.city)
  const setPanel = useGame((s) => s.setPanel)
  if (!city) return <div className="p-6 text-sm text-[var(--color-muted)]">Город загружается…</div>

  const next = city.level.next
  const toNext = next ? (city.population - city.level.from) / (next.from - city.level.from) : 1
  const minutesLeft = Math.max(1, Math.ceil(((1 - city.dayProgress) * city.dayMs) / 60_000))
  // Projects that help: the ones open right now first; closed ones are shown greyed with their threshold.
  const helpFor = (need: NeedId) =>
    PROJECTS.filter((p) => (p.effects[need] ?? 0) > 0 && !city.projects[p.id].completedAt)
      .sort((a, b) => Number(city.projects[b.id].available) - Number(city.projects[a.id].available) || a.minPopulation - b.minPopulation)
      .slice(0, 2)
  const problems = [...city.crises.map((n) => ({ n, crisis: true })), ...city.warnings.map((n) => ({ n, crisis: false }))]

  return (
    <div className="space-y-5 p-4">
      <div className="rounded-3xl bg-gradient-to-br from-[#fbe3c4] to-[#f6efe4] p-4">
        <div className="flex items-baseline justify-between">
          <div className="text-xs font-semibold text-[#a0582c]">{city.level.name} · день {city.day}</div>
          <div className="text-xs text-[#7a6250]">новый день через {minutesLeft} мин</div>
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <div className="font-display text-4xl font-bold tabular-nums">{fmt.format(city.population)}</div>
          <div className="text-sm text-[#6b5a4a]">жителей</div>
        </div>
        {next && (
          <div className="mt-3">
            <Bar value={toNext} color="#d9772b" />
            <div className="mt-1 text-xs text-[#6b5a4a]">
              До уровня «{next.name}» ещё {fmt.format(Math.max(0, next.from - city.population))} жителей
            </div>
          </div>
        )}
        <div className="mt-3">
          <Sparkline data={city.history} color="#d9772b" />
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-white/70 p-2">
            <div className="text-[11px] text-[#6b5a4a]">Счастье</div>
            <div className="font-display text-lg font-semibold tabular-nums">{city.happiness}%</div>
          </div>
          <div className="rounded-2xl bg-white/70 p-2">
            <div className="text-[11px] text-[#6b5a4a]">Приезжают</div>
            <div className="font-display text-lg font-semibold text-[#1f8a4c] tabular-nums">{fmtSigned(city.inflow)}</div>
          </div>
          <div className="rounded-2xl bg-white/70 p-2">
            <div className="text-[11px] text-[#6b5a4a]">Уезжают</div>
            <div className="font-display text-lg font-semibold text-[#b3261e] tabular-nums">{fmtSigned(city.outflow, 1, 'minus')}</div>
          </div>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-[#6b5a4a]">
          За день. Каждый житель, который сегодня выполнил задание, приводит в город новых людей. Сегодня активны: {city.activeToday}.
        </p>
      </div>

      <GrowthGuide />

      {nextNeed(city) && (
        <button className="flex w-full items-center justify-between gap-2 rounded-2xl bg-[#eef3fb] p-3 text-left" onClick={() => setPanel('projects')}>
          <span className="text-sm">
            <span className="block text-xs text-[var(--color-muted)]">Следующее, что нужно городу</span>
            <span className="font-semibold">{nextNeed(city)!.name}</span>
          </span>
          <span className="text-sm font-semibold text-[var(--color-brand)]">→</span>
        </button>
      )}

      {problems.length > 0 && (
        <Section title="Что сейчас плохо">
          <div className="space-y-2">
            {problems.map(({ n, crisis }) => (
              <div key={n} className={`rounded-2xl p-3 ${crisis ? 'bg-red-50 text-red-900' : 'bg-amber-50 text-amber-900'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold">
                    {crisis ? 'Кризис' : 'Не хватает'}: {NEED_BY_ID[n].label.toLowerCase()}
                  </div>
                  <span className="text-xs font-semibold tabular-nums">{Math.round(city.needs[n].ratio * 100)}%</span>
                </div>
                <p className="mt-1 text-[13px] leading-snug opacity-80">{NEED_BY_ID[n].crisis}</p>
                {helpFor(n).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {helpFor(n).map((p) =>
                      city.projects[p.id].available ? (
                        <button key={p.id} className="rounded-full bg-white px-3 py-1 text-xs font-semibold shadow-sm" onClick={() => setPanel('projects')}>
                          Поможет: {p.name} →
                        </button>
                      ) : (
                        <span key={p.id} className="rounded-full bg-white/60 px-3 py-1 text-xs font-semibold text-black/40">
                          {p.name}: откроется при {fmt.format(p.minPopulation)} жителей
                        </span>
                      ),
                    )}
                  </div>
                )}
                {n === 'food' && (
                  <button className="mt-2 rounded-full bg-white px-3 py-1 text-xs font-semibold shadow-sm" onClick={() => setPanel('business')}>
                    Открой магазин или кафе →
                  </button>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Потребности города">
        <div className="space-y-3">
          {NEEDS.map((n) => {
            const st = city.needs[n.id]
            const ratio = n.id === 'housing' ? Math.min(1, (st.supply - st.demand) / Math.max(10, st.demand * 0.2)) : st.ratio
            const color = ratio < 0.5 ? '#d14b4b' : ratio < 0.8 ? '#e0a526' : NEED_COLOR[n.id]
            return (
              <div key={n.id}>
                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <span className="font-medium">{n.label}</span>
                  <span className="text-xs text-[var(--color-muted)] tabular-nums">{needLine(n.id, st.supply, st.demand)}</span>
                </div>
                <Bar value={n.id === 'housing' ? Math.max(0.05, ratio) : st.ratio} color={color} h={7} />
              </div>
            )
          })}
        </div>
      </Section>
    </div>
  )
}

function realTime(ms: number) {
  const m = Math.max(1, Math.round(ms / 60_000))
  if (m < 60) return `${m} мин`
  const h = Math.round(m / 60)
  return h < 48 ? `${h} ч` : `${Math.round(h / 24)} дн`
}

/** What actually makes the city grow, with the numbers of this city and a button for each. */
function GrowthGuide() {
  const city = useGame((s) => s.city)!
  const config = useGame((s) => s.config)
  const setPanel = useGame((s) => s.setPanel)
  const free = Math.max(0, Math.round(city.needs.housing.supply - city.population))
  const net = city.inflow - city.outflow
  const next = city.level.next
  const full = free < Math.max(3, city.inflow)
  const eta = next && net > 0.05 && !full ? realTime(((next.from - city.population) / net) * city.dayMs) : null
  const house = PLAYER_BUILDING_BY_ID.house
  const lowrise = PLAYER_BUILDING_BY_ID.lowrise
  const perActive = config?.perActive ?? 4
  const steps = [
    {
      icon: '🏠',
      title: full ? 'Город упёрся в жильё — строй дома' : 'Жильё',
      text: full
        ? `Свободных мест: ${fmt.format(free)}. Пока их нет, новые люди не приезжают. Дом даёт +${house.effects.housing} мест, малоэтажка +${lowrise.effects.housing}.`
        : `Свободно ${fmt.format(free)} мест. Когда они кончатся, рост остановится: заранее строй дома (+${house.effects.housing}) и малоэтажки (+${lowrise.effects.housing}).`,
      go: 'build' as const,
      btn: 'Стройка',
      hot: full,
    },
    {
      icon: '✅',
      title: 'Задания каждый день',
      text: `Каждый житель, который сегодня сделал задание, приводит +${perActive} человек в день. Сегодня активны: ${city.activeToday}. Позови друзей — каждый новый активный житель ускоряет рост.`,
      go: 'tasks' as const,
      btn: 'Задания',
      hot: city.activeToday === 0,
    },
    {
      icon: '🙂',
      title: `Счастье ${city.happiness}%`,
      text: 'Из приезжающих остаётся столько процентов, какое счастье. Его поднимают проекты: свет, вода, врачи, школа, парк. При кризисе люди ещё и уезжают.',
      go: 'projects' as const,
      btn: 'Проекты',
      hot: city.happiness < 70 || city.crises.length > 0,
    },
  ]
  return (
    <Section title="Как вырастить город">
      <div className="space-y-2">
        <div className="rounded-2xl bg-[var(--color-soft)] p-3 text-[13px] leading-snug">
          {next ? (
            eta ? (
              <>
                Сейчас прибавляется {fmtSigned(net)} жителей за игровой день. До «{next.name}» примерно <b>{eta}</b> реального времени.
              </>
            ) : full ? (
              <>Рост стоит: нет свободного жилья.</>
            ) : (
              <>Город сейчас не растёт: людей приезжает не больше, чем уезжает.</>
            )
          ) : (
            <>Город достиг высшего уровня.</>
          )}{' '}
          Уровни: Посёлок → Городок (400) → Город (800) → Большой город (1600). С уровня «Городок» можно держать третье заведение.
        </div>
        {steps.map((s) => (
          <div key={s.go} className={`flex items-start gap-3 rounded-2xl border p-3 ${s.hot ? 'border-[#d9772b] bg-[#fff6ec]' : 'border-[var(--color-line)]'}`}>
            <div className="text-xl leading-none">{s.icon}</div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{s.title}</div>
              <div className="mt-0.5 text-xs leading-snug text-[var(--color-muted)]">{s.text}</div>
            </div>
            <button className="btn-flat !h-8 shrink-0 !px-2.5 !text-xs" onClick={() => setPanel(s.go)}>
              {s.btn}
            </button>
          </div>
        ))}
      </div>
    </Section>
  )
}
