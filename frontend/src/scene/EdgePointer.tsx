import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const PIN =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>'
const ARROW =
  '<svg width="26" height="26" viewBox="0 0 26 26" style="position:absolute;left:-13px;top:-13px" aria-hidden="true"><circle cx="13" cy="13" r="12" fill="#e0701a" stroke="#fff" stroke-width="2"/><path d="M8 13h9M13.5 8.5 18 13l-4.5 4.5" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'

/**
 * A label for a place on the map that stays on screen (round 2, 4.7): over the place while it is
 * visible, pressed to the edge with an arrow towards it when it is not. Plain DOM next to the
 * canvas (the 3D scene cannot hold HTML elements).
 */
export function EdgePointer({ at, label }: { at: [number, number, number]; label: string }) {
  const { camera, size, gl } = useThree()
  const v = useMemo(() => new THREE.Vector3(), [])
  const el = useMemo(() => {
    const box = document.createElement('div')
    box.className =
      'pointer-events-none absolute top-0 left-0 z-[15] flex items-center gap-1.5 rounded-full border-2 border-white bg-[#e0701a] px-3 py-1.5 font-display text-sm font-bold whitespace-nowrap text-white shadow-lg'
    box.innerHTML = `${PIN}<span></span><div class="absolute top-1/2 left-1/2 h-0 w-0" style="display:none">${ARROW}</div>`
    return box
  }, [])
  useEffect(() => {
    ;(el.querySelector('span') as HTMLSpanElement).textContent = label
  }, [el, label])
  useEffect(() => {
    const parent = gl.domElement.parentElement ?? document.body
    parent.appendChild(el)
    return () => void el.remove()
  }, [gl, el])
  useFrame(() => {
    v.set(at[0], at[1], at[2]).project(camera)
    const behind = v.z > 1
    let x = (v.x * 0.5 + 0.5) * size.width
    let y = (-v.y * 0.5 + 0.5) * size.height
    if (behind) {
      x = size.width - x
      y = size.height - 1
    }
    const m = 70
    const top = m + 120
    const bottom = size.height - m - 80
    const inside = !behind && x > m && x < size.width - m && y > top && y < bottom
    const cx = Math.min(size.width - m, Math.max(m, x))
    const cy = Math.min(bottom, Math.max(top, y))
    el.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`
    // Off screen: a round arrow just outside the label, on the side of the place, pointing at it.
    const arrow = el.lastElementChild as HTMLDivElement
    arrow.style.display = inside ? 'none' : 'block'
    const ang = Math.atan2(y - cy, x - cx)
    const rx = el.offsetWidth / 2 + 16
    const ry = el.offsetHeight / 2 + 16
    arrow.style.transform = `translate(${Math.cos(ang) * rx}px, ${Math.sin(ang) * ry}px) rotate(${ang}rad)`
  })
  return null
}
