import { useEffect, useRef, type ReactNode } from 'react'
import type { BuildingKind } from '../../data/types'
import type { CivicVisual, NeedId } from '../../game/catalog'

export const fmt = new Intl.NumberFormat('ru-RU')

/**
 * A number with its sign: «+1,7», «−0,3», and a plain «0» for (rounded) zero.
 * `sign: 'minus'` shows an amount that is taken away (people leaving) with a minus.
 */
export function fmtSigned(v: number, digits = 1, sign: 'auto' | 'minus' = 'auto') {
  const value = sign === 'minus' ? -Math.abs(v) : v
  const r = Number(value.toFixed(digits))
  if (r === 0 || Object.is(r, -0)) return '0'
  const body = Math.abs(r).toLocaleString('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits })
  return `${r > 0 ? '+' : '−'}${body}`
}

export const KIND_BY_VISUAL: Record<CivicVisual, BuildingKind> = {
  park: 'park',
  clinic: 'clinic',
  hospital: 'hospital',
  'water-tower': 'watertower',
  police: 'police',
  fire: 'fire',
  school: 'school',
  library: 'library',
  solar: 'solar',
  pump: 'pump',
  spire: 'tower',
  'plant-repair': 'plant',
}

export const NEED_COLOR: Record<NeedId, string> = {
  power: '#e0a526',
  water: '#2f86c9',
  housing: '#8b6bb8',
  jobs: '#5b6b7a',
  food: '#d9772b',
  health: '#d14b4b',
  education: '#2f63c9',
  safety: '#1f4fa0',
  leisure: '#3f8f5a',
}

/** A spark coin for the in-game currency. */
export function Spark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden className="inline-block shrink-0 align-[-3px]">
      <circle cx="10" cy="10" r="9" fill="#f6c343" stroke="#c9901a" strokeWidth="1.2" />
      <path d="M10 4.5l1.3 3.8 3.9.1-3.1 2.4 1.1 3.8L10 12.3l-3.2 2.3 1.1-3.8-3.1-2.4 3.9-.1z" fill="#fff6d6" />
    </svg>
  )
}

/** «92,6 тыс.», «1,2 млн» for big amounts; the exact number below 10 000. */
export function fmtShort(v: number, tight = false) {
  const n = Math.round(v)
  const a = Math.abs(n)
  const one = (x: number) => x.toLocaleString('ru-RU', { maximumFractionDigits: 1 })
  if (a >= 1_000_000) return `${one(Math.floor(n / 100_000) / 10)} млн`
  // On a narrow phone «92 тыс.» instead of «92,6 тыс.» (from 100 000 always whole thousands).
  if (a >= 10_000) return tight || a >= 100_000 ? `${Math.floor(n / 1000)} тыс.` : `${one(Math.floor(n / 100) / 10)} тыс.`
  return fmt.format(n)
}

export function Money({ value, size = 15, short = false, tight = false }: { value: number; size?: number; short?: boolean; tight?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 font-display font-semibold whitespace-nowrap tabular-nums" title={short ? fmt.format(Math.round(value)) : undefined}>
      <Spark size={size} />
      {short ? fmtShort(value, tight) : fmt.format(Math.round(value))}
    </span>
  )
}

export function Bar({ value, color, h = 8 }: { value: number; color: string; h?: number }) {
  return (
    <div className="overflow-hidden rounded-full bg-black/10" style={{ height: h }}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
    </div>
  )
}

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-[15px] font-semibold">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  )
}

/**
 * Esc closes the topmost open window. Every window registers its close action here while it
 * is open; the keyboard handler in App.tsx calls the newest one first.
 */
const escStack: { current: () => void }[] = []
export function closeTopWindow(): boolean {
  const top = escStack.at(-1)
  if (!top) return false
  top.current()
  return true
}
export function useEscape(onClose: () => void, active = true) {
  const ref = useRef(onClose)
  useEffect(() => {
    ref.current = onClose
  })
  useEffect(() => {
    if (!active) return
    const entry = { current: () => ref.current() }
    escStack.push(entry)
    return () => {
      const i = escStack.indexOf(entry)
      if (i >= 0) escStack.splice(i, 1)
    }
  }, [active])
}

/** How many modal windows are open: the 3D city stops redrawing under them (round 2, 3.1). */
export const modalCount = { n: 0, listeners: new Set<() => void>() }
function useModalOpen() {
  useEffect(() => {
    modalCount.n++
    modalCount.listeners.forEach((f) => f())
    return () => {
      modalCount.n--
      modalCount.listeners.forEach((f) => f())
    }
  }, [])
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  useEscape(onClose)
  useModalOpen()
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#17202b]/45 desk:items-center desk:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0" aria-label="Закрыть" onClick={onClose} />
      <div className="anim-pop relative flex max-h-[92vh] w-full max-w-[560px] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl desk:rounded-[28px]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--color-line)] px-5 py-4">
          <h2 className="font-display text-lg font-bold">{title}</h2>
          <button className="btn-flat !h-9 !w-9 !px-0" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-5 pb-[max(20px,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  )
}

export function Sparkline({ data, color = '#2f63c9', height = 56 }: { data: number[]; color?: string; height?: number }) {
  if (data.length < 2) return <div className="text-xs text-[var(--color-muted)]">График появится через пару игровых дней.</div>
  const w = 300
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = Math.max(1, max - min)
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, height - 6 - ((v - min) / span) * (height - 14)] as const)
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const last = pts.at(-1)!
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="h-14 w-full" preserveAspectRatio="none" aria-label="Население по дням">
      <path d={`${line} L${w} ${height} L0 ${height} Z`} fill={color} fillOpacity="0.12" />
      <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r="3.5" fill={color} />
    </svg>
  )
}

export function Stars({ value, onChange, size = 22 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <div className="inline-flex gap-0.5" role={onChange ? 'radiogroup' : undefined} aria-label="Оценка">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          aria-label={`${n} из 5`}
          className="leading-none disabled:cursor-default"
          style={{ fontSize: size, color: n <= value ? '#f2a516' : '#d5d9de' }}
        >
          ★
        </button>
      ))}
    </div>
  )
}
