import { lazy, Suspense, type ComponentProps } from 'react'

/** Mini-games load when they are opened (T4). */
const Games = () => import('./MiniGames')
const Wires = lazy(() => Games().then((m) => ({ default: m.WiresGame })))
const Survey = lazy(() => Games().then((m) => ({ default: m.SurveyModal })))
const Drawing = lazy(() => Games().then((m) => ({ default: m.DrawingPad })))

type P<T extends keyof typeof import('./MiniGames')> = ComponentProps<(typeof import('./MiniGames'))[T]>

export const WiresGame = (p: P<'WiresGame'>) => (
  <Suspense fallback={null}>
    <Wires {...p} />
  </Suspense>
)
export const SurveyModal = (p: P<'SurveyModal'>) => (
  <Suspense fallback={null}>
    <Survey {...p} />
  </Suspense>
)
export const DrawingPad = (p: P<'DrawingPad'>) => (
  <Suspense fallback={null}>
    <Drawing {...p} />
  </Suspense>
)
