import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { DESK_QUERY } from '../ui/layout'
import { useCity } from '../store/cityStore'

/**
 * Post-processing for the full graphics only. It lives in its own file, loaded when the full
 * graphics are switched on (round 2, 6.2): the economy mode never downloads it.
 */
export default function Effects() {
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
