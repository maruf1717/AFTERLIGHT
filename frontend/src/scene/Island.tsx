import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useCity } from '../store/cityStore'
import { AVENUES } from './Traffic'
import { asphaltTexture, grassTexture, landShapes, riverX, RIVER_HALF, waterNormalTexture } from './terrain'

const LAND_DEPTH = 4

function useLandGeometry(bevel: number, bevelThickness: number) {
  return useMemo(
    () =>
      landShapes().map((s) => {
        const g = new THREE.ExtrudeGeometry(s, {
          depth: LAND_DEPTH,
          bevelEnabled: bevel > 0,
          bevelSize: bevel,
          bevelThickness,
          bevelSegments: 4,
          curveSegments: 1,
        })
        g.rotateX(-Math.PI / 2)
        // Planar UVs for the grass on top.
        const pos = g.attributes.position
        const uv = new Float32Array(pos.count * 2)
        for (let i = 0; i < pos.count; i++) {
          uv[i * 2] = pos.getX(i) / 420 + 0.5
          uv[i * 2 + 1] = pos.getZ(i) / 240 + 0.5
        }
        g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
        g.computeVertexNormals()
        return g
      }),
    [bevel, bevelThickness],
  )
}

export function Water() {
  const night = useCity((s) => s.night)
  const mat = useMemo(() => {
    const n = waterNormalTexture().clone()
    n.needsUpdate = true
    n.repeat.set(60, 60)
    return new THREE.MeshPhysicalMaterial({
      color: '#2f6f94',
      roughness: 0.12,
      metalness: 0.05,
      normalMap: n,
      normalScale: new THREE.Vector2(0.35, 0.35),
      clearcoat: 0.6,
      clearcoatRoughness: 0.15,
    })
  }, [])
  useFrame((_, dt) => {
    const n = mat.normalMap!
    n.offset.x += dt * 0.012
    n.offset.y += dt * 0.007
  })
  mat.color.set(night ? '#0d2236' : '#3b7ea3')
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.25, 0]} material={mat} receiveShadow>
      <planeGeometry args={[2400, 2400]} />
    </mesh>
  )
}

export function Island() {
  const night = useCity((s) => s.night)
  const shadows = useCity((s) => s.quality === 'high')
  const land = useLandGeometry(0.8, 0.5)
  const beach = useLandGeometry(3, 1.2)
  const mats = useMemo(() => {
    const grass = new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1 })
    const earth = new THREE.MeshStandardMaterial({ color: '#7a5d43', roughness: 1 })
    const sand = new THREE.MeshStandardMaterial({ color: '#dcc9a0', roughness: 1 })
    return { grass, earth, sand }
  }, [])
  mats.grass.color.set(night ? '#4a5a52' : '#ffffff')
  mats.sand.color.set(night ? '#4b4638' : '#dcc9a0')

  return (
    <group>
      {land.map((g, i) => (
        <mesh key={i} geometry={g} material={[mats.grass, mats.earth]} position={[0, -0.6 - LAND_DEPTH, 0]} receiveShadow={shadows} />
      ))}
      {beach.map((g, i) => (
        <mesh key={`b${i}`} geometry={g} material={mats.sand} position={[0, -2.2 - LAND_DEPTH, 0]} receiveShadow={shadows} />
      ))}
      <Hills />
      <Bridges />
    </group>
  )
}

/** A few soft grassy hills in the countryside. */
function Hills() {
  const night = useCity((s) => s.night)
  const list: [number, number, number, number][] = [
    [-200, -70, 22, 6],
    [-180, 60, 26, 5],
    [150, -80, 20, 5],
    [-150, -92, 16, 4],
    [160, 70, 24, 4.5],
    [40, -95, 18, 3.5],
  ]
  return (
    <group>
      {list.map(([x, z, r, h], i) => (
        <mesh key={i} position={[x, -0.6, z]} scale={[r, h, r * 0.8]} receiveShadow castShadow>
          <sphereGeometry args={[1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial map={grassTexture()} color={night ? '#46564c' : '#e9f2dc'} roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

/** Road bridges where the avenues cross the river. */
function Bridges() {
  const night = useCity((s) => s.night)
  const asphalt = useMemo(() => {
    const t = asphaltTexture().clone()
    t.needsUpdate = true
    t.repeat.set(8, 1)
    return t
  }, [])
  return (
    <group>
      {AVENUES.map((z) => {
        const cx = riverX(z)
        const len = RIVER_HALF * 2 + 10
        return (
          <group key={z} position={[cx, 0, z]}>
            <mesh position={[0, -0.25, 0]} castShadow receiveShadow>
              <boxGeometry args={[len, 0.5, 5.2]} />
              <meshStandardMaterial color="#b8b2a6" roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[len, 3.8]} />
              <meshStandardMaterial map={asphalt} color={night ? '#3a3d42' : '#8a8e94'} roughness={0.95} />
            </mesh>
            {/* arch under the deck */}
            <mesh position={[0, -0.9, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[RIVER_HALF + 1, 0.35, 8, 32, Math.PI]} />
              <meshStandardMaterial color="#a39d91" />
            </mesh>
            {[-2.45, 2.45].map((side) => (
              <group key={side} position={[0, 0, side]}>
                <mesh position={[0, 0.55, 0]}>
                  <boxGeometry args={[len, 0.08, 0.08]} />
                  <meshStandardMaterial color="#3e444b" metalness={0.6} roughness={0.4} />
                </mesh>
                {Array.from({ length: 9 }, (_, i) => (
                  <mesh key={i} position={[-len / 2 + 0.6 + (i * (len - 1.2)) / 8, 0.28, 0]}>
                    <boxGeometry args={[0.08, 0.56, 0.08]} />
                    <meshStandardMaterial color="#3e444b" metalness={0.6} roughness={0.4} />
                  </mesh>
                ))}
              </group>
            ))}
          </group>
        )
      })}
    </group>
  )
}
