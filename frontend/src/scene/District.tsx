import { memo, useMemo } from 'react'
import { Html } from '@react-three/drei'
import { BUILDINGS_BY_DISTRICT, districtSize, lotCenter, LOT, PITCH } from '../data/city'
import type { District as DistrictData } from '../data/types'
import { useCity } from '../store/cityStore'
import { Building } from './Building'

function DistrictImpl({ district }: { district: DistrictData }) {
  const active = useCity((s) => s.activeDistrictId === district.id)
  const night = useCity((s) => s.night)
  const shadows = useCity((s) => s.quality === 'high')
  const setDistrict = useCity((s) => s.setDistrict)
  const hasSelection = useCity((s) => s.selectedBuildingId !== null)
  const buildings = BUILDINGS_BY_DISTRICT[district.id]
  const [sw, sd] = districtSize(district)
  const [ox, oz] = district.origin

  const lots = useMemo(() => {
    const out: [number, number][] = []
    for (let r = 0; r < district.grid.rows; r++)
      for (let c = 0; c < district.grid.cols; c++) out.push(lotCenter(district, c, r))
    return out
  }, [district])

  // Glowing kerb lines along every street, tinted with the district colour.
  const streets = useMemo(() => {
    const xs: number[] = []
    const zs: number[] = []
    for (let c = 0; c <= district.grid.cols; c++) xs.push(ox + (c - district.grid.cols / 2) * PITCH)
    for (let r = 0; r <= district.grid.rows; r++) zs.push(oz + (r - district.grid.rows / 2) * PITCH)
    return { xs, zs }
  }, [district, ox, oz])

  const lineOpacity = (active ? 0.55 : 0.18) * (night ? 1 : 0.5)

  return (
    <group>
      {/* asphalt plate */}
      <mesh position={[ox, -0.05, oz]} receiveShadow={shadows}>
        <boxGeometry args={[sw, 0.1, sd]} />
        <meshStandardMaterial color={night ? '#11131b' : '#3a3d46'} roughness={0.95} />
      </mesh>

      {/* sidewalks / lots */}
      {lots.map(([x, z], i) => (
        <mesh key={i} position={[x, 0.04, z]} receiveShadow={shadows}>
          <boxGeometry args={[LOT, 0.08, LOT]} />
          <meshStandardMaterial color={night ? '#1d2029' : '#6b6e76'} roughness={0.9} />
        </mesh>
      ))}

      {/* street centre lines */}
      {streets.xs.map((x) => (
        <mesh key={`x${x}`} position={[x, 0.011, oz]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.18, sd - 2]} />
          <meshBasicMaterial color={district.color} transparent opacity={lineOpacity} />
        </mesh>
      ))}
      {streets.zs.map((z) => (
        <mesh key={`z${z}`} position={[ox, 0.011, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[sw - 2, 0.18]} />
          <meshBasicMaterial color={district.color} transparent opacity={lineOpacity} />
        </mesh>
      ))}

      {buildings.map((b) => (
        <Building key={b.id} data={b} />
      ))}

      {!hasSelection && (
      <Html position={[ox, 1, oz - sd / 2 - 4]} center zIndexRange={[20, 0]}>
        <button
          onClick={() => setDistrict(district.id)}
          className={`district-tag ${active ? 'is-active' : ''}`}
          style={{ ['--c' as string]: district.color }}
        >
          <span className="dot" />
          {district.name}
        </button>
      </Html>
      )}
    </group>
  )
}

export const District = memo(DistrictImpl)
