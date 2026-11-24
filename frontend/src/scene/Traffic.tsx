import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { DISTRICTS, PITCH } from '../data/city'
import { createRng } from '../lib/random'
import { useCity } from '../store/cityStore'

interface Car {
  axis: 'x' | 'z'
  lane: number
  from: number
  to: number
  dir: 1 | -1
  speed: number
  t: number
}

export const CITY_WEST = -118
export const CITY_EAST = 118
/** East-west avenues that connect the three districts. */
export const AVENUES = [-PITCH / 2, PITCH / 2, (-PITCH * 5) / 2 + PITCH, (PITCH * 5) / 2 - PITCH]

const CAR_COLORS = ['#c0392b', '#f4f4f2', '#2c3e50', '#2e86c1', '#d4ac0d', '#7f8c8d', '#1e8449', '#e67e22', '#1c1c1c']

/** Small cars driving along the streets. Purely ambient, makes the city feel alive. */
export function Traffic({ count = 70 }: { count?: number }) {
  const night = useCity((s) => s.night)
  const body = useRef<THREE.InstancedMesh>(null)
  const cabin = useRef<THREE.InstancedMesh>(null)
  const lights = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const cars = useMemo<Car[]>(() => {
    const rng = createRng(77)
    return Array.from({ length: count }, (_, i): Car => {
      const dir: 1 | -1 = rng.chance(0.5) ? 1 : -1
      if (i < count * 0.55) {
        return { axis: 'x', lane: rng.pick(AVENUES) + dir * 0.95, from: CITY_WEST, to: CITY_EAST, dir, speed: rng.range(6, 11), t: rng.next() }
      }
      const d = rng.pick(DISTRICTS)
      const x = d.origin[0] + (rng.int(0, d.grid.cols) - d.grid.cols / 2) * PITCH
      const half = (d.grid.rows * PITCH) / 2
      return { axis: 'z', lane: x - dir * 0.95, from: d.origin[1] - half, to: d.origin[1] + half, dir, speed: rng.range(4, 8), t: rng.next() }
    })
  }, [count])

  useLayoutEffect(() => {
    const rng = createRng(99)
    const c = new THREE.Color()
    cars.forEach((_, i) => {
      body.current?.setColorAt(i, c.set(rng.pick(CAR_COLORS)))
    })
    if (body.current?.instanceColor) body.current.instanceColor.needsUpdate = true
  }, [cars])

  useFrame((_, dt) => {
    if (!body.current || !cabin.current || !lights.current) return
    const step = Math.min(dt, 0.1)
    cars.forEach((c, i) => {
      const len = c.to - c.from
      c.t = (c.t + (c.speed * step) / len) % 1
      const p = c.dir === 1 ? c.from + c.t * len : c.to - c.t * len
      if (c.axis === 'x') dummy.position.set(p, 0, c.lane)
      else dummy.position.set(c.lane, 0, p)
      const yaw = c.axis === 'x' ? (c.dir === 1 ? 0 : Math.PI) : c.dir === 1 ? -Math.PI / 2 : Math.PI / 2
      dummy.rotation.set(0, yaw, 0)

      dummy.position.y = 0.38
      dummy.updateMatrix()
      body.current!.setMatrixAt(i, dummy.matrix)
      dummy.position.y = 0.85
      dummy.translateX(-0.15)
      dummy.updateMatrix()
      cabin.current!.setMatrixAt(i, dummy.matrix)
      dummy.translateX(1.12)
      dummy.position.y = 0.42
      dummy.updateMatrix()
      lights.current!.setMatrixAt(i, dummy.matrix)
    })
    body.current.instanceMatrix.needsUpdate = true
    cabin.current.instanceMatrix.needsUpdate = true
    lights.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      <instancedMesh ref={body} args={[undefined, undefined, cars.length]} castShadow>
        <boxGeometry args={[2.1, 0.5, 1]} />
        <meshStandardMaterial roughness={0.35} metalness={0.3} />
      </instancedMesh>
      <instancedMesh ref={cabin} args={[undefined, undefined, cars.length]}>
        <boxGeometry args={[1.1, 0.45, 0.88]} />
        <meshStandardMaterial color="#2f3b47" roughness={0.2} metalness={0.4} />
      </instancedMesh>
      <instancedMesh ref={lights} args={[undefined, undefined, cars.length]} visible={night}>
        <boxGeometry args={[0.06, 0.14, 0.8]} />
        <meshBasicMaterial color="#fff3d6" toneMapped={false} />
      </instancedMesh>
    </group>
  )
}

/** Asphalt bridges between the district plates, on the avenues the traffic uses. */
export function Avenues() {
  const night = useCity((s) => s.night)
  return (
    <group>
      {AVENUES.map((z) => (
        <mesh key={z} position={[0, -0.04, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[CITY_EAST - CITY_WEST, 3.8]} />
          <meshStandardMaterial color={night ? '#202328' : '#55595f'} roughness={1} />
        </mesh>
      ))}
    </group>
  )
}
