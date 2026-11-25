import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useCity } from '../store/cityStore'

/** The circle where a delivery's house is (round 2, 3.5): a soft pulsing ring on the ground. */
export function AreaMark() {
  const area = useCity((s) => s.areaMark)
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  useFrame(({ clock }) => {
    if (mat.current) mat.current.opacity = 0.55 + 0.25 * Math.sin(clock.elapsedTime * 2.5)
  })
  if (!area) return null
  return (
    <group position={[area.x, 0.2, area.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <ringGeometry args={[area.r - 1.2, area.r, 64]} />
        <meshBasicMaterial ref={mat} color="#ff9a2e" transparent opacity={0.7} toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <circleGeometry args={[area.r - 1.2, 64]} />
        <meshBasicMaterial color="#ffb547" transparent opacity={0.08} toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  )
}
