import * as THREE from 'three'
import { useCity } from '../store/cityStore'
import { LAND } from './terrain'

/** One continuous piece of land: grass to the horizon, with fields and gentle hills. */
export function Ground() {
  const night = useCity((s) => s.night)
  const shadows = useCity((s) => s.quality === 'high')
  const w = LAND.east - LAND.west
  const d = LAND.south - LAND.north
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow={shadows}>
        <planeGeometry args={[w * 3, d * 3]} />
        <meshStandardMaterial color={night ? '#2f3a30' : '#86ab60'} roughness={1} />
      </mesh>
      <Fields />
      <Hills />
    </group>
  )
}

/** Ploughed and planted fields outside the city, like a real outskirt. */
function Fields() {
  const night = useCity((s) => s.night)
  const fields: [number, number, number, number, string][] = [
    [-170, 75, 60, 40, '#c9b37a'],
    [-110, 95, 50, 30, '#8fae4f'],
    [150, 85, 55, 38, '#b8a265'],
    [190, -70, 50, 45, '#9cb85a'],
    [-200, -60, 45, 50, '#a8c266'],
    [40, 110, 70, 30, '#c2ac6e'],
  ]
  return (
    <group>
      {fields.map(([x, z, w, d, c], i) => (
        <group key={i} position={[x, -0.05, z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[w, d]} />
            <meshStandardMaterial color={night ? '#3f4636' : c} roughness={1} />
          </mesh>
          {Array.from({ length: Math.floor(d / 2.5) }, (_, k) => (
            <mesh key={k} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -d / 2 + 1.25 + k * 2.5]}>
              <planeGeometry args={[w, 0.5]} />
              <meshStandardMaterial color={night ? '#363c2e' : new THREE.Color(c).multiplyScalar(0.82).getStyle()} roughness={1} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

/** A few soft grassy hills on the horizon. */
function Hills() {
  const night = useCity((s) => s.night)
  const list: [number, number, number, number][] = [
    [-260, -120, 60, 14],
    [-300, 60, 70, 12],
    [260, -140, 65, 13],
    [300, 90, 70, 11],
    [40, -200, 80, 16],
    [-120, 210, 70, 10],
    [140, 220, 60, 9],
  ]
  return (
    <group>
      {list.map(([x, z, r, h], i) => (
        <mesh key={i} position={[x, -0.6, z]} scale={[r, h, r * 0.8]} receiveShadow>
          <sphereGeometry args={[1, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={night ? '#33402f' : '#80a65a'} roughness={1} />
        </mesh>
      ))}
    </group>
  )
}
