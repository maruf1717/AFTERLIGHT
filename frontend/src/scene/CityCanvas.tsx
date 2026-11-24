import { Canvas } from '@react-three/fiber'
import { OrbitControls, Sky, Stars } from '@react-three/drei'
import * as THREE from 'three'
import { DISTRICTS } from '../data/city'
import { useCity } from '../store/cityStore'
import { CameraRig } from './CameraRig'
import { District } from './District'
import { Avenues, Traffic } from './Traffic'

const SUN = new THREE.Vector3(80, 55, 60)

function Atmosphere() {
  const night = useCity((s) => s.night)
  const shadows = useCity((s) => s.quality === 'high')
  const fog = night ? '#0d1424' : '#c9dbe8'
  return (
    <>
      {night ? <color attach="background" args={['#0b1220']} /> : <Sky sunPosition={SUN} turbidity={4} rayleigh={1.2} mieCoefficient={0.004} />}
      <fog attach="fog" args={[fog, 190, 520]} />
      <hemisphereLight args={[night ? '#3c4f78' : '#d7e6f5', night ? '#1a1a22' : '#7d7464', night ? 0.8 : 1.15]} />
      <directionalLight
        position={night ? [-60, 90, -40] : SUN.toArray()}
        intensity={night ? 0.45 : 2.6}
        color={night ? '#9fb3e0' : '#fff1dc'}
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-135}
        shadow-camera-right={135}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
        shadow-camera-far={420}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
      {night && <Stars radius={300} depth={60} count={1800} factor={4} fade speed={0.3} />}
    </>
  )
}

/** The city stands on an island: a grassy slab with earthy sides, surrounded by water. */
function Island() {
  const night = useCity((s) => s.night)
  const shadows = useCity((s) => s.quality === 'high')
  return (
    <group>
      <mesh position={[0, -2.1, 0]} receiveShadow={shadows}>
        <boxGeometry args={[262, 4, 110]} />
        <meshStandardMaterial
          attach="material"
          color={night ? '#26301f' : '#7fae5c'}
          roughness={1}
        />
      </mesh>
      <mesh position={[0, -2.6, 0]}>
        <boxGeometry args={[263, 4.2, 111]} />
        <meshStandardMaterial color={night ? '#2a221b' : '#8a6b4d'} roughness={1} />
      </mesh>
      {/* beach */}
      <mesh position={[0, -3.9, 0]}>
        <boxGeometry args={[274, 1.2, 122]} />
        <meshStandardMaterial color={night ? '#3b3528' : '#e3d3a8'} roughness={1} />
      </mesh>
      <mesh position={[0, -4.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1600, 1600]} />
        <meshStandardMaterial color={night ? '#0e1c2c' : '#4f93b8'} roughness={0.25} metalness={0.1} />
      </mesh>
    </group>
  )
}

export function CityCanvas() {
  const quality = useCity((s) => s.quality)
  const selectBuilding = useCity((s) => s.selectBuilding)

  return (
    <Canvas
      shadows={quality === 'high' ? 'soft' : false}
      dpr={quality === 'high' ? [1, 2] : [1, 1.25]}
      camera={{ position: [0, 190, 260], fov: 40, near: 0.5, far: 1400 }}
      gl={{ antialias: quality === 'high', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      onPointerMissed={() => selectBuilding(null)}
    >
      <Atmosphere />
      <Island />
      <Avenues />
      {DISTRICTS.map((d) => (
        <District key={d.id} district={d} />
      ))}
      <Traffic count={quality === 'high' ? 80 : 40} />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={12}
        maxDistance={320}
        maxPolarAngle={Math.PI * 0.43}
        screenSpacePanning={false}
      />
      <CameraRig />
    </Canvas>
  )
}
