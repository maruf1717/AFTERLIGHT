import { memo, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { districtSize, lotCenter, LOT, PITCH, STREET } from '../data/city'
import type { District as DistrictData, DistrictId } from '../data/types'
import { useGame } from '../game/store'
import { createRng } from '../lib/random'
import { useCity } from '../store/cityStore'
import { DistrictArt } from '../ui/art'
import { Building } from './Building'
import { Instances, type Placement } from './Instances'
import { asphaltTexture, grassTexture, pavingTexture } from './terrain'

const LOT_SURFACE: Record<DistrictId, { day: string; night: string }> = {
  residential: { day: '#8fbd6a', night: '#2c3a2a' },
  downtown: { day: '#d9d3c6', night: '#3a3936' },
  industrial: { day: '#bdb7ab', night: '#363330' },
}

const TREE_GREENS = ['#4f8a3c', '#5e9a46', '#3f7a35', '#6aa24f', '#77a845']

function DistrictImpl({ district }: { district: DistrictData }) {
  const active = useCity((s) => s.activeDistrictId === district.id)
  const night = useCity((s) => s.night)
  const shadows = useCity((s) => s.quality === 'high')
  const setDistrict = useCity((s) => s.setDistrict)
  const hasSelection = useCity((s) => s.selectedBuildingId !== null)
  const objects = useGame((s) => s.objects)
  const buildings = useMemo(() => objects.filter((o) => o.districtId === district.id), [objects, district.id])
  const [sw, sd] = districtSize(district)
  const [ox, oz] = district.origin
  const { cols, rows } = district.grid

  const tex = useMemo(() => {
    const a = asphaltTexture().clone()
    a.needsUpdate = true
    a.repeat.set(sw / 6, sd / 6)
    const p = pavingTexture().clone()
    p.needsUpdate = true
    p.repeat.set(3, 3)
    const g = grassTexture().clone()
    g.needsUpdate = true
    g.repeat.set(0.6, 0.6)
    return { asphalt: a, paving: p, grass: g }
  }, [sw, sd])

  const layout = useMemo(() => {
    const lots: [number, number][] = []
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) lots.push(lotCenter(district, c, r))
    const xs = Array.from({ length: cols + 1 }, (_, c) => ox + (c - cols / 2) * PITCH)
    const zs = Array.from({ length: rows + 1 }, (_, r) => oz + (r - rows / 2) * PITCH)

    // Dashed centre lines between intersections.
    const dashes: Placement[] = []
    const half = STREET / 2 + 0.6
    for (const x of xs)
      for (let i = 0; i < rows; i++) {
        const z0 = zs[i] + half
        const z1 = zs[i + 1] - half
        for (let z = z0 + 0.8; z < z1 - 0.6; z += 2.4) dashes.push({ p: [x, 0.025, z], s: [0.14, 0.02, 1.2] })
      }
    for (const z of zs)
      for (let i = 0; i < cols; i++) {
        const x0 = xs[i] + half
        const x1 = xs[i + 1] - half
        for (let x = x0 + 0.8; x < x1 - 0.6; x += 2.4) dashes.push({ p: [x, 0.025, z], s: [1.2, 0.02, 0.14] })
      }

    // Zebra crossings on every side of every intersection.
    const zebra: Placement[] = []
    for (const x of xs)
      for (const z of zs) {
        for (const s of [-1, 1]) {
          for (const k of [-1.5, -0.5, 0.5, 1.5]) {
            zebra.push({ p: [x + k * 0.95, 0.026, z + s * (STREET / 2 + 0.9)], s: [0.38, 0.02, 1.3] })
            zebra.push({ p: [x + s * (STREET / 2 + 0.9), 0.026, z + k * 0.95], s: [1.3, 0.02, 0.38] })
          }
        }
      }

    const rng = createRng(district.origin[0] * 13 + 5)
    const trunks: Placement[] = []
    const crowns: Placement[] = []
    const posts: Placement[] = []
    const bulbs: Placement[] = []
    const arms: Placement[] = []
    const benches: Placement[] = []
    const sigPoles: Placement[] = []
    const sigHeads: Placement[] = []
    const reds: Placement[] = []
    const greens: Placement[] = []
    const edge = LOT / 2 + 0.05
    for (const [x, z] of lots) {
      // Street trees along two sides of each block.
      for (const t of [-2.6, 0, 2.6]) {
        if (district.id !== 'industrial' && rng.chance(0.7)) {
          const s = rng.range(0.85, 1.15)
          const px = x + t
          const pz = z + edge - 0.2
          trunks.push({ p: [px, 0.9 * s, pz], s: [s, s, s] })
          crowns.push({ p: [px, 2.5 * s, pz], s: [s, s * 1.1, s], r: rng.range(0, 6), c: rng.pick(TREE_GREENS) })
        }
      }
      // A lamp on the near corner, with an arm reaching over the road.
      posts.push({ p: [x + edge - 0.15, 2.1, z + edge - 0.15] })
      arms.push({ p: [x + edge + 0.45, 4.15, z + edge - 0.15] })
      bulbs.push({ p: [x + edge + 1.05, 4.05, z + edge - 0.15] })
      if (district.id !== 'industrial' && rng.chance(0.5)) benches.push({ p: [x - edge + 0.35, 0.25, z + rng.range(-2, 2)], r: Math.PI / 2 })
    }
    // Traffic lights on inner intersections.
    for (let i = 1; i < xs.length - 1; i++)
      for (let j = 1; j < zs.length - 1; j++) {
        const x = xs[i] + STREET / 2 + 0.35
        const z = zs[j] + STREET / 2 + 0.35
        sigPoles.push({ p: [x, 1.6, z] })
        sigHeads.push({ p: [x, 3.1, z] })
        ;((i + j) % 2 ? reds : greens).push({ p: [x - 0.21, (i + j) % 2 ? 3.35 : 2.85, z] })
      }
    return { lots, dashes, zebra, trunks, crowns, posts, bulbs, arms, benches, sigPoles, sigHeads, reds, greens }
  }, [district, ox, oz, cols, rows])

  const lotColor = LOT_SURFACE[district.id][night ? 'night' : 'day']
  // Lots with nothing on them are grassy wasteland until the city grows into them.
  const { usedLots, emptyLots } = useMemo(() => {
    const used: Placement[] = []
    const empty: Placement[] = []
    for (const [x, z] of layout.lots) {
      const taken = buildings.some((b) => Math.abs(b.position[0] - x) < 4.6 && Math.abs(b.position[1] - z) < 4.6)
      ;(taken ? used : empty).push({ p: [x, 0.11, z] })
    }
    return { usedLots: used, emptyLots: empty }
  }, [layout.lots, buildings])

  return (
    <group>
      {/* asphalt */}
      <mesh position={[ox, -0.05, oz]} receiveShadow={shadows}>
        <boxGeometry args={[sw, 0.1, sd]} />
        <meshStandardMaterial map={tex.asphalt} color={night ? '#3a3d42' : '#8a8e94'} roughness={0.95} />
      </mesh>

      {/* kerbs (paved sidewalks) + lot surfaces */}
      <Instances items={layout.lots.map(([x, z]) => ({ p: [x, 0.07, z] }))} receiveShadow={shadows}>
        <boxGeometry args={[LOT + 1.2, 0.14, LOT + 1.2]} />
        <meshStandardMaterial map={tex.paving} color={night ? '#55555a' : '#d8d6d0'} roughness={0.9} />
      </Instances>
      {usedLots.length > 0 && (
        <Instances items={usedLots} receiveShadow={shadows}>
          <boxGeometry args={[LOT - 0.6, 0.12, LOT - 0.6]} />
          <meshStandardMaterial color={lotColor} roughness={1} />
        </Instances>
      )}
      {emptyLots.length > 0 && (
        <Instances items={emptyLots} receiveShadow={shadows}>
          <boxGeometry args={[LOT - 0.6, 0.12, LOT - 0.6]} />
          <meshStandardMaterial map={tex.grass} color={night ? '#4a5a52' : '#ffffff'} roughness={1} />
        </Instances>
      )}

      <Instances items={layout.dashes}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={night ? '#8a8a80' : '#f4f1e8'} roughness={0.7} />
      </Instances>
      <Instances items={layout.zebra}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={night ? '#8a8a80' : '#f4f1e8'} roughness={0.7} />
      </Instances>

      {layout.trunks.length > 0 && (
        <>
          <Instances items={layout.trunks}>
            <cylinderGeometry args={[0.1, 0.15, 1.8, 6]} />
            <meshStandardMaterial color="#6b4a2f" />
          </Instances>
          <Instances items={layout.crowns} castShadow={shadows}>
            <icosahedronGeometry args={[1.0, 1]} />
            <meshStandardMaterial color={night ? '#55605a' : '#ffffff'} roughness={0.9} flatShading />
          </Instances>
        </>
      )}
      <Instances items={layout.posts} castShadow={shadows}>
        <cylinderGeometry args={[0.06, 0.09, 4.2, 8]} />
        <meshStandardMaterial color="#353a40" metalness={0.6} roughness={0.45} />
      </Instances>
      <Instances items={layout.arms}>
        <boxGeometry args={[1.3, 0.07, 0.07]} />
        <meshStandardMaterial color="#353a40" metalness={0.6} roughness={0.45} />
      </Instances>
      <Instances items={layout.bulbs}>
        <boxGeometry args={[0.45, 0.12, 0.25]} />
        <meshStandardMaterial color="#e9e4d8" emissive="#ffcf8a" emissiveIntensity={night ? 5 : 0} />
      </Instances>
      <Instances items={layout.benches}>
        <boxGeometry args={[1.4, 0.12, 0.45]} />
        <meshStandardMaterial color="#7a5636" roughness={0.8} />
      </Instances>
      <Instances items={layout.sigPoles}>
        <cylinderGeometry args={[0.07, 0.07, 3.2, 8]} />
        <meshStandardMaterial color="#2c3035" metalness={0.5} roughness={0.5} />
      </Instances>
      <Instances items={layout.sigHeads}>
        <boxGeometry args={[0.36, 1.05, 0.36]} />
        <meshStandardMaterial color="#1f2226" roughness={0.6} />
      </Instances>
      <TrafficLamps reds={layout.reds} greens={layout.greens} />

      {buildings.map((b) => (
        <Building key={b.id} data={b} />
      ))}

      {!hasSelection && (
        <Html position={[ox, 2, oz - sd / 2 - 4]} center zIndexRange={[20, 0]}>
          <button
            onClick={() => setDistrict(district.id)}
            className={`district-tag ${active ? 'is-active' : ''}`}
            style={{ ['--c' as string]: district.color }}
          >
            <DistrictArt id={district.id} size={26} />
            {district.name}
          </button>
        </Html>
      )}
    </group>
  )
}

/** Red and green signal lamps that swap every few seconds. */
function TrafficLamps({ reds, greens }: { reds: Placement[]; greens: Placement[] }) {
  const red = useRef<THREE.MeshStandardMaterial>(null)
  const green = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(({ clock }) => {
    const phase = Math.floor(clock.elapsedTime / 6) % 2 === 0
    if (red.current) red.current.emissiveIntensity = phase ? 4 : 0.2
    if (green.current) green.current.emissiveIntensity = phase ? 0.2 : 4
  })
  return (
    <>
      <Instances items={reds}>
        <sphereGeometry args={[0.11, 10, 10]} />
        <meshStandardMaterial ref={red} color="#5a0d0d" emissive="#ff2d1f" />
      </Instances>
      <Instances items={greens}>
        <sphereGeometry args={[0.11, 10, 10]} />
        <meshStandardMaterial ref={green} color="#0d3b16" emissive="#2dff6a" />
      </Instances>
    </>
  )
}

export const District = memo(DistrictImpl)
