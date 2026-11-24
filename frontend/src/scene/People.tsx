import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { DISTRICTS, lotCenter } from '../data/city'
import { createRng } from '../lib/random'

const CLOTHES = ['#2f3d56', '#a23b36', '#e3ddd0', '#3c5a3a', '#6b4f8a', '#1f1f22', '#c78b2d', '#5c7894', '#8c8c8c', '#b85d7a']
const SKIN = ['#f1c9a5', '#d9a47c', '#a8714d', '#6e4a33', '#f5d6bf']

interface Walker {
  cx: number
  cz: number
  t: number
  speed: number
  dir: 1 | -1
  phase: number
}

const HALF = 4.75 // sidewalk ring around each block

function perimeter(t: number): [number, number, number] {
  const s = ((t % 4) + 4) % 4
  const side = Math.floor(s)
  const f = s - side
  const a = -HALF + f * 2 * HALF
  switch (side) {
    case 0:
      return [a, -HALF, 0]
    case 1:
      return [HALF, a, Math.PI / 2]
    case 2:
      return [-a, HALF, Math.PI]
    default:
      return [-HALF, -a, -Math.PI / 2]
  }
}

/** Small residents walking around the blocks. */
export function People({ count = 140 }: { count?: number }) {
  const body = useRef<THREE.InstancedMesh>(null)
  const head = useRef<THREE.InstancedMesh>(null)
  const walkers = useMemo(() => {
    const rng = createRng(321)
    const lots = DISTRICTS.flatMap((d) => {
      const out: [number, number, number][] = []
      for (let r = 0; r < d.grid.rows; r++)
        for (let c = 0; c < d.grid.cols; c++) {
          const [x, z] = lotCenter(d, c, r)
          out.push([x, z, d.id === 'industrial' ? 0.4 : d.id === 'downtown' ? 1.4 : 1])
        }
      return out
    })
    const out: Walker[] = []
    while (out.length < count) {
      const [cx, cz, w] = rng.pick(lots)
      if (rng.next() > w * 0.7) continue
      out.push({ cx, cz, t: rng.range(0, 4), speed: rng.range(0.06, 0.12), dir: rng.chance(0.5) ? 1 : -1, phase: rng.range(0, 6) })
    }
    return out
  }, [count])

  useLayoutEffect(() => {
    const rng = createRng(11)
    const c = new THREE.Color()
    walkers.forEach((_, i) => {
      body.current?.setColorAt(i, c.set(rng.pick(CLOTHES)))
      head.current?.setColorAt(i, c.set(rng.pick(SKIN)))
    })
    if (body.current?.instanceColor) body.current.instanceColor.needsUpdate = true
    if (head.current?.instanceColor) head.current.instanceColor.needsUpdate = true
  }, [walkers])

  const o = useMemo(() => new THREE.Object3D(), [])
  useFrame(({ clock }, dt) => {
    if (!body.current || !head.current) return
    const step = Math.min(dt, 0.1)
    const time = clock.elapsedTime
    walkers.forEach((w, i) => {
      w.t += w.speed * step * w.dir
      const [lx, lz, yaw] = perimeter(w.t)
      const bob = Math.abs(Math.sin(time * 7 + w.phase)) * 0.04
      o.position.set(w.cx + lx, 0.62 + bob, w.cz + lz)
      o.rotation.set(0, yaw + (w.dir < 0 ? Math.PI : 0), 0)
      o.updateMatrix()
      body.current!.setMatrixAt(i, o.matrix)
      o.position.y = 1.32 + bob
      o.updateMatrix()
      head.current!.setMatrixAt(i, o.matrix)
    })
    body.current.instanceMatrix.needsUpdate = true
    head.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      <instancedMesh ref={body} args={[undefined, undefined, walkers.length]} castShadow frustumCulled={false}>
        <capsuleGeometry args={[0.19, 0.7, 4, 8]} />
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={head} args={[undefined, undefined, walkers.length]} frustumCulled={false}>
        <sphereGeometry args={[0.15, 10, 10]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
    </group>
  )
}
