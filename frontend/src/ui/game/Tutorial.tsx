import { useState } from 'react'
import { TUTORIAL } from '../../game/catalog'
import { useGame, type Panel } from '../../game/store'
import { useCity } from '../../store/cityStore'
import { useIsMobile } from '../layout'
import { Money } from './common'

const PANEL: Record<(typeof TUTORIAL)[number]['id'], Panel> = { wires: 'tasks', clinic: 'projects', business: 'business', collect: 'business' }

/** First steps: one card over the map until all four are done. */
export function TutorialCard() {
  const step = useGame((s) => s.accounts[s.uid]?.tutorial)
  const status = useGame((s) => s.status)
  const panel = useGame((s) => s.panel)
  const setPanel = useGame((s) => s.setPanel)
  const selected = useCity((s) => s.selectedBuildingId)
  const pickPlot = useCity((s) => s.pickPlot)
  const [hidden, setHidden] = useState(() => {
    try {
      return sessionStorage.getItem('afterlight:tutorial-hidden') === '1'
    } catch {
      return false
    }
  })
  const mobile = useIsMobile()
  // On phones an open panel covers the map: the card waits until it closes.
  if (status !== 'ready' || step === undefined || step >= TUTORIAL.length || hidden || selected || pickPlot || (mobile && panel)) return null
  const s = TUTORIAL[step]
  return (
    <div
      className={`pointer-events-none absolute inset-x-3 bottom-[calc(max(10px,env(safe-area-inset-bottom))+76px)] z-20 flex justify-start pr-[60px] desk:inset-x-auto desk:top-[92px] desk:bottom-auto desk:left-1/2 desk:-translate-x-1/2 desk:pr-0 land:bottom-[80px] land:left-[92px] land:right-[76px]`}
    >
      <div className="panel pointer-events-auto flex w-full max-w-[420px] items-center gap-3 rounded-2xl p-2.5 pl-3.5">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold text-[#a0582c]">
            Шаг {step + 1} из {TUTORIAL.length} · награда <Money value={s.reward} size={11} />
          </div>
          <div className="truncate text-sm font-semibold">{s.title}</div>
        </div>
        <button className="btn-primary !h-9 shrink-0 !px-3 !text-[13px]" onClick={() => setPanel(PANEL[s.id])}>
          Начать
        </button>
        <button
          className="btn-flat !h-9 !w-9 shrink-0 !px-0"
          aria-label="Скрыть подсказку"
          onClick={() => {
            setHidden(true)
            try {
              sessionStorage.setItem('afterlight:tutorial-hidden', '1')
            } catch {
              /* fine */
            }
          }}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
