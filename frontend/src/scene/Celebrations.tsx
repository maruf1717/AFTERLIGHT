import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from '../game/store'
import { createRng, hashString } from '../lib/random'

const COLORS = ['#ffcf4a', '#ff6b4a', '#4ad1ff', '#7dff6b', '#ff4ad8', '#ffffff']
const PER_BURST = 70
const BURSTS = 4

/** Fireworks over a building that just opened. */
function Firework({ x, z, h, at, seed }: { x: number; z: number; h: number; at: number; seed: number }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const parts = useMemo(() => {
    const rng = createRng(seed)
    return Array.from({ length: PER_BURST * BURSTS }, (_, i) => {
      const burst = Math.floor(i / PER_BURST)
      const dir = new THREE.Vector3(rng.range(-1, 1), rng.range(-0.4, 1), rng.range(-1, 1)).normalize().multiplyScalar(rng.range(4, 8))
      return { burst, dir, color: COLORS[(burst + Math.floor(rng.next() * 3)) % COLORS.length], ox: rng.range(-4, 4), oz: rng.range(-4, 4) }
    })
  }, [seed])
  const o = useMemo(() => new THREE.Object3D(), [])
  const colored = useRef(false)
  useFrame(() => {
    const m = ref.current
    if (!m) return
    if (!colored.current) {
      const c = new THREE.Color()
      parts.forEach((p, i) => m.setColorAt(i, c.set(p.color)))
      if (m.instanceColor) m.instanceColor.needsUpdate = true
      colored.current = true
    }
    const t = (Date.now() - at) / 1000
    parts.forEach((p, i) => {
      const local = t - p.burst * 0.7
      if (local < 0 || local > 2.2) {
        o.scale.setScalar(0)
      } else {
        const cx = x + p.ox
        const cz = z + p.oz
        const cy = h + 6 + p.burst * 2.5
        o.position.set(cx + p.dir.x * local, cy + p.dir.y * local - 4.9 * local * local * 0.6, cz + p.dir.z * local)
        o.scale.setScalar(Math.max(0, 1 - local / 2.2) * 0.45)
      }
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, parts.length]} frustumCulled={false}>
      <sphereGeometry args={[0.5, 6, 6]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  )
}

export function Celebrations() {
  const celebrations = useGame((s) => s.celebrations)
  const objectById = useGame((s) => s.objectById)
  const live = celebrations.filter((c) => Date.now() - c.at < 7000)
  return (
    <group>
      {live.map((c) => {
        const b = objectById[c.id]
        if (!b) return null
        return <Firework key={c.id + c.at} x={b.position[0]} z={b.position[1]} h={b.height} at={c.at + 700} seed={hashString(c.id) + c.at} />
      })}
    </group>
  )
}
