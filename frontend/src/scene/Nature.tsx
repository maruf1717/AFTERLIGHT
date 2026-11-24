import { useMemo } from 'react'
import { createRng } from '../lib/random'
import { useCity } from '../store/cityStore'
import { Instances, type Placement } from './Instances'
import { inCity, ISLAND, onLand } from './terrain'

const DECIDUOUS = ['#4f8a3c', '#5e9a46', '#3f7a35', '#6aa24f', '#77a845', '#8aa848', '#5a8f3a']
const CONIFER = ['#2f5d36', '#365f3a', '#2a5232', '#3d6b40']

/** Forests, river-bank trees, bushes and rocks around the city. */
export function Nature() {
  const quality = useCity((s) => s.quality)
  const night = useCity((s) => s.night)
  const shadows = quality === 'high'

  const data = useMemo(() => {
    const rng = createRng(4242)
    const dTrunk: Placement[] = []
    const dCrown: Placement[] = []
    const cTrunk: Placement[] = []
    const cCrownA: Placement[] = []
    const cCrownB: Placement[] = []
    const bushes: Placement[] = []
    const rocks: Placement[] = []

    // Forest density: thick in the west and north-west, groves elsewhere.
    // A forest to the north and west, groves and tree lines elsewhere, open fields to the south.
    const density = (x: number, z: number) => {
      if (z < -60) return 0.9
      if (x < -140) return 0.75
      if (x > 140) return 0.5
      if (z > 60) return 0.18
      return 0.25
    }
    const target = quality === 'high' ? 3200 : 1200
    let tries = 0
    while (dTrunk.length + cTrunk.length < target && tries < target * 8) {
      tries++
      const x = rng.range(ISLAND.west, ISLAND.east)
      const z = rng.range(ISLAND.north, ISLAND.south)
      if (!onLand(x, z, 3) || inCity(x, z, 4)) continue
      if (rng.next() > density(x, z)) continue
      const s = rng.range(0.75, 1.5)
      if (rng.chance(x < -150 || z < -60 ? 0.55 : 0.2)) {
        cTrunk.push({ p: [x, 0.8 * s, z], s: [s, s, s] })
        cCrownA.push({ p: [x, 2.6 * s, z], s: [s, s * 1.1, s], c: rng.pick(CONIFER), r: rng.range(0, 6) })
        cCrownB.push({ p: [x, 4.1 * s, z], s: [s * 0.72, s * 0.9, s * 0.72], c: rng.pick(CONIFER), r: rng.range(0, 6) })
      } else {
        dTrunk.push({ p: [x, 0.9 * s, z], s: [s, s, s] })
        dCrown.push({ p: [x, 2.7 * s, z], s: [s * rng.range(0.9, 1.3), s * rng.range(0.85, 1.15), s * rng.range(0.9, 1.3)], c: rng.pick(DECIDUOUS), r: rng.range(0, 6) })
      }
    }

    // Scattered bushes and rocks in the countryside.
    for (let i = 0; i < (quality === 'high' ? 700 : 250); i++) {
      const x = rng.range(ISLAND.west, ISLAND.east)
      const z = rng.range(ISLAND.north, ISLAND.south)
      if (!onLand(x, z, 2) || inCity(x, z, 2)) continue
      if (rng.chance(0.75)) {
        const s = rng.range(0.4, 1.1)
        bushes.push({ p: [x, 0.2 * s, z], s: [s * 1.4, s, s * 1.4], c: rng.pick(DECIDUOUS), r: rng.range(0, 6) })
      } else {
        const s = rng.range(0.3, 1.2)
        rocks.push({ p: [x, 0.1, z], s: [s * 1.3, s * 0.7, s], r: rng.range(0, 6), c: rng.pick(['#8d8a84', '#9a958c', '#7b7872']) })
      }
    }
    return { dTrunk, dCrown, cTrunk, cCrownA, cCrownB, bushes, rocks }
  }, [quality])

  const tint = night ? '#55605a' : '#ffffff'
  return (
    <group>
      <Instances items={data.dTrunk}>
        <cylinderGeometry args={[0.13, 0.2, 1.8, 6]} />
        <meshStandardMaterial color="#5e4330" roughness={1} />
      </Instances>
      <Instances items={data.dCrown} castShadow={shadows}>
        <icosahedronGeometry args={[1.15, 1]} />
        <meshStandardMaterial color={tint} roughness={0.95} flatShading />
      </Instances>
      <Instances items={data.cTrunk}>
        <cylinderGeometry args={[0.12, 0.18, 1.6, 6]} />
        <meshStandardMaterial color="#4f3a2a" roughness={1} />
      </Instances>
      <Instances items={data.cCrownA} castShadow={shadows}>
        <coneGeometry args={[1.3, 2.8, 8]} />
        <meshStandardMaterial color={tint} roughness={0.95} flatShading />
      </Instances>
      <Instances items={data.cCrownB} castShadow={shadows}>
        <coneGeometry args={[1.1, 2.4, 8]} />
        <meshStandardMaterial color={tint} roughness={0.95} flatShading />
      </Instances>
      <Instances items={data.bushes}>
        <icosahedronGeometry args={[0.7, 1]} />
        <meshStandardMaterial color={tint} roughness={1} flatShading />
      </Instances>
      <Instances items={data.rocks} castShadow={shadows}>
        <dodecahedronGeometry args={[0.8, 0]} />
        <meshStandardMaterial color={tint} roughness={0.9} flatShading />
      </Instances>
    </group>
  )
}
