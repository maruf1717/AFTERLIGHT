import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { pointAt, right } from '../city/geometry'
import { PLAN, roadOpen } from '../city/plan'
import { SIDEWALK } from '../city/planner'
import { CAR_POSITIONS } from '../city/traffic'
import { createRng } from '../lib/random'

const TOPS = ['#2f3d56', '#a23b36', '#e3ddd0', '#3c5a3a', '#6b4f8a', '#c78b2d', '#5c7894', '#d8d2c4', '#b85d7a', '#2a6f73', '#e0a03a']
const PANTS = ['#2b3442', '#1f1f22', '#4a5568', '#6b5a45', '#3d4f6b', '#8c8577']
const SKIN = ['#f1c9a5', '#d9a47c', '#a8714d', '#6e4a33', '#f5d6bf', '#c68a62']
const HAIR = ['#2a1d14', '#4a3222', '#1b1b1b', '#8a5a2b', '#c9a066', '#6b6b6b', '#3a2a1e']
const SHOES = ['#1b1b1b', '#f2f0ea', '#5a3a22']

interface Walker {
  edge: number
  dir: 1 | -1
  side: 1 | -1
  s: number
  speed: number
  phase: number
  scale: number
  longHair: boolean
  /** Crossing a junction: straight line from one sidewalk corner to the next. */
  cross: { ax: number; az: number; bx: number; bz: number; len: number; t: number } | null
}

/** Is any moving car within `r` metres of the crossing from a to b? */
function carNear(ax: number, az: number, bx: number, bz: number, r: number) {
  const dx = bx - ax
  const dz = bz - az
  const l2 = dx * dx + dz * dz || 1
  for (const c of CAR_POSITIONS) {
    if (!c) continue
    const t = Math.max(0, Math.min(1, ((c.x - ax) * dx + (c.z - az) * dz) / l2))
    const px = ax + dx * t - c.x
    const pz = az + dz * t - c.z
    if (px * px + pz * pz < r * r) return true
  }
  return false
}

/** How far from a junction centre the sidewalk corner is. */
const NODE_R = PLAN.nodes.map((nd) => (nd.edges.length > 1 ? Math.max(...nd.edges.map((id) => PLAN.edges[id].width)) / 2 + SIDEWALK + 0.4 : 0))

function span(id: number) {
  const e = PLAN.edges[id]
  let a = NODE_R[e.a]
  let b = NODE_R[e.b]
  if (a + b > e.length - 1) a = b = 0
  return { a, b, e }
}

function sidewalkAt(id: number, dir: 1 | -1, side: 1 | -1, s: number) {
  const { a, b, e } = span(id)
  const along = dir === 1 ? a + s : e.length - b - s
  const { p, t } = pointAt(e.points, e.cum, Math.max(0, Math.min(e.length, along)))
  const n = right(t)
  const off = (e.width / 2 + SIDEWALK * 0.55) * side
  return { x: p.x + n.x * off, z: p.z + n.z * off, d: dir === 1 ? t : { x: -t.x, z: -t.z } }
}

/* Each body part is one instanced mesh. Limb geometry is shifted so that the
 * pivot (hip, shoulder) is at the origin and the limb hangs down from it. */
const PARTS = {
  legL: { geo: () => box(0.15, 0.8, 0.16, -0.4), pivot: [0, 0.86, 0.1] },
  legR: { geo: () => box(0.15, 0.8, 0.16, -0.4), pivot: [0, 0.86, -0.1] },
  shoeL: { geo: () => box(0.24, 0.09, 0.15, 0, 0.04), pivot: [0, 0.86, 0.1] },
  shoeR: { geo: () => box(0.24, 0.09, 0.15, 0, 0.04), pivot: [0, 0.86, -0.1] },
  torso: { geo: () => torso(), pivot: [0, 1.18, 0] },
  armL: { geo: () => box(0.11, 0.56, 0.11, -0.28), pivot: [0, 1.44, 0.26] },
  armR: { geo: () => box(0.11, 0.56, 0.11, -0.28), pivot: [0, 1.44, -0.26] },
  neck: { geo: () => box(0.09, 0.1, 0.09, 0), pivot: [0, 1.55, 0] },
  head: { geo: () => new THREE.SphereGeometry(0.135, 14, 12), pivot: [0, 1.7, 0] },
  hair: { geo: () => hair(), pivot: [0, 1.7, 0] },
} as const
type Part = keyof typeof PARTS

function box(w: number, h: number, d: number, dy: number, dx = 0) {
  const g = new THREE.BoxGeometry(w, h, d)
  g.translate(dx, dy, 0)
  return g
}

function torso() {
  const g = new THREE.CapsuleGeometry(0.17, 0.3, 4, 10)
  g.scale(0.75, 1, 1.35)
  return g
}

function hair() {
  // A cap that covers the top and back of the head.
  const g = new THREE.SphereGeometry(0.148, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55)
  g.translate(-0.015, 0.01, 0)
  return g
}

/** Residents walking along the sidewalks, turning into other streets at junctions. */
export function People({ count = 140, stage = 0 }: { count?: number; stage?: number }) {
  const refs = useRef<Partial<Record<Part, THREE.InstancedMesh | null>>>({})
  const geos = useMemo(() => Object.fromEntries(Object.entries(PARTS).map(([k, v]) => [k, v.geo()])) as unknown as Record<Part, THREE.BufferGeometry>, [])
  const open = useMemo(() => new Set(PLAN.edges.filter((e) => roadOpen(e.id, stage) && e.kind !== 'ring').map((e) => e.id)), [stage])
  const walkers = useMemo(() => {
    const rng = createRng(321)
    const edges = PLAN.edges.filter((e) => open.has(e.id) && e.kind !== 'arterial')
    const pool = edges.length ? edges : PLAN.edges.filter((e) => open.has(e.id))
    return Array.from({ length: count }, (): Walker => {
      const e = rng.pick(pool)
      return {
        edge: e.id,
        dir: rng.chance(0.5) ? 1 : -1,
        side: rng.chance(0.5) ? 1 : -1,
        s: rng.range(0, Math.max(0, span(e.id).e.length - span(e.id).a - span(e.id).b)),
        speed: rng.range(1.1, 1.55),
        phase: rng.range(0, 6),
        scale: rng.chance(0.12) ? rng.range(0.68, 0.8) : rng.range(0.92, 1.07),
        longHair: rng.chance(0.45),
        cross: null,
      }
    })
  }, [count, open])

  useLayoutEffect(() => {
    const rng = createRng(11)
    const c = new THREE.Color()
    const set = (part: Part, i: number, col: string) => refs.current[part]?.setColorAt(i, c.set(col))
    walkers.forEach((_, i) => {
      const top = rng.pick(TOPS)
      const pants = rng.pick(PANTS)
      const skin = rng.pick(SKIN)
      const shoes = rng.pick(SHOES)
      set('torso', i, top)
      set('armL', i, top)
      set('armR', i, top)
      set('legL', i, pants)
      set('legR', i, pants)
      set('shoeL', i, shoes)
      set('shoeR', i, shoes)
      set('neck', i, skin)
      set('head', i, skin)
      set('hair', i, rng.pick(HAIR))
    })
    for (const m of Object.values(refs.current)) if (m?.instanceColor) m.instanceColor.needsUpdate = true
  }, [walkers])

  const root = useMemo(() => new THREE.Object3D(), [])
  const limb = useMemo(() => {
    const o = new THREE.Object3D()
    root.add(o)
    return o
  }, [root])
  const rnd = useMemo(() => createRng(5), [])

  useFrame(({ clock }, dt) => {
    const step = Math.min(dt, 0.1)
    const time = clock.elapsedTime
    walkers.forEach((w, i) => {
      let x: number
      let z: number
      let d: { x: number; z: number }
      if (w.cross) {
        const c = w.cross
        // At the crossing: wait on the kerb while a car is closer than 8 m.
        const waiting = c.t < 0.02 && c.len > 6 && carNear(c.ax, c.az, c.bx, c.bz, 8)
        if (!waiting) c.t += (w.speed * step) / c.len
        if (c.t >= 1) w.cross = null
        const k = Math.min(1, c.t)
        x = c.ax + (c.bx - c.ax) * k
        z = c.az + (c.bz - c.az) * k
        d = { x: (c.bx - c.ax) / c.len, z: (c.bz - c.az) / c.len }
      } else {
        w.s += w.speed * step
        const sp = span(w.edge)
        const walk = sp.e.length - sp.a - sp.b
        if (w.s > walk) {
          const end = sidewalkAt(w.edge, w.dir, w.side, walk)
          const e = sp.e
          const node = w.dir === 1 ? e.b : e.a
          const options = PLAN.nodes[node].edges.filter((id) => id !== w.edge && open.has(id))
          if (options.length) {
            const pick = options[Math.floor(rnd.next() * options.length)]
            w.edge = pick
            w.dir = PLAN.edges[pick].a === node ? 1 : -1
            // Continue on the nearest corner so people cross at most one street.
            const s1 = sidewalkAt(w.edge, w.dir, 1, 0)
            const s2 = sidewalkAt(w.edge, w.dir, -1, 0)
            w.side = Math.hypot(s1.x - end.x, s1.z - end.z) <= Math.hypot(s2.x - end.x, s2.z - end.z) ? 1 : -1
          } else {
            w.dir = w.dir === 1 ? -1 : 1
            w.side = w.side === 1 ? -1 : 1
          }
          w.s = 0
          const start = sidewalkAt(w.edge, w.dir, w.side, 0)
          const len = Math.hypot(start.x - end.x, start.z - end.z)
          if (len > 0.3) w.cross = { ax: end.x, az: end.z, bx: start.x, bz: start.z, len, t: 0 }
          x = end.x
          z = end.z
          d = len > 0.3 ? { x: (start.x - end.x) / len, z: (start.z - end.z) / len } : start.d
        } else {
          const q = sidewalkAt(w.edge, w.dir, w.side, w.s)
          x = q.x
          z = q.z
          d = q.d
        }
      }
      // Stride: legs swing opposite to each other, arms opposite to legs.
      const still = !!w.cross && w.cross.t < 0.02 && w.cross.len > 6
      const cycle = time * w.speed * 5.2 + w.phase
      const swing = still ? 0 : Math.sin(cycle) * 0.5
      const bob = Math.abs(Math.cos(cycle)) * 0.035
      root.position.set(x, 0.2 + bob, z)
      root.rotation.set(0, Math.atan2(-d.z, d.x), 0)
      root.scale.setScalar(w.scale)
      root.updateMatrixWorld()
      for (const part of Object.keys(PARTS) as Part[]) {
        const mesh = refs.current[part]
        if (!mesh) continue
        const [px, py, pz] = PARTS[part].pivot
        limb.position.set(px, py, pz)
        let a = 0
        if (part === 'legL' || part === 'shoeL') a = swing
        else if (part === 'legR' || part === 'shoeR') a = -swing
        else if (part === 'armL') a = -swing * 0.8
        else if (part === 'armR') a = swing * 0.8
        limb.rotation.set(0, 0, a)
        limb.scale.set(1, part === 'hair' && w.longHair ? 1.25 : 1, 1)
        if (part === 'shoeL' || part === 'shoeR') {
          // Shoes sit at the end of the leg.
          limb.updateMatrix()
          limb.matrix.multiply(SHOE_OFFSET)
          limb.matrixWorld.multiplyMatrices(root.matrixWorld, limb.matrix)
        } else {
          limb.updateMatrixWorld()
        }
        mesh.setMatrixAt(i, limb.matrixWorld)
      }
    })
    for (const m of Object.values(refs.current)) if (m) m.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      {(Object.keys(PARTS) as Part[]).map((part) => (
        <instancedMesh
          key={`${part}${stage}${count}`}
          ref={(m) => {
            refs.current[part] = m
          }}
          args={[geos[part], undefined, walkers.length]}
          castShadow={part === 'torso' || part === 'legL' || part === 'legR'}
          frustumCulled={false}
        >
          <meshStandardMaterial roughness={part === 'hair' ? 0.9 : 0.8} />
        </instancedMesh>
      ))}
    </group>
  )
}

const SHOE_OFFSET = new THREE.Matrix4().makeTranslation(0.03, -0.82, 0)
