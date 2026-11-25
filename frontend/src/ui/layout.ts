import { useEffect, useState } from 'react'

/** Same rule as the `desk` variant in index.css: a computer or a big tablet held sideways. */
export const DESK_QUERY = '(min-width: 768px) and (min-height: 501px) and (pointer: fine), (min-width: 1025px) and (min-height: 501px)'
/** Same rule as the `land` variant: a phone on its side. */
export const LAND_QUERY = '(max-height: 500px) and (orientation: landscape)'

function useMedia(q: string) {
  const [m, setM] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const on = () => setM(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [q])
  return m
}

/** Phone layout (bottom tabs, sheets) in both orientations and on upright tablets. */
export function useIsMobile() {
  return !useMedia(DESK_QUERY)
}

export function useIsLandscapePhone() {
  return useMedia(LAND_QUERY)
}
