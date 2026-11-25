import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three-stdlib'
import { pointAt, right } from '../city/geometry'
import { PLAN, roadOpen } from '../city/plan'
import { CAR_POSITIONS, lightFor, TrafficSim, type TransitInput } from '../city/traffic'
import { BUS_LINES, BUS_STOPS, STOP_ON } from '../city/transit'
import { lightSpots, signSpots } from '../city/furniture'
import { signTexture } from './CivicShapes'
import { createRng } from '../lib/random'
import { useCity } from '../store/cityStore'

/**
 * Vehicles are assembled from parts. Each part is one instanced mesh, so a whole fleet of
 * one model costs a handful of draw calls however many cars drive around.
 */

type PartColor = 'body' | 'glass' | 'tyre' | 'rim' | 'chrome' | 'head' | 'tail' | 'dark' | 'white'

interface Part {
  geo: THREE.BufferGeometry
  color: PartColor
  at: [number, number, number]
  wheel?: boolean
}

export type VehicleType = 'sedan' | 'suv' | 'van' | 'bus' | 'truck'

const rb = (w: number, h: number, d: number, r: number) => new RoundedBoxGeometry(w, h, d, 3, r)

function wheels(x: number, z: number, r: number, w: number, extraX: number[] = []): Part[] {
  const tyre = new THREE.CylinderGeometry(r, r, w, 18)
  tyre.rotateX(Math.PI / 2)
  const rim = new THREE.CylinderGeometry(r * 0.62, r * 0.62, w + 0.02, 12)
  rim.rotateX(Math.PI / 2)
  const out: Part[] = []
  for (const px of [x, -x, ...extraX])
    for (const pz of [z, -z]) {
      out.push({ geo: tyre, color: 'tyre', at: [px, r, pz], wheel: true })
      out.push({ geo: rim, color: 'rim', at: [px, r, pz], wheel: true })
    }
  return out
}

const lights = (x: number, y: number, z: number, w = 0.22, h = 0.1): Part[] => {
  const g = new THREE.BoxGeometry(0.05, h, w)
  return [
    { geo: g, color: 'head', at: [x, y, z] },
    { geo: g, color: 'head', at: [x, y, -z] },
    { geo: g, color: 'tail', at: [-x, y, z] },
    { geo: g, color: 'tail', at: [-x, y, -z] },
  ]
}

const MODELS: Record<VehicleType, Part[]> = {
  sedan: [
    { geo: rb(2.35, 0.5, 1.02, 0.16), color: 'body', at: [0, 0.5, 0] },
    { geo: rb(1.3, 0.48, 0.94, 0.2), color: 'glass', at: [-0.12, 0.92, 0] },
    { geo: rb(1.24, 0.06, 0.9, 0.03), color: 'body', at: [-0.12, 1.17, 0] },
    { geo: new THREE.BoxGeometry(0.06, 0.14, 0.8), color: 'chrome', at: [1.17, 0.42, 0] },
    ...wheels(0.74, 0.46, 0.27, 0.2),
    ...lights(1.17, 0.58, 0.34),
  ],
  suv: [
    { geo: rb(2.5, 0.72, 1.1, 0.18), color: 'body', at: [0, 0.64, 0] },
    { geo: rb(1.65, 0.55, 1.02, 0.18), color: 'glass', at: [-0.2, 1.2, 0] },
    { geo: rb(1.6, 0.07, 0.98, 0.03), color: 'body', at: [-0.2, 1.5, 0] },
    { geo: new THREE.BoxGeometry(1.2, 0.05, 0.06), color: 'dark', at: [-0.2, 1.57, 0.36] },
    { geo: new THREE.BoxGeometry(1.2, 0.05, 0.06), color: 'dark', at: [-0.2, 1.57, -0.36] },
    ...wheels(0.82, 0.5, 0.33, 0.24),
    ...lights(1.25, 0.78, 0.38),
  ],
  van: [
    { geo: rb(2.7, 1.35, 1.12, 0.16), color: 'body', at: [0, 1.0, 0] },
    { geo: new THREE.BoxGeometry(0.06, 0.5, 0.98), color: 'glass', at: [1.34, 1.32, 0] },
    { geo: new THREE.BoxGeometry(0.6, 0.42, 1.14), color: 'glass', at: [0.95, 1.33, 0] },
    ...wheels(0.9, 0.5, 0.3, 0.22),
    ...lights(1.35, 0.68, 0.4),
  ],
  bus: [
    { geo: rb(6.4, 1.75, 1.35, 0.2), color: 'body', at: [0, 1.25, 0] },
    { geo: new THREE.BoxGeometry(5.9, 0.62, 1.37), color: 'glass', at: [0.05, 1.62, 0] },
    { geo: new THREE.BoxGeometry(0.06, 0.9, 1.2), color: 'glass', at: [3.2, 1.5, 0] },
    { geo: new THREE.BoxGeometry(6.2, 0.1, 1.38), color: 'white', at: [0, 2.08, 0] },
    ...wheels(2.2, 0.62, 0.42, 0.28),
    ...lights(3.2, 0.72, 0.5, 0.26, 0.14),
  ],
  truck: [
    { geo: rb(1.5, 1.4, 1.25, 0.16), color: 'body', at: [1.85, 1.15, 0] },
    { geo: new THREE.BoxGeometry(0.06, 0.55, 1.1), color: 'glass', at: [2.6, 1.45, 0] },
    { geo: new THREE.BoxGeometry(3.6, 1.75, 1.3), color: 'white', at: [-0.75, 1.35, 0] },
    { geo: new THREE.BoxGeometry(5.2, 0.22, 1.0), color: 'dark', at: [0.2, 0.5, 0] },
    ...wheels(1.9, 0.56, 0.38, 0.26, [-1.6]),
    ...lights(2.6, 0.75, 0.46),
  ],
}

const PAINT = ['#b3261e', '#f2f2ef', '#1f2a36', '#2563a8', '#c9a227', '#8a9097', '#1e6b3c', '#d9772b', '#141414', '#5b6b7a', '#7b1e2b', '#e6e1d6']

function material(kind: PartColor, night: boolean) {
  switch (kind) {
    case 'body':
      return new THREE.MeshPhysicalMaterial({ roughness: 0.32, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.08 })
    case 'glass':
      return new THREE.MeshPhysicalMaterial({ color: '#1a232c', roughness: 0.06, metalness: 0.6, clearcoat: 1 })
    case 'tyre':
      return new THREE.MeshStandardMaterial({ color: '#1b1b1d', roughness: 0.9 })
    case 'rim':
      return new THREE.MeshStandardMaterial({ color: '#b9bec4', roughness: 0.3, metalness: 0.9 })
    case 'chrome':
      return new THREE.MeshStandardMaterial({ color: '#d0d4d8', roughness: 0.2, metalness: 1 })
    case 'head':
      return new THREE.MeshStandardMaterial({ color: '#f4f1e6', emissive: '#fff4d6', emissiveIntensity: night ? 6 : 0.3 })
    case 'tail':
      return new THREE.MeshStandardMaterial({ color: '#7a1414', emissive: '#ff2a1a', emissiveIntensity: night ? 4 : 0.2 })
    case 'dark':
      return new THREE.MeshStandardMaterial({ color: '#2a2d31', roughness: 0.6, metalness: 0.4 })
    case 'white':
      return new THREE.MeshStandardMaterial({ color: '#eeeeea', roughness: 0.5 })
  }
}

/** Footprint of the shadow patch under each vehicle type (length, width). */
const BLOB: Record<VehicleType, [number, number]> = { sedan: [2.9, 1.5], suv: [3.1, 1.6], van: [3.3, 1.6], bus: [7.2, 1.9], truck: [6, 1.8] }
const BLOB_TEX = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(32, 32, 4, 32, 32, 32)
  grd.addColorStop(0, 'rgba(0,0,0,0.55)')
  grd.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
})()
const BLOB_GEO = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
const BLOB_MAT = new THREE.MeshBasicMaterial({ map: BLOB_TEX, transparent: true, depthWrite: false, color: '#000000' })

export interface VehiclePose {
  x: number
  z: number
  yaw: number
  spin: number
}

/** One model, many instances. `poses` is mutated by the caller (moving cars) or fixed (parked). */
function Fleet({ type, poses, colors, animated }: { type: VehicleType; poses: VehiclePose[]; colors: string[]; animated: boolean }) {
  const night = useCity((s) => s.night)
  const shadows = useCity((s) => s.quality === 'high')
  const parts = MODELS[type]
  const refs = useRef<(THREE.InstancedMesh | null)[]>([])
  const mats = useMemo(() => parts.map((p) => material(p.color, night)), [parts, night])
  const tmp = useMemo(
    () => ({ base: new THREE.Matrix4(), local: new THREE.Matrix4(), spin: new THREE.Matrix4(), out: new THREE.Matrix4(), q: new THREE.Quaternion(), v: new THREE.Vector3(), one: new THREE.Vector3(1, 1, 1) }),
    [],
  )

  const blob = useRef<THREE.InstancedMesh>(null)
  const blobScale = useMemo(() => new THREE.Vector3(BLOB[type][0], 1, BLOB[type][1]), [type])
  const write = () => {
    const bm = blob.current
    poses.forEach((pose, i) => {
      // A soft dark patch under each vehicle when real shadows are off (round 2, 5.6).
      if (bm) {
        tmp.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, pose.yaw)
        tmp.out.compose(tmp.v.set(pose.x, 0.095, pose.z), tmp.q, blobScale)
        bm.setMatrixAt(i, tmp.out)
      }
      tmp.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, pose.yaw)
      tmp.base.compose(tmp.v.set(pose.x, 0.02, pose.z), tmp.q, tmp.one)
      parts.forEach((part, pi) => {
        const mesh = refs.current[pi]
        if (!mesh) return
        tmp.local.makeTranslation(part.at[0], part.at[1], part.at[2])
        if (part.wheel) tmp.local.multiply(tmp.spin.makeRotationZ(-pose.spin))
        tmp.out.multiplyMatrices(tmp.base, tmp.local)
        mesh.setMatrixAt(i, tmp.out)
      })
    })
    refs.current.forEach((m) => m && (m.instanceMatrix.needsUpdate = true))
    if (bm) bm.instanceMatrix.needsUpdate = true
  }

  useLayoutEffect(() => {
    const c = new THREE.Color()
    parts.forEach((part, pi) => {
      const mesh = refs.current[pi]
      if (!mesh || part.color !== 'body') return
      poses.forEach((_, i) => mesh.setColorAt(i, c.set(colors[i % colors.length])))
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    })
    write()
    refs.current.forEach((m) => m?.computeBoundingSphere())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poses, colors, mats])

  useFrame(() => {
    if (animated) write()
  })

  return (
    <group>
      {!shadows && (
        <instancedMesh ref={blob} args={[BLOB_GEO, BLOB_MAT, poses.length]} frustumCulled={false} raycast={() => null} />
      )}
      {parts.map((part, pi) => (
        <instancedMesh
          key={pi}
          ref={(m) => {
            refs.current[pi] = m
          }}
          args={[part.geo, mats[pi], poses.length]}
          castShadow={shadows && (part.color === 'body' || part.color === 'white')}
          frustumCulled={!animated}
          dispose={null}
        />
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Traffic on the road graph                                           */
/* ------------------------------------------------------------------ */


const WHEEL_R: Record<VehicleType, number> = { sedan: 0.27, suv: 0.33, van: 0.3, bus: 0.42, truck: 0.38 }

/**
 * Moving traffic: the simulation in city/traffic.ts drives every car (lanes, distance to the
 * car ahead, traffic lights, curves through junctions); this only draws them.
 */
const TRANSIT: TransitInput = {
  lines: BUS_LINES,
  stopAt: (line, edge, dir) => STOP_ON.get(`${line}:${edge}:${dir}`)?.s ?? null,
  busesPerLine: 3,
}

export function Traffic({ count = 70, stage = 0 }: { count?: number; stage?: number }) {
  const sim = useMemo(() => new TrafficSim(stage, count, 77, undefined, TRANSIT), [stage, count])
  const kinds = useMemo(() => {
    const rng = createRng(78)
    return sim.cars.map((c): VehicleType => (c.bus ? 'bus' : rng.chance(0.07) ? 'truck' : rng.chance(0.14) ? 'van' : rng.chance(0.3) ? 'suv' : 'sedan'))
  }, [sim])
  const busColors = useMemo(() => sim.cars.filter((c) => c.bus).map((c) => BUS_LINES[c.bus!.line].color), [sim])
  const poses = useMemo(() => sim.cars.map((): VehiclePose => ({ x: 0, z: 0, yaw: 0, spin: 0 })), [sim])
  const groups = useMemo(() => {
    const g: Record<VehicleType, VehiclePose[]> = { sedan: [], suv: [], van: [], bus: [], truck: [] }
    poses.forEach((p, i) => g[kinds[i]].push(p))
    return g
  }, [poses, kinds])
  const colors = useMemo(() => {
    const rng = createRng(5)
    return Array.from({ length: 64 }, () => rng.pick(PAINT))
  }, [])

  useFrame((_, dt) => {
    sim.step(dt)
    CAR_POSITIONS.length = sim.cars.length
    sim.cars.forEach((c, i) => {
      const p = poses[i]
      p.x = c.pose.x
      p.z = c.pose.z
      p.yaw = c.pose.yaw
      p.spin += (c.v * Math.min(dt, 0.1)) / WHEEL_R[kinds[i]]
      CAR_POSITIONS[i] = { x: c.pose.x, z: c.pose.z }
    })
    TRAFFIC_CLOCK.t = sim.time
  })

  return (
    <group>
      {(Object.keys(groups) as VehicleType[]).map((type) =>
        groups[type].length ? (
          <Fleet
            key={type + stage + count}
            type={type}
            poses={groups[type]}
            colors={type === 'bus' ? busColors : type === 'truck' ? ['#e0e0dc', '#2f5f9e', '#b33a2b'] : colors}
            animated
          />
        ) : null,
      )}
      <TrafficLights stage={stage} />
      <BusStops />
      <RoadSigns />
    </group>
  )
}

/** The clock of the lights, shared with the drawn signal heads. */
export const TRAFFIC_CLOCK = { t: 0 }

/** A post with a three-lamp head at the stop line of every road entering a signalled junction. */
function TrafficLights({ stage }: { stage: number }) {
  const heads = useMemo(() => lightSpots(stage), [stage])
  const poles = useRef<THREE.InstancedMesh>(null)
  const boxes = useRef<THREE.InstancedMesh>(null)
  const bulbs = useRef<THREE.InstancedMesh>(null)
  const o = useMemo(() => new THREE.Object3D(), [])
  useLayoutEffect(() => {
    heads.forEach((h, i) => {
      o.position.set(h.x, 1.6, h.z)
      o.rotation.set(0, h.yaw, 0)
      o.updateMatrix()
      poles.current?.setMatrixAt(i, o.matrix)
      o.position.set(h.x, 3.5, h.z)
      o.updateMatrix()
      boxes.current?.setMatrixAt(i, o.matrix)
      // Three lamps facing the oncoming cars: red on top, then yellow, then green.
      for (let k = 0; k < 3; k++) {
        o.position.set(h.x - Math.cos(h.yaw) * 0.18, 3.85 - k * 0.36, h.z + Math.sin(h.yaw) * 0.18)
        o.updateMatrix()
        bulbs.current?.setMatrixAt(i * 3 + k, o.matrix)
      }
    })
    for (const m of [poles.current, boxes.current, bulbs.current]) if (m) m.instanceMatrix.needsUpdate = true
  }, [heads, o])
  const c = useMemo(() => ({ red: new THREE.Color('#ff3b30'), yellow: new THREE.Color('#ffcc00'), green: new THREE.Color('#34c759'), off: new THREE.Color('#2a2d31') }), [])
  useFrame(() => {
    const m = bulbs.current
    if (!m) return
    heads.forEach((h, i) => {
      const l = lightFor(h.node, h.edge, TRAFFIC_CLOCK.t)
      m.setColorAt(i * 3, l === 'red' ? c.red : c.off)
      m.setColorAt(i * 3 + 1, l === 'yellow' ? c.yellow : c.off)
      m.setColorAt(i * 3 + 2, l === 'green' ? c.green : c.off)
    })
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  })
  if (!heads.length) return null
  return (
    <group>
      <instancedMesh ref={poles} args={[undefined, undefined, heads.length]} castShadow>
        <cylinderGeometry args={[0.07, 0.09, 3.2, 8]} />
        <meshStandardMaterial color="#2f3439" metalness={0.5} roughness={0.5} />
      </instancedMesh>
      <instancedMesh ref={boxes} args={[undefined, undefined, heads.length]}>
        <boxGeometry args={[0.28, 1.2, 0.36]} />
        <meshStandardMaterial color="#1f2326" roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={bulbs} args={[undefined, undefined, heads.length * 3]}>
        <sphereGeometry args={[0.13, 10, 8]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  )
}

/** Cars parked along the kerbs of side streets. */
export function ParkedCars({ density = 0.45, stage = 0 }: { density?: number; stage?: number }) {
  const groups = useMemo(() => {
    const rng = createRng(909)
    const g: Record<VehicleType, VehiclePose[]> = { sedan: [], suv: [], van: [], bus: [], truck: [] }
    for (const e of PLAN.edges) {
      if (!roadOpen(e.id, stage) || e.kind === 'arterial' || e.kind === 'ring') continue
      for (const side of [1, -1]) {
        for (let s = 9; s < e.length - 9; s += rng.range(5.5, 9)) {
          if (!rng.chance(density)) continue
          const { p, t } = pointAt(e.points, e.cum, s)
          const n = right(t)
          const off = (e.width / 2 - 0.6) * side
          const type: VehicleType = rng.chance(0.12) ? 'van' : rng.chance(0.3) ? 'suv' : 'sedan'
          g[type].push({ x: p.x + n.x * off, z: p.z + n.z * off, yaw: Math.atan2(-t.z, t.x) + (side > 0 ? 0 : Math.PI), spin: 0 })
        }
      }
    }
    return g
  }, [density, stage])
  const colors = useMemo(() => {
    const rng = createRng(17)
    return Array.from({ length: 80 }, () => rng.pick(PAINT))
  }, [])
  return (
    <group>
      {(Object.keys(groups) as VehicleType[]).map((t) =>
        groups[t].length ? <Fleet key={t + stage + density} type={t} poses={groups[t]} colors={colors} animated={false} /> : null,
      )}
    </group>
  )
}

/**
 * Bus stops: a glass shelter with a bench and a roof, and a post with the round «А» sign and
 * the line number, on the sidewalk next to where the bus pulls up.
 */
function BusStops() {
  const night = useCity((s) => s.night)
  const signs = useMemo(() => BUS_LINES.map((l) => signTexture(`А ${l.name}`, l.color, '#ffffff', 256, 128)), [])
  return (
    <group>
      {BUS_STOPS.map((st) => {
        const yaw = Math.atan2(st.face.x, st.face.z)
        // Along the kerb: the shelter sits a few metres before the bus's front.
        return (
          <group key={st.id} position={[st.at.x, 0, st.at.z]} rotation={[0, yaw, 0]}>
            {/* back glass and side panes */}
            <mesh position={[0, 1.15, -0.55]}>
              <boxGeometry args={[3.2, 2.0, 0.06]} />
              <meshStandardMaterial color="#bfe0f2" transparent opacity={0.45} roughness={0.05} metalness={0.3} />
            </mesh>
            {[-1, 1].map((k) => (
              <mesh key={k} position={[k * 1.6, 1.15, -0.15]}>
                <boxGeometry args={[0.06, 2.0, 0.8]} />
                <meshStandardMaterial color="#bfe0f2" transparent opacity={0.45} roughness={0.05} metalness={0.3} />
              </mesh>
            ))}
            {/* frame and roof */}
            {[-1, 1].map((k) => (
              <mesh key={`p${k}`} position={[k * 1.6, 1.15, -0.55]} castShadow>
                <boxGeometry args={[0.08, 2.3, 0.08]} />
                <meshStandardMaterial color="#2f3439" metalness={0.6} roughness={0.4} />
              </mesh>
            ))}
            <mesh position={[0, 2.32, -0.15]} castShadow>
              <boxGeometry args={[3.5, 0.12, 1.2]} />
              <meshStandardMaterial color="#2f3439" metalness={0.5} roughness={0.4} emissive="#fff2cf" emissiveIntensity={night ? 0.25 : 0} />
            </mesh>
            {/* bench */}
            <mesh position={[0, 0.5, -0.35]} castShadow>
              <boxGeometry args={[2.4, 0.08, 0.36]} />
              <meshStandardMaterial color="#9a6b3f" />
            </mesh>
            {/* sign post */}
            <mesh position={[2.1, 1.3, 0.25]} castShadow>
              <cylinderGeometry args={[0.05, 0.05, 2.6, 8]} />
              <meshStandardMaterial color="#5b6168" metalness={0.6} roughness={0.4} />
            </mesh>
            <mesh position={[2.1, 2.55, 0.25]}>
              <boxGeometry args={[0.7, 0.35, 0.04]} />
              <meshStandardMaterial attach="material-0" color="#ffffff" />
              <meshStandardMaterial attach="material-1" color="#ffffff" />
              <meshStandardMaterial attach="material-2" color="#ffffff" />
              <meshStandardMaterial attach="material-3" color="#ffffff" />
              <meshStandardMaterial attach="material-4" map={signs[st.line]} emissive="#ffffff" emissiveMap={signs[st.line]} emissiveIntensity={night ? 0.6 : 0.05} />
              <meshStandardMaterial attach="material-5" map={signs[st.line]} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

/* Road signs ------------------------------------------------------------ */


function signCanvas(draw: (ctx: CanvasRenderingContext2D, s: number) => void) {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')!
  draw(ctx, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** «Уступи дорогу»: a white triangle pointing down with a red border. */
const giveWayTexture = () =>
  signCanvas((g, s) => {
    g.clearRect(0, 0, s, s)
    const tri = (m: number) => {
      g.beginPath()
      g.moveTo(m, m * 0.9)
      g.lineTo(s - m, m * 0.9)
      g.lineTo(s / 2, s - m * 0.6)
      g.closePath()
    }
    g.fillStyle = '#d42a20'
    tri(4)
    g.fill()
    g.fillStyle = '#ffffff'
    tri(22)
    g.fill()
  })

/** «Пешеходный переход»: blue square, white triangle, a walking figure. */
const crossingTexture = () =>
  signCanvas((g, s) => {
    g.fillStyle = '#1f5fbf'
    g.fillRect(0, 0, s, s)
    g.fillStyle = '#ffffff'
    g.beginPath()
    g.moveTo(s / 2, 14)
    g.lineTo(s - 12, s - 16)
    g.lineTo(12, s - 16)
    g.closePath()
    g.fill()
    g.strokeStyle = '#111111'
    g.fillStyle = '#111111'
    g.lineWidth = 7
    g.lineCap = 'round'
    g.beginPath()
    g.arc(s / 2 + 2, 46, 7, 0, Math.PI * 2)
    g.fill()
    g.beginPath()
    g.moveTo(s / 2, 56)
    g.lineTo(s / 2 - 4, 80)
    g.lineTo(s / 2 - 16, 98)
    g.moveTo(s / 2 - 4, 80)
    g.lineTo(s / 2 + 12, 98)
    g.moveTo(s / 2 - 14, 70)
    g.lineTo(s / 2, 60)
    g.lineTo(s / 2 + 14, 72)
    g.stroke()
    g.fillRect(16, s - 26, s - 32, 5)
  })

/** Give-way signs where a smaller street meets a bigger one without lights, crossing signs before zebras there. */
function RoadSigns() {
  const spots = useMemo(() => signSpots(), [])
  const tex = useMemo(() => ({ give: giveWayTexture(), cross: crossingTexture() }), [])
  const all = useMemo(() => [...spots.giveWay, ...spots.crossing], [spots])
  const posts = useRef<THREE.InstancedMesh>(null)
  const give = useRef<THREE.InstancedMesh>(null)
  const cross = useRef<THREE.InstancedMesh>(null)
  const o = useMemo(() => new THREE.Object3D(), [])
  useLayoutEffect(() => {
    all.forEach((sp, i) => {
      o.position.set(sp.x, 1.15, sp.z)
      o.rotation.set(0, 0, 0)
      o.updateMatrix()
      posts.current?.setMatrixAt(i, o.matrix)
    })
    const plates = (m: THREE.InstancedMesh | null, list: typeof all) => {
      if (!m) return
      list.forEach((sp, i) => {
        o.position.set(sp.x, 2.35, sp.z)
        o.rotation.set(0, sp.yaw, 0)
        o.updateMatrix()
        m.setMatrixAt(i, o.matrix)
      })
      m.instanceMatrix.needsUpdate = true
      m.computeBoundingSphere()
    }
    plates(give.current, spots.giveWay)
    plates(cross.current, spots.crossing)
    if (posts.current) {
      posts.current.instanceMatrix.needsUpdate = true
      posts.current.computeBoundingSphere()
    }
  }, [all, spots, o])
  if (!all.length) return null
  return (
    <group>
      <instancedMesh ref={posts} args={[undefined, undefined, all.length]} castShadow>
        <cylinderGeometry args={[0.045, 0.045, 2.3, 6]} />
        <meshStandardMaterial color="#8a9097" metalness={0.6} roughness={0.4} />
      </instancedMesh>
      {spots.giveWay.length > 0 && (
        <instancedMesh ref={give} args={[undefined, undefined, spots.giveWay.length]}>
          <planeGeometry args={[0.8, 0.8]} />
          <meshStandardMaterial map={tex.give} transparent alphaTest={0.4} side={THREE.DoubleSide} />
        </instancedMesh>
      )}
      {spots.crossing.length > 0 && (
        <instancedMesh ref={cross} args={[undefined, undefined, spots.crossing.length]}>
          <planeGeometry args={[0.7, 0.7]} />
          <meshStandardMaterial map={tex.cross} side={THREE.DoubleSide} />
        </instancedMesh>
      )}
    </group>
  )
}
