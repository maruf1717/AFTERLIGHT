import { useState } from 'react'
import { ACHIEVEMENTS, BUSINESS_TYPES, START_BALANCE, STREAK_DAYS, STREAK_REWARD, TUTORIAL } from '../../game/catalog'
import { displayName, nameError, useGame } from '../../game/store'
import { useCity } from '../../store/cityStore'
import { fmt, Modal, Money, Section } from './common'

/* Help: short answers ----------------------------------------------------- */

const QA: [string, string][] = [
  [
    'Откуда берутся Искры?',
    `Новый житель получает ${fmt.format(START_BALANCE)} Искр. Дальше: ежедневные задания (вкладка «Задания»), творческие задания (их проверяет основатель), первые шаги обучения и выручка своего заведения. Все начисления и траты видны в «Настройки» → «История счёта».`,
  ],
  [
    'Как растёт город?',
    'Каждый день в город приезжают новые люди. Чем больше жителей выполнило задание сегодня и чем счастливее город, тем больше приезжает. Новые дома, офисы и магазины город строит сам, когда их не хватает.',
  ],
  [
    'Что такое кризис?',
    'Если городу чего-то не хватает (врачей, тока, воды), это видно во вкладке «Город». Когда нехватка серьёзная, начинается кризис: люди уезжают каждый день. Кризис закрывают проекты, на которые жители скидываются вместе.',
  ],
  [
    'Как открыть бизнес?',
    `Вкладка «Бизнес»: выбери тип (${BUSINESS_TYPES.map((b) => b.label.toLowerCase()).join(', ')}), придумай название, цену и участок. Заведение зарабатывает каждый час, касса копит до 12 часов — собирай кнопкой «Собрать». Если за день выполнил 3 задания, гостей на 25% больше. Можно открыть до трёх заведений и продать любое за половину вложенного.`,
  ],
  [
    'Как строить самому?',
    'Вкладка «Стройка»: купи свободный участок (цена зависит от района и размера) и выбери, что построить: дом, малоэтажку, магазин, офис или мастерскую. Стройка идёт несколько игровых дней, её можно ускорить Искрами. Готовое здание даёт городу жильё, еду или работу, а тебе — аренду каждый час.',
  ],
  [
    'Как работают проекты?',
    'Большие здания (поликлиника, школа, станции) строятся только на деньги жителей. Вкладывай во вкладке «Проекты»: когда сумма собрана, здание сразу появляется и начинает работать.',
  ],
]

export function HelpPanel() {
  const setHelpOpen = useCity((s) => s.setHelpOpen)
  const [open, setOpen] = useState(0)
  return (
    <div className="space-y-4 p-4">
      <div className="space-y-2">
        {QA.map(([q, a], i) => (
          <div key={q} className="rounded-2xl bg-[var(--color-soft)]">
            <button className="flex w-full items-center justify-between gap-3 p-3 text-left text-sm font-semibold" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>
              {q}
              <span className="text-[var(--color-muted)]">{open === i ? '−' : '+'}</span>
            </button>
            {open === i && <p className="px-3 pb-3 text-[13px] leading-relaxed text-[#3a4554]">{a}</p>}
          </div>
        ))}
      </div>
      <Section title="Первые шаги">
        <ol className="space-y-1 text-[13px] text-[#3a4554]">
          {TUTORIAL.map((s, i) => (
            <li key={s.id}>
              {i + 1}. {s.title} — {s.hint}
            </li>
          ))}
        </ol>
      </Section>
      <button className="btn-flat w-full" onClick={() => setHelpOpen(true)}>
        Показать приветствие снова
      </button>
    </div>
  )
}

/* Settings ------------------------------------------------------------------ */

export function SettingsPanel() {
  const night = useCity((s) => s.night)
  const quality = useCity((s) => s.quality)
  const toggleNight = useCity((s) => s.toggleNight)
  const toggleQuality = useCity((s) => s.toggleQuality)
  const me = useGame((s) => s.players[s.uid])
  const account = useGame((s) => s.accounts[s.uid])
  const setName = useGame((s) => s.setName)
  const [name, setDraft] = useState(me?.name ?? '')
  const [saved, setSaved] = useState(false)
  const err = name.trim() === (me?.name ?? '') ? null : nameError(name)
  const row = 'flex w-full items-center justify-between gap-3 rounded-2xl bg-[var(--color-soft)] p-3 text-left text-sm font-semibold'
  return (
    <div className="space-y-5 p-4">
      <Section title="Имя в городе">
        <form
          className="flex items-start gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!err) void setName(name).then((ok) => setSaved(ok))
          }}
        >
          <div className="flex-1">
            <label htmlFor="set-name" className="sr-only">
              Имя
            </label>
            <input
              id="set-name"
              value={name}
              maxLength={20}
              aria-invalid={!!err}
              onChange={(e) => {
                setDraft(e.target.value)
                setSaved(false)
              }}
              placeholder="Как тебя зовут в городе?"
              className={`h-10 w-full rounded-xl px-3 text-sm outline-none focus:ring-2 ${err ? 'border-2 border-[#d93a2f] bg-[#fdecea] focus:ring-[#d93a2f]' : 'bg-[var(--color-soft)] focus:ring-[var(--color-brand)]'}`}
            />
            {err && <div className="mt-0.5 text-xs font-semibold text-[#d93a2f]">{err}</div>}
            {saved && <div className="mt-0.5 text-xs font-semibold text-[#1f8a4c]">Сохранено</div>}
          </div>
          <button className="btn-primary !h-10" type="submit" disabled={!!err || !name.trim()}>
            Сохранить
          </button>
        </form>
      </Section>
      <Section title="Экран">
        <div className="space-y-2">
          <button className={row} onClick={toggleQuality} aria-pressed={quality === 'high'}>
            Графика <span className="text-[var(--color-muted)]">{quality === 'high' ? 'максимум' : 'эконом'}</span>
          </button>
          <button className={row} onClick={toggleNight} aria-pressed={night}>
            Время суток <span className="text-[var(--color-muted)]">{night ? 'ночь' : 'день'}</span>
          </button>
          <div className={`${row} opacity-60`}>
            Звук <span className="text-[var(--color-muted)]">в игре пока нет звуков</span>
          </div>
          <button
            className={row}
            onClick={() => {
              try {
                for (const k of Object.keys(localStorage)) if (k.startsWith('afterlight:tip') || k === 'afterlight:welcomed' || k === 'afterlight:tutorial-hidden') localStorage.removeItem(k)
              } catch {
                /* storage unavailable */
              }
              location.reload()
            }}
          >
            Показать подсказки заново <span className="text-[var(--color-muted)]">↻</span>
          </button>
        </div>
      </Section>
      {account && (
        <Section title="Достижения" aside={<span className="text-xs text-[var(--color-muted)]">{account.achievements.length} из {ACHIEVEMENTS.length}</span>}>
          <div className="text-[13px] text-[#3a4554]">
            Дней подряд в городе: <b>{account.streak.count}</b>
            {account.streak.count < STREAK_DAYS ? ` (за ${STREAK_DAYS} дней подряд — ${STREAK_REWARD} Искр)` : ''}
          </div>
          <ul className="grid grid-cols-1 gap-1.5">
            {ACHIEVEMENTS.map((a) => {
              const got = account.achievements.includes(a.id)
              return (
                <li key={a.id} className={`flex items-center gap-2 rounded-2xl p-2.5 ${got ? 'bg-[#e9f5ec]' : 'bg-[var(--color-soft)] opacity-70'}`}>
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm ${got ? 'bg-[#1f8a4c] text-white' : 'bg-black/10'}`}>{got ? '★' : '☆'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{a.title}</span>
                    <span className="block text-xs text-[var(--color-muted)]">{a.text}</span>
                  </span>
                  <Money value={a.reward} size={12} />
                </li>
              )
            })}
          </ul>
        </Section>
      )}
      {account && (
        <Section title="История счёта">
          <ul className="space-y-1">
            {[...account.ledger].reverse().slice(0, 30).map((l, i) => (
              <li key={`${l.t}-${i}`} className="flex items-center justify-between gap-2 text-[13px]">
                <span className="min-w-0 flex-1 truncate">{l.why}</span>
                <span className={`font-semibold tabular-nums ${l.amount >= 0 ? 'text-[#1f8a4c]' : 'text-[#b3261e]'}`}>
                  {l.amount >= 0 ? '+' : '−'}
                  {fmt.format(Math.abs(Math.round(l.amount)))}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}

/* Gallery: the works the founder marked as the best ------------------------- */

export function GalleryPanel() {
  const reviews = useGame((s) => s.reviews)
  const players = useGame((s) => s.players)
  const config = useGame((s) => s.config)
  useGame((s) => s.names)
  const [shown, setShown] = useState(10)
  const works = reviews
    .filter((r) => r.featured && r.status === 'approved')
    .sort((a, b) => b.at - a.at)
    .map((r) => ({ r, sub: players[r.to]?.submissions.find((s) => s.id === r.id) }))
    .filter((w) => w.sub)
  if (!works.length) return <p className="p-6 text-sm text-[var(--color-muted)]">Пока здесь пусто. Лучшие творческие работы жителей основатель отмечает звездой, и они появляются здесь.</p>
  return (
    <div className="space-y-3 p-4">
      {works.slice(0, shown).map(({ r, sub }) => (
        <figure key={r.id} className="space-y-2 rounded-2xl border border-[var(--color-line)] p-3">
          {sub!.image && <img src={sub!.image} alt={`Работа: ${config.creativeTasks.find((t) => t.id === r.taskId)?.title ?? ''}`} className="w-full rounded-xl" />}
          {sub!.text && <p className="text-sm leading-relaxed whitespace-pre-wrap">{sub!.text}</p>}
          <figcaption className="text-xs text-[var(--color-muted)]">
            {displayName(r.to)} · {config.creativeTasks.find((t) => t.id === r.taskId)?.title ?? 'Творческое задание'} · ★{r.rating}
          </figcaption>
        </figure>
      ))}
      {shown < works.length && (
        <button className="btn-flat w-full" onClick={() => setShown(shown + 10)}>
          Показать ещё
        </button>
      )}
    </div>
  )
}

/* First visit: a name ---------------------------------------------------------- */

export function NamePrompt() {
  const status = useGame((s) => s.status)
  const canWrite = useGame((s) => s.canWrite)
  const mine = useGame((s) => s.players[s.uid])
  const helpOpen = useCity((s) => s.helpOpen)
  const setName = useGame((s) => s.setName)
  const [later, setLater] = useState(() => {
    try {
      return sessionStorage.getItem('afterlight:name-later') === '1'
    } catch {
      return false
    }
  })
  const [name, setDraft] = useState('')
  const [touched, setTouched] = useState(false)
  if (status !== 'ready' || !canWrite || !mine || mine.name || helpOpen || later) return null
  const err = nameError(name)
  const close = () => {
    setLater(true)
    try {
      sessionStorage.setItem('afterlight:name-later', '1')
    } catch {
      /* fine */
    }
  }
  return (
    <Modal title="Как тебя зовут в городе?" onClose={close}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          setTouched(true)
          if (!err) void setName(name)
        }}
      >
        <p className="text-sm text-[var(--color-muted)]">Это имя увидят другие жители: в рейтинге, на вывеске твоего заведения и под твоими работами.</p>
        <label htmlFor="first-name" className="sr-only">
          Имя
        </label>
        <input
          id="first-name"
          autoFocus
          value={name}
          maxLength={20}
          aria-invalid={touched && !!err}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Например: Маруф"
          className={`h-11 w-full rounded-xl px-3 text-base outline-none focus:ring-2 ${touched && err ? 'border-2 border-[#d93a2f] bg-[#fdecea] focus:ring-[#d93a2f]' : 'bg-[var(--color-soft)] focus:ring-[var(--color-brand)]'}`}
        />
        {touched && err && <div className="text-xs font-semibold text-[#d93a2f]">{err}</div>}
        <div className="flex gap-2">
          <button className="btn-primary flex-1" type="submit">
            Готово
          </button>
          <button className="btn-flat" type="button" onClick={close}>
            Позже
          </button>
        </div>
      </form>
    </Modal>
  )
}
