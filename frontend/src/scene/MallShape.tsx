import { Box, signTexture, type Props } from './CivicShapes'

/**
 * ТЦ «AFTERLIGHT»: the city's landmark next to the central roundabout. A two-storey podium
 * with a glass front and entrance canopy, a glass atrium rising above it, and the name of
 * the project in big letters on the roof (lit at night). Front is +z (towards the street).
 */
export function MallShape({ data, night }: Props) {
  const [w, d] = data.size
  const h = Math.max(9, data.height)
  const podium = h * 0.62
  const glow = night ? 1.4 : 0.15
  const sign = signTexture('AFTERLIGHT', '#141a24', '#ffb547', 1024, 192)
  const atriumW = w * 0.42
  const atriumD = d * 0.5
  return (
    <group>
      {/* podium: concrete with a band of shop windows */}
      <Box size={[w, podium, d]} at={[0, podium / 2, 0]} color="#e9e4da" rough={0.7} />
      <Box size={[w + 0.02, podium * 0.36, d + 0.02]} at={[0, podium * 0.3, 0]} color="#3f5d78" rough={0.15} metal={0.5} emissive="#ffd59a" ei={night ? 0.55 : 0} />
      <Box size={[w + 0.02, podium * 0.22, d + 0.02]} at={[0, podium * 0.74, 0]} color="#4a6a86" rough={0.15} metal={0.5} emissive="#ffd59a" ei={night ? 0.4 : 0} />
      {/* roof parapet */}
      <Box size={[w + 0.3, 0.5, d + 0.3]} at={[0, podium + 0.25, 0]} color="#cfc8bb" />
      {/* glass atrium */}
      <Box size={[atriumW, h - podium, atriumD]} at={[0, podium + (h - podium) / 2, -d * 0.05]} color="#6f97b8" rough={0.08} metal={0.6} emissive="#cfe6ff" ei={night ? 0.5 : 0} />
      <Box size={[atriumW + 0.3, 0.35, atriumD + 0.3]} at={[0, h + 0.17, -d * 0.05]} color="#d9d3c8" />
      {/* entrance: canopy, glass doors and two orange pillars */}
      <Box size={[w * 0.4, 0.3, 2.4]} at={[0, podium * 0.48, d / 2 + 1.1]} color="#f2efe8" />
      <Box size={[w * 0.32, podium * 0.42, 0.1]} at={[0, podium * 0.22, d / 2 + 0.06]} color="#1d2a36" rough={0.05} metal={0.6} emissive="#ffe2b0" ei={night ? 0.9 : 0.05} />
      {[-1, 1].map((s) => (
        <Box key={s} size={[0.5, podium * 0.5, 0.5]} at={[s * w * 0.18, podium * 0.25, d / 2 + 2.1]} color="#e0832f" />
      ))}
      {/* the name on the roof, readable from both sides */}
      <group position={[0, h + 2.6, -d * 0.05 + atriumD / 2 + 0.4]}>
        <Box size={[0.2, 4.4, 0.2]} at={[-w * 0.3, -1.2, -0.3]} color="#2b3036" cast={false} />
        <Box size={[0.2, 4.4, 0.2]} at={[w * 0.3, -1.2, -0.3]} color="#2b3036" cast={false} />
        <mesh>
          <boxGeometry args={[w * 0.86, (w * 0.86) / 5.3, 0.25]} />
          <meshStandardMaterial attach="material-0" color="#141a24" />
          <meshStandardMaterial attach="material-1" color="#141a24" />
          <meshStandardMaterial attach="material-2" color="#141a24" />
          <meshStandardMaterial attach="material-3" color="#141a24" />
          <meshStandardMaterial attach="material-4" map={sign} emissive="#ffffff" emissiveMap={sign} emissiveIntensity={glow} toneMapped={false} />
          <meshStandardMaterial attach="material-5" color="#141a24" />
        </mesh>
        <mesh position={[0, 0, -0.13]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[w * 0.86, (w * 0.86) / 5.3]} />
          <meshStandardMaterial map={sign} emissive="#ffffff" emissiveMap={sign} emissiveIntensity={glow} toneMapped={false} />
        </mesh>
      </group>
      {/* rooftop units */}
      {[-1, 1].map((s) => (
        <Box key={s} size={[2.2, 1.1, 1.6]} at={[s * w * 0.36, podium + 1, -d * 0.3]} color="#b9b4ab" />
      ))}
    </group>
  )
}
