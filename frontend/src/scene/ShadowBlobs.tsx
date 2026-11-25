import { useMemo } from 'react'
import * as THREE from 'three'
import { lawnDecor, streetDecor } from '../city/decor'
import { useGame } from '../game/store'
import { useCity } from '../store/cityStore'
import { Instances, type Placement } from './Instances'
import { useOpenStage } from './CityGround'

/*
 * Economy graphics have no real shadows, so the city would look flat. Baked soft shadows fix
 * most of it for almost nothing: a blurred dark patch under every building (shifted away
 * from the sun, longer for taller buildings) and a soft round one under every tree.
 */

let rectTex: THREE.CanvasTexture | null = null
let roundTex: THREE.CanvasTexture | null = null

function softRect() {
  if (rectTex) return rectTex
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')!
  ctx.filter = 'blur(14px)'
  ctx.fillStyle = 'rgba(0,0,0,1)'
  ctx.fillRect(26, 26, 76, 76)
  rectTex = new THREE.CanvasTexture(c)
  return rectTex
}

function softRound() {
  if (roundTex) return roundTex
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(0,0,0,0.9)')
  g.addColorStop(0.6, 'rgba(0,0,0,0.45)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  roundTex = new THREE.CanvasTexture(c)
  return roundTex
}

/** A unit square lying on the ground. */
const FLAT = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)

/** Shadows fall away from the sun (it stands at x+, z+). */
const AWAY = new THREE.Vector2(-140, -90).normalize()

export function ShadowBlobs() {
  const high = useCity((s) => s.quality === 'high')
  const night = useCity((s) => s.night)
  const objects = useGame((s) => s.objects)
  const stage = useOpenStage()
  const buildings = useMemo<Placement[]>(
    () =>
      objects
        .filter((o) => o.kind !== 'lot' && o.shape !== 'park' && o.height > 1)
        .map((o) => {
          const reach = Math.min(o.height * 0.3, 7)
          // The blob is drawn twice as big as the soft core of the texture.
          return {
            p: [o.position[0] + AWAY.x * reach, 0.09, o.position[1] + AWAY.y * reach],
            s: [(o.size[0] + reach * 0.8) * 1.7, 1, (o.size[1] + reach * 0.8) * 1.7],
            r: o.rotation ?? 0,
          }
        }),
    [objects],
  )
  const trees = useMemo<Placement[]>(() => {
    const out: Placement[] = []
    for (const t of streetDecor(stage).trees) out.push({ p: [t.x + AWAY.x * 0.8, 0.088, t.z + AWAY.y * 0.8], s: [3.2 * t.s, 1, 3.2 * t.s] })
    for (const t of lawnDecor()) out.push({ p: [t.x + AWAY.x * 0.8, 0.088, t.z + AWAY.y * 0.8], s: [3.4 * t.s, 1, 3.4 * t.s] })
    return out
  }, [stage])
  if (high) return null
  const opacity = night ? 0.18 : 0.32
  return (
    <group>
      <Instances items={buildings}>
        <primitive object={FLAT} attach="geometry" />
        <meshBasicMaterial map={softRect()} transparent opacity={opacity} depthWrite={false} color="#1c2733" />
      </Instances>
      <Instances items={trees}>
        <primitive object={FLAT} attach="geometry" />
        <meshBasicMaterial map={softRound()} transparent opacity={opacity * 0.9} depthWrite={false} color="#1c2733" />
      </Instances>
    </group>
  )
}
