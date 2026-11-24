import * as THREE from 'three'
import { createRng } from '../lib/random'

/**
 * Procedural facade textures. One canvas pair (albedo + emissive) per variant,
 * shared by every building; each building clones the texture to set its own repeat.
 */

const CELLS = 8 // window cells per texture side
const PX = 32 // pixels per cell

interface FacadeTextures {
  map: THREE.CanvasTexture
  emissive: THREE.CanvasTexture
}

const cache = new Map<string, FacadeTextures>()

function build(variant: number, litRatio: number): FacadeTextures {
  const size = CELLS * PX
  const albedo = document.createElement('canvas')
  const glow = document.createElement('canvas')
  albedo.width = albedo.height = glow.width = glow.height = size
  const a = albedo.getContext('2d')!
  const g = glow.getContext('2d')!

  a.fillStyle = '#ffffff'
  a.fillRect(0, 0, size, size)
  g.fillStyle = '#000000'
  g.fillRect(0, 0, size, size)

  const rng = createRng(9000 + variant)
  const pad = 7
  for (let y = 0; y < CELLS; y++) {
    for (let x = 0; x < CELLS; x++) {
      const px = x * PX + pad
      const py = y * PX + pad - 1
      const w = PX - pad * 2
      const h = PX - pad * 2 + 3
      const lit = rng.chance(litRatio)
      a.fillStyle = lit ? '#d9d4c4' : '#3a4152'
      a.fillRect(px, py, w, h)
      if (lit) {
        const v = Math.floor(rng.range(170, 255))
        g.fillStyle = `rgb(${v},${v},${v})`
        g.fillRect(px, py, w, h)
      }
    }
  }

  const make = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.anisotropy = 4
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    return t
  }
  return { map: make(albedo, true), emissive: make(glow, false) }
}

export function getFacade(variant: number, litRatio = 0.45): FacadeTextures {
  const key = `${variant % 4}:${litRatio}`
  let tex = cache.get(key)
  if (!tex) {
    tex = build(variant % 4, litRatio)
    cache.set(key, tex)
  }
  return tex
}

/** Clone a shared texture with a repeat that keeps windows ~3.4 units apart. */
export function repeated(tex: THREE.Texture, width: number, height: number, offset = 0) {
  const t = tex.clone()
  t.repeat.set(
    Math.max(1 / CELLS, Math.round(width / 2.6) / CELLS),
    Math.max(1 / CELLS, Math.round(height / 3.4) / CELLS),
  )
  t.offset.set(offset, 0)
  t.needsUpdate = true
  return t
}
