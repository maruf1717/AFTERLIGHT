import { useEffect, useState } from 'react'
import { DISTRICT_BY_ID } from '../../data/city'
import { RESERVED_LOTS } from '../../data/lots'
import { BUSINESS_COLORS, BUSINESS_TYPES, UPGRADES, type BusinessType } from '../../game/catalog'
import { businessEconomics, economyNow } from '../../game/sim'
import { useBalance, useGame, useMe } from '../../game/store'
import { useCity } from '../../store/cityStore'
import { KindArt } from '../art'
import { Bar, fmt, Money, Section, Stars } from './common'

const TYPE_ART: Record<BusinessType, 'cafe' | 'shop' | 'hotel' | 'business' | 'warehouse'> = {
  coffee: 'cafe',
  diner: 'business',
  restaurant: 'hotel',
  store: 'shop',
  service: 'warehouse',
}

export const preselect = { lot: '' }

export function BusinessPanel() {
  const me = useMe()
  const config = useGame((s) => s.config)
  const has = me.business && me.business.openedAt >= config.startedAt
  return <div className="p-4">{has ? <MyBusiness /> : <OpenBusiness />}</div>
}

function OpenBusiness() {
  const me = useMe()
  const config = useGame((s) => s.config)
  const accounts = useGame((s) => s.accounts)
  const uid = useGame((s) => s.uid)
  const balance = useBalance()
  const open = useGame((s) => s.openBusiness)
  const [type, setType] = useState<BusinessType>('coffee')
  const [name, setName] = useState('')
  const [color, setColor] = useState(BUSINESS_COLORS[0])
  const [price, setPrice] = useState<1 | 2 | 3>(2)
  const openStage = useGame((s) => s.city?.openStage ?? 0)
  const freeLots = RESERVED_LOTS.filter(
    (l) =>
      l.use === 'business' &&
      l.parcel.stage <= openStage &&
      !Object.values(accounts).some((a) => a.uid !== uid && a.business?.lot === l.key),
  ).sort((a, b) => (a.key === preselect.lot ? -1 : b.key === preselect.lot ? 1 : a.parcel.order - b.parcel.order))
  const [lot, setLot] = useState(preselect.lot && freeLots.some((l) => l.key === preselect.lot) ? preselect.lot : freeLots[0]?.key ?? '')
  useEffect(() => {
    preselect.lot = ''
  }, [])
  const def = BUSINESS_TYPES.find((b) => b.id === type)!
  const nameOk = name.trim().length >= 2
  const repOk = config.soloMode || me.rep >= config.businessRep

  return (
    <div className="space-y-5">
      <div className="rounded-3xl bg-gradient-to-br from-[#fde9cf] to-[#fff6ea] p-4">
        <div className="font-display text-lg font-bold">Открой своё заведение</div>
        <p className="mt-1 text-[13px] leading-relaxed text-[#6b5a4a]">
          Жители будут заходить к тебе каждый день. Выручку собираешь сам. Чем ближе к домам, чем доступнее цены и чем уютнее место, тем больше гостей.
        </p>
        {!repOk && (
          <div className="mt-3 rounded-2xl bg-white/80 p-3 text-sm">
            <div className="font-semibold">Нужна репутация {config.businessRep}</div>
            <div className="mt-1 text-xs text-[var(--color-muted)]">Репутация растёт за выполненные задания и крупные взносы. Сейчас у тебя {me.rep}.</div>
            <div className="mt-2">
              <Bar value={me.rep / config.businessRep} color="#d9772b" />
            </div>
          </div>
        )}
      </div>

      <Section title="1. Что открываем">
        <div className="grid grid-cols-1 gap-2">
          {BUSINESS_TYPES.map((b) => (
            <button
              key={b.id}
              onClick={() => setType(b.id)}
              className={`flex items-center gap-3 rounded-2xl border p-2.5 text-left transition ${type === b.id ? 'border-[var(--color-ink)] bg-[var(--color-soft)]' : 'border-[var(--color-line)] hover:bg-[var(--color-soft)]'}`}
            >
              <KindArt kind={TYPE_ART[b.id]} size={44} />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2 text-sm font-semibold">
                  {b.label}
                  <Money value={b.openCost} size={13} />
                </div>
                <div className="text-xs leading-snug text-[var(--color-muted)]">{b.description}</div>
              </div>
            </button>
          ))}
        </div>
      </Section>

      <Section title="2. Название и цвет">
        <label htmlFor="biz-name" className="sr-only">
          Название
        </label>
        <input
          id="biz-name"
          value={name}
          maxLength={32}
          onChange={(e) => setName(e.target.value)}
          placeholder="Придумай название"
          aria-invalid={!nameOk}
          className={`h-11 w-full rounded-xl px-3 text-sm outline-none focus:ring-2 ${nameOk ? 'bg-[var(--color-soft)] focus:ring-[var(--color-brand)]' : 'border-2 border-[#d93a2f] bg-[#fdecea] focus:ring-[#d93a2f]'}`}
        />
        {!nameOk && <p className="text-xs font-semibold text-[#d93a2f]">Без названия открыть нельзя. Нужно хотя бы 2 буквы.</p>}
        <div className="flex flex-wrap gap-2">
          {BUSINESS_COLORS.map((c) => (
            <button key={c} onClick={() => setColor(c)} aria-label={`Цвет ${c}`} className="h-9 w-9 rounded-full border-2" style={{ background: c, borderColor: color === c ? '#2f63c9' : '#d5d9de' }} />
          ))}
        </div>
      </Section>

      <Section title="3. Цены">
        <div className="grid grid-cols-3 gap-2">
          {([1, 2, 3] as const).map((p) => (
            <button key={p} onClick={() => setPrice(p)} className={`rounded-2xl border p-2 text-center ${price === p ? 'border-[var(--color-ink)] bg-[var(--color-soft)]' : 'border-[var(--color-line)]'}`}>
              <div className="text-sm font-semibold">{['Низкие', 'Средние', 'Высокие'][p - 1]}</div>
              <div className="text-xs text-[var(--color-muted)]">чек {def.check[p - 1]}</div>
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--color-muted)]">Низкие цены приводят больше гостей, высокие дают больше с каждого.</p>
      </Section>

      <Section
        title="4. Место"
        aside={
          <button
            className="text-xs font-semibold text-[var(--color-brand)]"
            onClick={() => {
              useCity.getState().setPickPlot(true)
              useGame.getState().setPanel(null)
              useGame.getState().setSidebar(false)
            }}
          >
            Выбрать на карте →
          </button>
        }
      >
        {freeLots.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">Все участки заняты. Новые появятся, когда город вырастет.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {freeLots.map((l) => (
              <button
                key={l.key}
                onClick={() => setLot(l.key)}
                className={`rounded-2xl border p-2.5 text-left ${lot === l.key ? 'border-[var(--color-ink)] bg-[var(--color-soft)]' : 'border-[var(--color-line)]'}`}
              >
                <div className="text-sm font-semibold">{DISTRICT_BY_ID[l.district].name}</div>
                <div className="text-xs text-[var(--color-muted)]">
                  участок {Math.round(l.parcel.w)}×{Math.round(l.parcel.d)} м
                  {l.district === 'residential' ? ' · рядом с домами' : l.district === 'downtown' ? ' · среди офисов' : ' · у заводов'}
                </div>
              </button>
            ))}
          </div>
        )}
      </Section>

      <button
        className="btn-primary w-full"
        disabled={!repOk || !lot || !nameOk || balance < def.openCost}
        onClick={() => {
          if (!nameOk) return
          void open({ type, name: name.trim(), color, price, lot })
        }}
      >
        Открыть за {fmt.format(def.openCost)} Искр
      </button>
      {!nameOk && <p className="text-center text-xs font-semibold text-[#d93a2f]">Сначала впиши название заведения.</p>}
      {balance < def.openCost && <p className="text-center text-xs text-[var(--color-muted)]">У тебя {fmt.format(balance)}. Не хватает {fmt.format(def.openCost - balance)}.</p>}
    </div>
  )
}

function MyBusiness() {
  const me = useMe()
  const uid = useGame((s) => s.uid)
  const city = useGame((s) => s.city)
  const accounts = useGame((s) => s.accounts)
  const balance = useBalance()
  const collect = useGame((s) => s.collect)
  const buy = useGame((s) => s.buyUpgrade)
  const update = useGame((s) => s.updateBusiness)
  const showOnMap = useGame((s) => s.showOnMap)
  const [edit, setEdit] = useState(false)
  const [name, setName] = useState(me.business?.name ?? '')
  if (!me.business || !city) return null
  const biz = me.business
  const eco = businessEconomics(uid, biz, economyNow(city, accounts))
  const pending = Math.floor(biz.pending)
  const def = BUSINESS_TYPES.find((b) => b.id === biz.type)!

  return (
    <div className="space-y-5">
      <div className="rounded-3xl p-4 text-white" style={{ background: `linear-gradient(140deg, ${biz.color}, #17202b)` }}>
        <div className="text-xs font-semibold opacity-80">{def.label} · {DISTRICT_BY_ID[RESERVED_LOTS.find((l) => l.key === biz.lot)!.district].name}</div>
        <div className="mt-0.5 font-display text-2xl font-bold">{biz.name}</div>
        <div className="mt-2 flex items-center gap-2 text-sm">
          <Stars value={Math.round(eco.rating.avg)} size={16} /> <span className="opacity-80">{eco.rating.count ? `${eco.rating.avg.toFixed(1)} · ${eco.rating.count} оценок` : 'пока без оценок'}</span>
        </div>
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-white/15 p-3">
          <div>
            <div className="text-xs opacity-80">Накопилось выручки</div>
            <div className="font-display text-xl font-bold tabular-nums">+{fmt.format(pending)}</div>
          </div>
          <button className="btn !h-10 !text-[var(--color-ink)]" onClick={() => void collect()}>
            Собрать
          </button>
        </div>
        <p className="mt-2 text-xs opacity-75">Касса копит не больше трёх игровых дней. Заходи почаще.</p>
      </div>

      <Section title="За один игровой день">
        <dl className="grid grid-cols-2 gap-2">
          <div className="stat">
            <dt className="label">Гостей</dt>
            <dd className="value">{fmt.format(eco.visits)}</dd>
          </div>
          <div className="stat">
            <dt className="label">Средний чек</dt>
            <dd className="value">{eco.check}</dd>
          </div>
          <div className="stat">
            <dt className="label">Выручка</dt>
            <dd className="value">{fmt.format(eco.revenue)}</dd>
          </div>
          <div className="stat">
            <dt className="label">Аренда и зарплаты</dt>
            <dd className="value">−{fmt.format(eco.upkeep)}</dd>
          </div>
        </dl>
        <div className={`rounded-2xl p-3 text-sm font-semibold ${eco.profit >= 0 ? 'bg-[#e9f5ec] text-[#1f6b3a]' : 'bg-red-50 text-red-800'}`}>
          Прибыль: {eco.profit >= 0 ? '+' : ''}
          {fmt.format(eco.profit)} в день
        </div>
        {eco.power && <p className="text-xs text-amber-800">В городе не хватает электричества, гостей на 40% меньше. Помоги собрать на электростанцию.</p>}
        {eco.profit < 0 && <p className="text-xs text-[var(--color-muted)]">Гостей мало. Попробуй снизить цены, купить улучшения или подожди, пока вырастет район.</p>}
      </Section>

      <Section title="Улучшения" aside={<Money value={balance} size={13} />}>
        <div className="space-y-2">
          {UPGRADES.map((u) => {
            const owned = biz.upgrades.includes(u.id)
            return (
              <div key={u.id} className="flex items-center gap-3 rounded-2xl bg-[var(--color-soft)] p-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{upgradeText(u, biz.type).label}</div>
                  <div className="text-xs text-[var(--color-muted)]">{upgradeText(u, biz.type).description}</div>
                </div>
                {owned ? (
                  <span className="text-xs font-semibold text-[#1f8a4c]">Есть</span>
                ) : (
                  <button className="btn-primary !h-9 !px-3 !text-[13px]" disabled={balance < u.cost} onClick={() => void buy(u.id)}>
                    {fmt.format(u.cost)}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </Section>

      <Section title="Настройки">
        <div className="grid grid-cols-3 gap-2">
          {([1, 2, 3] as const).map((p) => (
            <button key={p} onClick={() => void update({ price: p })} className={`rounded-2xl border p-2 text-center text-sm font-semibold ${biz.price === p ? 'border-[var(--color-ink)] bg-[var(--color-soft)]' : 'border-[var(--color-line)]'}`}>
              {['Низкие', 'Средние', 'Высокие'][p - 1]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {BUSINESS_COLORS.map((c) => (
            <button key={c} onClick={() => void update({ color: c })} aria-label={`Цвет ${c}`} className="h-9 w-9 rounded-full border-2" style={{ background: c, borderColor: biz.color === c ? '#2f63c9' : '#d5d9de' }} />
          ))}
        </div>
        {edit ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (name.trim().length < 2) return
              void update({ name: name.trim() })
              setEdit(false)
            }}
          >
            <label htmlFor="biz-rename" className="sr-only">
              Новое название
            </label>
            <input id="biz-rename" value={name} maxLength={32} onChange={(e) => setName(e.target.value)} className="h-10 flex-1 rounded-xl bg-[var(--color-soft)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand)]" />
            <button className="btn-primary !h-10" type="submit">
              Сохранить
            </button>
          </form>
        ) : (
          <div className="flex gap-2">
            <button className="btn-flat" onClick={() => setEdit(true)}>
              Переименовать
            </button>
            <button className="btn-flat" onClick={() => showOnMap(`biz:${uid}`)}>
              Показать на карте
            </button>
          </div>
        )}
        <p className="text-xs text-[var(--color-muted)]">Всего заработано: {fmt.format(biz.totalEarned)} Искр.</p>
      </Section>
    </div>
  )
}

/** The same upgrade reads differently for a garage or a grocery than for a cafe. */
function upgradeText(u: (typeof UPGRADES)[number], type: BusinessType) {
  if (type === 'service') {
    if (u.id === 'terrace') return { label: 'Зона ожидания', description: 'Навес, скамейка и автомат с напитками для клиентов. +15% клиентов.' }
    if (u.id === 'drivethru') return { label: 'Окно приёмки', description: 'Машину можно сдать, не выходя из неё. +15% клиентов.' }
  }
  if (type === 'store') {
    if (u.id === 'terrace') return { label: 'Уличный прилавок', description: 'Фрукты и цветы прямо у входа. +15% покупателей.' }
    if (u.id === 'drivethru') return { label: 'Окно выдачи заказов', description: 'Заказал заранее, забрал из машины. +15% покупателей.' }
  }
  return { label: u.label, description: u.description }
}
