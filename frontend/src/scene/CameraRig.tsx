import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { DISTRICT_BY_ID } from '../data/city'
import { useGame } from '../game/store'
import { useCity } from '../store/cityStore'
import { ISLAND } from './terrain'

const DISTRICT_OFFSET = new THREE.Vector3(0, 0.95, 1).normalize()
const BUILDING_OFFSET = new THREE.Vector3(0.45, 0.55, 1).normalize()
const UP = new THREE.Vector3(0, 1, 0)

/**
 * Smoothly flies the camera (and the controls' target) to whatever is in focus: the selected
 * building, a building shown after an action, otherwise the active district. Also runs the
 * on-screen zoom / rotate buttons and keeps the view over the island.
 */
export function CameraRig() {
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const nonce = useCity((s) => s.focusNonce)
  const cmd = useCity((s) => s.camCommand)

  const goal = useRef({ pos: new THREE.Vector3(), target: new THREE.Vector3(), active: false, speed: 3 })

  useEffect(() => {
    const { selectedBuildingId, viewTargetId, activeDistrictId } = useCity.getState()
    const portrait = size.width < size.height
    const mobile = size.width < 768
    const g = goal.current
    const objects = useGame.getState().objects
    const id = selectedBuildingId ?? viewTargetId
    const b = id ? useGame.getState().objectById[id] : null
    if (b) {
      const h = Math.max(b.height, 6)
      const dist = Math.max(22, h * 1.3 + 14) * (portrait ? 1.35 : 1)
      g.target.set(b.position[0], h * 0.4, b.position[1])
      // With a card open on a phone the bottom of the screen is covered: aim lower.
      if (mobile && selectedBuildingId) g.target.y -= dist * 0.22
      // Look at the facade: turn the usual offset to the side the building faces.
      const off = BUILDING_OFFSET.clone().applyAxisAngle(UP, b.rotation ?? 0)
      g.pos.copy(g.target).addScaledVector(off, dist)
      g.speed = viewTargetId && !selectedBuildingId ? 2.2 : 3
    } else {
      const d = DISTRICT_BY_ID[activeDistrictId]
      const tallest = Math.max(20, ...objects.filter((x) => x.districtId === d.id).map((x) => x.height))
      const dist = (92 + tallest * 0.75) * (portrait ? 1.4 : 1)
      const sidebar = !mobile && useGame.getState().sidebarOpen
      g.target.set(d.origin[0] - (sidebar ? 12 : 0), 0, d.origin[1] + (portrait ? -28 : 4))
      g.pos.copy(g.target).addScaledVector(DISTRICT_OFFSET, dist)
      g.speed = 3
    }
    g.active = true
  }, [nonce, size.width, size.height])

  // On-screen buttons: zoom and rotate around the current target.
  useEffect(() => {
    if (!cmd || !controls) return
    const g = goal.current
    const target = controls.target.clone()
    const offset = camera.position.clone().sub(target)
    if (cmd.type === 'in') offset.multiplyScalar(0.62)
    if (cmd.type === 'out') offset.multiplyScalar(1.55)
    if (cmd.type === 'left') offset.applyAxisAngle(UP, Math.PI / 4)
    if (cmd.type === 'right') offset.applyAxisAngle(UP, -Math.PI / 4)
    const len = THREE.MathUtils.clamp(offset.length(), 12, 420)
    offset.setLength(len)
    g.target.copy(target)
    g.pos.copy(target).add(offset)
    g.speed = 5
    g.active = true
  }, [cmd, controls, camera])

  useEffect(() => {
    if (!controls) return
    const stop = () => (goal.current.active = false)
    controls.addEventListener('start', stop)
    return () => controls.removeEventListener('start', stop)
  }, [controls])

  const tmp = useRef(new THREE.Vector3())
  useFrame((_, dt) => {
    if (!controls) return
    const g = goal.current
    if (g.active) {
      const k = 1 - Math.exp(-Math.min(dt, 0.1) * g.speed)
      camera.position.lerp(g.pos, k)
      controls.target.lerp(g.target, k)
      controls.update()
      if (camera.position.distanceTo(g.pos) < 0.05 && controls.target.distanceTo(g.target) < 0.05) g.active = false
    }
    // Keep the view over the island: panning stops at the coast.
    const t = controls.target
    const cx = THREE.MathUtils.clamp(t.x, ISLAND.west + 30, ISLAND.east - 30)
    const cz = THREE.MathUtils.clamp(t.z, ISLAND.north + 20, ISLAND.south - 20)
    const cy = THREE.MathUtils.clamp(t.y, 0, 60)
    if (cx !== t.x || cz !== t.z || cy !== t.y) {
      tmp.current.set(cx - t.x, cy - t.y, cz - t.z)
      t.add(tmp.current)
      camera.position.add(tmp.current)
    }
  })

  return null
}
