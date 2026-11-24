import { memo, useEffect, useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Edges } from '@react-three/drei'
import * as THREE from 'three'
import type { Building as BuildingData } from '../data/types'
import { createRng, hashString } from '../lib/random'
import { useCity } from '../store/cityStore'
import { getFacade, repeated } from './windowTexture'

interface Props {
  data: BuildingData
}

/** Wraps a building: handles pointer interaction, selection outline and placement. */
function BuildingImpl({ data }: Props) {
  const selected = useCity((s) => s.selectedBuildingId === data.id)
  const hovered = useCity((s) => s.hoveredBuildingId === data.id)
  const night = useCity((s) => s.night)
  const shadows = useCity((s) => s.quality === 'high')
  const selectBuilding = useCity((s) => s.selectBuilding)
  const hoverBuilding = useCity((s) => s.hoverBuilding)

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.delta > 6) return // was a camera drag, not a tap
    selectBuilding(data.id)
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

  const highlight = selected || hovered
  const props: ShapeProps = { data, night, highlight, selected, shadows }

  return (
    <group position={[data.position[0], 0, data.position[1]]} onClick={onClick} onPointerOver={onOver} onPointerOut={onOut}>
      {data.shape === 'block' && <BlockShape {...props} />}
      {data.shape === 'house' && <HouseShape {...props} />}
      {data.shape === 'factory' && <FactoryShape {...props} />}
      {data.shape === 'plant' && <PlantShape {...props} />}
      {data.shape === 'park' && <ParkShape {...props} />}
      {data.shape === 'mystery' && <MysteryShape {...props} />}
      {selected && <SelectionRing size={data.size} color={data.accent} />}
    </group>
  )
}

export const Building = memo(BuildingImpl)

/* ------------------------------------------------------------------ */

interface ShapeProps {
  data: BuildingData
  night: boolean
  highlight: boolean
  selected: boolean
  shadows: boolean
}

function glowIntensity(night: boolean, highlight: boolean) {
  return (night ? 1.35 : 0.08) + (highlight ? 0.6 : 0)
}

/** Facade materials for a box: [+x, -x, +y, -y, +z, -z]. */
function useFacadeMaterials(data: BuildingData, height: number, litRatio: number) {
  return useMemo(() => {
    const seed = hashString(data.id)
    const facade = getFacade(seed, litRatio)
    const [w, d] = data.size
    const wall = new THREE.Color(data.color)
    const accent = new THREE.Color(data.accent)
    const face = (width: number, off: number) =>
      new THREE.MeshStandardMaterial({
        color: wall,
        map: repeated(facade.map, width, height, off),
        emissive: accent,
        emissiveMap: repeated(facade.emissive, width, height, off),
        roughness: 0.55,
        metalness: 0.15,
      })
    const roof = new THREE.MeshStandardMaterial({ color: wall.clone().multiplyScalar(0.6), roughness: 0.9 })
    const sideX = face(d, (seed % 7) / 8)
    const sideZ = face(w, (seed % 5) / 8)
    return { all: [sideX, sideX, roof, roof, sideZ, sideZ], facades: [sideX, sideZ] }
  }, [data.id, data.size, data.color, data.accent, height, litRatio])
}

function useGlow(materials: THREE.MeshStandardMaterial[], night: boolean, highlight: boolean, base = 1) {
  useEffect(() => {
    for (const m of materials) m.emissiveIntensity = glowIntensity(night, highlight) * base
  }, [materials, night, highlight, base])
}

function Outline({ show, color }: { show: boolean; color: string }) {
  if (!show) return null
  return <Edges threshold={15} color={color} scale={1.002} />
}

function BlockShape({ data, night, highlight, shadows }: ShapeProps) {
  const [w, d] = data.size
  const h = data.height
  const lit = data.status === 'closed' ? 0.06 : data.kind === 'warehouse' ? 0.18 : 0.5
  const mats = useFacadeMaterials(data, h, lit)
  useGlow(mats.facades, night, highlight, data.status === 'closed' ? 0.4 : 1)

  const storefront = data.kind === 'shop' || data.kind === 'cafe'
  return (
    <>
      <mesh position={[0, h / 2, 0]} material={mats.all} castShadow={shadows} receiveShadow={shadows}>
        <boxGeometry args={[w, h, d]} />
        <Outline show={highlight} color={data.accent} />
      </mesh>
      {storefront && (
        <mesh position={[0, 2.6, d / 2 + 0.45]}>
          <boxGeometry args={[w * 0.85, 0.18, 0.9]} />
          <meshStandardMaterial color={data.accent} emissive={data.accent} emissiveIntensity={night ? 1.6 : 0.3} />
        </mesh>
      )}
      {(data.kind === 'tower' || data.kind === 'hotel') && (
        <RooftopBeacon height={h} color={data.accent} night={night} tall={h > 50} />
      )}
      {data.kind === 'tower' && h > 40 && (
        <mesh position={[0, h + 0.6, 0]}>
          <boxGeometry args={[w * 0.7, 1.2, d * 0.7]} />
          <meshStandardMaterial color={data.color} roughness={0.6} />
        </mesh>
      )}
    </>
  )
}

function RooftopBeacon({ height, color, night, tall }: { height: number; color: string; night: boolean; tall: boolean }) {
  const ref = useRef<THREE.MeshStandardMaterial>(null)
  const phase = useMemo(() => Math.random() * Math.PI * 2, [])
  useFrame(({ clock }) => {
    if (ref.current) ref.current.emissiveIntensity = (night ? 2.4 : 0.6) * (0.55 + 0.45 * Math.sin(clock.elapsedTime * 2 + phase))
  })
  const mast = tall ? 7 : 2.5
  return (
    <group position={[0, height + (tall ? 1.2 : 0), 0]}>
      <mesh position={[0, mast / 2, 0]}>
        <cylinderGeometry args={[0.08, 0.12, mast, 6]} />
        <meshStandardMaterial color="#9ca3af" />
      </mesh>
      <mesh position={[0, mast, 0]}>
        <sphereGeometry args={[0.35, 12, 12]} />
        <meshStandardMaterial ref={ref} color={color} emissive={color} />
      </mesh>
    </group>
  )
}

function HouseShape({ data, night, highlight, shadows }: ShapeProps) {
  const [w, d] = data.size
  const body = data.height * 0.62
  const roofH = data.height * 0.38 + 1
  const mats = useFacadeMaterials(data, body, data.status === 'closed' ? 0.05 : 0.55)
  useGlow(mats.facades, night, highlight)
  const roofColor = useMemo(() => {
    const rng = createRng(hashString(data.id))
    return rng.pick(['#7c2d12', '#57534e', '#334155', '#7f1d1d', '#3f6212'])
  }, [data.id])
  return (
    <>
      <mesh position={[0, body / 2, 0]} material={mats.all} castShadow={shadows} receiveShadow={shadows}>
        <boxGeometry args={[w, body, d]} />
        <Outline show={highlight} color={data.accent} />
      </mesh>
      <mesh
        position={[0, body + roofH / 2, 0]}
        rotation={[0, Math.PI / 4, 0]}
        scale={[w / Math.SQRT2, 1, d / Math.SQRT2]}
        castShadow={shadows}
      >
        <coneGeometry args={[1.08, roofH, 4, 1]} />
        <meshStandardMaterial color={roofColor} roughness={0.85} flatShading />
      </mesh>
    </>
  )
}

function FactoryShape({ data, night, highlight, shadows }: ShapeProps) {
  const [w, d] = data.size
  const h = data.height
  const mats = useFacadeMaterials(data, h, data.status === 'closed' ? 0.03 : 0.22)
  useGlow(mats.facades, night, highlight)
  const chimneys = useMemo(() => {
    const rng = createRng(hashString(data.id) + 1)
    const n = rng.int(1, 3)
    return Array.from({ length: n }, (_, i) => ({
      x: n === 1 ? w / 4 : -w / 2 + 1.2 + (i * (w - 2.4)) / (n - 1),
      z: rng.range(-d / 4, d / 4),
      h: rng.range(6, 12),
    }))
  }, [data.id, w, d])
  return (
    <>
      <mesh position={[0, h / 2, 0]} material={mats.all} castShadow={shadows} receiveShadow={shadows}>
        <boxGeometry args={[w, h, d]} />
        <Outline show={highlight} color={data.accent} />
      </mesh>
      {chimneys.map((c, i) => (
        <group key={i} position={[c.x, h, c.z]}>
          <mesh position={[0, c.h / 2, 0]} castShadow={shadows}>
            <cylinderGeometry args={[0.45, 0.65, c.h, 10]} />
            <meshStandardMaterial color="#78716c" roughness={0.9} />
          </mesh>
          <mesh position={[0, c.h - 0.6, 0]}>
            <torusGeometry args={[0.5, 0.08, 6, 16]} />
            <meshStandardMaterial color={data.accent} emissive={data.accent} emissiveIntensity={night ? 2 : 0.4} />
          </mesh>
        </group>
      ))}
    </>
  )
}

function PlantShape({ data, night, highlight, shadows }: ShapeProps) {
  const h = data.height
  const ring = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(({ clock }) => {
    if (ring.current) ring.current.emissiveIntensity = (night ? 2.6 : 0.8) * (0.7 + 0.3 * Math.sin(clock.elapsedTime * 3))
  })
  return (
    <>
      {[-2.1, 2.1].map((x) => (
        <mesh key={x} position={[x, h / 2, -1]} castShadow={shadows} receiveShadow={shadows}>
          <cylinderGeometry args={[1.7, 2.3, h, 20, 1, true]} />
          <meshStandardMaterial color="#a8a29e" roughness={0.8} side={THREE.DoubleSide} />
          {x < 0 && <Outline show={highlight} color={data.accent} />}
        </mesh>
      ))}
      <mesh position={[0, 2.5, 2.6]} castShadow={shadows}>
        <boxGeometry args={[7.5, 5, 3]} />
        <meshStandardMaterial color={data.color} roughness={0.7} />
        <Outline show={highlight} color={data.accent} />
      </mesh>
      <mesh position={[0, 5.2, 2.6]}>
        <boxGeometry args={[7.6, 0.25, 3.1]} />
        <meshStandardMaterial ref={ring} color={data.accent} emissive={data.accent} />
      </mesh>
    </>
  )
}

function ParkShape({ data, night, highlight, shadows }: ShapeProps) {
  const [w, d] = data.size
  const trees = useMemo(() => {
    const rng = createRng(hashString(data.id) + 7)
    return Array.from({ length: data.landmark ? 14 : 8 }, () => ({
      x: rng.range(-w / 2 + 1, w / 2 - 1),
      z: rng.range(-d / 2 + 1, d / 2 - 1),
      s: rng.range(0.8, 1.4),
      c: rng.pick(['#166534', '#15803d', '#14532d', '#3f6212']),
    }))
  }, [data.id, data.landmark, w, d])
  const lights = useMemo(() => {
    const rng = createRng(hashString(data.id) + 11)
    return Array.from({ length: 24 }, (): [number, number, number] => [rng.range(-w / 2, w / 2), rng.range(0.6, 3), rng.range(-d / 2, d / 2)])
  }, [data.id, w, d])
  return (
    <>
      <mesh position={[0, 0.2, 0]} receiveShadow={shadows}>
        <boxGeometry args={[w, 0.25, d]} />
        <meshStandardMaterial color={highlight ? '#2f7d4f' : '#1f5135'} roughness={1} />
        <Outline show={highlight} color={data.accent} />
      </mesh>
      <mesh position={[0, 0.34, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.4, 2, 32]} />
        <meshStandardMaterial color="#a8a29e" />
      </mesh>
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0.3, t.z]} scale={t.s}>
          <mesh position={[0, 0.6, 0]}>
            <cylinderGeometry args={[0.12, 0.16, 1.2, 6]} />
            <meshStandardMaterial color="#57381f" />
          </mesh>
          <mesh position={[0, 1.9, 0]} castShadow={shadows}>
            <coneGeometry args={[0.9, 2.4, 7]} />
            <meshStandardMaterial color={t.c} flatShading />
          </mesh>
        </group>
      ))}
      {night &&
        lights.map((p, i) => (
          <mesh key={i} position={p}>
            <sphereGeometry args={[0.08, 6, 6]} />
            <meshBasicMaterial color={data.accent} />
          </mesh>
        ))}
    </>
  )
}

function MysteryShape({ data, night, highlight, shadows }: ShapeProps) {
  const [w, d] = data.size
  const h = data.height
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  const mark = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (mat.current) mat.current.emissiveIntensity = (night ? 0.06 : 0.015) * (1 + Math.sin(t * 1.4)) + (highlight ? 0.1 : 0)
    if (mark.current) {
      mark.current.rotation.y = t * 0.8
      mark.current.position.y = h + 2.2 + Math.sin(t * 1.6) * 0.4
    }
  })
  return (
    <>
      <mesh position={[0, h / 2, 0]} castShadow={shadows} receiveShadow={shadows}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial ref={mat} color={data.color} emissive={data.accent} roughness={0.95} />
        <Edges threshold={15} color={data.accent} />
      </mesh>
      <mesh ref={mark} position={[0, h + 2.2, 0]}>
        <octahedronGeometry args={[0.9, 0]} />
        <meshStandardMaterial color={data.accent} emissive={data.accent} emissiveIntensity={1.8} wireframe />
      </mesh>
    </>
  )
}

function SelectionRing({ size, color }: { size: [number, number]; color: string }) {
  const ref = useRef<THREE.Mesh>(null)
  const r = Math.max(size[0], size[1]) * 0.78
  useFrame(({ clock }) => {
    if (!ref.current) return
    const s = 1 + 0.06 * Math.sin(clock.elapsedTime * 4)
    ref.current.scale.set(s, s, s)
  })
  return (
    <mesh ref={ref} position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[r, r + 0.35, 48]} />
      <meshBasicMaterial color={color} transparent opacity={0.9} />
    </mesh>
  )
}
