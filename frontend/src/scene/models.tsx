import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Model } from '../game/catalog'
import { hashString } from '../lib/random'
import { getFacade, repeated, shadeByHeight, type FacadeStyle } from './facade'

/*
 * Every building as a small hand-made 3D model. Each model fills its footprint (W×D metres,
 * centred on the origin), stands on y = 0 and faces +z (the street side by default).
 */

export interface ModelProps {
  W: number
  D: number
  seed: string
  night: boolean
}

function Box({ s, p, c, rough = 0.85, metal = 0, emissive, ei = 0, cast = true }: { s: [number, number, number]; p: [number, number, number]; c: string; rough?: number; metal?: number; emissive?: string; ei?: number; cast?: boolean }) {
  return (
    <mesh position={p} castShadow={cast} receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} roughness={rough} metalness={metal} emissive={emissive ?? '#000000'} emissiveIntensity={ei} />
    </mesh>
  )
}

function Cyl({ r, h, p, c, seg = 16, r2 }: { r: number; h: number; p: [number, number, number]; c: string; seg?: number; r2?: number }) {
  return (
    <mesh position={p} castShadow receiveShadow>
      <cylinderGeometry args={[r2 ?? r, r, h, seg]} />
      <meshStandardMaterial color={c} roughness={0.8} />
    </mesh>
  )
}

/** A wall block with a facade of windows on its four sides. */
function Facade({ w, d, h, y = 0, color, style, seed, night, lit = 0.45, x = 0, z = 0 }: { w: number; d: number; h: number; y?: number; color: string; style: FacadeStyle; seed: string; night: boolean; lit?: number; x?: number; z?: number }) {
  const mats = useMemo(() => {
    const v = hashString(seed)
    const f = getFacade(style, v, lit)
    const face = (width: number) =>
      shadeByHeight(
        new THREE.MeshStandardMaterial({
          color,
          map: repeated(f.map, style, width, h),
          emissive: new THREE.Color('#ffd59a'),
          emissiveMap: repeated(f.emissive, style, width, h),
          emissiveIntensity: 0,
          roughness: style === 'glass' ? 0.35 : 0.85,
          metalness: style === 'glass' ? 0.3 : 0.02,
        }),
      )
    const roof = new THREE.MeshStandardMaterial({ color: '#8b8f94', roughness: 0.95 })
    const sx = face(d)
    const sz = face(w)
    return [sx, sx, roof, roof, sz, sz]
  }, [w, d, h, color, style, seed, lit])
  for (const m of [mats[0], mats[4]] as THREE.MeshStandardMaterial[]) m.emissiveIntensity = night ? 1.05 : 0
  return (
    <mesh position={[x, y + h / 2, z]} material={mats} castShadow receiveShadow>
      <boxGeometry args={[w, h, d]} />
    </mesh>
  )
}

/** A gable roof: ridge along x, slopes to ±z, gables closed with wall. */
function Gable({ w, d, h, y, roof, wall }: { w: number; d: number; h: number; y: number; roof: string; wall: string }) {
  const { slopes, gables } = useMemo(() => {
    const x = w / 2
    const z = d / 2
    const slopes = new THREE.BufferGeometry()
    slopes.setAttribute('position', new THREE.Float32BufferAttribute([-x, 0, z, x, 0, z, x, h, 0, -x, 0, z, x, h, 0, -x, h, 0, x, 0, -z, -x, 0, -z, -x, h, 0, x, 0, -z, -x, h, 0, x, h, 0], 3))
    slopes.computeVertexNormals()
    const gx = x - 0.3
    const gz = z - 0.3
    const gables = new THREE.BufferGeometry()
    gables.setAttribute('position', new THREE.Float32BufferAttribute([gx, 0, gz, gx, 0, -gz, gx, h - 0.1, 0, -gx, 0, -gz, -gx, 0, gz, -gx, h - 0.1, 0], 3))
    gables.computeVertexNormals()
    return { slopes, gables }
  }, [w, d, h])
  return (
    <group position={[0, y, 0]}>
      <mesh geometry={slopes} castShadow receiveShadow>
        <meshStandardMaterial color={roof} roughness={0.8} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={gables}>
        <meshStandardMaterial color={wall} roughness={0.9} />
      </mesh>
    </group>
  )
}

function Tree({ p, s = 1 }: { p: [number, number, number]; s?: number }) {
  return (
    <group position={p} scale={s}>
      <Cyl r={0.15} h={1.4} p={[0, 0.7, 0]} c="#6b4a32" seg={6} />
      <mesh position={[0, 2, 0]} castShadow>
        <icosahedronGeometry args={[0.95, 0]} />
        <meshStandardMaterial color="#5e9a46" flatShading roughness={0.9} />
      </mesh>
    </group>
  )
}

function Lawn({ W, D, c = '#86b562' }: { W: number; D: number; c?: string }) {
  return <Box s={[W, 0.1, D]} p={[0, 0.05, 0]} c={c} rough={1} cast={false} />
}

const pick = <T,>(seed: string, list: T[], salt = 0) => list[(hashString(seed) + salt) % list.length]

/* The models ------------------------------------------------------------------ */

function House({ W, D, seed, night }: ModelProps) {
  const wall = pick(seed, ['#efe3cf', '#e5cdb2', '#d8e0da', '#f0d8c8', '#dfd5e8'])
  const roof = pick(seed, ['#9b3d2e', '#6b4a3a', '#46566b', '#7a2f2a', '#4f6b3a'], 2)
  const w = W * 0.62
  const d = D * 0.55
  return (
    <group>
      <Lawn W={W} D={D} />
      <group position={[0, 0, -D * 0.08]}>
        <Facade w={w} d={d} h={2.9} color={wall} style="punched" seed={seed} night={night} lit={0.5} />
        <Gable w={w + 0.5} d={d + 0.5} h={1.7} y={2.9} roof={roof} wall={wall} />
        <Box s={[0.9, 1.9, 0.1]} p={[0, 0.95, d / 2 + 0.05]} c="#5a3d2b" />
        <Box s={[0.45, 1.3, 0.45]} p={[w * 0.25, 3.9, -d * 0.15]} c="#8c5a45" />
      </group>
      <Tree p={[W * 0.34, 0, D * 0.3]} s={0.7} />
    </group>
  )
}

function Cottage({ W, D, seed, night }: ModelProps) {
  const wall = pick(seed, ['#f4ead8', '#e8d9c4', '#dce6e0'])
  return (
    <group>
      <Lawn W={W} D={D} c="#7fb35a" />
      <Facade w={W * 0.7} d={D * 0.5} h={5.6} color={wall} style="punched" seed={seed} night={night} z={-D * 0.12} />
      <Gable w={W * 0.7 + 0.5} d={D * 0.5 + 0.5} h={1.8} y={5.6} roof="#7a2f2a" wall={wall} />
      <Box s={[W * 0.7, 0.15, 1.2]} p={[0, 2.8, D * 0.13 + 0.5]} c="#d8d2c4" />
      <Box s={[W * 0.25, 0.12, D * 0.22]} p={[W * 0.25, 0.12, D * 0.32]} c="#6fb3d6" rough={0.1} cast={false} />
    </group>
  )
}

function Lowrise({ W, D, seed, night }: ModelProps) {
  const wall = pick(seed, ['#d8c3a5', '#c9b49a', '#e2d5c0', '#b9c3c9', '#e6c8b6'])
  return (
    <group>
      <Lawn W={W} D={D} />
      <Facade w={W * 0.86} d={D * 0.66} h={9.6} color={wall} style="punched" seed={seed} night={night} />
      <Box s={[W * 0.88, 0.4, D * 0.68]} p={[0, 9.8, 0]} c="#8b8f94" />
      <Box s={[1.6, 2.2, 0.3]} p={[0, 1.1, D * 0.33 + 0.1]} c="#5a4a3a" />
    </group>
  )
}

function Apartment({ W, D, seed, night }: ModelProps) {
  const wall = pick(seed, ['#e8e2d6', '#d6cfc0', '#cfd8de', '#e3d2bd'])
  return (
    <group>
      <Lawn W={W} D={D} />
      <Facade w={W * 0.7} d={D * 0.6} h={27} color={wall} style="punched" seed={seed} night={night} />
      <Box s={[3, 2, 3]} p={[0, 28, 0]} c="#9a9ea3" />
      <Box s={[W * 0.4, 0.2, 1.5]} p={[0, 3, D * 0.3 + 0.75]} c="#c7c1b4" />
      <Tree p={[-W * 0.4, 0, D * 0.4]} s={0.8} />
      <Tree p={[W * 0.4, 0, -D * 0.4]} s={0.8} />
    </group>
  )
}

function Tower({ W, D, seed, night }: ModelProps) {
  const glass = pick(seed, ['#7f9fb8', '#8aa6a0', '#9aa7c0'])
  const light = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(({ clock }) => {
    if (light.current) light.current.emissiveIntensity = Math.sin(clock.elapsedTime * 2.4) > 0.6 ? 2 : 0.15
  })
  return (
    <group>
      <Box s={[W, 0.15, D]} p={[0, 0.07, 0]} c="#cfc8bb" cast={false} />
      <Facade w={W * 0.7} d={D * 0.7} h={62} color={glass} style="glass" seed={seed} night={night} lit={0.6} />
      <Facade w={W * 0.5} d={D * 0.5} h={8} y={62} color={glass} style="glass" seed={seed + 'c'} night={night} lit={0.6} />
      <Cyl r={0.15} h={8} p={[0, 74, 0]} c="#c9ccd0" seg={6} />
      <mesh position={[0, 78.2, 0]}>
        <sphereGeometry args={[0.4, 8, 8]} />
        <meshStandardMaterial ref={light} color="#ff3b30" emissive="#ff2a1a" />
      </mesh>
    </group>
  )
}

function Shop({ W, D, seed, night }: ModelProps) {
  const awning = pick(seed, ['#d1495b', '#2f6f4f', '#2f63c9', '#e0832f'])
  return (
    <group>
      <Box s={[W, 0.15, D]} p={[0, 0.07, 0]} c="#d8d2c4" cast={false} />
      <Facade w={W * 0.8} d={D * 0.65} h={4.2} color="#ebe6dc" style="shopfront" seed={seed} night={night} lit={0.8} z={-D * 0.08} />
      <mesh position={[0, 3, D * 0.25 + 0.6]} rotation={[0.35, 0, 0]} castShadow>
        <boxGeometry args={[W * 0.78, 0.12, 1.3]} />
        <meshStandardMaterial color={awning} />
      </mesh>
      <Box s={[W * 0.5, 0.8, 0.15]} p={[0, 4.7, D * 0.24]} c={awning} emissive={awning} ei={night ? 0.6 : 0} />
    </group>
  )
}

function Cafe({ W, D, seed, night }: ModelProps) {
  return (
    <group>
      <Shop W={W} D={D} seed={seed + 'cafe'} night={night} />
      {[-1, 1].map((k) => (
        <group key={k} position={[k * W * 0.22, 0, D * 0.4]}>
          <Cyl r={0.45} h={0.08} p={[0, 0.8, 0]} c="#f4f1ea" />
          <Cyl r={0.06} h={0.8} p={[0, 0.4, 0]} c="#555" seg={6} />
          <mesh position={[0, 2.1, 0]} castShadow>
            <coneGeometry args={[1, 0.6, 8]} />
            <meshStandardMaterial color="#e0832f" />
          </mesh>
          <Cyl r={0.04} h={2.1} p={[0, 1.05, 0]} c="#ddd" seg={5} />
        </group>
      ))}
    </group>
  )
}

function Office({ W, D, seed, night }: ModelProps) {
  const c = pick(seed, ['#9fb3c6', '#b8c4cf', '#8ea6bd', '#c6c0b4'])
  return (
    <group>
      <Box s={[W, 0.15, D]} p={[0, 0.07, 0]} c="#d8d2c4" cast={false} />
      <Facade w={W * 0.78} d={D * 0.7} h={20} color={c} style="strip" seed={seed} night={night} />
      <Box s={[W * 0.5, 1.6, D * 0.4]} p={[0, 20.8, 0]} c="#a9adb2" />
    </group>
  )
}

function BizTower({ W, D, seed, night }: ModelProps) {
  return (
    <group>
      <Box s={[W, 0.15, D]} p={[0, 0.07, 0]} c="#d8d2c4" cast={false} />
      <Facade w={W * 0.82} d={D * 0.82} h={6} color="#3f5d78" style="glass" seed={seed + 'b'} night={night} lit={0.7} />
      <Facade w={W * 0.62} d={D * 0.62} h={78} y={6} color="#5f86a8" style="glass" seed={seed} night={night} lit={0.6} />
      <Box s={[W * 0.3, 6, D * 0.3]} p={[0, 87, 0]} c="#c9ccd0" metal={0.6} rough={0.3} />
    </group>
  )
}

function Mall({ W, D, seed, night }: ModelProps) {
  return (
    <group>
      <Box s={[W, 0.15, D]} p={[0, 0.07, 0]} c="#d8d2c4" cast={false} />
      <Facade w={W * 0.9} d={D * 0.72} h={9} color="#e9e4da" style="shopfront" seed={seed} night={night} lit={0.85} z={-D * 0.08} />
      <Box s={[W * 0.4, 5, D * 0.35]} p={[0, 11.5, -D * 0.1]} c="#6f97b8" metal={0.6} rough={0.1} emissive="#cfe6ff" ei={night ? 0.5 : 0} />
      <Box s={[W * 0.4, 0.3, 2.6]} p={[0, 4.2, D * 0.28 + 1.2]} c="#f2efe8" />
      <Box s={[W * 0.6, 1.6, 0.3]} p={[0, 10.3, D * 0.28]} c="#141a24" emissive="#ffb547" ei={night ? 0.8 : 0.15} />
      {/* parking in front */}
      {[-2, -1, 0, 1, 2].map((k) => (
        <Box key={k} s={[0.12, 0.03, 3]} p={[k * 2.6, 0.17, D * 0.42]} c="#ffffff" cast={false} />
      ))}
    </group>
  )
}

function Garage({ W, D, seed, night }: ModelProps) {
  return (
    <group>
      <Box s={[W, 0.15, D]} p={[0, 0.07, 0]} c="#8f8b84" cast={false} />
      <Facade w={W * 0.85} d={D * 0.6} h={5} color="#d0cbc2" style="strip" seed={seed} night={night} z={-D * 0.1} />
      {[-1, 0, 1].map((k) => (
        <Box key={k} s={[W * 0.22, 3.4, 0.12]} p={[k * W * 0.27, 1.7, D * 0.2 + 0.06]} c={k ? '#5b6168' : '#c0392b'} />
      ))}
      <Box s={[3, 0.9, 0.2]} p={[0, 5.6, D * 0.2]} c="#c0392b" emissive="#ff6b5b" ei={night ? 0.6 : 0} />
      <Box s={[1.8, 1.2, 4]} p={[W * 0.3, 0.75, D * 0.38]} c={pick(seed, ['#2563a8', '#d9772b', '#141414'])} metal={0.5} rough={0.3} />
    </group>
  )
}

function Parking({ W, D }: ModelProps) {
  const cars = ['#b3261e', '#f2f2ef', '#1f2a36', '#2563a8', '#8a9097', '#d9772b']
  return (
    <group>
      <Box s={[W, 0.12, D]} p={[0, 0.06, 0]} c="#555a60" cast={false} />
      {[-3, -1, 1, 3].map((k, i) => (
        <group key={k}>
          <Box s={[0.12, 0.02, D * 0.4]} p={[k * W * 0.11, 0.13, -D * 0.2]} c="#f2f2f2" cast={false} />
          <Box s={[0.12, 0.02, D * 0.4]} p={[k * W * 0.11, 0.13, D * 0.25]} c="#f2f2f2" cast={false} />
          {i % 2 === 0 && <Box s={[1.8, 1.3, 4]} p={[(k + 1) * W * 0.11, 0.75, -D * 0.2]} c={cars[i]} metal={0.5} rough={0.3} />}
          <Box s={[1.8, 1.3, 4]} p={[(k - 1) * W * 0.11 + 0.1, 0.75, D * 0.25]} c={cars[(i + 3) % 6]} metal={0.5} rough={0.3} />
        </group>
      ))}
    </group>
  )
}

function Factory({ W, D, seed, night }: ModelProps) {
  const smoke = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (smoke.current) smoke.current.children.forEach((c, i) => {
      const t = (clock.elapsedTime * 0.4 + i / 3) % 1
      c.position.y = 15 + t * 9
      c.scale.setScalar(0.8 + t * 1.6)
      ;((c as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = 0.6 * (1 - t)
    })
  })
  return (
    <group>
      <Box s={[W, 0.15, D]} p={[0, 0.07, 0]} c="#a7a196" cast={false} />
      <Facade w={W * 0.62} d={D * 0.7} h={9} color="#b8b2a6" style="strip" seed={seed} night={night} x={-W * 0.12} />
      {[0, 1, 2].map((k) => (
        <mesh key={k} position={[-W * 0.12 + (k - 1) * W * 0.2, 9.9, 0]} rotation={[0, 0, Math.PI / 4]} castShadow>
          <boxGeometry args={[1.3, 1.3, D * 0.7]} />
          <meshStandardMaterial color="#8a8d91" />
        </mesh>
      ))}
      <Cyl r={0.9} r2={0.7} h={15} p={[W * 0.34, 7.5, -D * 0.2]} c="#b5462d" />
      <Cyl r={2.2} h={6} p={[W * 0.32, 3, D * 0.22]} c="#d8d2c4" />
      <group ref={smoke} position={[W * 0.34, 0, -D * 0.2]}>
        {[0, 1, 2].map((k) => (
          <mesh key={k}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshStandardMaterial color="#9a9a9a" transparent opacity={0.5} depthWrite={false} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

function Civic({ W, D, seed, night, wall, accent, sign, h = 7 }: ModelProps & { wall: string; accent: string; sign: 'cross' | 'star' | 'flame' | 'book' | 'kid'; h?: number }) {
  return (
    <group>
      <Lawn W={W} D={D} c="#8fbb66" />
      <Box s={[W * 0.9, 0.1, D * 0.25]} p={[0, 0.11, D * 0.35]} c="#d8d2c4" cast={false} />
      <Facade w={W * 0.82} d={D * 0.58} h={h} color={wall} style="punched" seed={seed} night={night} z={-D * 0.08} />
      <Box s={[W * 0.84, 0.4, D * 0.6]} p={[0, h + 0.2, -D * 0.08]} c={accent} />
      <Box s={[W * 0.3, 1.3, 0.15]} p={[0, h - 1.2, D * 0.21 + 0.08]} c={accent} emissive={accent} ei={night ? 0.5 : 0} />
      {sign === 'cross' && (
        <group position={[0, h + 1.6, -D * 0.08]}>
          <Box s={[2.2, 0.6, 0.3]} p={[0, 0, 0]} c="#e53935" emissive="#ff3b30" ei={night ? 0.8 : 0.2} />
          <Box s={[0.6, 2.2, 0.3]} p={[0, 0, 0]} c="#e53935" emissive="#ff3b30" ei={night ? 0.8 : 0.2} />
        </group>
      )}
      {sign === 'star' && <Box s={[0.15, 3, 0.15]} p={[W * 0.35, h + 1.5, -D * 0.2]} c="#c9ccd0" />}
      {sign === 'flame' && <Box s={[W * 0.36, 3.6, 0.15]} p={[-W * 0.18, 1.8, D * 0.21 + 0.1]} c="#b71c1c" />}
      {sign === 'kid' &&
        [-1, 1].map((k) => (
          <group key={k} position={[k * W * 0.3, 0, D * 0.36]}>
            <Box s={[0.15, 1.8, 0.15]} p={[0, 0.9, 0]} c="#2f63c9" />
            <Box s={[1.6, 0.15, 0.15]} p={[0, 1.8, 0]} c="#f2a516" />
          </group>
        ))}
    </group>
  )
}

function Coal({ W, D, seed, night }: ModelProps) {
  return (
    <group>
      <Factory W={W} D={D * 0.7} seed={seed} night={night} />
      <Cyl r={3.2} r2={2.3} h={14} p={[-W * 0.28, 7, D * 0.3]} c="#cfc8bb" seg={20} />
      <Cyl r={3.2} r2={2.3} h={14} p={[-W * 0.02, 7, D * 0.3]} c="#cfc8bb" seg={20} />
    </group>
  )
}

function Solar({ W, D }: ModelProps) {
  const rows = [-1.5, -0.5, 0.5, 1.5]
  return (
    <group>
      <Lawn W={W} D={D} c="#9cc27a" />
      {rows.map((r) =>
        [-1, 1].map((k) => (
          <group key={`${r}${k}`} position={[k * W * 0.22, 0, r * D * 0.2]}>
            <Cyl r={0.08} h={1} p={[0, 0.5, 0]} c="#888" seg={5} />
            <mesh position={[0, 1.1, 0]} rotation={[-0.5, 0, 0]} castShadow>
              <boxGeometry args={[W * 0.4, 0.08, D * 0.15]} />
              <meshStandardMaterial color="#20385c" metalness={0.6} roughness={0.25} />
            </mesh>
          </group>
        )),
      )}
    </group>
  )
}

function Wind({ W, D }: ModelProps) {
  const rotor = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (rotor.current) rotor.current.rotation.z += dt * 1.6
  })
  return (
    <group>
      <Lawn W={W} D={D} c="#9cc27a" />
      <Cyl r={0.35} r2={0.18} h={16} p={[0, 8, 0]} c="#f2f2f0" />
      <Box s={[0.7, 0.7, 1.4]} p={[0, 16.2, 0.2]} c="#f2f2f0" />
      <group ref={rotor} position={[0, 16.2, 1]}>
        {[0, 1, 2].map((k) => (
          <mesh key={k} rotation={[0, 0, (k * Math.PI * 2) / 3]} position={[0, 0, 0]} castShadow>
            <boxGeometry args={[0.35, 6.5, 0.08]} />
            <meshStandardMaterial color="#ffffff" />
            <group position={[0, 3.25, 0]} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

function WaterTower({ W, D }: ModelProps) {
  return (
    <group>
      <Lawn W={W} D={D} c="#9cc27a" />
      {[
        [-0.9, -0.9],
        [0.9, -0.9],
        [-0.9, 0.9],
        [0.9, 0.9],
      ].map(([x, z], i) => (
        <Cyl key={i} r={0.12} h={9} p={[x, 4.5, z]} c="#6b7076" seg={6} />
      ))}
      <Cyl r={2.1} h={3.4} p={[0, 10.5, 0]} c="#cfe3ef" seg={20} />
      <mesh position={[0, 12.6, 0]} castShadow>
        <coneGeometry args={[2.3, 1, 20]} />
        <meshStandardMaterial color="#2f63c9" />
      </mesh>
    </group>
  )
}

function Pump({ W, D, seed, night }: ModelProps) {
  return (
    <group>
      <Lawn W={W} D={D} c="#9cc27a" />
      <Facade w={W * 0.45} d={D * 0.4} h={5} color="#cfd8de" style="strip" seed={seed} night={night} x={-W * 0.2} z={-D * 0.2} />
      <Cyl r={W * 0.2} h={0.8} p={[W * 0.2, 0.4, D * 0.15]} c="#d8d2c4" seg={24} />
      <Cyl r={W * 0.18} h={0.1} p={[W * 0.2, 0.82, D * 0.15]} c="#4f9fd0" seg={24} />
      <Cyl r={0.5} h={3} p={[-W * 0.3, 1.5, D * 0.3]} c="#2f63c9" />
    </group>
  )
}

function Gazebo({ W, D }: ModelProps) {
  return (
    <group>
      <Lawn W={W} D={D} c="#8fc06a" />
      <Cyl r={1.6} h={0.25} p={[0, 0.2, 0]} c="#c9b48a" seg={8} />
      {[0, 1, 2, 3, 4, 5].map((k) => (
        <Cyl key={k} r={0.08} h={2.3} p={[Math.cos((k * Math.PI) / 3) * 1.4, 1.4, Math.sin((k * Math.PI) / 3) * 1.4]} c="#8a5a3a" seg={5} />
      ))}
      <mesh position={[0, 3, 0]} castShadow>
        <coneGeometry args={[2, 1.2, 6]} />
        <meshStandardMaterial color="#7a2f2a" />
      </mesh>
      <Tree p={[W * 0.35, 0, -D * 0.35]} s={0.6} />
    </group>
  )
}

function Playground({ W, D }: ModelProps) {
  return (
    <group>
      <Box s={[W, 0.12, D]} p={[0, 0.06, 0]} c="#d4bf8c" cast={false} />
      <Box s={[0.15, 2.2, 0.15]} p={[-1.4, 1.1, -1]} c="#c0392b" />
      <Box s={[0.15, 2.2, 0.15]} p={[0.4, 1.1, -1]} c="#c0392b" />
      <Box s={[2, 0.15, 0.15]} p={[-0.5, 2.2, -1]} c="#c0392b" />
      <Box s={[1.2, 1.6, 1.2]} p={[1.3, 0.8, 1]} c="#2f63c9" />
      <mesh position={[1.3, 0.9, -0.3]} rotation={[0.6, 0, 0]} castShadow>
        <boxGeometry args={[0.9, 0.1, 2.2]} />
        <meshStandardMaterial color="#f2a516" />
      </mesh>
    </group>
  )
}

function Fountain({ W, D, night }: ModelProps) {
  return (
    <group>
      <Box s={[W, 0.12, D]} p={[0, 0.06, 0]} c="#d8d2c4" cast={false} />
      <Cyl r={2.2} h={0.6} p={[0, 0.3, 0]} c="#c9c3b8" seg={24} />
      <Cyl r={2} h={0.1} p={[0, 0.62, 0]} c="#5d9ec4" seg={24} />
      <Cyl r={0.3} h={1.6} p={[0, 1.2, 0]} c="#c9c3b8" />
      <mesh position={[0, 2.4, 0]}>
        <cylinderGeometry args={[0.08, 0.25, 1.4, 8]} />
        <meshStandardMaterial color="#cfe9f7" transparent opacity={0.75} emissive="#9fd4f0" emissiveIntensity={night ? 0.6 : 0.1} />
      </mesh>
    </group>
  )
}

function Park({ W, D, seed }: ModelProps) {
  const trees = useMemo(() => {
    const out: [number, number, number][] = []
    const h = hashString(seed)
    for (let i = 0; i < 9; i++) {
      const a = ((h >> (i % 16)) % 100) / 100
      out.push([(((i % 3) - 1) * W) / 3 + (a - 0.5) * 2, 0, ((Math.floor(i / 3) - 1) * D) / 3 + (0.5 - a) * 2])
    }
    return out
  }, [W, D, seed])
  return (
    <group>
      <Lawn W={W} D={D} c="#7db556" />
      <Box s={[W * 0.9, 0.04, 1.3]} p={[0, 0.12, 0]} c="#d8c9a6" cast={false} />
      <Box s={[1.3, 0.04, D * 0.9]} p={[0, 0.12, 0]} c="#d8c9a6" cast={false} />
      {trees.filter((_, i) => i !== 4).map((p, i) => (
        <Tree key={i} p={p} s={0.9 + (i % 3) * 0.15} />
      ))}
      <Cyl r={1.4} h={0.4} p={[0, 0.2, 0]} c="#c9c3b8" />
      <Box s={[1.6, 0.4, 0.5]} p={[2.5, 0.4, 1.2]} c="#8a6a48" />
    </group>
  )
}

function Stadium({ W, D, night }: ModelProps) {
  return (
    <group>
      <Box s={[W, 0.15, D]} p={[0, 0.07, 0]} c="#cfc8bb" cast={false} />
      <Box s={[W * 0.62, 0.1, D * 0.55]} p={[0, 0.2, 0]} c="#4f9a3a" cast={false} />
      {[-1, 1].map((k) => (
        <mesh key={k} position={[0, 3, k * D * 0.38]} rotation={[k * 0.5, 0, 0]} castShadow>
          <boxGeometry args={[W * 0.8, 0.5, 5]} />
          <meshStandardMaterial color={k > 0 ? '#c0392b' : '#2f63c9'} />
        </mesh>
      ))}
      {[-1, 1].map((k) => (
        <mesh key={`e${k}`} position={[k * W * 0.42, 3, 0]} rotation={[0, 0, -k * 0.5]} castShadow>
          <boxGeometry args={[0.5, 5, D * 0.6]} />
          <meshStandardMaterial color="#d8d2c4" />
        </mesh>
      ))}
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([x, z], i) => (
        <group key={i} position={[x * W * 0.46, 0, z * D * 0.44]}>
          <Cyl r={0.2} h={16} p={[0, 8, 0]} c="#8a9097" seg={6} />
          <Box s={[2, 1.2, 0.4]} p={[0, 16.3, 0]} c="#f4f1e6" emissive="#fff4d6" ei={night ? 2 : 0.2} />
        </group>
      ))}
    </group>
  )
}

export function BuildingModel({ model, ...p }: ModelProps & { model: Model }) {
  switch (model) {
    case 'house':
      return <House {...p} />
    case 'cottage':
      return <Cottage {...p} />
    case 'lowrise':
      return <Lowrise {...p} />
    case 'apartment':
      return <Apartment {...p} />
    case 'tower':
      return <Tower {...p} />
    case 'shop':
      return <Shop {...p} />
    case 'cafe':
      return <Cafe {...p} />
    case 'office':
      return <Office {...p} />
    case 'bizTower':
      return <BizTower {...p} />
    case 'mall':
      return <Mall {...p} />
    case 'garage':
      return <Garage {...p} />
    case 'parking':
      return <Parking {...p} />
    case 'factory':
      return <Factory {...p} />
    case 'kindergarten':
      return <Civic {...p} wall="#f6e3b4" accent="#f2a516" sign="kid" h={4.5} />
    case 'school':
      return <Civic {...p} wall="#e8c49a" accent="#b5462d" sign="book" h={9} />
    case 'clinic':
      return <Civic {...p} wall="#f2f4f5" accent="#2f8f7a" sign="cross" h={7} />
    case 'hospital':
      return <Civic {...p} wall="#f2f4f5" accent="#2f6f9e" sign="cross" h={16} />
    case 'police':
      return <Civic {...p} wall="#dfe6ef" accent="#1f4f9a" sign="star" h={7} />
    case 'fire':
      return <Civic {...p} wall="#e9d6c8" accent="#b71c1c" sign="flame" h={7} />
    case 'coal':
      return <Coal {...p} />
    case 'solar':
      return <Solar {...p} />
    case 'wind':
      return <Wind {...p} />
    case 'waterTower':
      return <WaterTower {...p} />
    case 'pump':
      return <Pump {...p} />
    case 'gazebo':
      return <Gazebo {...p} />
    case 'playground':
      return <Playground {...p} />
    case 'fountain':
      return <Fountain {...p} />
    case 'park':
      return <Park {...p} />
    case 'stadium':
      return <Stadium {...p} />
  }
}
