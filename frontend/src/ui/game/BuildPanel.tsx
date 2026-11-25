import { useState } from 'react'
import { PARCEL_BY_ID } from '../../city/plan'
import { DISTRICT_BY_ID } from '../../data/city'
import { lotPrice, PLAYER_BUILDING_BY_ID, PLAYER_BUILDINGS, type PlayerBuildingId } from '../../game/catalog'
import { rushCost, type Property } from '../../game/sim'
import { displayName, useBalance, useGame } from '../../game/store'
import { useCity } from '../../store/cityStore'
import { Bar, fmt, Money, Section } from './common'
import { preselect } from './BusinessPanel'
import { TestTools } from './TestTools'

/** A plot chosen on the map, waiting for the build panel to open. */
export const buildPick = { parcel: '' }

const zoneLabel = (p: string) => DISTRICT_BY_ID[PARCEL_BY_ID[p].zone].name
const sizeLabel = (p: string) => `${Math.round(PARCEL_BY_ID[p].w)}×${Math.round(PARCEL_BY_ID[p].d)} м`

function timeLeft(ms: number) {
  const m = Math.max(1, Math.ceil(ms / 60_000))
  return m >= 60 ? `${Math.floor(m / 60)} ч ${m % 60} мин` : `${m} мин`
}

/** What can go up on this plot, with prices: one tap starts the building site. */
export function BuildChoices({ parcel, compact = false }: { parcel: string; compact?: boolean }) {
  const build = useGame((s) => s.build)
  const setPanel = useGame((s) => s.setPanel)
  const balance = useBalance()
  const dayMs = useGame((s) => s.city?.dayMs ?? 15 * 60_000)
  const P = PARCEL_BY_ID[parcel]
  const area = P.w * P.d
  const fits = PLAYER_BUILDINGS.filter((b) => b.zones.includes(P.zone))
  return (
    <div className="space-y-2">
      {fits.map((b) => {
        const room = area >= b.minArea
        return (
          <div key={b.id} className="flex items-center gap-3 rounded-2xl bg-[var(--color-soft)] p-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{b.label}</div>
              {!compact && <div className="text-xs text-[var(--color-muted)]">{b.description}</div>}
              <div className="text-xs text-[var(--color-muted)]">
                стройка {timeLeft(b.days * dayMs)} · аренда до +{b.rent} в час
              </div>
            </div>
            {room ? (
              <button className="btn-primary !h-9 shrink-0 !px-3 !text-[13px]" disabled={balance < b.cost} onClick={() => void build(parcel, b.id)}>
                {fmt.format(b.cost)}
              </button>
            ) : (
              <span className="text-right text-xs text-[var(--color-muted)]">Нужно {b.minArea} м²</span>
            )}
          </div>
        )
      })}
      <button
        className="btn-flat w-full !text-[13px]"
        onClick={() => {
          preselect.lot = parcel
          setPanel('business')
        }}
      >
        Открыть здесь своё заведение →
      </button>
    </div>
  )
}

/** A building site or a finished building of mine: progress, rush, rent. */
export function PropertyCard({ pr }: { pr: Property }) {
  const now = useGame((s) => s.city?.now ?? Date.now())
  const rush = useGame((s) => s.rush)
  const collect = useGame((s) => s.collect)
  const showOnMap = useGame((s) => s.showOnMap)
  const uid = useGame((s) => s.uid)
  const balance = useBalance()
  const def = PLAYER_BUILDING_BY_ID[pr.kind]
  const ready = pr.readyAt <= now
  const progress = Math.min(1, (now - pr.startedAt) / Math.max(1, pr.readyAt - pr.startedAt))
  const mine = pr.owner === uid
  const cost = rushCost(pr, now)
  return (
    <div className="space-y-2 rounded-2xl border border-[var(--color-line)] p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">{def.label}</div>
          <div className="text-xs text-[var(--color-muted)]">
            {zoneLabel(pr.lot)} · {sizeLabel(pr.lot)}
            {!mine && ` · владелец ${displayName(pr.owner)}`}
          </div>
        </div>
        <button className="text-xs font-semibold text-[var(--color-brand)]" onClick={() => showOnMap(`prop:${pr.lot}`)}>
          На карте →
        </button>
      </div>
      {ready ? (
        mine && (
          <div className="flex items-center justify-between rounded-xl bg-[#e9f5ec] p-2.5">
            <div className="text-xs text-[#1f6b3a]">
              Аренда +{Math.round(pr.rate ?? 0)} в час (до {def.rent}, когда всё занято) · накопилось <b>{fmt.format(Math.floor(pr.pending))}</b>
            </div>
            <button className="btn-primary !h-8 !px-3 !text-xs" disabled={Math.floor(pr.pending) < 1} onClick={() => void collect(pr.lot)}>
              Собрать
            </button>
          </div>
        )
      ) : (
        <>
          <Bar value={progress} color="#d9772b" />
          <div className="flex items-center justify-between gap-2 text-xs text-[var(--color-muted)]">
            <span>Стройка: {Math.round(progress * 100)}%, осталось {timeLeft(pr.readyAt - now)}</span>
            {mine && (
              <button className="btn-flat !h-8 !px-2.5 !text-xs" disabled={balance < cost} onClick={() => void rush(pr.lot)}>
                Ускорить за {fmt.format(cost)}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export function BuildPanel() {
  const uid = useGame((s) => s.uid)
  const city = useGame((s) => s.city)
  const objects = useGame((s) => s.objects)
  const buyLot = useGame((s) => s.buyLot)
  const balance = useBalance()
  const [first] = useState(() => {
    const p = buildPick.parcel
    buildPick.parcel = ''
    return p
  })
  if (!city) return null
  const myLots = Object.entries(city.owned)
    .filter(([, o]) => o === uid)
    .map(([p]) => p)
  const myProps = city.properties.filter((p) => p.owner === uid)
  const empty = myLots.filter((p) => !myProps.some((x) => x.lot === p) && !city.businesses.some((b) => b.biz.lot === p))
  const forSale = objects
    .filter((o) => o.meta?.type === 'plot' && o.meta.use === 'sale')
    .map((o) => (o.meta as { parcel: string; price: number }).parcel)
    .sort((a, b) => (a === first ? -1 : b === first ? 1 : lotPrice(PARCEL_BY_ID[a].zone, PARCEL_BY_ID[a].w * PARCEL_BY_ID[a].d) - lotPrice(PARCEL_BY_ID[b].zone, PARCEL_BY_ID[b].w * PARCEL_BY_ID[b].d)))
  const pick = () => {
    useCity.getState().setPickPlot('buy')
    useGame.getState().setPanel(null)
    useGame.getState().setSidebar(false)
  }
  return (
    <div className="space-y-5 p-4">
      <TestTools compact />
      <div className="rounded-3xl bg-gradient-to-br from-[#e3efe0] to-[#f4f8ef] p-4">
        <div className="font-display text-lg font-bold">Строй город сам</div>
        <p className="mt-1 text-[13px] leading-relaxed text-[#4c5e48]">
          Купи участок и построй дом, магазин, офис или мастерскую. Новые дома приводят жителей, магазины их кормят, офисы дают работу. А ты получаешь аренду.
        </p>
      </div>

      {(myProps.length > 0 || empty.length > 0) && (
        <Section title="Мои участки">
          <div className="space-y-2">
            {myProps.map((pr) => (
              <PropertyCard key={pr.lot} pr={pr} />
            ))}
            {empty.map((p) => (
              <div key={p} className="space-y-2 rounded-2xl border-2 border-[#3d6b4f] p-3">
                <div className="text-sm font-semibold">
                  Твой участок: {zoneLabel(p)}, {sizeLabel(p)}
                </div>
                <div className="text-xs text-[var(--color-muted)]">Что построим?</div>
                <BuildChoices parcel={p} compact />
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section
        title="Купить участок"
        aside={
          <button className="text-xs font-semibold text-[var(--color-brand)]" onClick={pick}>
            Выбрать на карте →
          </button>
        }
      >
        {forSale.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">Свободных участков сейчас нет. Новые улицы откроются, когда город вырастет.</p>
        ) : (
          <div className="space-y-2">
            {forSale.slice(0, 12).map((p) => {
              const P = PARCEL_BY_ID[p]
              const price = lotPrice(P.zone, P.w * P.d)
              const can = PLAYER_BUILDINGS.filter((b) => b.zones.includes(P.zone) && P.w * P.d >= b.minArea).map((b) => b.label.toLowerCase())
              return (
                <div key={p} className={`flex items-center gap-3 rounded-2xl border p-3 ${p === first ? 'border-[var(--color-ink)] bg-[var(--color-soft)]' : 'border-[var(--color-line)]'}`}>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">
                      {zoneLabel(p)}, {sizeLabel(p)}
                    </div>
                    <div className="text-xs text-[var(--color-muted)]">можно: {can.join(', ') || 'только заведение'}</div>
                    {P.zone === 'residential' && <div className="text-xs font-semibold text-[#3d6b4f]">Микрорайон — лучше всего для домов</div>}
                  </div>
                  <button className="btn-primary !h-9 shrink-0 !px-3 !text-[13px]" disabled={balance < price} onClick={() => void buyLot(p)}>
                    <Money value={price} size={13} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </Section>
    </div>
  )
}

export type { PlayerBuildingId }
