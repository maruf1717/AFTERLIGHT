import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { DISTRICTS, PITCH } from '../data/city'
import { createRng } from '../lib/random'
import { useCity } from '../store/cityStore'

interface Car {
  axis: 'x' | 'z'
  /** Coordinate on the other axis (the lane). */
  lane: number
  from: number
  to: number
  dir: 1 | -1
  speed: number
  t: number
}

const WEST = -118
const EAST = 118

/** Small glowing "cars" driving along streets. Purely ambient — makes the city feel alive. */
export function Traffic({ count = 70 }: { count?: number }) {
  const night = useCity((s) => s.night)
  const ref = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const cars = useMemo<Car[]>(() => {
    const rng = createRng(77)
    const out: Car[] = []
    // East-west avenues that connect the three districts.
    const avenues = [-PITCH / 2, PITCH / 2, (-PITCH * 5) / 2 + PITCH, (PITCH * 5) / 2 - PITCH]
    for (let i = 0; i < count; i++) {
      const dir: 1 | -1 = rng.chance(0.5) ? 1 : -1
      if (i < count * 0.55) {
        out.push({ axis: 'x', lane: rng.pick(avenues) + dir * 0.9, from: WEST, to: EAST, dir, speed: rng.range(7, 13), t: rng.next() })
      } else {
        const d = rng.pick(DISTRICTS)
        const c = rng.int(0, d.grid.cols)
        const x = d.origin[0] + (c - d.grid.cols / 2) * PITCH
        const half = (d.grid.rows * PITCH) / 2
        out.push({ axis: 'z', lane: x + dir * 0.9, from: d.origin[1] - half, to: d.origin[1] + half, dir, speed: rng.range(5, 9), t: rng.next() })
      }
    }
    return out
  }, [count])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const head = new THREE.Color('#fef9c3')
    const tail = new THREE.Color('#f87171')
    cars.forEach((c, i) => mesh.setColorAt(i, c.dir === 1 ? head : tail))
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [cars])

  useFrame((_, dt) => {
    const mesh = ref.current
    if (!mesh) return
    const step = Math.min(dt, 0.1)
    cars.forEach((c, i) => {
      const len = c.to - c.from
      c.t = (c.t + (c.speed * step) / len) % 1
      const p = c.dir === 1 ? c.from + c.t * len : c.to - c.t * len
      if (c.axis === 'x') {
        dummy.position.set(p, 0.35, c.lane)
        dummy.rotation.set(0, 0, 0)
      } else {
        dummy.position.set(c.lane, 0.35, p)
        dummy.rotation.set(0, Math.PI / 2, 0)
      }
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, cars.length]} visible={night}>
      <boxGeometry args={[1.1, 0.35, 0.55]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  )
}

/** Asphalt bridges between district plates, on the same avenues the traffic uses. */
export function Avenues() {
  const night = useCity((s) => s.night)
  const lanes = [-PITCH / 2, PITCH / 2, (-PITCH * 5) / 2 + PITCH, (PITCH * 5) / 2 - PITCH]
  return (
    <group>
      {lanes.map((z) => (
        <mesh key={z} position={[0, -0.04, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[EAST - WEST, 3.6]} />
          <meshStandardMaterial color={night ? '#14161f' : '#3d4049'} roughness={1} />
        </mesh>
      ))}
    </group>
  )
}
