import { useState } from 'react'
import { DISTRICT_BY_ID } from '../../data/city'
import { BUSINESS_TYPE_BY_ID, DAILY_TASKS, type CreativeTask, type DailyTaskId } from '../../game/catalog'
import { averageRating } from '../../game/sim'
import { useGame, useMe } from '../../game/store'
import { MIDNIGHT_ID } from '../../data/city'
import { KindArt } from '../art'
import { fmt, Modal, Money, Section, Stars } from './common'
import { DrawingPad, SurveyModal, WiresGame } from './MiniGames'

const TASK_ART = { wires: 'plant', delivery: 'shop', survey: 'library', patrol: 'house', reviews: 'cafe' } as const satisfies Record<DailyTaskId, string>

export function TasksPanel() {
  const me = useMe()
  const objects = useGame((s) => s.objectById)
  const config = useGame((s) => s.config)
  const reviews = useGame((s) => s.reviews)
  const setPanel = useGame((s) => s.setPanel)
  const setSidebar = useGame((s) => s.setSidebar)
  const showOnMap = useGame((s) => s.showOnMap)
  const [open, setOpen] = useState<null | 'wires' | 'survey' | 'reviews' | CreativeTask>(null)

  const target = me.daily.target ? objects[me.daily.target] : null
  const doneCount = me.daily.done.length

  const action = (id: DailyTaskId) => {
    if (id === 'wires') setOpen('wires')
    else if (id === 'survey') setOpen('survey')
    else if (id === 'reviews') setOpen('reviews')
    else if (id === 'delivery' && target) {
      showOnMap(target.id)
    } else if (id === 'patrol') {
      setPanel(null)
      setSidebar(false)
    }
  }

  return (
    <div className="space-y-6 p-4">
      <Section title="Задания на сегодня" aside={<span className="text-xs text-[var(--color-muted)] tabular-nums">{doneCount} из {DAILY_TASKS.length}</span>}>
        <div className="space-y-2">
          {DAILY_TASKS.map((t) => {
            const done = me.daily.done.includes(t.id)
            let hint = t.text
            if (t.id === 'delivery' && target) hint = `Отнеси посылку: ${target.name} (${DISTRICT_BY_ID[target.districtId].name}). Найди дом с оранжевой меткой на карте и нажми на него.`
            if (t.id === 'patrol') hint = `${t.text} Открыто сегодня: ${Math.min(5, me.daily.visited?.length ?? 0)} из 5.`
            return (
              <div key={t.id} className={`flex gap-3 rounded-2xl p-3 ${done ? 'bg-[#e9f5ec]' : 'bg-[var(--color-soft)]'}`}>
                <div className="relative shrink-0">
                  <KindArt kind={TASK_ART[t.id]} size={44} />
                  {done && <span className="absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#1f8a4c] text-[11px] font-bold text-white">✓</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-semibold">{t.title}</div>
                    <Money value={t.reward} size={14} />
                  </div>
                  <p className="mt-0.5 text-[13px] leading-snug text-[var(--color-muted)]">{hint}</p>
                  {!done && (
                    <button className="btn-primary mt-2 !h-9 !text-[13px]" onClick={() => action(t.id)}>
                      {t.id === 'delivery' ? 'Показать дом' : t.id === 'patrol' ? 'К карте' : 'Начать'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-xs leading-relaxed text-[var(--color-muted)]">Задания обновляются каждый день. Выполнил хотя бы одно, и ты считаешься активным жителем: город растёт быстрее.</p>
      </Section>

      <Section title="Творческие задания" aside={<span className="text-xs text-[var(--color-muted)]">до {config.creativePerStar * 5} за работу</span>}>
        <div className="space-y-2">
          {config.creativeTasks.map((t) => {
            const subs = me.submissions.filter((s) => s.taskId === t.id)
            const last = subs.at(-1)
            // One accepted work per task: once accepted, the task is done for good.
            const accepted = subs.map((s) => reviews.find((r) => r.id === s.id)).find((r) => r?.status === 'approved')
            const review = accepted ?? (last ? reviews.find((r) => r.id === last.id) : undefined)
            const status = accepted ? 'approved' : !last ? null : !review ? 'pending' : review.status
            return (
              <div key={t.id} className="rounded-2xl border border-[var(--color-line)] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">{t.title}</div>
                    <div className="text-xs text-[var(--color-muted)]">{t.kind === 'drawing' ? 'Рисунок' : 'Текст'}</div>
                  </div>
                  {status === 'pending' && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">На проверке</span>}
                  {status === 'approved' && review && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                      Выполнено ★{review.rating}
                      {review.featured ? ' · в галерее' : ''}
                    </span>
                  )}
                  {status === 'rejected' && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">Не принято</span>}
                </div>
                <p className="mt-1.5 text-[13px] leading-snug text-[#3a4554]">{t.text}</p>
                {status !== 'pending' && status !== 'approved' && (
                  <button className="btn-flat mt-2 !h-9 !text-[13px]" onClick={() => setOpen(t)}>
                    {status === 'rejected' ? 'Попробовать ещё раз' : 'Выполнить'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
        <p className="text-xs leading-relaxed text-[var(--color-muted)]">Работы проверяет основатель города. Лучшие работы основатель отмечает звездой, и они попадают в «Галерею» (вкладка «Ещё»).</p>
      </Section>

      {open === 'wires' && <WiresGame onClose={() => setOpen(null)} />}
      {open === 'survey' && <SurveyModal onClose={() => setOpen(null)} />}
      {open === 'reviews' && <RateModal onClose={() => setOpen(null)} />}
      {open && typeof open === 'object' && <CreativeModal task={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

function CreativeModal({ task, onClose }: { task: CreativeTask; onClose: () => void }) {
  const submit = useGame((s) => s.submitCreative)
  const [text, setText] = useState('')
  const send = async (content: string) => {
    if (await submit(task.id, task.kind, content)) onClose()
  }
  return (
    <Modal title={task.title} onClose={onClose}>
      <p className="mb-3 text-sm leading-relaxed text-[#3a4554]">{task.text}</p>
      {task.kind === 'drawing' ? (
        <DrawingPad onSave={(d) => void send(d)} />
      ) : (
        <div className="space-y-3">
          <label htmlFor="creative-text" className="sr-only">
            Твой ответ
          </label>
          <textarea
            id="creative-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            rows={8}
            placeholder="Пиши здесь…"
            className="w-full rounded-2xl border border-[var(--color-line)] bg-[var(--color-soft)] p-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
          />
          <div className="flex items-center justify-between text-xs text-[var(--color-muted)]">
            <span className="tabular-nums">{text.length} / 2000</span>
          </div>
          <button className="btn-primary w-full" disabled={text.trim().length < 20} onClick={() => void send(text.trim())}>
            Отправить на проверку
          </button>
          {text.trim().length < 20 && <p className="text-xs text-[var(--color-muted)]">Напиши хотя бы пару предложений.</p>}
        </div>
      )}
    </Modal>
  )
}

function RateModal({ onClose }: { onClose: () => void }) {
  const uid = useGame((s) => s.uid)
  const accounts = useGame((s) => s.accounts)
  const names = useGame((s) => s.names)
  const rate = useGame((s) => s.rate)
  const showOnMap = useGame((s) => s.showOnMap)
  const me = useMe()
  const list = Object.values(accounts).filter((a) => a.uid !== uid && a.business)
  return (
    <Modal title="Оцени заведения жителей" onClose={onClose}>
      {list.length === 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-[var(--color-muted)]">
            Пока никто, кроме тебя, не открыл своё заведение. Сегодня вместо оценки сходи в кафе «Полночь»: найди его на карте и нажми на него.
          </p>
          <button
            className="btn-primary w-full"
            onClick={() => {
              onClose()
              showOnMap(MIDNIGHT_ID)
            }}
          >
            Где «Полночь»?
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map(({ uid: id, business }) => {
            const biz = business!
            const r = averageRating(id, accounts)
            return (
              <div key={id} className="flex items-center gap-3 rounded-2xl bg-[var(--color-soft)] p-3">
                <KindArt kind="business" size={44} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{biz.name}</div>
                  <div className="text-xs text-[var(--color-muted)]">
                    {BUSINESS_TYPE_BY_ID[biz.type].label} · владелец {names[id]?.name || 'житель'} · {r.count ? `★ ${r.avg.toFixed(1)} (${fmt.format(r.count)})` : 'нет оценок'}
                  </div>
                </div>
                <Stars value={me.ratings[id] ?? 0} onChange={(v) => void rate(id, v)} size={20} />
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}
