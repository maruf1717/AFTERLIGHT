import { lazy, Suspense, useEffect, useState } from 'react'
import { useGame } from './game/store'
import { BuildBar, BuildingCard, CitySheet, Complaints, RollbackModal, Toasts, TopBar } from './ui/Panels'
import { Start } from './ui/Start'

const World = lazy(() => import('./scene/World'))

export default function App() {
  const status = useGame((s) => s.status)
  const init = useGame((s) => s.init)
  const [sheet, setSheet] = useState(false)
  useEffect(() => {
    void init()
  }, [init])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useGame.getState()
      if (e.key === 'Escape') {
        if (sheet) setSheet(false)
        else if (st.selected) st.select(null)
        else st.setTool(null)
      }
      if ((e.key === 'r' || e.key === 'к') && st.tool?.kind === 'build') st.rotate()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheet])
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#bcd6ea]">
      {status === 'loading' && <div className="flex h-full items-center justify-center font-display text-lg font-semibold">Открываем город…</div>}
      {status === 'start' && <Start />}
      {status === 'play' && (
        <>
          <Suspense fallback={<div className="flex h-full items-center justify-center font-display text-lg font-semibold">Загружаем город…</div>}>
            <World />
          </Suspense>
          <TopBar onList={() => setSheet(true)} />
          <Complaints />
          <BuildingCard />
          <BuildBar />
          <Toasts />
          <RollbackModal />
          {sheet && <CitySheet onClose={() => setSheet(false)} />}
        </>
      )}
    </div>
  )
}
