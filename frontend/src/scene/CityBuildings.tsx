import { Html } from '@react-three/drei'
import { DISTRICTS } from '../data/city'
import { useGame } from '../game/store'
import { useCity } from '../store/cityStore'
import { DistrictArt } from '../ui/art'
import { Building } from './Building'

/** Every building and game object, each standing on its own parcel and facing its street. */
export function CityBuildings() {
  const objects = useGame((s) => s.objects)
  return (
    <group>
      {objects.map((b) => (
        <Building key={b.id} data={b} />
      ))}
    </group>
  )
}

/** Floating zone names; tap one to fly there. */
export function ZoneLabels() {
  const active = useCity((s) => s.activeDistrictId)
  const setDistrict = useCity((s) => s.setDistrict)
  const hasSelection = useCity((s) => s.selectedBuildingId !== null)
  if (hasSelection) return null
  return (
    <>
      {DISTRICTS.map((d) => (
        <Html key={d.id} position={[d.origin[0], 14, d.origin[1]]} center zIndexRange={[20, 0]}>
          <button
            onClick={() => setDistrict(d.id)}
            className={`district-tag ${active === d.id ? 'is-active' : ''}`}
            style={{ ['--c' as string]: d.color }}
          >
            <DistrictArt id={d.id} size={26} />
            {d.name}
          </button>
        </Html>
      ))}
    </>
  )
}
