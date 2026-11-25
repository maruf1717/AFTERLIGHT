import { useState } from 'react'
import { displayName, donatedBy, useGame } from '../../game/store'
import { fmt } from './common'

type Board = 'builders' | 'creators' | 'business'

export function RatingPanel() {
  const accounts = useGame((s) => s.accounts)
  const reviews = useGame((s) => s.reviews)
  const names = useGame((s) => s.names)
  useGame((s) => s.players)
  const uid = useGame((s) => s.uid)
  const [board, setBoard] = useState<Board>('builders')

  const rows = Object.values(accounts)
    .map((a) => {
      const id = a.uid
      const value =
        board === 'builders'
          ? donatedBy(a)
          : board === 'creators'
            ? reviews.filter((r) => r.to === id && r.status === 'approved').reduce((s, r) => s + r.rating, 0)
            : (a.business?.totalEarned ?? 0)
      return { id, value, sub: board === 'business' && a.business ? a.business.name : '' }
    })
    .filter((r) => r.value > 0 || r.id === uid)
    .sort((a, b) => b.value - a.value)

  const unit = board === 'builders' ? 'Искр вложено' : board === 'creators' ? 'звёзд' : 'Искр выручки'
  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-[var(--color-soft)] p-1">
        {(
          [
            ['builders', 'Строители'],
            ['creators', 'Творцы'],
            ['business', 'Бизнесы'],
          ] as [Board, string][]
        ).map(([id, label]) => (
          <button key={id} onClick={() => setBoard(id)} className={`rounded-xl py-2 text-sm font-semibold ${board === id ? 'bg-white shadow-sm' : 'text-[var(--color-muted)]'}`}>
            {label}
          </button>
        ))}
      </div>
      <ol className="space-y-1.5">
        {rows.map((r, i) => (
          <li key={r.id} className={`flex items-center gap-3 rounded-2xl p-2.5 ${r.id === uid ? 'bg-[#fdf1df]' : 'bg-white'}`}>
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold ${i === 0 ? 'bg-[#f6c343] text-[#5a3d00]' : i === 1 ? 'bg-[#d5d9de]' : i === 2 ? 'bg-[#e0b48a]' : 'bg-[var(--color-soft)] text-[var(--color-muted)]'}`}
            >
              {i + 1}
            </span>
            {names[r.id]?.avatarUrl ? <img src={names[r.id]!.avatarUrl} alt="" className="h-8 w-8 rounded-full" /> : null}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">
                {displayName(r.id)}
                {r.id === uid && <span className="text-[var(--color-muted)]"> (ты)</span>}
              </div>
              {r.sub && <div className="truncate text-xs text-[var(--color-muted)]">{r.sub}</div>}
            </div>
            <div className="text-right">
              <div className="font-display text-sm font-semibold tabular-nums">{fmt.format(r.value)}</div>
              <div className="text-[10px] text-[var(--color-muted)]">{unit}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
