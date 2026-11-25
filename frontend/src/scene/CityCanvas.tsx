import { Canvas } from '@react-three/fiber'
import { Environment, Lightformer, MapControls, Sky, Stars } from '@react-three/drei'
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { DESK_QUERY } from '../ui/layout'
import { useGame } from '../game/store'
import { useCity } from '../store/cityStore'
import { CameraRig } from './CameraRig'
import { Celebrations } from './Celebrations'
import { CityBuildings, ZoneLabels } from './CityBuildings'
import { CityGround, useOpenStage } from './CityGround'
import { Ground } from './Island'
import { Nature } from './Nature'
import { People } from './People'
import { ParkedCars, Traffic } from './Vehicles'
import { ShadowBlobs } from './ShadowBlobs'

const SUN = new THREE.Vector3(140, 95, 90)

function Atmosphere() {
  const night = useCity((s) => s.night)
  const high = useCity((s) => s.quality === 'high')
  // Night is a moonlit evening, not a black screen: ground, roads and outlines stay readable.
  const fog = night ? '#18233d' : '#cddfec'
  return (
    <>
      {night ? <color attach="background" args={['#111b33']} /> : <Sky sunPosition={SUN} turbidity={3.2} rayleigh={0.9} mieCoefficient={0.004} mieDirectionalG={0.85} />}
      <fog attach="fog" args={[fog, night ? 360 : 260, night ? 1000 : 760]} />
      <Environment resolution={high ? 256 : 64} frames={1} environmentIntensity={night ? 0.4 : 0.75}>
        <color attach="background" args={[night ? '#0b1322' : '#9cc0de']} />
        <Lightformer form="rect" intensity={night ? 0.9 : 2.4} color={night ? '#5b72a8' : '#dbeafe'} scale={[300, 300, 1]} position={[0, 120, 0]} rotation={[Math.PI / 2, 0, 0]} />
        <Lightformer form="rect" intensity={night ? 0 : 3} color="#fff1dc" scale={[80, 40, 1]} position={[140, 60, 90]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={night ? 0.1 : 0.8} color="#c9d9c0" scale={[300, 20, 1]} position={[0, 4, -200]} />
        <Lightformer form="rect" intensity={night ? 0.1 : 0.6} color="#e6dccb" scale={[300, 20, 1]} position={[0, 4, 200]} rotation={[0, Math.PI, 0]} />
      </Environment>
      {/* Warm sky and cool ground by day (a soft gradient on walls even without shadows); moonlit blue at night. */}
      <hemisphereLight args={[night ? '#6f86bf' : high ? '#dfeaf6' : '#fff2dc', night ? '#2a2f3d' : high ? '#6f6656' : '#7d8aa0', night ? 1.1 : high ? 0.55 : 0.85]} />
      <directionalLight
        position={night ? [-80, 110, -50] : SUN.toArray()}
        intensity={night ? 1.0 : 3.1}
        color={night ? '#9fb3e0' : '#fff0d9'}
        castShadow={high}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-170}
        shadow-camera-right={170}
        shadow-camera-top={110}
        shadow-camera-bottom={-110}
        shadow-camera-near={10}
        shadow-camera-far={500}
        shadow-bias={-0.0003}
        shadow-normalBias={0.05}
      />
      {night && <Stars radius={400} depth={80} count={2500} factor={5} fade speed={0.3} />}
    </>
  )
}

/** Counts frames and reports the average of the last 5 seconds (T8). */
function FpsMeter() {
  const setFps = useCity((s) => s.setFps)
  const frames = useRef<number[]>([])
  useFrame(() => {
    const now = performance.now()
    const f = frames.current
    f.push(now)
    while (f.length && now - f[0] > 5000) f.shift()
    if (f.length > 3 && Math.floor(now / 1000) !== Math.floor(f[f.length - 2] / 1000)) setFps(Math.round((f.length - 1) / ((now - f[0]) / 1000)))
  })
  return null
}

function Effects() {
  const night = useCity((s) => s.night)
  // Ambient occlusion is the heaviest effect: computers only.
  const desk = typeof window !== 'undefined' && window.matchMedia(DESK_QUERY).matches
  const bloom = <Bloom mipmapBlur luminanceThreshold={night ? 0.85 : 1.15} luminanceSmoothing={0.2} intensity={night ? 1.1 : 0.25} />
  if (desk)
    return (
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <N8AO aoRadius={2.6} distanceFalloff={1.2} intensity={2.4} halfRes quality="medium" color="#1b2430" />
        {bloom}
        <SMAA />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Vignette offset={0.28} darkness={0.42} />
      </EffectComposer>
    )
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      {bloom}
      <SMAA />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.28} darkness={0.42} />
    </EffectComposer>
  )
}

export function CityCanvas() {
  const quality = useCity((s) => s.quality)
  const selectBuilding = useCity((s) => s.selectBuilding)
  const high = quality === 'high'
  const stage = useOpenStage()
  // Traffic and crowds grow with the city (rounded so fleets are not rebuilt every tick).
  const pop = useGame((s) => Math.round((s.city?.population ?? 120) / 100) * 100)
  const cars = Math.min(high ? 90 : 40, Math.max(10, Math.round(pop / 14)))
  const people = Math.min(high ? 180 : 60, Math.max(20, Math.round(pop / 6)))
  const parked = Math.min(high ? 0.5 : 0.25, 0.12 + pop / 6000)

  return (
    <Canvas
      shadows={high ? 'soft' : false}
      dpr={high ? [1, 2] : [1, 1.25]}
      camera={{ position: [0, 220, 300], fov: 40, near: 0.5, far: 1600 }}
      gl={{ antialias: !high, toneMapping: high ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05, powerPreference: 'high-performance' }}
      onPointerMissed={() => selectBuilding(null)}
    >
      <Atmosphere />
      <Ground />
      <Nature />
      <CityGround />
      <ShadowBlobs />
      <CityBuildings />
      <ZoneLabels />
      <Traffic count={cars} stage={stage} />
      <ParkedCars density={parked} stage={stage} />
      <People count={people} stage={stage} />
      {/* Map-style controls: one finger / left mouse drags the city, two fingers / right mouse rotate and zoom. */}
      <MapControls
        makeDefault
        enableDamping
        dampingFactor={0.1}
        minDistance={12}
        maxDistance={420}
        minPolarAngle={0.25}
        maxPolarAngle={Math.PI * 0.42}
        screenSpacePanning={false}
        panSpeed={1.2}
        rotateSpeed={0.6}
        zoomSpeed={1.1}
      />
      <Celebrations />
      <CameraRig />
      {high && <Effects />}
      <FpsMeter />
    </Canvas>
  )
}
