import { useEffect, useState } from 'react'
import { BUILDING_BY_ID, BUILDINGS, CATEGORIES, NEED_BY_ID, ROADS, SELL_SHARE, type Category } from '../game/catalog'
import { rollbackIn, unlocked } from '../game/city'
import { PROBLEM_LABEL } from '../game/complaints'
import { useGame, useShownCity, useShownStats } from '../game/store'
import { useView } from '../scene/World'
import { BoltIcon, CloseIcon, CoinIcon, DropIcon, ListIcon, ModelIcon, MoonIcon, PeopleIcon, RoadIcon, RotateIcon, SellIcon, SmileIcon, categoryColor } from './icons'

export const fmt = new Intl.NumberFormat('ru-RU')
const money = (v: number) => fmt.format(Math.floor(v))

/* Top bar ---------------------------------------------------------------------- */

export function TopBar({ onList }: { onList: () => void }) {
  const city = useShownCity()
  const stats = useShownStats()
  const visiting = useGame((s) => s.visiting)
  const visit = useGame((s) => s.visit)
  const toggleNight = useView((s) => s.toggleNight)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  if (!city || !stats) return null
  const left = visiting ? null : rollbackIn(city, now)
  const mood = stats.happiness
  const moodColor = mood >= 60 ? '#1f8a4c' : mood >= 35 ? '#b26a00' : '#b3261e'
  const pw = stats.power.used ? stats.power.made / stats.power.used : 1
  const wt = stats.water.used ? stats.water.made / stats.water.used : 1
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 px-3 pt-[max(10px,env(safe-area-inset-top))]">
      <div className="pointer-events-auto panel mx-auto max-w-3xl rounded-2xl px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 truncate font-display text-[15px] font-bold leading-tight">{city.name}</div>
          <div className="flex items-center gap-1 text-[13px] font-semibold tabular-nums">
            <CoinIcon /> {money(city.money)}
            <span className={`text-xs ${stats.income >= 0 ? 'text-[#1f8a4c]' : 'text-[#b3261e]'}`}>
              {stats.income >= 0 ? '+' : '−'}
              {fmt.format(Math.abs(Math.round(stats.income)))}/мин
            </span>
          </div>
          <button className="btn-flat !h-8 !w-8 !px-0" onClick={toggleNight} aria-label="День или ночь">
            <MoonIcon />
          </button>
          <button className="btn-flat !h-8 !w-8 !px-0" onClick={onList} aria-label="Города и статистика">
            <ListIcon />
          </button>
        </div>
        <div className="mt-1.5 grid grid-cols-4 gap-1 border-t border-[var(--color-line)] pt-1.5">
          <Stat icon={<PeopleIcon />} value={fmt.format(city.pop)} label="жители" />
          <Stat icon={<SmileIcon />} value={`${mood}%`} label="счастье" color={moodColor} />
          <Stat icon={<BoltIcon />} value={pw >= 1 ? 'хватает' : `${Math.round(pw * 100)}%`} label="свет" color={pw >= 1 ? '#1f8a4c' : '#b3261e'} />
          <Stat icon={<DropIcon />} value={wt >= 1 ? 'хватает' : `${Math.round(wt * 100)}%`} label="вода" color={wt >= 1 ? '#1f8a4c' : '#b3261e'} />
        </div>
      </div>
      {visiting && (
        <div className="pointer-events-auto mx-auto mt-2 flex max-w-md items-center justify-between gap-2 rounded-2xl bg-[#17202b] px-4 py-2 text-sm text-white">
          <span>Ты в гостях: «{visiting.city.name}»</span>
          <button className="btn !h-8 !text-[13px]" onClick={() => void visit(null)}>
            Домой
          </button>
        </div>
      )}
      {left !== null && (
        <div className="pointer-events-auto mx-auto mt-2 max-w-md rounded-2xl bg-[#b3261e] px-4 py-2 text-center text-sm font-semibold text-white">
          Жители очень недовольны! Через {left} с город откатится назад. Почини то, на что они жалуются.
        </div>
      )}
    </div>
  )
}

function Stat({ icon, value, label, color }: { icon: React.ReactNode; value: string; label: string; color?: string }) {
  return (
    <div className="flex flex-col items-center leading-tight" title={label}>
      <span className="flex items-center gap-1 font-display text-[14px] font-bold tabular-nums" style={{ color }}>
        <span className="opacity-70">{icon}</span>
        {value}
      </span>
      <span className="text-[10px] text-[var(--color-muted)]">{label}</span>
    </div>
  )
}

/* Build bar --------------------------------------------------------------------- */

export function BuildBar() {
  const city = useGame((s) => s.city)
  const visiting = useGame((s) => s.visiting)
  const tool = useGame((s) => s.tool)
  const setTool = useGame((s) => s.setTool)
  const rotate = useGame((s) => s.rotate)
  const [cat, setCat] = useState<Category | null>(null)
  if (!city || visiting) return null
  const items = cat === 'roads' ? null : BUILDINGS.filter((b) => b.category === cat)
  const active = (t: typeof tool) => JSON.stringify(t) === JSON.stringify(tool)
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-2 pb-[max(8px,env(safe-area-inset-bottom))]">
      {tool && (
        <div className="pointer-events-auto mx-auto mb-2 flex max-w-xl items-center gap-2 rounded-2xl bg-[#17202b] px-3 py-2 text-[13px] text-white">
          <span className="min-w-0 flex-1 truncate">
            {tool.kind === 'road'
              ? 'Проведи пальцем по полю — проложится прямая дорога'
              : tool.kind === 'sell'
                ? 'Нажми на здание или дорогу, чтобы продать за половину цены'
                : `Нажми на поле, чтобы поставить: ${BUILDING_BY_ID[tool.id].name}`}
          </span>
          {tool.kind === 'build' && (
            <button className="btn !h-8 gap-1 !px-2.5 !text-[13px]" onClick={rotate}>
              <RotateIcon /> Повернуть
            </button>
          )}
          <button className="btn !h-8 !px-2.5 !text-[13px]" onClick={() => setTool(null)}>
            Готово
          </button>
        </div>
      )}
      {cat && (
        <div className="pointer-events-auto panel scroll-thin mx-auto mb-2 flex max-w-5xl gap-2 overflow-x-auto rounded-2xl p-2">
          {cat === 'roads'
            ? ROADS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setTool({ kind: 'road', road: r.id })}
                  className={`flex w-[150px] shrink-0 items-start gap-2 rounded-xl p-2 text-left ${active({ kind: 'road', road: r.id }) ? 'bg-[#17202b] text-white' : 'bg-[var(--color-soft)]'}`}
                >
                  <RoadIcon kind={r.id} />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold leading-tight">{r.name}</span>
                    <span className="flex items-center gap-1 text-xs tabular-nums">
                      <CoinIcon size={12} /> {fmt.format(r.cost)} за клетку
                    </span>
                  </span>
                </button>
              ))
            : items!.map((b) => {
                const open = unlocked(city, b)
                return (
                  <button
                    key={b.id}
                    disabled={!open}
                    onClick={() => setTool({ kind: 'build', id: b.id })}
                    title={b.text}
                    className={`flex w-[168px] shrink-0 items-start gap-2 rounded-xl p-2 text-left disabled:opacity-50 ${active({ kind: 'build', id: b.id }) ? 'bg-[#17202b] text-white' : 'bg-[var(--color-soft)]'}`}
                  >
                    <ModelIcon model={b.model} category={b.category} />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold leading-tight">{b.name}</span>
                      {open ? (
                        <span className="flex items-center gap-1 text-xs tabular-nums">
                          <CoinIcon size={12} /> {fmt.format(b.cost)} · {b.w}×{b.d}
                        </span>
                      ) : (
                        <span className="block text-xs">с {fmt.format(b.unlock)} жителей</span>
                      )}
                      <span className="block text-[11px] leading-tight opacity-75">{effectLine(b.id)}</span>
                    </span>
                  </button>
                )
              })}
        </div>
      )}
      <nav aria-label="Стройка" className="pointer-events-auto panel mx-auto flex max-w-3xl gap-0.5 rounded-2xl p-1">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              setCat(cat === c.id ? null : c.id)
              if (cat === c.id) setTool(null)
            }}
            aria-pressed={cat === c.id}
            className="flex min-w-[46px] flex-1 flex-col items-center gap-0.5 rounded-xl px-0.5 py-1.5 text-[10.5px] leading-tight font-semibold"
            style={cat === c.id ? { background: categoryColor(c.id), color: '#fff' } : undefined}
          >
            <span className="h-2 w-6 rounded-full" style={{ background: cat === c.id ? '#fff' : categoryColor(c.id) }} />
            {c.label}
          </button>
        ))}
        <button
          onClick={() => {
            setCat(null)
            setTool(tool?.kind === 'sell' ? null : { kind: 'sell' })
          }}
          aria-pressed={tool?.kind === 'sell'}
          className={`flex min-w-[46px] flex-1 flex-col items-center gap-0.5 rounded-xl px-0.5 py-1.5 text-[10.5px] leading-tight font-semibold ${tool?.kind === 'sell' ? 'bg-[#b3261e] text-white' : ''}`}
        >
          <span className="h-2 w-6 rounded-full" style={{ background: tool?.kind === 'sell' ? '#fff' : '#b3261e' }} />
          Снос
        </button>
      </nav>
    </div>
  )
}

function effectLine(id: string) {
  const b = BUILDING_BY_ID[id]
  const parts: string[] = []
  if (b.homes) parts.push(`${b.homes} жителей`)
  if (b.jobs) parts.push(`${b.jobs} рабочих мест`)
  if (b.power) parts.push(`+${b.power} тока`)
  if (b.water) parts.push(`+${b.water} воды`)
  if (b.covers) parts.push(b.covers.map((c) => NEED_BY_ID[c.need].label.toLowerCase()).join(', '))
  if (b.pollution) parts.push('дымит')
  return parts.join(' · ')
}

/* Building card ------------------------------------------------------------------ */

export function BuildingCard() {
  const city = useShownCity()
  const stats = useShownStats()
  const selected = useGame((s) => s.selected)
  const select = useGame((s) => s.select)
  const sell = useGame((s) => s.sellSelected)
  const visiting = useGame((s) => s.visiting)
  const p = city?.items.find((i) => i.uid === selected)
  if (!p || !stats) return null
  const def = BUILDING_BY_ID[p.id]
  const home = stats.perHome.find((h) => h.uid === p.uid)
  const connected = stats.connected.has(p.uid)
  return (
    <div className="pointer-events-auto panel absolute inset-x-2 bottom-[86px] z-30 mx-auto max-w-md rounded-2xl p-3">
      <div className="flex items-start gap-3">
        <ModelIcon model={def.model} category={def.category} size={48} />
        <div className="min-w-0 flex-1">
          <div className="font-display text-base font-bold">{def.name}</div>
          <div className="text-xs text-[var(--color-muted)]">{def.text}</div>
          <div className="mt-1 text-xs">{effectLine(def.id)}</div>
        </div>
        <button className="btn-flat !h-8 !w-8 !px-0" onClick={() => select(null)} aria-label="Закрыть">
          <CloseIcon />
        </button>
      </div>
      {!connected && <div className="mt-2 rounded-xl bg-red-50 p-2 text-xs font-semibold text-red-800">Нет дороги до въезда в город: здание не работает. Проложи к нему дорогу.</div>}
      {home && connected && (
        <div className="mt-2 rounded-xl bg-[var(--color-soft)] p-2 text-xs">
          Счастье жителей: <b>{Math.round(home.happiness)}%</b>
          {home.missing.length > 0 && <> · не хватает: {home.missing.map((m) => PROBLEM_LABEL[m].toLowerCase()).join(', ')}</>}
        </div>
      )}
      {!visiting && (
        <button className="btn-flat mt-2 w-full gap-1 !text-[13px] !text-[#b3261e]" onClick={sell}>
          <SellIcon /> Продать за {fmt.format(Math.floor(def.cost * SELL_SHARE))}
        </button>
      )}
    </div>
  )
}

/* Complaints, toasts, roll-back ------------------------------------------------------- */

export function Complaints() {
  const list = useGame((s) => s.complaints)
  const dismiss = useGame((s) => s.dismissComplaint)
  const select = useGame((s) => s.select)
  const visiting = useGame((s) => s.visiting)
  if (visiting) return null
  return (
    <div className="pointer-events-none absolute top-[100px] left-2 z-20 flex w-[min(320px,calc(100%-16px))] flex-col gap-2">
      {list.map((c) => (
        <div key={c.id} className="pointer-events-auto panel anim-pop flex items-start gap-2 rounded-2xl p-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fde2df] font-display text-sm font-bold text-[#b3261e]">{c.who[0]}</span>
          <button className="min-w-0 flex-1 text-left" onClick={() => select(c.home)}>
            <span className="block text-xs font-semibold">
              {c.who} · <span className="text-[#b3261e]">{PROBLEM_LABEL[c.problem]}</span>
            </span>
            <span className="block text-[13px] leading-snug">{c.text}</span>
          </button>
          <button className="text-[var(--color-faint)]" onClick={() => dismiss(c.id)} aria-label="Скрыть">
            <CloseIcon />
          </button>
        </div>
      ))}
    </div>
  )
}

export function Toasts() {
  const toasts = useGame((s) => s.toasts)
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[150px] z-[55] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div key={t.id} className={`anim-pop rounded-2xl px-4 py-2 text-sm font-semibold text-white shadow-lg ${t.tone === 'good' ? 'bg-[#1f6b3a]' : t.tone === 'bad' ? 'bg-[#8e1c1c]' : 'bg-[#17202b]'}`}>
          {t.text}
        </div>
      ))}
    </div>
  )
}

export function RollbackModal() {
  const on = useGame((s) => s.rolledBack)
  const close = useGame((s) => s.closeRollback)
  if (!on) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#17202b]/55 p-4">
      <div className="anim-pop w-full max-w-sm rounded-3xl bg-white p-5 text-center">
        <div className="font-display text-xl font-bold">Жители не выдержали</div>
        <p className="mt-2 text-sm text-[var(--color-muted)]">Слишком долго не хватало самого нужного, и люди уехали. Город вернулся к последнему состоянию, когда все были довольны.</p>
        <button className="btn-primary mt-4 w-full" onClick={close}>
          Попробую ещё раз
        </button>
      </div>
    </div>
  )
}

/* Stats and the list of cities ---------------------------------------------------------- */

export function CitySheet({ onClose }: { onClose: () => void }) {
  const city = useShownCity()
  const stats = useShownStats()
  const cities = useGame((s) => s.cities)
  const load = useGame((s) => s.loadCities)
  const visit = useGame((s) => s.visit)
  useEffect(() => {
    void load()
  }, [load])
  if (!city || !stats) return null
  const rows: [string, string][] = [
    ['Жители', `${fmt.format(city.pop)} из ${fmt.format(stats.homes)} мест`],
    ['Работа', `${fmt.format(Math.min(stats.workers, stats.jobs))} из ${fmt.format(stats.workers)} работают (мест ${fmt.format(stats.jobs)})`],
    ['Электричество', `${fmt.format(stats.power.made)} из нужных ${fmt.format(stats.power.used)}`],
    ['Вода', `${fmt.format(stats.water.made)} из нужных ${fmt.format(stats.water.used)}`],
    ['Налоги', `+${fmt.format(stats.taxes)} в минуту`],
    ['Содержание', `−${fmt.format(stats.upkeep)} в минуту`],
  ]
  return (
    <div className="fixed inset-0 z-[50] flex items-end justify-center bg-[#17202b]/40 desk:items-center" onClick={onClose}>
      <div className="anim-pop max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 desk:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="font-display text-xl font-bold">{city.name}</div>
          <button className="btn-flat !h-9 !w-9 !px-0" onClick={onClose} aria-label="Закрыть">
            <CloseIcon />
          </button>
        </div>
        <dl className="mt-3 space-y-1.5 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <dt className="text-[var(--color-muted)]">{k}</dt>
              <dd className="text-right font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 text-sm font-semibold">Что есть у жителей рядом с домом</div>
        <div className="mt-2 space-y-1.5">
          {stats.needs.map((n) => (
            <div key={n.id} className="flex items-center gap-2 text-sm">
              <span className="w-28 shrink-0">{NEED_BY_ID[n.id].label}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-black/10">
                <span className="block h-full rounded-full" style={{ width: `${Math.round(n.covered * 100)}%`, background: n.covered > 0.8 ? '#1f8a4c' : n.covered > 0.4 ? '#c9a227' : '#b3261e' }} />
              </span>
              <span className="w-10 text-right text-xs tabular-nums">{Math.round(n.covered * 100)}%</span>
            </div>
          ))}
          {!stats.needs.length && <p className="text-sm text-[var(--color-muted)]">Пока жителям нужны только магазины. Новые потребности появятся, когда город вырастет.</p>}
        </div>
        <div className="mt-5 text-sm font-semibold">Города игроков</div>
        <ul className="mt-2 space-y-1.5">
          {cities.map((c, i) => (
            <li key={c.uid} className="flex items-center gap-2 rounded-xl bg-[var(--color-soft)] p-2 text-sm">
              <span className="w-6 text-center font-bold tabular-nums">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{c.name}</span>
              <span className="text-xs tabular-nums">{fmt.format(c.pop)} жит.</span>
              <button
                className="btn !h-8 !text-xs"
                onClick={() => {
                  void visit(c.uid)
                  onClose()
                }}
              >
                Смотреть
              </button>
            </li>
          ))}
        </ul>
        {useGame.getState().mode === 'local' && <p className="mt-2 text-xs text-[var(--color-muted)]">Сейчас игра открыта не в Claude: город сохраняется только в этом браузере.</p>}
      </div>
    </div>
  )
}

export function isUnlocked(id: string) {
  const c = useGame.getState().city
  return !!c && unlocked(c, BUILDING_BY_ID[id])
}
