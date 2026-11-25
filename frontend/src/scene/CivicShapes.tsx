import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Building as BuildingData } from '../data/types'
import { createRng, hashString } from '../lib/random'
import { Html } from '@react-three/drei'
import { useGame } from '../game/store'
import { useCity } from '../store/cityStore'
import { buildPick } from '../ui/game/BuildPanel'
import { preselect } from '../ui/game/BusinessPanel'
import { getFacade, repeated, type FacadeStyle } from './facade'

/* Shared helpers ------------------------------------------------------- */

const signCache = new Map<string, THREE.CanvasTexture>()

/** A sign board texture with real text on it. */
export function signTexture(text: string, bg: string, fg: string, w = 512, h = 128) {
  const key = `${text}|${bg}|${fg}|${w}|${h}`
  const hit = signCache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = fg
  let size = h * 0.56
  ctx.font = `700 ${size}px Rubik, Onest, Arial, sans-serif`
  while (ctx.measureText(text).width > w * 0.9 && size > 12) {
    size -= 2
    ctx.font = `700 ${size}px Rubik, Onest, Arial, sans-serif`
  }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, w / 2, h / 2 + 2)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  signCache.set(key, t)
  return t
}

export function useFacadeMats(id: string, color: string, style: FacadeStyle, w: number, d: number, h: number, night: boolean, lit = 0.45) {
  const mats = useMemo(() => {
    const seed = hashString(id)
    const f = getFacade(style, seed, lit)
    const wall = new THREE.Color(color)
    const face = (width: number) =>
      new THREE.MeshStandardMaterial({
        color: wall,
        map: repeated(f.map, style, width, h),
        emissive: new THREE.Color('#ffd59a'),
        emissiveMap: repeated(f.emissive, style, width, h),
        roughness: style === 'glass' ? 0.35 : 0.85,
        metalness: style === 'glass' ? 0.3 : 0.02,
      })
    const roof = new THREE.MeshStandardMaterial({ color: '#8a8d91', roughness: 0.95 })
    const sx = face(d)
    const sz = face(w)
    return { all: [sx, sx, roof, roof, sz, sz], faces: [sx, sz] }
  }, [id, color, style, w, d, h, lit])
  for (const m of mats.faces) m.emissiveIntensity = night ? 1.05 : 0
  return mats
}

export function Box({ size, at, color, rough = 0.8, metal = 0, cast = true, emissive, ei = 0 }: { size: [number, number, number]; at: [number, number, number]; color: string; rough?: number; metal?: number; cast?: boolean; emissive?: string; ei?: number }) {
  return (
    <mesh position={at} castShadow={cast} receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={rough} metalness={metal} emissive={emissive ?? '#000000'} emissiveIntensity={ei} />
    </mesh>
  )
}

export function Sign({ text, at, w, h, bg, fg, rotY = 0, night }: { text: string; at: [number, number, number]; w: number; h: number; bg: string; fg: string; rotY?: number; night: boolean }) {
  const tex = signTexture(text, bg, fg)
  return (
    <mesh position={at} rotation={[0, rotY, 0]}>
      <boxGeometry args={[w, h, 0.12]} />
      <meshStandardMaterial attach="material-0" color={bg} />
      <meshStandardMaterial attach="material-1" color={bg} />
      <meshStandardMaterial attach="material-2" color={bg} />
      <meshStandardMaterial attach="material-3" color={bg} />
      <meshStandardMaterial attach="material-4" map={tex} emissive="#ffffff" emissiveMap={tex} emissiveIntensity={night ? 0.9 : 0.05} />
      <meshStandardMaterial attach="material-5" color={bg} />
    </mesh>
  )
}

function RedCross({ at, s = 1 }: { at: [number, number, number]; s?: number }) {
  return (
    <group position={at} scale={s}>
      <Box size={[1.6, 1.6, 0.14]} at={[0, 0, 0]} color="#ffffff" cast={false} />
      <Box size={[1.1, 0.34, 0.18]} at={[0, 0, 0.02]} color="#d32f2f" cast={false} emissive="#ff3b30" ei={0.3} />
      <Box size={[0.34, 1.1, 0.18]} at={[0, 0, 0.02]} color="#d32f2f" cast={false} emissive="#ff3b30" ei={0.3} />
    </group>
  )
}

export interface Props {
  data: BuildingData
  night: boolean
  highlight: boolean
  shadows: boolean
}

/* Civic buildings -------------------------------------------------------- */

export function CivicShape({ data, night }: Props) {
  const visual = data.meta?.type === 'civic' ? data.meta.visual : 'clinic'
  switch (visual) {
    case 'clinic':
      return <Clinic data={data} night={night} />
    case 'hospital':
      return <Hospital data={data} night={night} />
    case 'police':
      return <Police data={data} night={night} />
    case 'fire':
      return <FireStation data={data} night={night} />
    case 'water-tower':
      return <WaterTower />
    case 'school':
      return <School data={data} night={night} />
    case 'library':
      return <Library data={data} night={night} />
    case 'solar':
      return <SolarFarm />
    case 'pump':
      return <PumpStation data={data} night={night} />
    default:
      return <Clinic data={data} night={night} />
  }
}

function Clinic({ data, night }: { data: BuildingData; night: boolean }) {
  const m = useFacadeMats(data.id, '#f1efe9', 'punched', 7.6, 6.4, 8, night)
  return (
    <group position={[0, 0, -0.6]}>
      <mesh position={[0, 4, 0]} material={m.all} castShadow receiveShadow>
        <boxGeometry args={[7.6, 8, 6.4]} />
      </mesh>
      <Box size={[7.9, 0.4, 6.7]} at={[0, 8.2, 0]} color="#7d8185" />
      <Box size={[3.2, 0.2, 1.8]} at={[0, 3, 3.9]} color="#e9e6df" />
      <Box size={[0.12, 3, 0.12]} at={[-1.5, 1.5, 4.7]} color="#bfc3c7" metal={0.6} />
      <Box size={[0.12, 3, 0.12]} at={[1.5, 1.5, 4.7]} color="#bfc3c7" metal={0.6} />
      <Box size={[2.2, 2.4, 0.08]} at={[0, 1.2, 3.22]} color="#7fa3bf" rough={0.1} metal={0.4} />
      <RedCross at={[0, 6.4, 3.26]} />
      <Sign text="ПОЛИКЛИНИКА" at={[0, 3.6, 4.85]} w={3.2} h={0.55} bg="#ffffff" fg="#c62828" night={night} />
    </group>
  )
}

function Hospital({ data, night }: { data: BuildingData; night: boolean }) {
  const tall = useFacadeMats(data.id + 't', '#eef0f2', 'glass', 7.6, 4.6, 21, night)
  const low = useFacadeMats(data.id + 'l', '#f1efe9', 'punched', 7.6, 3.6, 6, night)
  const pad = useMemo(() => signTexture('H', '#3b4652', '#ffffff', 256, 256), [])
  return (
    <group>
      <mesh position={[0, 10.5, -1.9]} material={tall.all} castShadow receiveShadow>
        <boxGeometry args={[7.6, 21, 4.6]} />
      </mesh>
      <mesh position={[0, 3, 2.2]} material={low.all} castShadow receiveShadow>
        <boxGeometry args={[7.6, 6, 3.6]} />
      </mesh>
      <mesh position={[0, 21.15, -1.9]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.1, 32]} />
        <meshStandardMaterial map={pad} />
      </mesh>
      <RedCross at={[0, 17.5, 0.36]} s={1.3} />
      <Sign text="ГОРОДСКАЯ БОЛЬНИЦА" at={[0, 6.6, 4.05]} w={6.4} h={0.8} bg="#ffffff" fg="#c62828" night={night} />
      <Box size={[3, 0.2, 1.6]} at={[0, 2.7, 4.8]} color="#e5e2db" />
    </group>
  )
}

function Police({ data, night }: { data: BuildingData; night: boolean }) {
  const m = useFacadeMats(data.id, '#e7e4dc', 'punched', 7.6, 6.6, 7.5, night)
  const beacon = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(({ clock }) => {
    if (beacon.current) beacon.current.emissiveIntensity = Math.sin(clock.elapsedTime * 6) > 0 ? 3 : 0.3
  })
  return (
    <group position={[0, 0, -0.5]}>
      <mesh position={[0, 3.75, 0]} material={m.all} castShadow receiveShadow>
        <boxGeometry args={[7.6, 7.5, 6.6]} />
      </mesh>
      <Box size={[7.7, 0.7, 6.7]} at={[0, 2.6, 0]} color="#1f4fa0" cast={false} />
      <Box size={[7.9, 0.4, 6.9]} at={[0, 7.7, 0]} color="#6f7378" />
      <Sign text="ПОЛИЦИЯ" at={[0, 5.6, 3.38]} w={3.4} h={0.7} bg="#1f4fa0" fg="#ffffff" night={night} />
      <Box size={[2, 2.2, 0.1]} at={[0, 1.1, 3.32]} color="#3a4a5c" rough={0.2} metal={0.4} />
      <mesh position={[2.8, 8.3, 2.4]}>
        <sphereGeometry args={[0.25, 12, 12]} />
        <meshStandardMaterial ref={beacon} color="#1d4ed8" emissive="#3b82f6" />
      </mesh>
      <Box size={[0.08, 6, 0.08]} at={[-3.4, 8.6, 2.8]} color="#cfd3d7" metal={0.7} />
      <Box size={[1.4, 0.9, 0.03]} at={[-2.7, 11, 2.8]} color="#1f4fa0" cast={false} />
    </group>
  )
}

function FireStation({ data, night }: { data: BuildingData; night: boolean }) {
  const m = useFacadeMats(data.id, '#a5432f', 'punched', 7.6, 6.6, 8, night)
  return (
    <group position={[0, 0, -0.5]}>
      <mesh position={[0, 4, 0]} material={m.all} castShadow receiveShadow>
        <boxGeometry args={[7.6, 8, 6.6]} />
      </mesh>
      {[-2.4, 0, 2.4].map((x) => (
        <group key={x}>
          <Box size={[2, 3.2, 0.1]} at={[x, 1.6, 3.33]} color="#c62828" rough={0.5} metal={0.3} />
          {[0.6, 1.4, 2.2].map((y) => (
            <Box key={y} size={[1.9, 0.05, 0.12]} at={[x, y, 3.36]} color="#8e1c1c" cast={false} />
          ))}
        </group>
      ))}
      <Sign text="ПОЖАРНАЯ ЧАСТЬ" at={[0, 4.2, 3.38]} w={5.6} h={0.7} bg="#ffffff" fg="#b71c1c" night={night} />
      <Box size={[2.2, 13, 2.2]} at={[2.7, 6.5, -2.1]} color="#9b3d2b" />
      <Box size={[2.6, 0.5, 2.6]} at={[2.7, 13.2, -2.1]} color="#6f7378" />
    </group>
  )
}

function WaterTower() {
  return (
    <group>
      {[
        [-2, -2],
        [2, -2],
        [-2, 2],
        [2, 2],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x * 0.85, 6.5, z * 0.85]} rotation={[z * 0.03, 0, -x * 0.03]} castShadow>
          <cylinderGeometry args={[0.16, 0.22, 13, 8]} />
          <meshStandardMaterial color="#5c6670" metalness={0.6} roughness={0.5} />
        </mesh>
      ))}
      {[3.5, 8].map((y) => (
        <group key={y}>
          <Box size={[3.6, 0.12, 0.12]} at={[0, y, 1.7]} color="#5c6670" metal={0.6} />
          <Box size={[3.6, 0.12, 0.12]} at={[0, y, -1.7]} color="#5c6670" metal={0.6} />
          <Box size={[0.12, 0.12, 3.6]} at={[1.7, y, 0]} color="#5c6670" metal={0.6} />
          <Box size={[0.12, 0.12, 3.6]} at={[-1.7, y, 0]} color="#5c6670" metal={0.6} />
        </group>
      ))}
      <mesh position={[0, 15, 0]} castShadow>
        <cylinderGeometry args={[3.1, 3.1, 4.2, 32]} />
        <meshStandardMaterial color="#d9e3ea" metalness={0.5} roughness={0.35} />
      </mesh>
      <mesh position={[0, 17.9, 0]} castShadow>
        <coneGeometry args={[3.3, 1.6, 32]} />
        <meshStandardMaterial color="#9fb0bf" metalness={0.5} roughness={0.4} />
      </mesh>
      <Box size={[0.6, 13, 0.08]} at={[0, 6.5, 2.1]} color="#4a525a" metal={0.5} />
    </group>
  )
}

function School({ data, night }: { data: BuildingData; night: boolean }) {
  const m = useFacadeMats(data.id, '#e2b48a', 'punched', 7.8, 4.6, 10, night)
  return (
    <group>
      <mesh position={[0, 5, -1.9]} material={m.all} castShadow receiveShadow>
        <boxGeometry args={[7.8, 10, 4.6]} />
      </mesh>
      <Box size={[8.1, 0.4, 4.9]} at={[0, 10.2, -1.9]} color="#7a4a36" />
      <mesh position={[0, 0.17, 2.6]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[7.4, 3.4]} />
        <meshStandardMaterial color="#4f9a55" />
      </mesh>
      <Box size={[7.4, 0.02, 0.08]} at={[0, 0.19, 2.6]} color="#ffffff" cast={false} />
      <Box size={[0.08, 2.4, 0.08]} at={[3.4, 1.4, 2.6]} color="#ffffff" />
      <Box size={[0.08, 2.4, 0.08]} at={[-3.4, 1.4, 2.6]} color="#ffffff" />
      <Sign text="ШКОЛА" at={[0, 8.6, 0.42]} w={2.6} h={0.6} bg="#2f63c9" fg="#ffffff" night={night} />
    </group>
  )
}

function Library({ data, night }: { data: BuildingData; night: boolean }) {
  const m = useFacadeMats(data.id, '#d8cbb3', 'punched', 7.6, 5.4, 11, night)
  return (
    <group position={[0, 0, -0.8]}>
      <mesh position={[0, 5.5, 0]} material={m.all} castShadow receiveShadow>
        <boxGeometry args={[7.6, 11, 5.4]} />
      </mesh>
      {[-3, -1.8, -0.6, 0.6, 1.8, 3].map((x) => (
        <mesh key={x} position={[x, 3.4, 3.3]} castShadow>
          <cylinderGeometry args={[0.24, 0.28, 6.4, 16]} />
          <meshStandardMaterial color="#efe8da" roughness={0.7} />
        </mesh>
      ))}
      <Box size={[7.4, 0.5, 1.8]} at={[0, 6.8, 3.3]} color="#e6dccb" />
      <mesh position={[0, 7.9, 3.3]} rotation={[0, 0, Math.PI / 2]} scale={[1.1, 1, 1.1]} castShadow>
        <cylinderGeometry args={[1, 1, 7.4, 3]} />
        <meshStandardMaterial color="#e6dccb" flatShading />
      </mesh>
      {[0, 1, 2].map((i) => (
        <Box key={i} size={[7.4 - i * 0.4, 0.22, 0.7]} at={[0, 0.11 + i * 0.22, 4.6 - i * 0.35]} color="#d6cdbd" cast={false} />
      ))}
      <Sign text="БИБЛИОТЕКА" at={[0, 9.4, 2.75]} w={3.8} h={0.6} bg="#5b4a3a" fg="#f6e7c8" night={night} />
    </group>
  )
}

function SolarFarm() {
  const panels = useMemo(() => {
    const out: [number, number][] = []
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) out.push([-2.7 + c * 2.7, -3 + r * 2])
    return out
  }, [])
  return (
    <group>
      {panels.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <Box size={[0.1, 0.9, 0.1]} at={[0, 0.5, 0]} color="#8a9198" metal={0.6} />
          <mesh position={[0, 1.05, 0]} rotation={[-0.5, 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[2.4, 0.06, 1.5]} />
            <meshStandardMaterial color="#1c2f52" metalness={0.7} roughness={0.15} />
          </mesh>
        </group>
      ))}
      <Box size={[1.4, 1.4, 1]} at={[3.4, 0.8, 3.6]} color="#d9d6cf" />
    </group>
  )
}

function PumpStation({ data, night }: { data: BuildingData; night: boolean }) {
  const m = useFacadeMats(data.id, '#9fb4c2', 'strip', 6, 4.6, 6.5, night)
  return (
    <group>
      <mesh position={[-1, 3.25, -1.6]} material={m.all} castShadow receiveShadow>
        <boxGeometry args={[6, 6.5, 4.6]} />
      </mesh>
      {[1.6, 3.6].map((x) => (
        <mesh key={x} position={[x, 2.2, 2.2]} castShadow>
          <cylinderGeometry args={[1, 1, 4.4, 24]} />
          <meshStandardMaterial color="#c7ced4" metalness={0.6} roughness={0.35} />
        </mesh>
      ))}
      <mesh position={[-3.2, 1.2, 2]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.35, 0.35, 5, 16]} />
        <meshStandardMaterial color="#3f6fa0" metalness={0.5} roughness={0.4} />
      </mesh>
      <Sign text="ВОДОКАНАЛ" at={[-1, 5.2, 0.72]} w={3.2} h={0.55} bg="#3f6fa0" fg="#ffffff" night={night} />
    </group>
  )
}

/* Construction site ----------------------------------------------------- */

export function ConstructionShape({ data }: Props) {
  const progress = data.meta?.type === 'construction' ? data.meta.progress : 0
  const levels = Math.max(1, Math.round(1 + progress * 4))
  const jib = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (jib.current) jib.current.rotation.y = Math.sin(clock.elapsedTime * 0.15) * 1.2
  })
  const fence = useMemo(() => {
    const out: { at: [number, number, number]; rot: number }[] = []
    for (let i = -2; i <= 2; i++) {
      out.push({ at: [i * 1.75, 0.9, 4.3], rot: 0 })
      out.push({ at: [i * 1.75, 0.9, -4.3], rot: 0 })
      out.push({ at: [4.3, 0.9, i * 1.75], rot: Math.PI / 2 })
      out.push({ at: [-4.3, 0.9, i * 1.75], rot: Math.PI / 2 })
    }
    return out
  }, [])
  return (
    <group>
      <mesh position={[0, 0.2, 0]} receiveShadow>
        <boxGeometry args={[8.6, 0.08, 8.6]} />
        <meshStandardMaterial color="#9b8768" roughness={1} />
      </mesh>
      {fence.map((f, i) => (
        <mesh key={i} position={f.at} rotation={[0, f.rot, 0]}>
          <boxGeometry args={[1.7, 1.6, 0.06]} />
          <meshStandardMaterial color={i % 2 ? '#2f6f4f' : '#356f55'} roughness={0.7} />
        </mesh>
      ))}
      {/* concrete frame rising with the money raised */}
      {Array.from({ length: levels }, (_, l) => (
        <group key={l} position={[-0.8, l * 3, -0.6]}>
          <Box size={[5.4, 0.3, 5]} at={[0, 3, 0]} color="#b9b5ad" />
          {[
            [-2.5, -2.3],
            [2.5, -2.3],
            [-2.5, 2.3],
            [2.5, 2.3],
            [0, 0],
          ].map(([x, z], i) => (
            <Box key={i} size={[0.35, 3, 0.35]} at={[x, 1.5, z]} color="#a9a59d" />
          ))}
        </group>
      ))}
      {/* tower crane */}
      <group position={[3, 0, 3]}>
        <Box size={[0.6, 20, 0.6]} at={[0, 10, 0]} color="#e0a526" metal={0.3} />
        <group ref={jib} position={[0, 20, 0]}>
          <Box size={[14, 0.5, 0.5]} at={[-4, 0.3, 0]} color="#e0a526" metal={0.3} />
          <Box size={[2, 1.2, 1]} at={[2.6, -0.2, 0]} color="#6b7076" />
          <Box size={[1.2, 1.1, 1.1]} at={[0, -0.6, 0]} color="#3d4852" rough={0.3} />
          <Box size={[0.04, 8, 0.04]} at={[-8, -4, 0]} color="#333" cast={false} />
          <Box size={[0.8, 0.5, 0.8]} at={[-8, -8.2, 0]} color="#c43c2c" />
        </group>
      </group>
    </group>
  )
}

/* Empty lot -------------------------------------------------------------- */

export function LotShape({ data, highlight, night }: Props) {
  const forBusiness = data.meta?.type === 'lot' && data.meta.use === 'business'
  const plot = data.meta?.type === 'plot' ? data.meta : null
  const uid = useGame((s) => s.uid)
  const mode = useCity((s) => s.pickPlot)
  // Business mode: free business plots and my own empty plots. Buy mode: plots for sale.
  const picking =
    (mode === 'business' && (forBusiness || (plot?.use === 'owned' && plot.owner === uid))) || (mode === 'buy' && plot?.use === 'sale')
  const glow = useRef<THREE.MeshBasicMaterial>(null)
  useFrame(({ clock }) => {
    if (glow.current) glow.current.opacity = 0.45 + 0.3 * Math.sin(clock.elapsedTime * 4)
  })
  return (
    <group>
      {picking && (
        <>
          <mesh position={[0, 0.4, 0]}>
            <boxGeometry args={[data.size[0] + 0.6, 0.5, data.size[1] + 0.6]} />
            <meshBasicMaterial ref={glow} color="#2ee86a" transparent opacity={0.6} depthWrite={false} />
          </mesh>
          <Html position={[0, 5, 0]} center zIndexRange={[30, 0]}>
            <button
              className="rounded-full border-2 border-white bg-[#1f9d55] px-2 py-1 font-display text-xs font-bold whitespace-nowrap text-white shadow-lg desk:px-3 desk:py-1.5 desk:text-sm"
              onClick={() => pickThis(data)}
            >
              {Math.round(data.size[0] + 1)}×{Math.round(data.size[1] + 1)} м{plot?.use === 'sale' ? ` · ${plot.price.toLocaleString('ru-RU')}` : ''}
            </button>
          </Html>
        </>
      )}
      {plot ? (
        // Residents' plots: the ground, fence and sign come from VacantPlots; this is the tap target.
        <>
          <mesh position={[0, 0.3, 0]}>
            <boxGeometry args={[data.size[0], 0.4, data.size[1]]} />
            <meshBasicMaterial transparent opacity={highlight ? 0.18 : 0} color="#ffffff" depthWrite={false} />
          </mesh>
          {plot.use === 'owned' && (
            <Sign text={`УЧАСТОК: ${(plot.ownerName ?? '').toUpperCase()}`} at={[0, 1.6, data.size[1] / 2 - 0.4]} w={2.6} h={0.55} bg="#3d6b4f" fg="#ffffff" night={night} />
          )}
        </>
      ) : (
        <LotGround data={data} highlight={highlight} night={night} forBusiness={forBusiness} />
      )}
    </group>
  )
}

/** Choose this plot from the map: for a business, or to buy it. */
export function pickThis(data: Props['data']) {
  const city = useCity.getState()
  if (data.meta?.type === 'lot' && data.meta.use === 'business') {
    preselect.lot = data.meta.lotKey
    city.setPickPlot(false)
    useGame.getState().setPanel('business')
  } else if (data.meta?.type === 'plot' && data.meta.use === 'owned') {
    preselect.lot = data.meta.parcel
    city.setPickPlot(false)
    useGame.getState().setPanel('business')
  } else if (data.meta?.type === 'plot' && data.meta.use === 'sale') {
    buildPick.parcel = data.meta.parcel
    city.setPickPlot(false)
    useGame.getState().setPanel('build')
  }
}

function LotGround({ data, highlight, night, forBusiness }: { data: Props['data']; highlight: boolean; night: boolean; forBusiness: boolean }) {
  const stakes = useMemo(() => {
    const rng = createRng(hashString(data.id))
    return Array.from({ length: 5 }, () => [rng.range(-data.size[0] / 2.4, data.size[0] / 2.4), rng.range(-data.size[1] / 2.4, data.size[1] / 2.4)] as [number, number])
  }, [data.id, data.size])
  return (
    <group>
      <mesh position={[0, 0.19, 0]} receiveShadow>
        <boxGeometry args={[data.size[0], 0.06, data.size[1]]} />
        <meshStandardMaterial color={highlight ? '#b7a382' : forBusiness ? '#a69479' : '#9b8a70'} roughness={1} />
      </mesh>
      {stakes.map(([x, z], i) => (
        <mesh key={i} position={[x, 0.5, z]}>
          <boxGeometry args={[0.08, 0.6, 0.08]} />
          <meshStandardMaterial color="#c9a46a" />
        </mesh>
      ))}
      <Box size={[0.1, 1.8, 0.1]} at={[-0.9, 0.9, data.size[1] / 2 - 0.6]} color="#5a4636" />
      <Box size={[0.1, 1.8, 0.1]} at={[0.9, 0.9, data.size[1] / 2 - 0.6]} color="#5a4636" />
      <Sign
        text={forBusiness ? 'СВОБОДНО ДЛЯ БИЗНЕСА' : 'ЗДЕСЬ БУДЕТ СТРОЙКА'}
        at={[0, 1.6, data.size[1] / 2 - 0.54]}
        w={2.4}
        h={0.6}
        bg={forBusiness ? '#2f6f4f' : '#c58a2a'}
        fg="#ffffff"
        night={night}
      />
    </group>
  )
}
