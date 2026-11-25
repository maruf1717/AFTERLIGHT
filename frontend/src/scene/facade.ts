import * as THREE from 'three'
import { createRng } from '../lib/random'

/**
 * Procedural facade textures, drawn once on a canvas and shared by all buildings.
 * Each style has an albedo map (multiplied by the wall colour) and an emissive map
 * (only the windows that are lit at night). Buildings clone them to set their own repeat.
 */

export type FacadeStyle = 'glass' | 'punched' | 'strip' | 'shopfront'

const CELLS = 8
const PX = 48
const SIZE = CELLS * PX

/** How many world units one texture cell covers, per style. */
export const CELL_SIZE: Record<FacadeStyle, [number, number]> = {
  glass: [2.2, 3.4],
  punched: [2.6, 3.2],
  strip: [4, 4.5],
  shopfront: [3, 4],
}

interface Facade {
  map: THREE.CanvasTexture
  emissive: THREE.CanvasTexture
}

const cache = new Map<string, Facade>()

function canvasPair() {
  const a = document.createElement('canvas')
  const g = document.createElement('canvas')
  a.width = a.height = g.width = g.height = SIZE
  return [a, g, a.getContext('2d', { willReadFrequently: true })!, g.getContext('2d', { willReadFrequently: true })!] as const
}

function glassGradient(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, top: string, bottom: string) {
  const gr = ctx.createLinearGradient(x, y, x, y + h)
  gr.addColorStop(0, top)
  gr.addColorStop(1, bottom)
  return gr
}

function draw(style: FacadeStyle, variant: number, lit: number) {
  const [albedo, glow, a, g] = canvasPair()
  const rng = createRng(4200 + variant * 31 + style.length)
  g.fillStyle = '#000'
  g.fillRect(0, 0, SIZE, SIZE)

  if (style === 'glass') {
    // Curtain wall: big panes, thin mullions, a darker spandrel band at each floor.
    a.fillStyle = '#ffffff'
    a.fillRect(0, 0, SIZE, SIZE)
    for (let y = 0; y < CELLS; y++) {
      for (let x = 0; x < CELLS; x++) {
        const px = x * PX + 3
        const py = y * PX + 3
        const w = PX - 6
        const h = PX - 14
        const tone = rng.range(-12, 12)
        a.fillStyle = glassGradient(a, px, py, h, `rgb(${214 + tone},${228 + tone},${240 + tone})`, `rgb(${128 + tone},${152 + tone},${178 + tone})`)
        a.fillRect(px, py, w, h)
        // sky reflection streak
        a.fillStyle = 'rgba(255,255,255,0.18)'
        a.beginPath()
        a.moveTo(px + w * 0.15, py)
        a.lineTo(px + w * 0.45, py)
        a.lineTo(px + w * 0.1, py + h)
        a.lineTo(px - w * 0.2, py + h)
        a.fill()
        if (rng.chance(lit)) {
          const v = Math.floor(rng.range(150, 255))
          g.fillStyle = `rgb(${v},${v},${v})`
          g.fillRect(px, py, w, h)
        }
      }
      a.fillStyle = 'rgba(40,50,64,0.22)'
      a.fillRect(0, y * PX + PX - 11, SIZE, 8)
    }
  } else if (style === 'punched') {
    // Masonry wall with framed windows and sills.
    a.fillStyle = '#ffffff'
    a.fillRect(0, 0, SIZE, SIZE)
    for (let i = 0; i < 900; i++) {
      a.fillStyle = `rgba(0,0,0,${rng.range(0.01, 0.045)})`
      a.fillRect(rng.range(0, SIZE), rng.range(0, SIZE), rng.range(2, 8), rng.range(1, 3))
    }
    for (let y = 0; y < CELLS; y++) {
      a.fillStyle = 'rgba(0,0,0,0.06)'
      a.fillRect(0, y * PX + PX - 3, SIZE, 3)
      for (let x = 0; x < CELLS; x++) {
        const px = x * PX + 12
        const py = y * PX + 9
        const w = PX - 24
        const h = PX - 20
        a.fillStyle = '#f4f1ea'
        a.fillRect(px - 3, py - 3, w + 6, h + 6)
        const curtains = rng.chance(0.35)
        a.fillStyle = glassGradient(a, px, py, h, curtains ? '#c9b8a0' : '#9fb6c9', curtains ? '#8d7a66' : '#4f6275')
        a.fillRect(px, py, w, h)
        a.fillStyle = '#f4f1ea'
        a.fillRect(px + w / 2 - 1, py, 2, h)
        a.fillRect(px - 5, py + h + 2, w + 10, 4)
        if (rng.chance(lit)) {
          const v = Math.floor(rng.range(170, 255))
          g.fillStyle = `rgb(${v},${v},${v})`
          g.fillRect(px, py, w / 2 - 1, h)
          g.fillRect(px + w / 2 + 1, py, w / 2 - 1, h)
        }
      }
    }
  } else if (style === 'strip') {
    // Corrugated metal siding with a high ribbon window per floor.
    a.fillStyle = '#ffffff'
    a.fillRect(0, 0, SIZE, SIZE)
    for (let x = 0; x < SIZE; x += 6) {
      a.fillStyle = 'rgba(0,0,0,0.08)'
      a.fillRect(x, 0, 2, SIZE)
    }
    for (let y = 0; y < CELLS; y++) {
      const py = y * PX + 6
      a.fillStyle = glassGradient(a, 0, py, 12, '#a9bccb', '#5e6f7d')
      a.fillRect(0, py, SIZE, 12)
      for (let x = 0; x < CELLS; x++) {
        a.fillStyle = 'rgba(60,60,60,0.6)'
        a.fillRect(x * PX, py, 3, 12)
        if (rng.chance(lit)) {
          g.fillStyle = '#d0d0d0'
          g.fillRect(x * PX + 3, py, PX - 3, 12)
        }
      }
      a.fillStyle = 'rgba(0,0,0,0.12)'
      a.fillRect(0, y * PX + PX - 2, SIZE, 2)
    }
  } else {
    // Shopfront: tall display windows with a door gap.
    a.fillStyle = '#ffffff'
    a.fillRect(0, 0, SIZE, SIZE)
    for (let y = 0; y < CELLS; y++) {
      for (let x = 0; x < CELLS; x++) {
        const px = x * PX + 4
        const py = y * PX + 8
        const w = PX - 8
        const h = PX - 12
        a.fillStyle = '#3a3a3a'
        a.fillRect(px - 2, py - 2, w + 4, h + 4)
        a.fillStyle = glassGradient(a, px, py, h, '#c7d6e2', '#6f8597')
        a.fillRect(px, py, w, h)
        if (rng.chance(Math.max(lit, 0.7))) {
          g.fillStyle = '#ffffff'
          g.fillRect(px, py, w, h)
        }
      }
    }
  }

  const make = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.anisotropy = 8
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    return t
  }
  return { map: make(albedo, true), emissive: make(glow, false) }
}

export function getFacade(style: FacadeStyle, variant: number, lit: number): Facade {
  const key = `${style}:${variant % 3}:${lit}`
  let f = cache.get(key)
  if (!f) {
    f = draw(style, variant % 3, lit)
    cache.set(key, f)
  }
  return f
}

/** Clone a shared texture with a repeat that keeps windows a realistic size on this face. */
export function repeated(tex: THREE.Texture, style: FacadeStyle, width: number, height: number, offset = 0) {
  const [cw, ch] = CELL_SIZE[style]
  const t = tex.clone()
  t.repeat.set(Math.max(1, Math.round(width / cw)) / CELLS, Math.max(1, Math.round(height / ch)) / CELLS)
  t.offset.set(offset, 0)
  t.needsUpdate = true
  return t
}

/**
 * Walls a little darker near the ground (round 2, 5.6): the economy graphics have no
 * shadows or ambient occlusion, and this one line of shader gives buildings their weight.
 */
export function shadeByHeight<T extends THREE.Material>(m: T, fullAt = 7): T {
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vWorldY;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorldY = (modelMatrix * vec4(transformed, 1.0)).y;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vWorldY;')
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>\ngl_FragColor.rgb *= mix(0.68, 1.0, smoothstep(0.0, ${fullAt.toFixed(1)}, vWorldY));`)
  }
  m.customProgramCacheKey = () => `shadeByHeight${fullAt}`
  return m
}
