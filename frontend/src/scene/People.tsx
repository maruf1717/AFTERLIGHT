import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { pointAt, right } from '../city/geometry'
import { PLAN } from '../city/plan'
import { SIDEWALK } from '../city/planner'
import { createRng } from '../lib/random'

const CLOTHES = ['#2f3d56', '#a23b36', '#e3ddd0', '#3c5a3a', '#6b4f8a', '#1f1f22', '#c78b2d', '#5c7894', '#8c8c8c', '#b85d7a']
const SKIN = ['#f1c9a5', '#d9a47c', '#a8714d', '#6e4a33', '#f5d6bf']

interface Walker {
  edge: number
  dir: 1 | -1
  side: 1 | -1
  s: number
  speed: number
  phase: number
}

/** Residents walking along the sidewalks, turning into other streets at junctions. */
export function People({ count = 140, stage = 0 }: { count?: number; stage?: number }) {
  const body = useRef<THREE.InstancedMesh>(null)
  const head = useRef<THREE.InstancedMesh>(null)
  const open = useMemo(() => new Set(PLAN.edges.filter((e) => e.stage <= stage && e.kind !== 'ring').map((e) => e.id)), [stage])
  const walkers = useMemo(() => {
    const rng = createRng(321)
    const edges = PLAN.edges.filter((e) => open.has(e.id) && e.kind !== 'arterial')
    const pool = edges.length ? edges : PLAN.edges.filter((e) => open.has(e.id))
    return Array.from({ length: count }, (): Walker => {
      const e = rng.pick(pool)
      return { edge: e.id, dir: rng.chance(0.5) ? 1 : -1, side: rng.chance(0.5) ? 1 : -1, s: rng.range(0, e.length), speed: rng.range(1.1, 1.6), phase: rng.range(0, 6) }
    })
  }, [count, open])

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
  const rnd = useMemo(() => createRng(5), [])
  useFrame(({ clock }, dt) => {
    if (!body.current || !head.current) return
    const step = Math.min(dt, 0.1)
    const time = clock.elapsedTime
    walkers.forEach((w, i) => {
      let e = PLAN.edges[w.edge]
      w.s += w.speed * step
      if (w.s > e.length) {
        const node = w.dir === 1 ? e.b : e.a
        const options = PLAN.nodes[node].edges.filter((id) => id !== w.edge && open.has(id))
        if (options.length) {
          const pick = options[Math.floor(rnd.next() * options.length)]
          w.edge = pick
          w.dir = PLAN.edges[pick].a === node ? 1 : -1
        } else w.dir = w.dir === 1 ? -1 : 1
        w.s = 0
        e = PLAN.edges[w.edge]
      }
      const along = w.dir === 1 ? w.s : e.length - w.s
      const { p, t } = pointAt(e.points, e.cum, along)
      const d = w.dir === 1 ? t : { x: -t.x, z: -t.z }
      const n = right(t)
      const off = (e.width / 2 + SIDEWALK * 0.55) * w.side
      const bob = Math.abs(Math.sin(time * 7 + w.phase)) * 0.04
      o.position.set(p.x + n.x * off, 0.67 + bob, p.z + n.z * off)
      o.rotation.set(0, Math.atan2(-d.z, d.x), 0)
      o.updateMatrix()
      body.current!.setMatrixAt(i, o.matrix)
      o.position.y = 1.37 + bob
      o.updateMatrix()
      head.current!.setMatrixAt(i, o.matrix)
    })
    body.current.instanceMatrix.needsUpdate = true
    head.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      <instancedMesh key={`b${stage}${count}`} ref={body} args={[undefined, undefined, walkers.length]} castShadow frustumCulled={false}>
        <capsuleGeometry args={[0.19, 0.7, 4, 8]} />
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
      <instancedMesh key={`h${stage}${count}`} ref={head} args={[undefined, undefined, walkers.length]} frustumCulled={false}>
        <sphereGeometry args={[0.15, 10, 10]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
    </group>
  )
}
