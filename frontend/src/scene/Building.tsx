import { MallShape } from './MallShape'
import { memo, useEffect, useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Edges, Html } from '@react-three/drei'
import * as THREE from 'three'
import type { Building as BuildingData, BuildingKind } from '../data/types'
import { createRng, hashString } from '../lib/random'
import { useCity } from '../store/cityStore'
import { useDeliveryTarget, useGame } from '../game/store'
import { BusinessShape } from './BusinessShapes'
import { CivicShape, ConstructionShape, LotShape, pickThis } from './CivicShapes'
import { getFacade, repeated, type FacadeStyle } from './facade'

const FACADE_BY_KIND: Partial<Record<BuildingKind, FacadeStyle>> = {
  tower: 'glass',
  office: 'glass',
  hotel: 'glass',
  apartment: 'punched',
  library: 'punched',
  school: 'punched',
  house: 'punched',
  shop: 'shopfront',
  cafe: 'shopfront',
  warehouse: 'strip',
  factory: 'strip',
  unknown: 'punched',
}

const APP_START = performance.now()

const AWNINGS = ['#b6463a', '#2f6f6a', '#c58a2a', '#3d5a99', '#7a4b8c']

/** Wraps a building: pointer interaction, selection outline, placement. */
function BuildingImpl({ data }: { data: BuildingData }) {
  const selected = useCity((s) => s.selectedBuildingId === data.id)
  const hovered = useCity((s) => s.hoveredBuildingId === data.id)
  const night = useCity((s) => s.night)
  const shadows = useCity((s) => s.quality === 'high')
  const selectBuilding = useCity((s) => s.selectBuilding)
  const hoverBuilding = useCity((s) => s.hoverBuilding)
  const parcelHere = useDeliveryTarget() === data.id

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.delta > 6) return // that was a camera drag, not a tap
    const city = useCity.getState()
    if (city.pickPlot) {
      pickThis(data)
      return
    }
    selectBuilding(data.id, 'map')
  }
  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (e.pointerType === 'mouse') {
      hoverBuilding(data.id)
      document.body.style.cursor = 'pointer'
    }
  }
  const onOut = () => {
    if (useCity.getState().hoveredBuildingId === data.id) hoverBuilding(null)
    document.body.style.cursor = ''
  }

  const p: ShapeProps = { data, night, highlight: selected || hovered, shadows }
  // Buildings that appear while the game is running grow out of the ground.
  const grow = useRef<THREE.Group>(null)
  const born = useRef(performance.now())
  const animate = useRef(performance.now() - APP_START > 6000)
  useFrame(() => {
    const g = grow.current
    if (!g || !animate.current) return
    const t = Math.min(1, (performance.now() - born.current) / 1400)
    const e = 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2) // ease-out with a little overshoot
    g.scale.set(1, Math.max(0.02, e), 1)
    if (t >= 1) {
      g.scale.set(1, 1, 1)
      animate.current = false
    }
  })
  return (
    <group ref={grow} position={[data.position[0], 0, data.position[1]]} rotation={[0, data.rotation ?? 0, 0]} onClick={onClick} onPointerOver={onOver} onPointerOut={onOut}>
      {data.shape === 'block' && <BlockShape {...p} />}
      {data.shape === 'mall' && <MallShape {...p} />}
      {data.shape === 'house' && <HouseShape {...p} />}
      {data.shape === 'factory' && <FactoryShape {...p} />}
      {data.shape === 'plant' && <PlantShape {...p} />}
      {data.shape === 'park' && <ParkShape {...p} />}
      {data.shape === 'mystery' && <MysteryShape {...p} />}
      {data.shape === 'civic' && (data.meta?.type === 'civic' && data.meta.visual === 'spire' ? <BlockShape {...p} /> : <CivicShape {...p} />)}
      {data.shape === 'construction' && <ConstructionShape {...p} />}
      {data.shape === 'lot' && <LotShape {...p} />}
      {data.shape === 'business' && <BusinessShape {...p} />}
      {selected && <SelectionRing size={data.size} />}
      {parcelHere && <DeliveryMark size={data.size} height={data.height} />}
    </group>
  )
}

export const Building = memo(BuildingImpl)

/** Today's parcel goes here: a pulsing outline and a label, until it is delivered. */
function DeliveryMark({ size, height }: { size: [number, number]; height: number }) {
  const box = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    const s = 1 + 0.04 * Math.sin(clock.elapsedTime * 4)
    box.current?.scale.set(s, 1, s)
  })
  return (
    <group>
      <mesh ref={box} position={[0, height / 2 + 0.2, 0]} raycast={() => null}>
        <boxGeometry args={[size[0] + 1.2, height + 0.6, size[1] + 1.2]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        <Edges color="#ff8a1f" lineWidth={3} />
      </mesh>
      <Html position={[0, height + 4, 0]} center zIndexRange={[25, 0]} style={{ pointerEvents: 'none' }}>
        <div className="flex items-center gap-1.5 rounded-full border-2 border-white bg-[#e0701a] px-3 py-1.5 font-display text-sm font-bold whitespace-nowrap text-white shadow-lg">
          📦 Посылка сюда
        </div>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */

interface ShapeProps {
  data: BuildingData
  night: boolean
  highlight: boolean
  shadows: boolean
}

/** Share of windows lit at night: 40–70 %, different from building to building. */
const litShare = (id: string) => 0.4 + (hashString(id) % 4) * 0.1

function seedOf(id: string, salt = 0) {
  return createRng(hashString(id) + salt)
}

/** Facade materials for a box: [+x, -x, +y(roof), -y, +z, -z]. */
function useFacade(data: BuildingData, style: FacadeStyle, height: number, lit: number) {
  return useMemo(() => {
    const seed = hashString(data.id)
    const f = getFacade(style, seed, lit)
    const [w, d] = data.size
    const wall = new THREE.Color(data.color)
    const face = (width: number, off: number) =>
      new THREE.MeshStandardMaterial({
        color: wall,
        map: repeated(f.map, style, width, height, off),
        emissive: new THREE.Color(data.accent),
        emissiveMap: repeated(f.emissive, style, width, height, off),
        emissiveIntensity: 0,
        roughness: style === 'glass' ? 0.38 : 0.85,
        metalness: style === 'glass' ? 0.25 : 0.02,
      })
    const roof = new THREE.MeshStandardMaterial({ color: '#8b8f94', roughness: 0.95 })
    const sx = face(d, (seed % 7) / 8)
    const sz = face(w, (seed % 5) / 8)
    return { all: [sx, sx, roof, roof, sz, sz], faces: [sx, sz] }
  }, [data.id, data.size, data.color, data.accent, style, height, lit])
}

function useWindowsAtNight(mats: THREE.MeshStandardMaterial[], night: boolean, strength = 1) {
  useEffect(() => {
    for (const m of mats) m.emissiveIntensity = night ? 1.05 * strength : 0
  }, [mats, night, strength])
}

function Outline({ show }: { show: boolean }) {
  return show ? <Edges threshold={15} color="#ffffff" scale={1.004} /> : null
}

/** Darker band on top of a flat roof, plus a few rooftop units. */
function RoofDetails({ id, w, d, h }: { id: string; w: number; d: number; h: number }) {
  const units = useMemo(() => {
    const rng = seedOf(id, 3)
    const n = h > 8 ? rng.int(1, 3) : 0
    return Array.from({ length: n }, () => ({
      x: rng.range(-w / 3, w / 3),
      z: rng.range(-d / 3, d / 3),
      tank: rng.chance(0.3),
      s: rng.range(0.8, 1.4),
    }))
  }, [id, w, d, h])
  return (
    <group position={[0, h, 0]}>
      <mesh position={[0, 0.22, 0]}>
        <boxGeometry args={[w + 0.25, 0.44, d + 0.25]} />
        <meshStandardMaterial color="#6d7176" roughness={0.9} />
      </mesh>
      {units.map((u, i) =>
        u.tank ? (
          <group key={i} position={[u.x, 0.44, u.z]}>
            <mesh position={[0, 1.2 * u.s, 0]}>
              <cylinderGeometry args={[0.7 * u.s, 0.7 * u.s, 1.4 * u.s, 12]} />
              <meshStandardMaterial color="#8a6a4f" roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.25 * u.s, 0]}>
              <boxGeometry args={[1.2 * u.s, 0.5 * u.s, 1.2 * u.s]} />
              <meshStandardMaterial color="#555b61" />
            </mesh>
          </group>
        ) : (
          <mesh key={i} position={[u.x, 0.44 + 0.4 * u.s, u.z]} castShadow>
            <boxGeometry args={[1.4 * u.s, 0.8 * u.s, 1 * u.s]} />
            <meshStandardMaterial color="#c3c7cb" roughness={0.7} />
          </mesh>
        ),
      )}
    </group>
  )
}

function BlockShape({ data, night, highlight, shadows }: ShapeProps) {
  const [w, d] = data.size
  const h = data.height
  const style = FACADE_BY_KIND[data.kind] ?? 'punched'
  const lit = data.status === 'closed' ? 0.05 : style === 'strip' ? 0.3 : litShare(data.id)
  const mats = useFacade(data, style, h, lit)
  useWindowsAtNight(mats.faces, night, data.status === 'closed' ? 0.4 : 1)
  const shopfront = data.kind === 'shop' || data.kind === 'cafe'
  const awning = useMemo(() => seedOf(data.id, 9).pick(AWNINGS), [data.id])
  const tall = data.kind === 'tower' && h > 40

  return (
    <>
      <mesh position={[0, h / 2, 0]} material={mats.all} castShadow={shadows} receiveShadow={shadows}>
        <boxGeometry args={[w, h, d]} />
        <Outline show={highlight} />
      </mesh>
      {shopfront && (
        <>
          <mesh position={[0, 3, d / 2 + 0.6]} rotation={[0.35, 0, 0]} castShadow={shadows}>
            <boxGeometry args={[w * 0.9, 0.12, 1.4]} />
            <meshStandardMaterial color={awning} roughness={0.8} />
          </mesh>
          <mesh position={[0, h + 0.6, d / 2 - 0.1]}>
            <boxGeometry args={[w * 0.6, 1, 0.2]} />
            <meshStandardMaterial color="#f5f1e8" emissive="#ffe6b5" emissiveIntensity={night ? 0.6 : 0} />
          </mesh>
        </>
      )}
      {!tall && <RoofDetails id={data.id} w={w} d={d} h={h} />}
      {tall && <TowerCrown data={data} night={night} />}
    </>
  )
}

/** Setback crown + mast for skyscrapers. The red aviation light is the only blinking thing in the city. */
function TowerCrown({ data, night }: { data: BuildingData; night: boolean }) {
  const [w, d] = data.size
  const h = data.height
  const light = useRef<THREE.MeshStandardMaterial>(null)
  const phase = useMemo(() => seedOf(data.id, 5).range(0, 6), [data.id])
  const mast = data.landmark ? 14 : 5
  useFrame(({ clock }) => {
    if (light.current) light.current.emissiveIntensity = night && Math.sin(clock.elapsedTime * 2.2 + phase) > 0.6 ? 2 : 0.15
  })
  return (
    <group position={[0, h, 0]}>
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[w * 0.72, 3, d * 0.72]} />
        <meshStandardMaterial color={data.color} roughness={0.5} metalness={0.2} />
      </mesh>
      <mesh position={[0, 3.1, 0]}>
        <boxGeometry args={[w * 0.76, 0.25, d * 0.76]} />
        <meshStandardMaterial color="#5f656c" />
      </mesh>
      <mesh position={[0, 3 + mast / 2, 0]}>
        <cylinderGeometry args={[0.1, data.landmark ? 0.35 : 0.15, mast, 8]} />
        <meshStandardMaterial color="#d6d9dc" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 3 + mast, 0]}>
        <sphereGeometry args={[0.28, 10, 10]} />
        <meshStandardMaterial ref={light} color="#c0392b" emissive="#ff3b2f" />
      </mesh>
    </group>
  )
}

function HouseShape({ data, night, highlight, shadows }: ShapeProps) {
  const [w, d] = data.size
  const body = data.height * 0.62
  const roofH = data.height * 0.38 + 1
  const mats = useFacade(data, 'punched', body, data.status === 'closed' ? 0.05 : litShare(data.id))
  useWindowsAtNight(mats.faces, night)
  const { roof, chimneyX } = useMemo(() => {
    const rng = seedOf(data.id, 1)
    return { roof: rng.pick(['#9b3d2e', '#6b4a3a', '#46566b', '#7a2f2a', '#5d6b4a']), chimneyX: rng.range(-w / 4, w / 4) }
  }, [data.id, w])
  const sy = roofH / 1.5
  const sz = (d + 0.7) / Math.sqrt(3)
  return (
    <>
      <mesh position={[0, body / 2, 0]} material={mats.all} castShadow={shadows} receiveShadow={shadows}>
        <boxGeometry args={[w, body, d]} />
        <Outline show={highlight} />
      </mesh>
      {/* gable roof: a 3-sided cylinder lying on its side is a triangular prism */}
      <mesh position={[0, body + 0.5 * sy, 0]} rotation={[0, 0, Math.PI / 2]} scale={[sy, 1, sz]} castShadow={shadows}>
        <cylinderGeometry args={[1, 1, w + 0.7, 3]} />
        <meshStandardMaterial color={roof} roughness={0.8} flatShading />
      </mesh>
      <mesh position={[chimneyX, body + roofH * 0.7, -d / 5]} castShadow={shadows}>
        <boxGeometry args={[0.6, roofH * 0.9, 0.6]} />
        <meshStandardMaterial color="#8c5a45" />
      </mesh>
      <mesh position={[0, 1.1, d / 2 + 0.03]}>
        <boxGeometry args={[1.1, 2.2, 0.1]} />
        <meshStandardMaterial color="#4b3326" />
      </mesh>
    </>
  )
}

/** A few soft grey puffs that rise and fade above a chimney. */
function Smoke({ height, seed, dark = false }: { height: number; seed: number; dark?: boolean }) {
  const group = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const g = group.current
    if (!g) return
    g.children.forEach((c, i) => {
      const t = (clock.elapsedTime * 0.25 + i / g.children.length + seed) % 1
      c.position.set(Math.sin(t * 3 + i) * 0.4 + t * 1.5, height + t * 7, 0)
      c.scale.setScalar(0.6 + t * 1.8)
      ;((c as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = 0.55 * (1 - t)
    })
  })
  return (
    <group ref={group}>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i}>
          <icosahedronGeometry args={[0.7, 1]} />
          <meshStandardMaterial color={dark ? '#6b6864' : '#e5e7ea'} transparent depthWrite={false} roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

function FactoryShape({ data, night, highlight, shadows }: ShapeProps) {
  const [w, d] = data.size
  const h = data.height
  const mats = useFacade(data, 'strip', h, data.status === 'closed' ? 0.03 : 0.3)
  useWindowsAtNight(mats.faces, night)
  const working = data.status === 'open'
  const { chimneys, teeth } = useMemo(() => {
    const rng = seedOf(data.id, 1)
    const n = rng.int(1, 2)
    return {
      chimneys: Array.from({ length: n }, (_, i) => ({
        x: n === 1 ? w / 3 : -w / 3 + (i * 2 * w) / 3,
        z: -d / 3,
        h: rng.range(8, 13),
        seed: rng.next(),
      })),
      teeth: Math.max(2, Math.round(d / 2.6)),
    }
  }, [data.id, w, d])
  const toothD = d / teeth
  return (
    <>
      <mesh position={[0, h / 2, 0]} material={mats.all} castShadow={shadows} receiveShadow={shadows}>
        <boxGeometry args={[w, h, d]} />
        <Outline show={highlight} />
      </mesh>
      {/* saw-tooth roof */}
      {Array.from({ length: teeth }, (_, i) => (
        <mesh
          key={i}
          position={[0, h + 0.55, -d / 2 + toothD * (i + 0.5)]}
          rotation={[0, 0, Math.PI / 2]}
          scale={[0.75, 1, toothD / Math.sqrt(3)]}
          castShadow={shadows}
        >
          <cylinderGeometry args={[1, 1, w, 3]} />
          <meshStandardMaterial color="#7c8288" roughness={0.7} metalness={0.2} flatShading />
        </mesh>
      ))}
      {chimneys.map((c, i) => (
        <group key={i} position={[c.x, h, c.z]}>
          <mesh position={[0, c.h / 2, 0]} castShadow={shadows}>
            <cylinderGeometry args={[0.45, 0.7, c.h, 12]} />
            <meshStandardMaterial color="#a2483a" roughness={0.9} />
          </mesh>
          <mesh position={[0, c.h - 1, 0]}>
            <cylinderGeometry args={[0.5, 0.5, 0.8, 12]} />
            <meshStandardMaterial color="#efefef" />
          </mesh>
          {working && <Smoke height={c.h} seed={c.seed} />}
        </group>
      ))}
    </>
  )
}

/** Hyperbolic cooling tower profile for LatheGeometry. */
const COOLING_PROFILE = (() => {
  const pts: THREE.Vector2[] = []
  for (let i = 0; i <= 12; i++) {
    const t = i / 12
    const r = 1.3 + 1.1 * Math.pow(Math.abs(t - 0.68) / 0.68, 1.6)
    pts.push(new THREE.Vector2(r, t))
  }
  return pts
})()

/**
 * ТЭЦ «Искра»: the turbine hall with the chimney is the main thing; two cooling towers stand
 * behind it. Everything stays inside the plant's plot; the chimney is the tallest part
 * (that is the height in the building card).
 */
function PlantShape({ data, highlight, shadows }: ShapeProps) {
  const [w, d] = data.size
  const H = data.height
  const repaired = useGame((s) => !!s.city?.projects['tec-repair']?.completedAt)
  const warn = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(({ clock }) => {
    if (warn.current) warn.current.emissiveIntensity = !repaired && Math.sin(clock.elapsedTime * 4) > 0 ? 3 : 0.1
  })
  const hallD = d * 0.42
  const hallZ = d / 2 - hallD / 2 - 0.4
  const towerH = H * 0.5
  const towerScale = Math.min(0.75, (w / 4 - 0.4) / 2.4)
  const towerZ = -d / 2 + 2.4 * towerScale + 0.4
  const windows = Math.max(3, Math.floor((w - 2) / 2.2))
  return (
    <>
      {[-w / 4, w / 4].map((x, i) => (
        <group key={x} position={[x, 0, towerZ]}>
          <mesh scale={[towerScale, towerH, towerScale]} castShadow={shadows} receiveShadow={shadows}>
            <latheGeometry args={[COOLING_PROFILE, 28]} />
            <meshStandardMaterial color={repaired ? '#e4e1db' : '#a69c8e'} roughness={0.95} side={THREE.DoubleSide} />
          </mesh>
          <Smoke height={towerH} seed={i * 0.5} dark={!repaired} />
        </group>
      ))}
      {/* turbine hall */}
      <mesh position={[0, 4, hallZ]} castShadow={shadows} receiveShadow={shadows}>
        <boxGeometry args={[w - 1, 8, hallD]} />
        <meshStandardMaterial color={data.color} roughness={0.8} />
        <Outline show={highlight} />
      </mesh>
      <mesh position={[0, 8.2, hallZ]}>
        <boxGeometry args={[w - 0.8, 0.4, hallD + 0.2]} />
        <meshStandardMaterial color="#d18a2c" roughness={0.6} />
      </mesh>
      {/* tall windows along the hall */}
      {Array.from({ length: windows }, (_, k) => (
        <mesh key={k} position={[-(w - 3) / 2 + (k * (w - 3)) / Math.max(1, windows - 1), 4.4, hallZ + hallD / 2 + 0.03]}>
          <boxGeometry args={[1.1, 4.5, 0.06]} />
          <meshStandardMaterial color="#8fb3c9" roughness={0.15} metalness={0.4} />
        </mesh>
      ))}
      {/* the chimney: the tallest part */}
      <group position={[-w / 2 + 1.6, 0, hallZ - hallD / 2 - 0.9]}>
        <mesh position={[0, H / 2, 0]} castShadow={shadows}>
          <cylinderGeometry args={[0.55, 0.95, H, 16]} />
          <meshStandardMaterial color="#b9b2a8" roughness={0.9} />
        </mesh>
        {[0.78, 0.9].map((f) => (
          <mesh key={f} position={[0, H * f, 0]}>
            <cylinderGeometry args={[0.66, 0.66, 0.9, 16]} />
            <meshStandardMaterial color="#c0392b" />
          </mesh>
        ))}
        <Smoke height={H} seed={0.9} dark={!repaired} />
        {!repaired && (
          <mesh position={[0, H + 0.6, 0]}>
            <sphereGeometry args={[0.35, 12, 12]} />
            <meshStandardMaterial ref={warn} color="#7a1010" emissive="#ff3b1f" />
          </mesh>
        )}
      </group>
    </>
  )
}

function ParkShape({ data, night, highlight, shadows }: ShapeProps) {
  const [w, d] = data.size
  const trees = useMemo(() => {
    const rng = seedOf(data.id, 7)
    const out: { x: number; z: number; s: number; c: string }[] = []
    while (out.length < (data.landmark ? 16 : 9)) {
      const x = rng.range(-w / 2 + 0.8, w / 2 - 0.8)
      const z = rng.range(-d / 2 + 0.8, d / 2 - 0.8)
      if (Math.abs(x) < 1.1 || Math.abs(z) < 1.1 || Math.hypot(x, z) < 2.4) continue // keep paths and fountain clear
      out.push({ x, z, s: rng.range(0.75, 1.25), c: rng.pick(['#4f8a3c', '#5e9a46', '#3f7a35', '#6aa24f']) })
    }
    return out
  }, [data.id, data.landmark, w, d])
  return (
    <>
      <mesh position={[0, 0.15, 0]} receiveShadow={shadows}>
        <boxGeometry args={[w, 0.3, d]} />
        <meshStandardMaterial color={highlight ? '#86b866' : '#74a957'} roughness={1} />
        <Outline show={highlight} />
      </mesh>
      {/* paths */}
      <mesh position={[0, 0.31, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.6, d]} />
        <meshStandardMaterial color="#d9cdb4" roughness={1} />
      </mesh>
      <mesh position={[0, 0.31, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, 1.6]} />
        <meshStandardMaterial color="#d9cdb4" roughness={1} />
      </mesh>
      {/* fountain */}
      <mesh position={[0, 0.5, 0]} castShadow={shadows}>
        <cylinderGeometry args={[1.9, 2, 0.45, 28]} />
        <meshStandardMaterial color="#c9c3b8" />
      </mesh>
      <mesh position={[0, 0.74, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.65, 28]} />
        <meshStandardMaterial color="#5d9ec4" roughness={0.15} metalness={0.2} />
      </mesh>
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.18, 0.3, 1, 10]} />
        <meshStandardMaterial color="#c9c3b8" />
      </mesh>
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0.3, t.z]} scale={t.s}>
          <mesh position={[0, 0.7, 0]}>
            <cylinderGeometry args={[0.12, 0.17, 1.4, 6]} />
            <meshStandardMaterial color="#6b4a2f" />
          </mesh>
          <mesh position={[0, 2.1, 0]} castShadow={shadows}>
            <icosahedronGeometry args={[1.05, 0]} />
            <meshStandardMaterial color={t.c} roughness={0.9} flatShading />
          </mesh>
        </group>
      ))}
      {night && (
        <pointLight position={[0, 3, 0]} intensity={18} distance={12} color="#ffcf8a" />
      )}
      {data.landmark && (
        <group position={[-2.9, 0.3, -2.9]}>
          {/* wooden gazebo */}
          <mesh position={[0, 0.12, 0]} receiveShadow>
            <cylinderGeometry args={[1.5, 1.5, 0.24, 6]} />
            <meshStandardMaterial color="#a0784f" roughness={0.9} />
          </mesh>
          {Array.from({ length: 6 }, (_, i) => (
            <mesh key={i} position={[Math.cos((i / 6) * Math.PI * 2) * 1.3, 1.2, Math.sin((i / 6) * Math.PI * 2) * 1.3]} castShadow={shadows}>
              <boxGeometry args={[0.14, 2, 0.14]} />
              <meshStandardMaterial color="#f1e9dc" />
            </mesh>
          ))}
          <mesh position={[0, 2.65, 0]} castShadow={shadows}>
            <coneGeometry args={[1.95, 1.2, 6]} />
            <meshStandardMaterial color="#7b3b2c" roughness={0.8} flatShading />
          </mesh>
          <mesh position={[0, 0.6, 0]}>
            <cylinderGeometry args={[0.55, 0.55, 0.08, 12]} />
            <meshStandardMaterial color="#8a6a48" />
          </mesh>
        </group>
      )}
    </>
  )
}

function MysteryShape(props: ShapeProps) {
  return props.data.districtId === 'industrial' ? <MysteryWarehouse {...props} /> : <MysteryHouse {...props} />
}

/** «Склад №7»: a low, wide corrugated shed with a boarded-up gate and no windows. */
function MysteryWarehouse({ data, highlight, shadows }: ShapeProps) {
  const [w0, d0] = data.size
  const w = Math.max(w0, 10)
  const d = Math.max(d0, 8)
  const h = Math.min(data.height, 7)
  return (
    <>
      <mesh position={[0, h / 2, 0]} castShadow={shadows} receiveShadow={shadows}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#8d8f8c" roughness={0.85} metalness={0.15} />
        <Outline show={highlight} />
      </mesh>
      {/* corrugation */}
      {Array.from({ length: Math.floor(w / 0.8) }, (_, i) => (
        <mesh key={i} position={[-w / 2 + 0.4 + i * 0.8, h / 2, d / 2 + 0.03]}>
          <boxGeometry args={[0.12, h - 0.2, 0.06]} />
          <meshStandardMaterial color="#7b7d7a" />
        </mesh>
      ))}
      {/* pitched roof */}
      <mesh position={[0, h + 0.6, 0]} rotation={[0, 0, 0]} castShadow={shadows}>
        <boxGeometry args={[w + 0.4, 0.3, d + 0.4]} />
        <meshStandardMaterial color="#6c5a4a" roughness={0.95} />
      </mesh>
      {/* the gate, boarded up */}
      <mesh position={[0, 2.4, d / 2 + 0.08]}>
        <boxGeometry args={[w * 0.45, 4.6, 0.1]} />
        <meshStandardMaterial color="#5f6b60" roughness={0.7} metalness={0.3} />
      </mesh>
      {[1.4, 3.2].map((y, i) => (
        <mesh key={y} position={[0, y, d / 2 + 0.16]} rotation={[0, 0, i ? 0.18 : -0.14]}>
          <boxGeometry args={[w * 0.55, 0.4, 0.08]} />
          <meshStandardMaterial color="#8a6a48" roughness={1} />
        </mesh>
      ))}
      <mesh position={[w * 0.32, h - 1.3, d / 2 + 0.08]}>
        <boxGeometry args={[1.6, 1.6, 0.08]} />
        <meshStandardMaterial color="#e0a33b" />
      </mesh>
      <Html position={[w * 0.32, h - 1.3, d / 2 + 0.2]} center transform scale={0.9} pointerEvents="none">
        <div style={{ font: '700 30px Rubik, sans-serif', color: '#2a2a2a' }}>7</div>
      </Html>
    </>
  )
}

/** The «?» over a mystery building: small, and only when the camera is closer than 120 m. */
function MysteryMark({ at }: { at: [number, number, number] }) {
  const anchor = useRef<THREE.Group>(null)
  const el = useRef<HTMLDivElement>(null)
  const world = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera }) => {
    if (!anchor.current || !el.current) return
    anchor.current.getWorldPosition(world)
    el.current.style.opacity = camera.position.distanceTo(world) < 120 ? '1' : '0'
  })
  return (
    <group ref={anchor} position={at}>
      <Html center zIndexRange={[15, 0]} pointerEvents="none">
        <div ref={el} className="mystery-sign small" aria-hidden style={{ transition: 'opacity .3s', opacity: 0 }}>
          ?
        </div>
      </Html>
    </group>
  )
}

function MysteryHouse({ data, highlight, shadows }: ShapeProps) {
  const [w, d] = data.size
  const h = data.height
  const mats = useFacade(data, 'punched', h, 0)
  const showSign = useCity((s) => s.selectedBuildingId !== data.id)
  return (
    <>
      <mesh position={[0, h / 2, 0]} material={mats.all} castShadow={shadows} receiveShadow={shadows}>
        <boxGeometry args={[w, h, d]} />
        <Outline show={highlight} />
      </mesh>
      {/* boards across the front */}
      {[0.3, 0.55].map((f) => (
        <mesh key={f} position={[0, h * f, d / 2 + 0.06]} rotation={[0, 0, f > 0.4 ? 0.12 : -0.1]}>
          <boxGeometry args={[w * 0.9, 0.45, 0.1]} />
          <meshStandardMaterial color="#8a6a48" roughness={1} />
        </mesh>
      ))}
      <RoofDetails id={data.id} w={w} d={d} h={h} />
      {showSign && <MysteryMark at={[0, h + 2.4, 0]} />}
    </>
  )
}

function SelectionRing({ size }: { size: [number, number] }) {
  const ref = useRef<THREE.Mesh>(null)
  const r = Math.max(size[0], size[1]) * 0.8
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = clock.elapsedTime * 0.4
  })
  return (
    <mesh ref={ref} position={[0, 0.14, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[r, r + 0.45, 6]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.85} />
    </mesh>
  )
}
