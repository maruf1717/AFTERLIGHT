import { useState } from 'react'
import { testClockAllowed, useGame } from '../../game/store'

const HOUR = 3_600_000

/**
 * Test tools for the owner while the city is in one-player mode: move the game clock forward
 * and fill the open quarters with buildings in one tap. Hidden in a shared city.
 */
export function TestTools({ compact = false }: { compact?: boolean }) {
  const isOwner = useGame((s) => s.isOwner)
  const config = useGame((s) => s.config)
  const mode = useGame((s) => s.mode)
  const shiftTime = useGame((s) => s.shiftTime)
  const resetTime = useGame((s) => s.resetTime)
  const testActions = useGame((s) => s.testActions)
  const buildAll = useGame((s) => s.testBuildEverything)
  const [hours, setHours] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  if (!isOwner || !testClockAllowed(config, mode)) return null
  const offset = config.timeOffsetMs ?? 0
  const h = Math.round(offset / HOUR)
  const run = async (f: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await f()
    } finally {
      setBusy(false)
    }
  }
  const btn = 'btn-flat !h-9 !px-3 !text-[13px]'
  return (
    <div className="space-y-3 rounded-2xl border-2 border-dashed border-[#d9772b] bg-[#fff8ef] p-3">
      <div>
        <div className="text-sm font-bold">Время (только тест)</div>
        <div className="text-xs text-[var(--color-muted)]">
          {offset ? `Часы игры впереди на ${h >= 24 ? `${Math.floor(h / 24)} дн. ${h % 24} ч` : `${h} ч`}.` : 'Часы игры идут как настоящие.'} Работает только в режиме одного игрока.
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {[
          ['+1 час', HOUR],
          ['+6 часов', 6 * HOUR],
          ['+1 день', 24 * HOUR],
          ['+7 дней', 7 * 24 * HOUR],
        ].map(([label, ms]) => (
          <button key={label} className={btn} disabled={busy} onClick={() => void run(() => shiftTime(ms as number))}>
            {label}
          </button>
        ))}
      </div>
      {!compact && (
        <div className="flex gap-2">
          <input
            inputMode="numeric"
            placeholder="часов"
            value={hours}
            onChange={(e) => setHours(e.target.value.replace(/[^\d]/g, ''))}
            className="h-9 w-24 rounded-xl bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
          />
          <button className={btn} disabled={busy || !Number(hours)} onClick={() => void run(() => shiftTime(Number(hours) * HOUR)).then(() => setHours(''))}>
            Прокрутить
          </button>
        </div>
      )}
      <button className="btn-primary !h-10 w-full !text-[13px]" disabled={busy} onClick={() => void run(buildAll)}>
        Скупить все свободные участки и застроить
      </button>
      {offset > 0 &&
        (confirmReset ? (
          <div className="space-y-2 rounded-xl bg-white p-2.5 text-xs">
            <div>
              Действий «из будущего»: <b>{testActions()}</b>. Их придётся удалить: журнал жителя идёт только вперёд, и пока они в нём, новые действия в настоящем времени не засчитаются. Постройки, выручка и задания из теста пропадут.
            </div>
            <div className="flex flex-wrap gap-2">
              <button className={btn} disabled={busy} onClick={() => void run(() => resetTime(true)).then(() => setConfirmReset(false))}>
                Удалить тестовую историю и вернуть время
              </button>
              <button className={btn} onClick={() => setConfirmReset(false)}>
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <button className={btn + ' w-full'} onClick={() => setConfirmReset(true)}>
            Вернуть настоящее время
          </button>
        ))}
    </div>
  )
}
