import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { DISTRICT_BY_ID } from '../data/city'
import { useGame } from '../game/store'
import { useCity } from '../store/cityStore'

const DISTRICT_OFFSET = new THREE.Vector3(0, 0.95, 1).normalize()
const BUILDING_OFFSET = new THREE.Vector3(0.55, 0.62, 1).normalize()

/**
 * Smoothly flies the camera (and the orbit target) to whatever the store says is in focus:
 * the selected building, otherwise the active district. Any manual drag cancels the flight.
 */
export function CameraRig() {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const nonce = useCity((s) => s.focusNonce)

  const goal = useRef({ pos: new THREE.Vector3(), target: new THREE.Vector3(), active: false })

  useEffect(() => {
    const { selectedBuildingId, activeDistrictId } = useCity.getState()
    const portrait = size.width < size.height
    const mobile = size.width < 768
    const g = goal.current
    const objects = useGame.getState().objects
    const b = selectedBuildingId ? useGame.getState().objectById[selectedBuildingId] : null
    if (b) {
      const dist = Math.max(24, b.height * 1.35 + 16) * (portrait ? 1.45 : 1)
      g.target.set(b.position[0], b.height * 0.45, b.position[1])
      // On phones the info sheet covers the bottom of the screen: aim lower so the building sits higher.
      if (mobile) g.target.y -= dist * 0.22
      g.pos.copy(g.target).addScaledVector(BUILDING_OFFSET, dist)
    } else {
      const d = DISTRICT_BY_ID[activeDistrictId]
      const tallest = Math.max(20, ...objects.filter((x) => x.districtId === d.id).map((x) => x.height))
      const dist = (92 + tallest * 0.75) * (portrait ? 1.4 : 1)
      // Desktop has a sidebar on the left: shift the aim so the district sits in the free space.
      g.target.set(d.origin[0] - (mobile ? 0 : 12), 0, d.origin[1] + (portrait ? -28 : 4))
      g.pos.copy(g.target).addScaledVector(DISTRICT_OFFSET, dist)
    }
    g.active = true
  }, [nonce, size.width, size.height])

  useEffect(() => {
    if (!controls) return
    const stop = () => (goal.current.active = false)
    controls.addEventListener('start', stop)
    return () => controls.removeEventListener('start', stop)
  }, [controls])

  useFrame((_, dt) => {
    const g = goal.current
    if (!g.active || !controls) return
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 3)
    camera.position.lerp(g.pos, k)
    controls.target.lerp(g.target, k)
    controls.update()
    if (camera.position.distanceTo(g.pos) < 0.05 && controls.target.distanceTo(g.target) < 0.05) g.active = false
  })

  return null
}
