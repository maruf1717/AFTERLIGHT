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
    const { selectedBuildingId, viewTargetId, activeDistrictId, fitIds } = useCity.getState()
    const portrait = size.width < size.height
    const mobile = size.width < 768
    const g = goal.current
    const objects = useGame.getState().objects
    const id = selectedBuildingId ?? viewTargetId
    const b = id ? useGame.getState().objectById[id] : null
    const fit = !b && fitIds ? fitIds.map((x) => useGame.getState().objectById[x]).filter(Boolean) : []
    if (fit.length) {
      // Frame all of them: centre of the group, far enough for the widest side.
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
      for (const o of fit) {
        minX = Math.min(minX, o.position[0])
        maxX = Math.max(maxX, o.position[0])
        minZ = Math.min(minZ, o.position[1])
        maxZ = Math.max(maxZ, o.position[1])
      }
      const span = Math.max(maxX - minX, maxZ - minZ, 30) + 24
      const fov = THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov ?? 45)
      const aspect = size.width / size.height
      const dist = (span / 2 / Math.tan(fov / 2)) * (aspect < 1 ? 1 / aspect : 1) * 1.05
      g.target.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2)
      g.pos.copy(g.target).addScaledVector(new THREE.Vector3(0, 1.4, 0.75).normalize(), dist)
      g.speed = 2.5
    } else if (b) {
      const h = Math.max(b.height, 6)
      // The whole building in view: at least two and a half heights away.
      const dist = Math.max(26, h * 2.5) * (portrait ? 1.35 : 1)
      g.target.set(b.position[0], h * 0.4, b.position[1])
      // With a card open on a phone the bottom of the screen is covered: aim lower.
      if (mobile && selectedBuildingId) g.target.y -= dist * 0.22
      // Look at the facade: turn the usual offset to the side the building faces.
      const off = BUILDING_OFFSET.clone().applyAxisAngle(UP, b.rotation ?? 0)
      g.pos.copy(g.target).addScaledVector(off, dist)
      g.speed = viewTargetId && !selectedBuildingId ? 2.2 : 3
    } else {
      const d = DISTRICT_BY_ID[activeDistrictId]
      // Look at where the district is really built up: the middle of its buildings, not of its land.
      const built = objects.filter((x) => x.districtId === d.id && x.kind !== 'lot' && x.height > 1)
      const cx = built.length ? built.reduce((sum, x) => sum + x.position[0], 0) / built.length : d.origin[0]
      const cz = built.length ? built.reduce((sum, x) => sum + x.position[1], 0) / built.length : d.origin[1]
      const spread = built.length ? Math.max(...built.map((x) => Math.hypot(x.position[0] - cx, x.position[1] - cz))) : 60
      const tallest = Math.max(20, ...built.map((x) => x.height))
      const dist = Math.max(70, Math.min(150, spread * 1.5) + tallest * 0.5) * (portrait ? 1.45 : 1)
      const sidebar = !mobile && useGame.getState().sidebarOpen
      g.target.set(cx - (sidebar ? 12 : 0), 0, cz + (portrait ? -10 : 4))
      g.pos.copy(g.target).addScaledVector(DISTRICT_OFFSET, dist)
      g.speed = 3
    }
    g.active = true
  }, [nonce, size.width, size.height, camera])

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
