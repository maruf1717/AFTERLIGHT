import { useEffect, useMemo, useRef, useState } from 'react'
import { SURVEY_QUESTIONS } from '../../game/catalog'
import { useGame, useMe } from '../../game/store'
import { Modal } from './common'

const WIRE_COLORS = ['#d32f2f', '#f2a516', '#2f63c9', '#3f8f5a']

/** Connect wires of the same colour, left to right. */
export function WiresGame({ onClose }: { onClose: () => void }) {
  const completeDaily = useGame((s) => s.completeDaily)
  const right = useMemo(() => [...WIRE_COLORS].sort(() => Math.random() - 0.5), [])
  const [picked, setPicked] = useState<number | null>(null)
  const [links, setLinks] = useState<Record<number, number>>({})
  const [wrong, setWrong] = useState(false)
  const done = Object.keys(links).length === WIRE_COLORS.length

  useEffect(() => {
    if (done) {
      void completeDaily('wires')
      const t = setTimeout(onClose, 900)
      return () => clearTimeout(t)
    }
  }, [done, completeDaily, onClose])

  const pickRight = (ri: number) => {
    if (picked === null) return
    if (WIRE_COLORS[picked] === right[ri]) {
      setLinks({ ...links, [picked]: ri })
    } else {
      setWrong(true)
      setTimeout(() => setWrong(false), 400)
    }
    setPicked(null)
  }

  const y = (i: number) => 40 + i * 70
  return (
    <Modal title="Почини проводку на ТЭЦ" onClose={onClose}>
      <p className="text-sm text-[var(--color-muted)]">Нажми на провод слева, потом на клемму того же цвета справа.</p>
      <svg viewBox="0 0 320 300" className={`mt-3 w-full rounded-2xl bg-[#2b3138] ${wrong ? 'animate-pulse' : ''}`}>
        {Object.entries(links).map(([l, r]) => (
          <path key={l} d={`M54 ${y(+l)} C160 ${y(+l)} 160 ${y(r)} 266 ${y(r)}`} stroke={WIRE_COLORS[+l]} strokeWidth="9" fill="none" strokeLinecap="round" />
        ))}
        {WIRE_COLORS.map((c, i) => (
          <g key={c} onClick={() => !(i in links) && setPicked(i)} className="cursor-pointer">
            <rect x="10" y={y(i) - 16} width="44" height="32" rx="6" fill={c} stroke={picked === i ? '#fff' : 'transparent'} strokeWidth="3" />
          </g>
        ))}
        {right.map((c, i) => (
          <g key={c} onClick={() => pickRight(i)} className="cursor-pointer">
            <rect x="266" y={y(i) - 16} width="44" height="32" rx="6" fill="#4a525c" stroke={c} strokeWidth="5" />
          </g>
        ))}
      </svg>
      {done && <p className="mt-3 text-center font-semibold text-[#1f8a4c]">Готово! Ток пошёл.</p>}
    </Modal>
  )
}

export function SurveyModal({ onClose }: { onClose: () => void }) {
  const me = useMe()
  const players = useGame((s) => s.players)
  const answer = useGame((s) => s.answerSurvey)
  const idx = me.daily.surveyIdx ?? 0
  const q = SURVEY_QUESTIONS[idx]
  const date = me.daily.date
  const tally = q.options.map((_, i) => Object.values(players).filter((p) => p.survey?.[date] === i).length)
  const total = tally.reduce((a, b) => a + b, 0)
  const mine = me.survey?.[date]
  return (
    <Modal title="Опрос горожан" onClose={onClose}>
      <p className="font-display text-lg font-semibold">{q.q}</p>
      <div className="mt-4 space-y-2">
        {q.options.map((o, i) => (
          <button
            key={o}
            disabled={mine !== undefined}
            onClick={() => void answer(i)}
            className={`relative w-full overflow-hidden rounded-2xl border p-3 text-left text-sm font-semibold transition ${mine === i ? 'border-[var(--color-ink)]' : 'border-[var(--color-line)] hover:bg-[var(--color-soft)]'}`}
          >
            {mine !== undefined && <span className="absolute inset-y-0 left-0 bg-[#2f63c9]/12" style={{ width: `${total ? (tally[i] / total) * 100 : 0}%` }} />}
            <span className="relative flex justify-between">
              {o}
              {mine !== undefined && <span className="tabular-nums">{total ? Math.round((tally[i] / total) * 100) : 0}%</span>}
            </span>
          </button>
        ))}
      </div>
      {mine !== undefined && <p className="mt-3 text-xs text-[var(--color-muted)]">Проголосовали {total}. Завтра будет новый вопрос.</p>}
    </Modal>
  )
}

const PALETTE = ['#17202b', '#ffffff', '#d32f2f', '#f2a516', '#f6d35b', '#3f8f5a', '#2f63c9', '#7a4b8c', '#8a5a3a', '#f4b6c2']

/** Finger / mouse drawing that exports a small JPEG. */
export function DrawingPad({ onSave }: { onSave: (dataUrl: string) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [color, setColor] = useState('#17202b')
  const [size, setSize] = useState(6)
  const drawing = useRef(false)
  const last = useRef<[number, number] | null>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    const ctx = canvas.current!.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 640, 640)
  }, [])

  const point = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * 640, ((e.clientY - r.top) / r.height) * 640] as [number, number]
  }
  const line = (a: [number, number], b: [number, number]) => {
    const ctx = canvas.current!.getContext('2d')!
    ctx.strokeStyle = color
    ctx.lineWidth = size * 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(...a)
    ctx.lineTo(...b)
    ctx.stroke()
  }
  const exportSmall = () => {
    const out = document.createElement('canvas')
    out.width = out.height = 360
    out.getContext('2d')!.drawImage(canvas.current!, 0, 0, 360, 360)
    return out.toDataURL('image/jpeg', 0.72)
  }

  return (
    <div className="space-y-3">
      <canvas
        ref={canvas}
        width={640}
        height={640}
        className="aspect-square w-full touch-none rounded-2xl border border-[var(--color-line)] bg-white"
        onPointerDown={(e) => {
          ;(e.target as HTMLCanvasElement).setPointerCapture(e.pointerId)
          drawing.current = true
          last.current = point(e)
          line(last.current, last.current)
          setDirty(true)
        }}
        onPointerMove={(e) => {
          if (!drawing.current || !last.current) return
          const p = point(e)
          line(last.current, p)
          last.current = p
        }}
        onPointerUp={() => {
          drawing.current = false
          last.current = null
        }}
      />
      <div className="flex flex-wrap items-center gap-1.5">
        {PALETTE.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            aria-label={`Цвет ${c}`}
            className="h-8 w-8 rounded-full border-2"
            style={{ background: c, borderColor: color === c ? '#2f63c9' : '#d5d9de' }}
          />
        ))}
      </div>
      <div className="flex items-center gap-3">
        <label className="flex flex-1 items-center gap-2 text-xs text-[var(--color-muted)]">
          Толщина
          <input type="range" min={2} max={24} value={size} onChange={(e) => setSize(+e.target.value)} className="flex-1" />
        </label>
        <button
          className="btn-flat"
          onClick={() => {
            const ctx = canvas.current!.getContext('2d')!
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, 640, 640)
            setDirty(false)
          }}
        >
          Очистить
        </button>
      </div>
      <button className="btn-primary w-full" disabled={!dirty} onClick={() => onSave(exportSmall())}>
        Отправить рисунок
      </button>
    </div>
  )
}
