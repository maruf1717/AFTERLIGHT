import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import * as THREE from 'three'
import { DISTRICTS } from '../data/city'
import { useCity } from '../store/cityStore'
import { CameraRig } from './CameraRig'
import { District } from './District'
import { Avenues, Traffic } from './Traffic'

const SKY = { night: '#070811', day: '#9cb8d6' }

function Lighting() {
  const night = useCity((s) => s.night)
  const shadows = useCity((s) => s.quality === 'high')
  return (
    <>
      <color attach="background" args={[night ? SKY.night : SKY.day]} />
      <fog attach="fog" args={[night ? SKY.night : SKY.day, 140, 340]} />
      <hemisphereLight args={[night ? '#5b6ba8' : '#dbeafe', night ? '#1a1530' : '#57534e', night ? 1.5 : 1.2]} />
      <directionalLight
        position={night ? [-60, 90, -40] : [70, 120, 50]}
        intensity={night ? 0.9 : 2.2}
        color={night ? '#a5b4fc' : '#fff7ed'}
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-130}
        shadow-camera-right={130}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
        shadow-camera-far={400}
        shadow-bias={-0.0004}
      />
      {night && <Stars radius={260} depth={60} count={2500} factor={5} fade speed={0.4} />}
    </>
  )
}

export function CityCanvas() {
  const quality = useCity((s) => s.quality)
  const selectBuilding = useCity((s) => s.selectBuilding)
  const night = useCity((s) => s.night)

  return (
    <Canvas
      shadows={quality === 'high'}
      dpr={quality === 'high' ? [1, 2] : [1, 1.25]}
      camera={{ position: [0, 170, 230], fov: 42, near: 0.5, far: 900 }}
      gl={{ antialias: quality === 'high', toneMapping: THREE.ACESFilmicToneMapping }}
      onPointerMissed={() => selectBuilding(null)}
    >
      <Lighting />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]} receiveShadow>
        <planeGeometry args={[900, 900]} />
        <meshStandardMaterial color={night ? '#090a10' : '#4b5563'} roughness={1} />
      </mesh>
      <Avenues />
      {DISTRICTS.map((d) => (
        <District key={d.id} district={d} />
      ))}
      <Traffic count={quality === 'high' ? 90 : 45} />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={10}
        maxDistance={260}
        maxPolarAngle={Math.PI * 0.44}
        screenSpacePanning={false}
      />
      <CameraRig />
    </Canvas>
  )
}
