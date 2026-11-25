import * as THREE from 'three'
import { createRng } from '../lib/random'

/** World layout outside the districts: island outline, the river, the edges of the built-up area. */

export const CITY_WEST = -116
export const CITY_EAST = 116
/** The land around the city. It runs past the fog, so no edge or water is ever in view. */
export const LAND = { west: -420, east: 420, north: -320, south: 320 }
export const ISLAND = { west: -260, east: 260, north: -170, south: 170 }

/** Everything inside the land counts as land: there is no water. */
export function onLand(x: number, z: number, margin = 0) {
  return x > LAND.west + margin && x < LAND.east - margin && z > LAND.north + margin && z < LAND.south - margin
}

/** The built-up city and its edge streets: where nature must not grow. */
export function inCity(x: number, z: number, margin = 0) {
  return x > CITY_WEST - 2 - margin && x < CITY_EAST + 2 + margin && Math.abs(z) < 42.5 + margin
}

/** Canvas textures (generated once). */
function noiseCanvas(size: number, paint: (ctx: CanvasRenderingContext2D, rng: ReturnType<typeof createRng>) => void, seed: number) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  paint(ctx, createRng(seed))
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 8
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

let grassTex: THREE.Texture | null = null
export function grassTexture() {
  if (grassTex) return grassTex
  grassTex = noiseCanvas(
    512,
    (ctx, rng) => {
      ctx.fillStyle = '#7da35a'
      ctx.fillRect(0, 0, 512, 512)
      for (let i = 0; i < 260; i++) {
        const g = ctx.createRadialGradient(rng.range(0, 512), rng.range(0, 512), 0, rng.range(0, 512), rng.range(0, 512), rng.range(30, 110))
        const c = rng.pick(['rgba(96,140,64,0.35)', 'rgba(140,165,84,0.3)', 'rgba(80,120,58,0.3)', 'rgba(160,160,96,0.22)'])
        g.addColorStop(0, c)
        g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, 512, 512)
      }
      for (let i = 0; i < 18000; i++) {
        ctx.fillStyle = rng.pick(['#6c9a4c', '#8db466', '#5d8a43', '#9bbd70', '#76a052'])
        ctx.fillRect(rng.range(0, 512), rng.range(0, 512), 1.4, rng.range(1.5, 3.5))
      }
    },
    11,
  )
  grassTex.repeat.set(26, 15)
  return grassTex
}

let asphaltTex: THREE.Texture | null = null
export function asphaltTexture() {
  if (asphaltTex) return asphaltTex
  asphaltTex = noiseCanvas(
    256,
    (ctx, rng) => {
      ctx.fillStyle = '#6a6e74'
      ctx.fillRect(0, 0, 256, 256)
      for (let i = 0; i < 9000; i++) {
        const v = Math.floor(rng.range(70, 140))
        ctx.fillStyle = `rgba(${v},${v},${v + 4},0.5)`
        ctx.fillRect(rng.range(0, 256), rng.range(0, 256), 1.2, 1.2)
      }
      for (let i = 0; i < 14; i++) {
        ctx.strokeStyle = 'rgba(40,42,46,0.25)'
        ctx.lineWidth = rng.range(1, 3)
        ctx.beginPath()
        ctx.moveTo(rng.range(0, 256), rng.range(0, 256))
        ctx.lineTo(rng.range(0, 256), rng.range(0, 256))
        ctx.stroke()
      }
    },
    21,
  )
  return asphaltTex
}

let paveTex: THREE.Texture | null = null
export function pavingTexture() {
  if (paveTex) return paveTex
  paveTex = noiseCanvas(
    256,
    (ctx, rng) => {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, 256, 256)
      for (let y = 0; y < 256; y += 16) {
        for (let x = (y / 16) % 2 ? 8 : 0; x < 256; x += 32) {
          const v = Math.floor(rng.range(205, 245))
          ctx.fillStyle = `rgb(${v},${v - 3},${v - 8})`
          ctx.fillRect(x + 1, y + 1, 30, 14)
        }
      }
    },
    31,
  )
  paveTex.repeat.set(2, 2)
  return paveTex
}

/** Animated normal map for water. */
let waterNormal: THREE.Texture | null = null
export function waterNormalTexture() {
  if (waterNormal) return waterNormal
  const size = 256
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  const img = ctx.createImageData(size, size)
  const h = (x: number, y: number) => {
    const u = (x / size) * Math.PI * 2
    const v = (y / size) * Math.PI * 2
    return (
      Math.sin(u * 3 + Math.sin(v * 2) * 1.5) * 0.5 +
      Math.sin(v * 5 + u * 2) * 0.3 +
      Math.sin(u * 9 - v * 7) * 0.12 +
      Math.sin(u * 13 + v * 11) * 0.08
    )
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = h(x + 1, y) - h(x - 1, y)
      const dy = h(x, y + 1) - h(x, y - 1)
      const n = new THREE.Vector3(-dx * 2.2, -dy * 2.2, 1).normalize()
      const i = (y * size + x) * 4
      img.data[i] = (n.x * 0.5 + 0.5) * 255
      img.data[i + 1] = (n.y * 0.5 + 0.5) * 255
      img.data[i + 2] = (n.z * 0.5 + 0.5) * 255
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  waterNormal = new THREE.CanvasTexture(c)
  waterNormal.wrapS = waterNormal.wrapT = THREE.RepeatWrapping
  return waterNormal
}
