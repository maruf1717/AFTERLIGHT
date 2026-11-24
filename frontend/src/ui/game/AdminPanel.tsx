import { useState } from 'react'
import type { CreativeTask, GameConfig } from '../../game/catalog'
import { useGame } from '../../game/store'
import type { Submission } from '../../game/types'
import { fmt, Money, Section, Stars } from './common'

export function AdminPanel() {
  const isOwner = useGame((s) => s.isOwner)
  const mode = useGame((s) => s.mode)
  if (!isOwner) return <div className="p-6 text-sm text-[var(--color-muted)]">Эта вкладка только для основателя города.</div>
  return (
    <div className="space-y-6 p-4">
      <div className="rounded-2xl bg-[#17202b] p-3 text-xs leading-relaxed text-white/80">
        Панель основателя. Её видишь только ты. {mode === 'local' ? 'Сейчас город хранится только в этом браузере.' : 'Изменения сразу видят все жители.'}
      </div>
      <Grants />
      <Moderation />
      <Balance />
      <CreativeEditor />
      <Restart />
    </div>
  )
}

function Grants() {
  const players = useGame((s) => s.players)
  const names = useGame((s) => s.names)
  const uid = useGame((s) => s.uid)
  const grant = useGame((s) => s.adminGrant)
  const balanceOf = useGame((s) => s.balance)
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  return (
    <Section title="Валюта">
      <div className="flex flex-wrap gap-2">
        {[1000, 10000, 100000].map((a) => (
          <button key={a} className="btn-primary !h-10" onClick={() => void grant(uid, a, 'Тест основателя')}>
            +{fmt.format(a)} себе
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        {Object.keys(players).map((id) => (
          <form
            key={id}
            className="flex items-center gap-2 rounded-2xl bg-[var(--color-soft)] p-2"
            onSubmit={(e) => {
              e.preventDefault()
              const v = Math.floor(Number(amounts[id]))
              if (v) void grant(id, v, 'Начисление основателя').then(() => setAmounts({ ...amounts, [id]: '' }))
            }}
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{id === uid ? 'Ты' : names[id]?.name || 'Житель'}</div>
              <div className="text-xs text-[var(--color-muted)]">
                <Money value={balanceOf(id)} size={12} />
              </div>
            </div>
            <label htmlFor={`grant-${id}`} className="sr-only">
              Сумма
            </label>
            <input
              id={`grant-${id}`}
              inputMode="numeric"
              placeholder="± сумма"
              value={amounts[id] ?? ''}
              onChange={(e) => setAmounts({ ...amounts, [id]: e.target.value.replace(/[^\d-]/g, '') })}
              className="h-9 w-24 rounded-xl bg-white px-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
            />
            <button className="btn-primary !h-9 !px-3 !text-[13px]" type="submit">
              Начислить
            </button>
          </form>
        ))}
      </div>
      <p className="text-xs text-[var(--color-muted)]">Отрицательная сумма списывает Искры.</p>
    </Section>
  )
}

function Moderation() {
  const players = useGame((s) => s.players)
  const reviews = useGame((s) => s.reviews)
  const names = useGame((s) => s.names)
  const config = useGame((s) => s.config)
  const review = useGame((s) => s.adminReview)
  const pending: { sub: Submission; owner: string }[] = []
  for (const [owner, p] of Object.entries(players)) for (const sub of p.submissions ?? []) if (!reviews.some((r) => r.id === sub.id)) pending.push({ sub, owner })
  pending.sort((a, b) => a.sub.at - b.sub.at)
  const taskTitle = (id: string) => config.creativeTasks.find((t) => t.id === id)?.title ?? 'Задание'

  return (
    <Section title="Проверка работ" aside={<span className="text-xs text-[var(--color-muted)]">{pending.length} ждут</span>}>
      {pending.length === 0 && <p className="text-sm text-[var(--color-muted)]">Новых работ нет.</p>}
      {pending.map(({ sub, owner }) => (
        <ReviewCard key={sub.id} sub={sub} author={names[owner]?.name || 'Житель'} task={taskTitle(sub.taskId)} onDecide={(r, f) => void review(sub, owner, r, f)} perStar={config.creativePerStar} />
      ))}
    </Section>
  )
}

function ReviewCard({ sub, author, task, onDecide, perStar }: { sub: Submission; author: string; task: string; onDecide: (rating: number | null, featured: boolean) => void; perStar: number }) {
  const [rating, setRating] = useState(0)
  const [featured, setFeatured] = useState(false)
  return (
    <div className="space-y-2 rounded-2xl border border-[var(--color-line)] p-3">
      <div className="text-xs text-[var(--color-muted)]">
        {author} · {task} · {new Date(sub.at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
      </div>
      {sub.image && <img src={sub.image} alt={`Рисунок: ${task}`} className="w-full rounded-xl border border-[var(--color-line)]" />}
      {sub.text && <p className="text-sm leading-relaxed whitespace-pre-wrap">{sub.text}</p>}
      <div className="flex items-center justify-between gap-2">
        <Stars value={rating} onChange={setRating} size={26} />
        <span className="text-xs text-[var(--color-muted)] tabular-nums">{rating ? `+${rating * perStar} Искр` : ''}</span>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} /> Отметить «в канал»
      </label>
      <div className="flex gap-2">
        <button className="btn-primary flex-1" disabled={!rating} onClick={() => onDecide(rating, featured)}>
          Принять
        </button>
        <button className="btn-flat" onClick={() => onDecide(null, false)}>
          Отклонить
        </button>
      </div>
    </div>
  )
}

const FIELDS: { key: keyof GameConfig; label: string; hint: string; step?: number }[] = [
  { key: 'dayMinutes', label: 'Длина игрового дня, минут', hint: 'Меньше: город меняется быстрее. Для теста ставь 2–5.' },
  { key: 'baseInflow', label: 'Приезжают сами, в день', hint: 'Сколько людей приезжает без игроков.' },
  { key: 'perActive', label: 'Жителей за активного игрока', hint: 'Сколько людей приводит игрок, выполнивший задание.' },
  { key: 'crisisOutflow', label: 'Отток за кризис, доля', hint: '0.015 = 1,5% жителей в день за каждый кризис.', step: 0.005 },
  { key: 'dailyDonationLimit', label: 'Лимит взносов в день', hint: 'Сколько Искр один житель может вложить за сутки.' },
  { key: 'businessRep', label: 'Репутация для бизнеса', hint: 'Сколько заданий нужно сделать, чтобы открыть заведение.' },
  { key: 'creativePerStar', label: 'Награда за звезду', hint: 'Оценка 5 даёт пять таких наград.' },
]

function Balance() {
  const config = useGame((s) => s.config)
  const save = useGame((s) => s.adminSaveConfig)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const value = (k: keyof GameConfig) => draft[k] ?? String(config[k])
  return (
    <Section title="Баланс">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          const patch: Partial<GameConfig> = {}
          for (const f of FIELDS) {
            const v = Number(value(f.key))
            if (!Number.isNaN(v)) (patch as Record<string, number>)[f.key] = v
          }
          void save(patch).then(() => setDraft({}))
        }}
      >
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label htmlFor={`cfg-${f.key}`} className="text-sm font-medium">
              {f.label}
            </label>
            <input
              id={`cfg-${f.key}`}
              type="number"
              step={f.step ?? 1}
              value={value(f.key)}
              onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
              className="mt-1 h-10 w-full rounded-xl bg-[var(--color-soft)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
            />
            <div className="mt-0.5 text-xs text-[var(--color-muted)]">{f.hint}</div>
          </div>
        ))}
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={config.soloMode} onChange={(e) => void save({ soloMode: e.target.checked })} />
          Режим одного игрока (тест)
        </label>
        <p className="-mt-2 text-xs text-[var(--color-muted)]">
          Пока включён, всё можно сделать одному: проектам не нужны другие участники, нет дневного лимита взносов и порога репутации для бизнеса. Выключи, когда придут другие жители.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={config.requireDonors} onChange={(e) => void save({ requireDonors: e.target.checked })} />
          Проекту нужны несколько разных участников
        </label>
        <button className="btn-primary w-full" type="submit">
          Сохранить баланс
        </button>
      </form>
    </Section>
  )
}

function CreativeEditor() {
  const config = useGame((s) => s.config)
  const save = useGame((s) => s.adminSaveConfig)
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [kind, setKind] = useState<CreativeTask['kind']>('text')
  return (
    <Section title="Творческие задания">
      <div className="space-y-1.5">
        {config.creativeTasks.map((t) => (
          <div key={t.id} className="flex items-start gap-2 rounded-2xl bg-[var(--color-soft)] p-2.5">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">
                {t.title} <span className="font-normal text-[var(--color-muted)]">· {t.kind === 'drawing' ? 'рисунок' : 'текст'}</span>
              </div>
              <div className="text-xs text-[var(--color-muted)]">{t.text}</div>
            </div>
            <button className="btn-flat !h-8 !px-2 !text-xs" onClick={() => void save({ creativeTasks: config.creativeTasks.filter((x) => x.id !== t.id) })}>
              Убрать
            </button>
          </div>
        ))}
      </div>
      <form
        className="space-y-2 rounded-2xl border border-[var(--color-line)] p-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!title.trim() || !text.trim()) return
          void save({ creativeTasks: [...config.creativeTasks, { id: `c-${Date.now().toString(36)}`, title: title.trim(), text: text.trim(), kind }] }).then(() => {
            setTitle('')
            setText('')
          })
        }}
      >
        <div className="text-sm font-semibold">Новое задание</div>
        <label htmlFor="ct-title" className="sr-only">
          Название
        </label>
        <input id="ct-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название" className="h-10 w-full rounded-xl bg-[var(--color-soft)] px-3 text-sm outline-none" />
        <label htmlFor="ct-text" className="sr-only">
          Описание
        </label>
        <textarea id="ct-text" value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Что нужно сделать" className="w-full rounded-xl bg-[var(--color-soft)] p-3 text-sm outline-none" />
        <div className="flex gap-2">
          {(['text', 'drawing'] as const).map((k) => (
            <button type="button" key={k} onClick={() => setKind(k)} className={`chip plain ${kind === k ? '' : ''}`} aria-pressed={kind === k}>
              {k === 'text' ? 'Текст' : 'Рисунок'}
            </button>
          ))}
        </div>
        <button className="btn-primary w-full" type="submit">
          Добавить
        </button>
      </form>
    </Section>
  )
}

function Restart() {
  const restart = useGame((s) => s.adminRestart)
  const [confirm, setConfirm] = useState(false)
  return (
    <Section title="Перезапуск">
      <p className="text-xs leading-relaxed text-[var(--color-muted)]">Город начнётся заново с посёлка на 120 жителей. Взносы, бизнесы и задания до перезапуска перестанут считаться. Балансы жителей сохранятся.</p>
      {confirm ? (
        <div className="flex gap-2">
          <button
            className="btn-primary flex-1 !bg-[#b3261e]"
            onClick={() => {
              void restart()
              setConfirm(false)
            }}
          >
            Да, начать заново
          </button>
          <button className="btn-flat" onClick={() => setConfirm(false)}>
            Отмена
          </button>
        </div>
      ) : (
        <button className="btn-flat w-full" onClick={() => setConfirm(true)}>
          Перезапустить город
        </button>
      )}
    </Section>
  )
}
