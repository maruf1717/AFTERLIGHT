import { memo, useMemo } from 'react'
import { Html } from '@react-three/drei'
import { BUILDINGS_BY_DISTRICT, districtSize, lotCenter, LOT, PITCH } from '../data/city'
import type { District as DistrictData, DistrictId } from '../data/types'
import { createRng } from '../lib/random'
import { useCity } from '../store/cityStore'
import { DistrictArt } from '../ui/art'
import { Building } from './Building'
import { Instances, type Placement } from './Instances'

const LOT_SURFACE: Record<DistrictId, { day: string; night: string }> = {
  residential: { day: '#8fbf6c', night: '#2c3a2a' },
  downtown: { day: '#d3ccbf', night: '#3a3936' },
  industrial: { day: '#b9b2a6', night: '#363330' },
}

const TREE_GREENS = ['#4f8a3c', '#5e9a46', '#3f7a35', '#6aa24f', '#77a845']

function DistrictImpl({ district }: { district: DistrictData }) {
  const active = useCity((s) => s.activeDistrictId === district.id)
  const night = useCity((s) => s.night)
  const shadows = useCity((s) => s.quality === 'high')
  const setDistrict = useCity((s) => s.setDistrict)
  const hasSelection = useCity((s) => s.selectedBuildingId !== null)
  const buildings = BUILDINGS_BY_DISTRICT[district.id]
  const [sw, sd] = districtSize(district)
  const [ox, oz] = district.origin
  const { cols, rows } = district.grid

  const layout = useMemo(() => {
    const lots: [number, number][] = []
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) lots.push(lotCenter(district, c, r))

    const xs = Array.from({ length: cols + 1 }, (_, c) => ox + (c - cols / 2) * PITCH)
    const zs = Array.from({ length: rows + 1 }, (_, r) => oz + (r - rows / 2) * PITCH)

    // Dashed centre lines along every street.
    const dashes: Placement[] = []
    for (const x of xs) for (let z = oz - sd / 2 + 2; z < oz + sd / 2 - 1; z += 3) dashes.push({ p: [x, 0.02, z], s: [0.18, 0.02, 1.4] })
    for (const z of zs) for (let x = ox - sw / 2 + 2; x < ox + sw / 2 - 1; x += 3) dashes.push({ p: [x, 0.02, z], s: [1.4, 0.02, 0.18] })

    // Street trees and lamps on lot corners (not in the industrial zone).
    const rng = createRng(district.origin[0] * 13 + 5)
    const trunks: Placement[] = []
    const crowns: Placement[] = []
    const posts: Placement[] = []
    const bulbs: Placement[] = []
    const half = LOT / 2 + 0.4
    for (const [x, z] of lots) {
      const corners: [number, number][] = [
        [x - half, z - half],
        [x + half, z - half],
        [x - half, z + half],
        [x + half, z + half],
      ]
      corners.forEach(([cx, cz], i) => {
        if (district.id !== 'industrial' && i % 2 === 0 && rng.chance(0.75)) {
          const s = rng.range(0.8, 1.15)
          trunks.push({ p: [cx, 0.8 * s, cz], s: [s, s, s] })
          crowns.push({ p: [cx, 2.3 * s, cz], s: [s, s * 1.1, s], r: rng.range(0, 6), c: rng.pick(TREE_GREENS) })
        } else if (i === 3) {
          posts.push({ p: [cx, 1.8, cz] })
          bulbs.push({ p: [cx, 3.65, cz] })
        }
      })
    }
    return { lots, dashes, trunks, crowns, posts, bulbs }
  }, [district, ox, oz, sw, sd, cols, rows])

  const lotColor = LOT_SURFACE[district.id][night ? 'night' : 'day']

  return (
    <group>
      {/* asphalt */}
      <mesh position={[ox, -0.05, oz]} receiveShadow={shadows}>
        <boxGeometry args={[sw, 0.1, sd]} />
        <meshStandardMaterial color={night ? '#202328' : '#55595f'} roughness={0.95} />
      </mesh>

      {/* kerbs + lot surfaces */}
      <Instances items={layout.lots.map(([x, z]) => ({ p: [x, 0.06, z] }))} receiveShadow={shadows}>
        <boxGeometry args={[LOT + 0.9, 0.12, LOT + 0.9]} />
        <meshStandardMaterial color={night ? '#45474b' : '#c8c6c1'} roughness={0.9} />
      </Instances>
      <Instances items={layout.lots.map(([x, z]) => ({ p: [x, 0.1, z] }))} receiveShadow={shadows}>
        <boxGeometry args={[LOT, 0.1, LOT]} />
        <meshStandardMaterial color={lotColor} roughness={1} />
      </Instances>

      <Instances items={layout.dashes}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={night ? '#8a8a80' : '#f2efe6'} roughness={0.8} />
      </Instances>

      {layout.trunks.length > 0 && (
        <>
          <Instances items={layout.trunks}>
            <cylinderGeometry args={[0.12, 0.16, 1.6, 6]} />
            <meshStandardMaterial color="#6b4a2f" />
          </Instances>
          <Instances items={layout.crowns} castShadow={shadows}>
            <icosahedronGeometry args={[1.05, 0]} />
            <meshStandardMaterial color="#ffffff" roughness={0.9} flatShading />
          </Instances>
        </>
      )}
      <Instances items={layout.posts}>
        <cylinderGeometry args={[0.06, 0.08, 3.6, 6]} />
        <meshStandardMaterial color="#3c4046" metalness={0.4} roughness={0.5} />
      </Instances>
      <Instances items={layout.bulbs}>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshStandardMaterial color="#f3e7cf" emissive="#ffcf8a" emissiveIntensity={night ? 2.2 : 0} />
      </Instances>

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

export const District = memo(DistrictImpl)
