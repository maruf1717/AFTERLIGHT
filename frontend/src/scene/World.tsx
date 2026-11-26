import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { MapControls } from '@react-three/drei'
import * as THREE from 'three'
import { create } from 'zustand'
import { BUILDING_BY_ID, CELL, GRID, type RoadKind } from '../game/catalog'
import { canBuild, canRoad, isEntry, key, occupancy, size, type Placed } from '../game/city'
import { useGame, useShownCity, useShownStats } from '../game/store'
import { createRng } from '../lib/random'
import { Instances, type Placement } from './Instances'
import { BuildingModel } from './models'
import { asphaltTexture } from './terrain'

/** World position of a cell's centre. */
export const cx = (x: number) => (x + 0.5 - GRID / 2) * CELL
const HALF = (GRID * CELL) / 2

/** View settings shared with the interface. */
export const useView = create<{ night: boolean; toggleNight(): void; hover: [number, number] | null; setHover(h: [number, number] | null): void }>((set) => ({
  night: false,
  toggleNight: () => set((s) => ({ night: !s.night })),
  hover: null,
  setHover: (h) => set({ hover: h }),
}))

/* Ground ---------------------------------------------------------------------- */

function Ground() {
  const night = useView((s) => s.night)
  const tool = useGame((s) => s.tool)
  const lines = useMemo(() => {
    const pts: number[] = []
    for (let i = 0; i <= GRID; i++) {
      const v = -HALF + i * CELL
      pts.push(-HALF, 0.06, v, HALF, 0.06, v, v, 0.06, -HALF, v, 0.06, HALF)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[HALF * 8, HALF * 8]} />
        <meshStandardMaterial color={night ? '#4d6347' : '#7fa95a'} roughness={1} />
      </mesh>
      {/* the buildable field */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[HALF * 2, HALF * 2]} />
        <meshStandardMaterial color={night ? '#55704c' : '#93bf6a'} roughness={1} />
      </mesh>
      {/* a low kerb around the field */}
      {[-1, 1].map((k) => (
        <group key={k}>
          <mesh position={[0, 0.15, k * (HALF + 0.4)]}>
            <boxGeometry args={[HALF * 2 + 1.6, 0.3, 0.8]} />
            <meshStandardMaterial color="#d8d2c4" />
          </mesh>
          <mesh position={[k * (HALF + 0.4), 0.15, 0]}>
            <boxGeometry args={[0.8, 0.3, HALF * 2]} />
            <meshStandardMaterial color="#d8d2c4" />
          </mesh>
        </group>
      ))}
      <lineSegments geometry={lines} visible={!!tool}>
        <lineBasicMaterial color="#ffffff" transparent opacity={0.22} />
      </lineSegments>
      <Forest />
    </group>
  )
}

/** Trees around the field: the city sits in a clearing. */
function Forest() {
  const items = useMemo(() => {
    const rng = createRng(11)
    const out: Placement[] = []
    while (out.length < 420) {
      const x = rng.range(-HALF * 2.6, HALF * 2.6)
      const z = rng.range(-HALF * 2.6, HALF * 2.6)
      if (Math.abs(x) < HALF + 6 && Math.abs(z) < HALF + 6) continue
      if (x < -HALF - 4 && Math.abs(z - cx(GRID / 2)) < 10) continue // the highway
      const s = rng.range(0.8, 1.5)
      out.push({ p: [x, 2.2 * s, z], s: [s * 1.3, s * 1.8, s * 1.3], r: rng.range(0, 6), c: rng.pick(['#4f8a3c', '#3f7a35', '#5e9a46', '#2f5d36']) })
    }
    return out
  }, [])
  return (
    <Instances items={items}>
      <coneGeometry args={[1.4, 3.4, 7]} />
      <meshStandardMaterial color="#ffffff" flatShading roughness={0.9} />
    </Instances>
  )
}

/** The highway into the city, from the forest to the field's west edge. */
function Highway() {
  const z = cx(GRID / 2)
  return (
    <group>
      <mesh position={[-HALF - 60, 0.05, z]} receiveShadow>
        <boxGeometry args={[120, 0.1, CELL]} />
        <meshStandardMaterial color="#4d5258" roughness={0.9} />
      </mesh>
      {Array.from({ length: 20 }, (_, i) => (
        <mesh key={i} position={[-HALF - 6 - i * 6, 0.11, z]}>
          <boxGeometry args={[3, 0.02, 0.2]} />
          <meshStandardMaterial color="#f2f2f2" />
        </mesh>
      ))}
    </group>
  )
}

/* Roads ----------------------------------------------------------------------- */

const ROAD_COLOR: Record<RoadKind, string> = { dirt: '#e6c99a', street: '#c4c8ce', avenue: '#b6bac0', ring: '#c4c8ce' }

function Roads() {
  const city = useShownCity()
  const night = useView((s) => s.night)
  const layout = useMemo(() => {
    const base: Placement[] = []
    const walk: Placement[] = []
    const marks: Placement[] = []
    const median: Placement[] = []
    const crowns: Placement[] = []
    const islands: Placement[] = []
    const lamps: Placement[] = []
    if (!city) return { base, walk, marks, median, crowns, islands, lamps }
    for (const [k, kind] of Object.entries(city.roads)) {
      const [x, z] = k.split(',').map(Number)
      const X = cx(x)
      const Z = cx(z)
      base.push({ p: [X, 0.06, Z], s: [CELL, 0.1, CELL], c: ROAD_COLOR[kind] })
      const n = { N: !!city.roads[key(x, z - 1)], S: !!city.roads[key(x, z + 1)], E: !!city.roads[key(x + 1, z)], W: !!city.roads[key(x - 1, z)] }
      if (isEntry(x, z) && x === 0) n.W = true
      const links = Object.values(n).filter(Boolean).length
      const sides: [boolean, number, number, number][] = [
        [n.N, 0, -1, 0],
        [n.S, 0, 1, 0],
        [n.E, 1, 0, Math.PI / 2],
        [n.W, -1, 0, Math.PI / 2],
      ]
      // Sidewalks on the sides with no road (not on dirt lanes).
      if (kind !== 'dirt')
        for (const [has, dx, dz, r] of sides) {
          if (has) continue
          walk.push({ p: [X + dx * (CELL / 2 - 0.55), 0.16, Z + dz * (CELL / 2 - 0.55)], s: [CELL, 0.12, 1.1], r, c: '#cfcac0' })
          if ((x + z) % 2 === 0) lamps.push({ p: [X + dx * (CELL / 2 - 0.4), 0, Z + dz * (CELL / 2 - 0.4)] })
        }
      const straightNS = n.N && n.S && !n.E && !n.W
      const straightEW = n.E && n.W && !n.N && !n.S
      if (kind === 'ring') {
        islands.push({ p: [X, 0.18, Z], s: [CELL * 0.32, 0.25, CELL * 0.32] })
        continue
      }
      if (kind === 'avenue' && (straightNS || straightEW)) {
        const r = straightNS ? 0 : Math.PI / 2
        median.push({ p: [X, 0.15, Z], s: [1, 0.12, CELL], r })
        crowns.push({ p: [X, 1.7, Z], s: [0.9, 0.9, 0.9] })
        continue
      }
      if (kind === 'street' && links === 2 && (straightNS || straightEW)) {
        const r = straightNS ? 0 : Math.PI / 2
        for (const o of [-CELL / 4, CELL / 4]) marks.push({ p: [X + (straightEW ? o : 0), 0.115, Z + (straightNS ? o : 0)], s: [0.16, 0.02, CELL / 3], r })
      }
    }
    return { base, walk, marks, median, crowns, islands, lamps }
  }, [city])
  const asphalt = useMemo(() => asphaltTexture(), [])
  return (
    <group>
      {layout.base.length > 0 && (
        <Instances items={layout.base} receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#ffffff" map={asphalt} roughness={0.95} />
        </Instances>
      )}
      {layout.walk.length > 0 && (
        <Instances items={layout.walk} receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#ffffff" roughness={0.9} />
        </Instances>
      )}
      {layout.marks.length > 0 && (
        <Instances items={layout.marks}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#f2f2ee" />
        </Instances>
      )}
      {layout.median.length > 0 && (
        <Instances items={layout.median}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#6fa452" />
        </Instances>
      )}
      {layout.crowns.length > 0 && (
        <Instances items={layout.crowns} castShadow>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#4f8a3c" flatShading />
        </Instances>
      )}
      {layout.islands.length > 0 && (
        <Instances items={layout.islands}>
          <cylinderGeometry args={[1, 1, 1, 24]} />
          <meshStandardMaterial color="#6fa452" />
        </Instances>
      )}
      {layout.lamps.length > 0 && (
        <>
          <Instances items={layout.lamps.map((l) => ({ p: [l.p[0], 2.2, l.p[2]] as [number, number, number] }))}>
            <cylinderGeometry args={[0.06, 0.08, 4.4, 6]} />
            <meshStandardMaterial color="#3a3f45" />
          </Instances>
          <Instances items={layout.lamps.map((l) => ({ p: [l.p[0], 4.4, l.p[2]] as [number, number, number] }))}>
            <sphereGeometry args={[0.25, 8, 6]} />
            <meshStandardMaterial color="#fff4d6" emissive="#ffd28a" emissiveIntensity={night ? 3 : 0.3} toneMapped={false} />
          </Instances>
        </>
      )}
    </group>
  )
}

/* Buildings ------------------------------------------------------------------- */

function placedPos(p: { id: string; x: number; z: number; r: 0 | 1 | 2 | 3 }) {
  const [w, d] = size(BUILDING_BY_ID[p.id], p.r)
  return [(p.x + w / 2 - GRID / 2) * CELL, (p.z + d / 2 - GRID / 2) * CELL] as const
}

function Building({ p, connected, selected }: { p: Placed; connected: boolean; selected: boolean }) {
  const night = useView((s) => s.night)
  const def = BUILDING_BY_ID[p.id]
  const [X, Z] = placedPos(p)
  const born = useRef(performance.now())
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    if (!g.current) return
    const t = Math.min(1, (performance.now() - born.current) / 450)
    const e = 1 - Math.pow(1 - t, 3)
    g.current.scale.set(1, Math.max(0.02, e), 1)
  })
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    const st = useGame.getState()
    if (st.tool) return
    e.stopPropagation()
    if (e.delta > 6) return
    st.select(p.uid)
  }
  return (
    <group position={[X, 0, Z]} rotation={[0, (p.r * Math.PI) / 2, 0]} onClick={onClick}>
      <group ref={g}>
        <BuildingModel model={def.model} W={def.w * CELL - 0.6} D={def.d * CELL - 0.6} seed={`${p.id}:${p.uid}`} night={night} />
      </group>
      {selected && (
        <mesh position={[0, 0.25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[Math.hypot(def.w, def.d) * CELL * 0.5, Math.hypot(def.w, def.d) * CELL * 0.5 + 0.6, 48]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
      )}
      {!connected && <NoRoad h={12} />}
    </group>
  )
}

/** A floating red sign over a building with no road to the highway. */
function NoRoad({ h }: { h: number }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const g = c.getContext('2d', { willReadFrequently: true })!
    g.fillStyle = '#d93a2f'
    g.beginPath()
    g.arc(32, 32, 30, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#fff'
    g.font = '700 44px Rubik, Arial, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('!', 32, 35)
    return new THREE.CanvasTexture(c)
  }, [])
  const ref = useRef<THREE.Sprite>(null)
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = h + Math.sin(clock.elapsedTime * 3) * 0.5
  })
  return (
    <sprite ref={ref} position={[0, h, 0]} scale={[3, 3, 3]}>
      <spriteMaterial map={tex} depthTest={false} />
    </sprite>
  )
}

function Buildings() {
  const city = useShownCity()
  const stats = useShownStats()
  const selected = useGame((s) => s.selected)
  if (!city || !stats) return null
  return (
    <group>
      {city.items.map((p) => (
        <Building key={p.uid} p={p} connected={stats.connected.has(p.uid)} selected={selected === p.uid} />
      ))}
    </group>
  )
}

/* Placing --------------------------------------------------------------------- */

/** What the current tool would do on the hovered cell: a see-through model or road square. */
function Ghost() {
  const hover = useView((s) => s.hover)
  const tool = useGame((s) => s.tool)
  const rot = useGame((s) => s.rot)
  const city = useGame((s) => s.city)
  const night = useView((s) => s.night)
  if (!hover || !tool || !city) return null
  const [x, z] = hover
  if (tool.kind === 'road' || tool.kind === 'sell') {
    const ok = tool.kind === 'sell' ? !!city.roads[key(x, z)] || occupancy(city).has(key(x, z)) : !canRoad(city, tool.road, x, z)
    return (
      <mesh position={[cx(x), 0.3, cx(z)]}>
        <boxGeometry args={[CELL, 0.3, CELL]} />
        <meshBasicMaterial color={tool.kind === 'sell' ? '#ff5a4a' : ok ? '#4ade80' : '#ff5a4a'} transparent opacity={0.45} depthWrite={false} />
      </mesh>
    )
  }
  const def = BUILDING_BY_ID[tool.id]
  const [w, d] = size(def, rot)
  // The hovered cell is the centre of the footprint (as near as cells allow).
  const ax = x - Math.floor((w - 1) / 2)
  const az = z - Math.floor((d - 1) / 2)
  const why = canBuild(city, tool.id, ax, az, rot)
  const [X, Z] = placedPos({ id: tool.id, x: ax, z: az, r: rot })
  const cover = def.covers?.reduce((m, c) => Math.max(m, c.r), 0) ?? 0
  return (
    <group position={[X, 0, Z]}>
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[w * CELL, 0.3, d * CELL]} />
        <meshBasicMaterial color={why && why !== 'Нет денег' ? '#ff5a4a' : why ? '#f2a516' : '#4ade80'} transparent opacity={0.45} depthWrite={false} />
      </mesh>
      <group rotation={[0, (rot * Math.PI) / 2, 0]}>
        <BuildingModel model={def.model} W={def.w * CELL - 0.6} D={def.d * CELL - 0.6} seed="ghost" night={night} />
      </group>
      {cover > 0 && (
        <mesh position={[0, 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[cover * CELL - 0.6, cover * CELL, 64]} />
          <meshBasicMaterial color="#2f63c9" transparent opacity={0.7} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}

/** Turns taps and drags on the field into cells: tap to build, drag to lay a road. */
export function anchorFor(id: string, rot: 0 | 1 | 2 | 3, x: number, z: number): [number, number] {
  const [w, d] = size(BUILDING_BY_ID[id], rot)
  return [x - Math.floor((w - 1) / 2), z - Math.floor((d - 1) / 2)]
}

function Picker({ controls }: { controls: React.RefObject<{ enabled: boolean } | null> }) {
  const setHover = useView((s) => s.setHover)
  const drag = useRef<{ start: [number, number]; cells: [number, number][]; moved: number; x: number; y: number } | null>(null)
  const toCell = (p: THREE.Vector3): [number, number] | null => {
    const x = Math.floor(p.x / CELL + GRID / 2)
    const z = Math.floor(p.z / CELL + GRID / 2)
    return x >= 0 && z >= 0 && x < GRID && z < GRID ? [x, z] : null
  }
  /** Cells of a straight road from a to b (along the longer direction). */
  const line = (a: [number, number], b: [number, number]): [number, number][] => {
    const out: [number, number][] = []
    if (Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1])) {
      const s = Math.sign(b[0] - a[0]) || 1
      for (let x = a[0]; x !== b[0] + s; x += s) out.push([x, a[1]])
    } else {
      const s = Math.sign(b[1] - a[1]) || 1
      for (let z = a[1]; z !== b[1] + s; z += s) out.push([a[0], z])
    }
    return out
  }
  const [preview, setPreview] = useState<[number, number][]>([])
  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 0]}
        onPointerMove={(e) => {
          const c = toCell(e.point)
          setHover(c)
          const d = drag.current
          if (!d || !c) return
          d.moved = Math.max(d.moved, Math.hypot(e.nativeEvent.clientX - d.x, e.nativeEvent.clientY - d.y))
          if (useGame.getState().tool?.kind === 'road') {
            d.cells = line(d.start, c)
            setPreview(d.cells)
          }
        }}
        onPointerOut={() => setHover(null)}
        onPointerDown={(e) => {
          const tool = useGame.getState().tool
          const c = toCell(e.point)
          if (!tool || !c) return
          drag.current = { start: c, cells: [c], moved: 0, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY }
          // Drawing a road: the camera stays still while the finger draws.
          if (tool.kind === 'road' && controls.current) controls.current.enabled = false
          if (tool.kind === 'road') setPreview([c])
        }}
        onPointerUp={(e) => {
          const d = drag.current
          drag.current = null
          if (controls.current) controls.current.enabled = true
          setPreview([])
          const st = useGame.getState()
          const tool = st.tool
          const c = toCell(e.point)
          if (!d || !tool) return
          if (tool.kind === 'road') st.roadLine(d.cells)
          else if (c && d.moved < 8) {
            if (tool.kind === 'build') {
              const [ax, az] = anchorFor(tool.id, st.rot, c[0], c[1])
              st.apply(ax, az)
            } else st.apply(c[0], c[1])
          }
        }}
      >
        <planeGeometry args={[GRID * CELL, GRID * CELL]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      {preview.map(([x, z]) => (
        <mesh key={`${x},${z}`} position={[cx(x), 0.35, cx(z)]}>
          <boxGeometry args={[CELL * 0.96, 0.2, CELL * 0.96]} />
          <meshBasicMaterial color="#4ade80" transparent opacity={0.5} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

/* Cars ------------------------------------------------------------------------ */

interface Car {
  at: [number, number]
  to: [number, number]
  t: number
  speed: number
  color: string
}

function Cars() {
  const city = useShownCity()
  const stats = useShownStats()
  const count = Math.min(60, Math.round((city?.pop ?? 0) / 12))
  const cells = useMemo(() => [...(stats?.reachable ?? [])].map((k) => k.split(',').map(Number) as [number, number]), [stats])
  const reach = stats?.reachable
  const cars = useMemo<Car[]>(() => {
    const rng = createRng(3)
    if (cells.length < 2) return []
    return Array.from({ length: count }, () => {
      const at = rng.pick(cells)
      return { at, to: at, t: 1, speed: rng.range(0.5, 0.9), color: rng.pick(['#b3261e', '#f2f2ef', '#1f2a36', '#2563a8', '#c9a227', '#8a9097', '#1e6b3c', '#d9772b']) }
    })
  }, [cells, count])
  const body = useRef<THREE.InstancedMesh>(null)
  const top = useRef<THREE.InstancedMesh>(null)
  const o = useMemo(() => new THREE.Object3D(), [])
  useEffect(() => {
    const c = new THREE.Color()
    cars.forEach((car, i) => body.current?.setColorAt(i, c.set(car.color)))
    if (body.current?.instanceColor) body.current.instanceColor.needsUpdate = true
  }, [cars])
  useFrame((_, dt) => {
    if (!reach || !body.current || !top.current) return
    const h = Math.min(dt, 0.1)
    cars.forEach((car, i) => {
      car.t += h * car.speed
      if (car.t >= 1) {
        car.t = 0
        const prev = car.at
        car.at = car.to
        const opts = ([
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as [number, number][])
          .map(([dx, dz]) => [car.at[0] + dx, car.at[1] + dz] as [number, number])
          .filter((n) => reach.has(key(n[0], n[1])) && !(n[0] === prev[0] && n[1] === prev[1]))
        car.to = opts.length ? opts[Math.floor(Math.random() * opts.length)] : prev
      }
      const x = cx(car.at[0]) + (cx(car.to[0]) - cx(car.at[0])) * car.t
      const z = cx(car.at[1]) + (cx(car.to[1]) - cx(car.at[1])) * car.t
      const dx = car.to[0] - car.at[0]
      const dz = car.to[1] - car.at[1]
      // Keep to the right-hand lane.
      const lx = -dz * 1.2
      const lz = dx * 1.2
      const yaw = Math.atan2(dx, dz)
      o.position.set(x + lx, 0.55, z + lz)
      o.rotation.set(0, yaw, 0)
      o.updateMatrix()
      body.current!.setMatrixAt(i, o.matrix)
      o.position.y = 1.15
      o.updateMatrix()
      top.current!.setMatrixAt(i, o.matrix)
    })
    body.current.instanceMatrix.needsUpdate = true
    top.current.instanceMatrix.needsUpdate = true
  })
  if (!cars.length) return null
  return (
    <group>
      <instancedMesh ref={body} args={[undefined, undefined, cars.length]} castShadow frustumCulled={false}>
        <boxGeometry args={[1.5, 0.7, 3]} />
        <meshStandardMaterial color="#ffffff" metalness={0.4} roughness={0.35} />
      </instancedMesh>
      <instancedMesh ref={top} args={[undefined, undefined, cars.length]} frustumCulled={false}>
        <boxGeometry args={[1.3, 0.55, 1.6]} />
        <meshStandardMaterial color="#1a232c" metalness={0.5} roughness={0.15} />
      </instancedMesh>
    </group>
  )
}

/* The world ------------------------------------------------------------------- */

function Lights() {
  const night = useView((s) => s.night)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    scene.background = new THREE.Color(night ? '#121c33' : '#bcd6ea')
    scene.fog = new THREE.Fog(night ? '#121c33' : '#bcd6ea', 260, 700)
  }, [night, scene])
  return (
    <>
      <hemisphereLight args={[night ? '#6f86bf' : '#fff6e6', night ? '#2a2f3d' : '#6f7d63', night ? 0.9 : 1.1]} />
      <directionalLight
        position={night ? [-80, 120, -60] : [120, 160, 90]}
        intensity={night ? 0.7 : 2.4}
        color={night ? '#9fb3e0' : '#fff0d9'}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-150}
        shadow-camera-right={150}
        shadow-camera-top={150}
        shadow-camera-bottom={-150}
        shadow-camera-far={500}
        shadow-bias={-0.0004}
        shadow-normalBias={0.05}
      />
    </>
  )
}

export default function World() {
  const controls = useRef<{ enabled: boolean } | null>(null)
  const lowEnd = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  // Start looking at the highway entrance: that is where a new city begins.
  const start = useGame.getState().city
  const empty = !start || start.items.length < 3
  const target: [number, number, number] = empty ? [cx(6), 0, cx(GRID / 2)] : [0, 0, 0]
  const dist = empty ? 150 : 260
  return (
    <Canvas
      shadows={!lowEnd}
      dpr={lowEnd ? [1, 1.5] : [1, 2]}
      camera={{ position: [target[0], dist * 0.8, target[2] + dist * 0.6], fov: 45, near: 1, far: 2000 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
      <Lights />
      <Ground />
      <Highway />
      <Roads />
      <Buildings />
      <Cars />
      <Ghost />
      <Picker controls={controls} />
      <MapControls
        ref={controls as never}
        makeDefault
        target={target}
        minDistance={30}
        maxDistance={420}
        maxPolarAngle={1.25}
        minPolarAngle={0.25}
        enableDamping
        dampingFactor={0.12}
      />
    </Canvas>
  )
}

