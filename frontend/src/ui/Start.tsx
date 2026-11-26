import { useState } from 'react'
import { START_MONEY } from '../game/catalog'
import { useGame } from '../game/store'
import { fmt } from './Panels'

/** The first screen: name your city (each name only once). */
export function Start() {
  const create = useGame((s) => s.createCity)
  const mode = useGame((s) => s.mode)
  const [name, setName] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true)
    const e = await create(name)
    setErr(e)
    setBusy(false)
  }
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-gradient-to-b from-[#bcd6ea] to-[#93bf6a] p-4">
      <div className="anim-pop w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="font-display text-3xl font-bold">AFTERLIGHT</div>
        <p className="mt-1 text-sm text-[var(--color-muted)]">Построй свой город с нуля</p>
        <ul className="mt-4 space-y-2 text-[13px] leading-snug">
          <li>
            <b>Пустое поле и {fmt.format(START_MONEY)} монет.</b> Всё строишь ты сам: дороги, дома, работу, школы, электростанции.
          </li>
          <li>
            <b>Всё работает, только если стоит у дороги</b>, а дорога соединена с въездом в город слева.
          </li>
          <li>
            <b>Жителям нужен свет, вода, работа</b>, а потом магазины, сады, школы, врачи. Чего не хватает, о том они пишут сами.
          </li>
          <li>
            <b>Если люди долго очень несчастны, город откатится назад</b> — к последнему времени, когда все были довольны.
          </li>
        </ul>
        <label htmlFor="city-name" className="mt-5 block text-sm font-semibold">
          Название города
        </label>
        <input
          id="city-name"
          value={name}
          maxLength={24}
          onChange={(e) => {
            setName(e.target.value)
            setErr(null)
          }}
          onKeyDown={(e) => e.key === 'Enter' && !busy && void go()}
          placeholder="Например, Новоискринск"
          aria-invalid={!!err}
          className={`mt-1 h-11 w-full rounded-xl px-3 text-base outline-none focus:ring-2 ${err ? 'border-2 border-[#d93a2f] bg-[#fdecea] focus:ring-[#d93a2f]' : 'bg-[var(--color-soft)] focus:ring-[var(--color-brand)]'}`}
        />
        {err && <div className="mt-1 text-xs font-semibold text-[#d93a2f]">{err}</div>}
        <button className="btn-primary mt-4 w-full" disabled={busy || name.trim().length < 2} onClick={() => void go()}>
          Основать город
        </button>
        <p className="mt-3 text-xs text-[var(--color-muted)]">
          {mode === 'shared'
            ? 'Город сохраняется в твоём аккаунте: открой игру с любого устройства, и он будет на месте. Названия городов не повторяются.'
            : 'Игра открыта не в Claude: город сохранится только в этом браузере.'}
        </p>
      </div>
    </div>
  )
}
