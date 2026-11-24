import { useMemo } from 'react'
import { useCity } from '../store/cityStore'
import { AVENUES } from './Vehicles'
import { asphaltTexture, CITY_EAST, CITY_WEST } from './terrain'

export { AVENUES, ParkedCars, Traffic } from './Vehicles'

/** Asphalt avenues linking the districts (they cross the river on bridges). */
export function Avenues() {
  const night = useCity((s) => s.night)
  const tex = useMemo(() => {
    const t = asphaltTexture().clone()
    t.needsUpdate = true
    t.repeat.set(70, 1)
    return t
  }, [])
  return (
    <group>
      {AVENUES.map((z) => (
        <mesh key={z} position={[(CITY_WEST + CITY_EAST) / 2, -0.03, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[CITY_EAST - CITY_WEST, 4.6]} />
          <meshStandardMaterial map={tex} color={night ? '#3a3d42' : '#8a8e94'} roughness={0.95} />
        </mesh>
      ))}
    </group>
  )
}
