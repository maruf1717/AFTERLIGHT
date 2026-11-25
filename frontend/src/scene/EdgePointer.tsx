import { useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * A label for a place on the map that stays on screen (round 2, 4.7): over the place while it is
 * visible, pressed to the edge with an arrow towards it when it is not.
 */
export function EdgePointer({ at, label }: { at: [number, number, number]; label: string }) {
  const { camera, size, gl } = useThree()
  const box = useRef<HTMLDivElement>(null)
  const arrow = useRef<HTMLDivElement>(null)
  const v = useMemo(() => new THREE.Vector3(), [])
  const host = useMemo(() => document.createElement('div'), [])
  useEffect(() => {
    const parent = gl.domElement.parentElement ?? document.body
    parent.appendChild(host)
    return () => void parent.removeChild(host)
  }, [gl, host])
  useFrame(() => {
    const el = box.current
    if (!el) return
    v.set(at[0], at[1], at[2]).project(camera)
    const behind = v.z > 1
    let x = (v.x * 0.5 + 0.5) * size.width
    let y = (-v.y * 0.5 + 0.5) * size.height
    if (behind) {
      x = size.width - x
      y = size.height - 1
    }
    const m = 70
    const inside = !behind && x > m && x < size.width - m && y > m + 120 && y < size.height - m - 80
    const cx = Math.min(size.width - m, Math.max(m, x))
    const cy = Math.min(size.height - m - 80, Math.max(m + 120, y))
    el.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`
    if (arrow.current) {
      arrow.current.style.display = inside ? 'none' : 'block'
      arrow.current.style.transform = `rotate(${Math.atan2(y - cy, x - cx)}rad)`
    }
  })
  return createPortal(
    <div ref={box} className="pointer-events-none absolute top-0 left-0 z-[15] flex items-center gap-1.5 rounded-full border-2 border-white bg-[#e0701a] px-3 py-1.5 font-display text-sm font-bold whitespace-nowrap text-white shadow-lg">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
        <circle cx="12" cy="9.5" r="2.5" />
      </svg>
      {label}
      <div ref={arrow} className="absolute top-1/2 left-1/2 h-0 w-0" style={{ display: 'none' }}>
        <svg width="40" height="20" viewBox="0 0 40 20" style={{ position: 'absolute', left: 22, top: -10 }} aria-hidden>
          <path d="M0 10h30M22 3l9 7-9 7" stroke="#e0701a" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>,
    host,
  )
}
