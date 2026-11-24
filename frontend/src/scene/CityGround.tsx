import { useMemo } from 'react'
import * as THREE from 'three'
import { inParcel, PLAN, roadClearance } from '../city/plan'
import { pointAt, right, type V2 } from '../city/geometry'
import { SIDEWALK, type Parcel, type RoadEdge } from '../city/planner'
import type { DistrictId } from '../data/types'
import { useGame } from '../game/store'
import { createRng, hashString } from '../lib/random'
import { useCity } from '../store/cityStore'
import { Instances, type Placement } from './Instances'
import { asphaltTexture, pavingTexture } from './terrain'

/* Geometry helpers ------------------------------------------------------ */

/** A flat ribbon following a polyline: UV u runs along the road, v across it. */
function ribbons(lines: { pts: V2[]; width: number; offset?: number }[], y: number, uvLen = 8) {
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  for (const { pts, width, offset = 0 } of lines) {
    if (pts.length < 2) continue
    const base = pos.length / 3
    let along = 0
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)]
      const b = pts[Math.min(pts.length - 1, i + 1)]
      const tx = b.x - a.x
      const tz = b.z - a.z
      const l = Math.hypot(tx, tz) || 1
      const n = right({ x: tx / l, z: tz / l })
      if (i > 0) along += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z)
      const cx = pts[i].x + n.x * offset
      const cz = pts[i].z + n.z * offset
      pos.push(cx - (n.x * width) / 2, y, cz - (n.z * width) / 2, cx + (n.x * width) / 2, y, cz + (n.z * width) / 2)
      uv.push(along / uvLen, 0, along / uvLen, 1)
      if (i > 0) {
        const k = base + (i - 1) * 2
        idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2)
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

function discs(items: { x: number; z: number; r: number }[], y: number) {
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  for (const d of items) {
    const base = pos.length / 3
    pos.push(d.x, y, d.z)
    uv.push(d.x / 8, d.z / 8)
    const n = 20
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2
      pos.push(d.x + Math.cos(a) * d.r, y, d.z + Math.sin(a) * d.r)
      uv.push((d.x + Math.cos(a) * d.r) / 8, (d.z + Math.sin(a) * d.r) / 8)
      if (i > 0) idx.push(base, base + i + 1, base + i)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** Points of an edge, trimmed back from both junctions by `trim` units. */
function trimmed(e: RoadEdge, trim: number): V2[] {
  if (e.length < trim * 2 + 1) return []
  return e.points.filter((_, i) => e.cum[i] > trim && e.cum[i] < e.length - trim)
}

const yaw = (t: V2) => Math.atan2(-t.z, t.x)

/* Layout ---------------------------------------------------------------- */

export function useOpenStage() {
  return useGame((s) => s.city?.openStage ?? 0)
}

export function CityGround() {
  const stage = useOpenStage()
  const night = useCity((s) => s.night)
  const shadows = useCity((s) => s.quality === 'high')

  const layout = useMemo(() => {
    const edges = PLAN.edges.filter((e) => e.stage <= stage)
    const nodeIds = new Set<number>()
    edges.forEach((e) => (nodeIds.add(e.a), nodeIds.add(e.b)))
    const nodes = PLAN.nodes.filter((n) => nodeIds.has(n.id))
    const visibleEdge = (eid: number) => PLAN.edges[eid].stage <= stage
    const junctionR = (n: (typeof nodes)[number]) => Math.max(...n.edges.filter(visibleEdge).map((e) => PLAN.edges[e].width)) / 2 + 0.4

    const sidewalk = ribbons(edges.map((e) => ({ pts: e.points, width: e.width + SIDEWALK * 2 })), 0.05)
    const asphalt = ribbons(edges.map((e) => ({ pts: e.points, width: e.width })), 0.07)
    const kerbDiscs = discs(nodes.map((n) => ({ x: n.x, z: n.z, r: junctionR(n) + SIDEWALK })), 0.052)
    const junctions = discs(nodes.map((n) => ({ x: n.x, z: n.z, r: junctionR(n) })), 0.074)

    // Markings: double centre line + dashed lanes on main roads, dashed centre on secondary roads.
    const solid: { pts: V2[]; width: number; offset: number }[] = []
    const dashes: Placement[] = []
    const zebra: Placement[] = []
    const trunks: Placement[] = []
    const crowns: Placement[] = []
    const posts: Placement[] = []
    const lampHeads: Placement[] = []
    const rng = createRng(77 + stage)
    for (const e of edges) {
      const trim = 9
      if (e.kind === 'arterial') {
        const pts = trimmed(e, trim)
        if (pts.length > 1) solid.push({ pts, width: 0.14, offset: 0.18 }, { pts, width: 0.14, offset: -0.18 })
      }
      if (e.kind === 'arterial' || e.kind === 'secondary') {
        const lanes = e.kind === 'arterial' ? [2.5, -2.5] : [0]
        for (let s = trim; s < e.length - trim; s += 4) {
          const { p, t } = pointAt(e.points, e.cum, s)
          const n = right(t)
          for (const off of lanes) dashes.push({ p: [p.x + n.x * off, 0.085, p.z + n.z * off], s: [1.8, 0.02, 0.14], r: yaw(t) })
        }
      }
      // Zebra crossings before busy junctions.
      for (const [end, node] of [
        [0, PLAN.nodes[e.a]],
        [1, PLAN.nodes[e.b]],
      ] as const) {
        if (node.edges.filter(visibleEdge).length < 3 || e.kind === 'ring') continue
        const at = end === 0 ? junctionR(node) + 1.6 : e.length - junctionR(node) - 1.6
        if (at < 2 || at > e.length - 2) continue
        const { p, t } = pointAt(e.points, e.cum, at)
        const n = right(t)
        for (let k = -e.width / 2 + 0.6; k <= e.width / 2 - 0.6; k += 0.9)
          zebra.push({ p: [p.x + n.x * k, 0.086, p.z + n.z * k], s: [2.2, 0.02, 0.45], r: yaw(t) })
      }
      // Street trees and lamps on the outer edge of the sidewalks.
      for (const side of [1, -1]) {
        for (let s = 10; s < e.length - 10; s += rng.range(8, 11)) {
          const { p, t } = pointAt(e.points, e.cum, s)
          const n = right(t)
          const off = e.width / 2 + SIDEWALK - 0.45
          const q = { x: p.x + n.x * off * side, z: p.z + n.z * off * side }
          if (roadClearance(q) < SIDEWALK - 0.6) continue
          if (e.kind === 'ring') continue
          if (rng.chance(e.kind === 'local' ? 0.7 : 0.85)) {
            const sc = rng.range(0.85, 1.15)
            trunks.push({ p: [q.x, 0.9 * sc, q.z], s: [sc, sc, sc] })
            crowns.push({ p: [q.x, 2.55 * sc, q.z], s: [sc, sc * 1.1, sc], r: rng.range(0, 6), c: rng.pick(['#4f8a3c', '#5e9a46', '#3f7a35', '#6aa24f', '#77a845']) })
          }
        }
        for (let s = 14; s < e.length - 10; s += 26) {
          const { p, t } = pointAt(e.points, e.cum, s + (side > 0 ? 0 : 13))
          const n = right(t)
          const off = e.width / 2 + 0.35
          const q = { x: p.x + n.x * off * side, z: p.z + n.z * off * side }
          posts.push({ p: [q.x, 2.2, q.z] })
          lampHeads.push({ p: [q.x - n.x * side * 0.9, 4.25, q.z - n.z * side * 0.9], r: yaw(t) })
        }
      }
    }
    const markings = ribbons(solid, 0.085)
    const paths = ribbons(PLAN.paths.map((pts) => ({ pts, width: 1.7 })), 0.04, 3)

    const lawn: Placement[] = []
    for (const t of PLAN.lawnTrees) {
      if (roadClearance(t) < 2.5) continue
      lawn.push({ p: [t.x, 0, t.z], s: [t.s, t.s, t.s], r: hashString(`${t.x}`) % 6, c: t.conifer ? '#2f5d36' : '#5e9a46' })
    }
    return { sidewalk, asphalt, kerbDiscs, junctions, markings, dashes, zebra, trunks, crowns, posts, lampHeads, paths, lawn }
  }, [stage])

  const tex = useMemo(() => {
    const a = asphaltTexture().clone()
    a.needsUpdate = true
    a.repeat.set(1, 0.5)
    const p = pavingTexture().clone()
    p.needsUpdate = true
    p.repeat.set(1, 0.4)
    return { asphalt: a, paving: p }
  }, [])

  const asphaltColor = night ? '#3a3d42' : '#8a8e94'
  const pavingColor = night ? '#55555a' : '#d8d5cd'
  return (
    <group>
      <mesh geometry={layout.sidewalk} receiveShadow={shadows}>
        <meshStandardMaterial map={tex.paving} color={pavingColor} roughness={0.9} />
      </mesh>
      <mesh geometry={layout.kerbDiscs} receiveShadow={shadows}>
        <meshStandardMaterial color={pavingColor} roughness={0.9} />
      </mesh>
      <mesh geometry={layout.asphalt} receiveShadow={shadows}>
        <meshStandardMaterial map={tex.asphalt} color={asphaltColor} roughness={0.95} />
      </mesh>
      <mesh geometry={layout.junctions} receiveShadow={shadows}>
        <meshStandardMaterial map={tex.asphalt} color={asphaltColor} roughness={0.95} />
      </mesh>
      <mesh geometry={layout.markings}>
        <meshStandardMaterial color={night ? '#8a8a80' : '#f4f1e8'} roughness={0.7} />
      </mesh>
      <mesh geometry={layout.paths} receiveShadow={shadows}>
        <meshStandardMaterial color={night ? '#4a463c' : '#d9cdb4'} roughness={1} />
      </mesh>
      <Instances items={layout.dashes}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={night ? '#8a8a80' : '#f4f1e8'} roughness={0.7} />
      </Instances>
      <Instances items={layout.zebra}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={night ? '#8a8a80' : '#f4f1e8'} roughness={0.7} />
      </Instances>
      <Instances items={layout.trunks}>
        <cylinderGeometry args={[0.1, 0.15, 1.8, 6]} />
        <meshStandardMaterial color="#6b4a2f" />
      </Instances>
      <Instances items={layout.crowns} castShadow={shadows}>
        <icosahedronGeometry args={[1.0, 1]} />
        <meshStandardMaterial color={night ? '#55605a' : '#ffffff'} roughness={0.9} flatShading />
      </Instances>
      <Instances items={layout.posts} castShadow={shadows}>
        <cylinderGeometry args={[0.06, 0.09, 4.4, 8]} />
        <meshStandardMaterial color="#353a40" metalness={0.6} roughness={0.45} />
      </Instances>
      <Instances items={layout.lampHeads}>
        <boxGeometry args={[0.5, 0.12, 0.28]} />
        <meshStandardMaterial color="#e9e4d8" emissive="#ffcf8a" emissiveIntensity={night ? 5 : 0} />
      </Instances>
      <LawnTrees items={layout.lawn} shadows={shadows} night={night} />
      <Roundabouts night={night} />
      <ParcelGrounds stage={stage} night={night} shadows={shadows} />
    </group>
  )
}

function LawnTrees({ items, shadows, night }: { items: Placement[]; shadows: boolean; night: boolean }) {
  const trunks = useMemo(() => items.map((t) => ({ p: [t.p[0], 0.9 * (t.s?.[0] ?? 1), t.p[2]] as [number, number, number], s: t.s })), [items])
  const crowns = useMemo(() => items.map((t) => ({ ...t, p: [t.p[0], 2.6 * (t.s?.[0] ?? 1), t.p[2]] as [number, number, number] })), [items])
  return (
    <>
      <Instances items={trunks}>
        <cylinderGeometry args={[0.12, 0.17, 1.8, 6]} />
        <meshStandardMaterial color="#5e4330" />
      </Instances>
      <Instances items={crowns} castShadow={shadows}>
        <icosahedronGeometry args={[1.15, 1]} />
        <meshStandardMaterial color={night ? '#55605a' : '#ffffff'} roughness={0.95} flatShading />
      </Instances>
    </>
  )
}

function Roundabouts({ night }: { night: boolean }) {
  return (
    <>
      {PLAN.roundabouts.map((r, i) => (
        <group key={i} position={[r.c.x, 0, r.c.z]}>
          <mesh position={[0, 0.12, 0]} receiveShadow>
            <cylinderGeometry args={[r.r - 3.9, r.r - 3.6, 0.24, 40]} />
            <meshStandardMaterial color="#cfcac0" />
          </mesh>
          <mesh position={[0, 0.25, 0]}>
            <cylinderGeometry args={[r.r - 4.3, r.r - 4.3, 0.05, 40]} />
            <meshStandardMaterial color={night ? '#2c3a2a' : '#6fa452'} />
          </mesh>
          {/* fountain monument in the middle */}
          <mesh position={[0, 0.5, 0]} castShadow>
            <cylinderGeometry args={[2.2, 2.4, 0.5, 28]} />
            <meshStandardMaterial color="#c9c3b8" />
          </mesh>
          <mesh position={[0, 0.76, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[1.95, 28]} />
            <meshStandardMaterial color="#5d9ec4" roughness={0.1} metalness={0.2} />
          </mesh>
          <mesh position={[0, 2.2, 0]} castShadow>
            <cylinderGeometry args={[0.25, 0.45, 3, 12]} />
            <meshStandardMaterial color="#b8b0a2" />
          </mesh>
          <mesh position={[0, 3.9, 0]} castShadow>
            <sphereGeometry args={[0.55, 16, 16]} />
            <meshStandardMaterial color="#c9a227" metalness={0.8} roughness={0.3} />
          </mesh>
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <mesh key={k} position={[Math.cos((k / 6) * Math.PI * 2) * (r.r - 5.6), 1.3, Math.sin((k / 6) * Math.PI * 2) * (r.r - 5.6)]} castShadow>
              <icosahedronGeometry args={[0.8, 1]} />
              <meshStandardMaterial color="#5e9a46" flatShading />
            </mesh>
          ))}
        </group>
      ))}
    </>
  )
}

/* Parcel grounds: yards, lawns, squares and gardens ---------------------- */

const ZONE_GROUND = {
  residential: { day: '#93bd6e', night: '#2c3a2a' },
  downtown: { day: '#d9d3c6', night: '#3a3936' },
  industrial: { day: '#bdb7ab', night: '#363330' },
}

function ParcelGrounds({ stage, night, shadows }: { stage: number; night: boolean; shadows: boolean }) {
  const objects = useGame((s) => s.objects)
  const { yards, greens } = useMemo(() => {
    const used = new Set(objects.map((o) => o.parcel).filter(Boolean) as string[])
    const yards: Record<DistrictId, Placement[]> = { residential: [], downtown: [], industrial: [] }
    const greens: Parcel[] = []
    for (const p of PLAN.parcels) {
      if (p.stage > stage) continue
      if (p.use === 'green') {
        greens.push(p)
        continue
      }
      if (!used.has(p.id) || p.use !== 'building') continue
      yards[p.zone].push({ p: [p.c.x, 0.06, p.c.z], s: [p.w - 0.3, 0.1, p.d - 0.3], r: p.rot })
    }
    return { yards, greens }
  }, [objects, stage])
  return (
    <>
      {(Object.keys(yards) as DistrictId[]).map((z) =>
        yards[z].length ? (
          <Instances key={z} items={yards[z]} receiveShadow={shadows}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={ZONE_GROUND[z][night ? 'night' : 'day']} roughness={1} />
          </Instances>
        ) : null,
      )}
      {greens.map((p) => (
        <GreenParcel key={p.id} p={p} night={night} shadows={shadows} />
      ))}
    </>
  )
}

function GreenParcel({ p, night, shadows }: { p: Parcel; night: boolean; shadows: boolean }) {
  const square = p.green === 'square'
  const trees = useMemo(() => {
    const rng = createRng(hashString(p.id))
    const out: [number, number, number][] = []
    for (let i = 0; i < Math.round((p.w * p.d) / 28); i++) {
      const x = rng.range(-p.w / 2 + 1.2, p.w / 2 - 1.2)
      const z = rng.range(-p.d / 2 + 1.2, p.d / 2 - 1.2)
      if (Math.abs(x) < 1.6 || Math.abs(z) < 1.6) continue
      out.push([x, z, rng.range(0.8, 1.2)])
    }
    return out
  }, [p])
  return (
    <group position={[p.c.x, 0, p.c.z]} rotation={[0, p.rot, 0]}>
      <mesh position={[0, 0.07, 0]} receiveShadow={shadows}>
        <boxGeometry args={[p.w - 0.3, 0.12, p.d - 0.3]} />
        <meshStandardMaterial color={square ? (night ? '#4a4a48' : '#d6cfc2') : night ? '#2c3a2a' : '#7fb35a'} roughness={1} />
      </mesh>
      {/* cross paths */}
      <mesh position={[0, 0.135, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.6, p.d - 0.4]} />
        <meshStandardMaterial color={night ? '#4a463c' : '#d9cdb4'} />
      </mesh>
      <mesh position={[0, 0.135, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[p.w - 0.4, 1.6]} />
        <meshStandardMaterial color={night ? '#4a463c' : '#d9cdb4'} />
      </mesh>
      {square ? (
        <group position={[0, 0.13, 0]}>
          <mesh position={[0, 0.25, 0]} castShadow={shadows}>
            <cylinderGeometry args={[1.6, 1.7, 0.5, 24]} />
            <meshStandardMaterial color="#c9c3b8" />
          </mesh>
          <mesh position={[0, 0.51, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[1.4, 24]} />
            <meshStandardMaterial color="#5d9ec4" roughness={0.1} metalness={0.2} />
          </mesh>
          {[-1, 1].map((sx) => (
            <mesh key={sx} position={[sx * 2.8, 0.25, 1.2]}>
              <boxGeometry args={[1.4, 0.12, 0.45]} />
              <meshStandardMaterial color="#7a5636" />
            </mesh>
          ))}
        </group>
      ) : (
        <group position={[-p.w / 4, 0.13, -p.d / 4]}>
          {/* playground */}
          <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[2.2, 24]} />
            <meshStandardMaterial color="#d97a3a" roughness={1} />
          </mesh>
          <mesh position={[0, 1.1, 0]} castShadow={shadows}>
            <boxGeometry args={[1.6, 0.12, 1.6]} />
            <meshStandardMaterial color="#2f63c9" />
          </mesh>
          {[
            [-0.7, -0.7],
            [0.7, -0.7],
            [-0.7, 0.7],
            [0.7, 0.7],
          ].map(([x, z], i) => (
            <mesh key={i} position={[x, 0.55, z]}>
              <cylinderGeometry args={[0.06, 0.06, 1.1, 6]} />
              <meshStandardMaterial color="#e0a526" />
            </mesh>
          ))}
          <mesh position={[1.3, 0.6, 0]} rotation={[0, 0, -0.6]}>
            <boxGeometry args={[1.8, 0.08, 0.6]} />
            <meshStandardMaterial color="#d32f2f" />
          </mesh>
        </group>
      )}
      {trees.map(([x, z, s], i) => (
        <group key={i} position={[x, 0.13, z]} scale={s}>
          <mesh position={[0, 0.8, 0]}>
            <cylinderGeometry args={[0.1, 0.15, 1.6, 6]} />
            <meshStandardMaterial color="#6b4a2f" />
          </mesh>
          <mesh position={[0, 2.2, 0]} castShadow={shadows}>
            <icosahedronGeometry args={[1.0, 1]} />
            <meshStandardMaterial color={night ? '#3c5240' : '#5e9a46'} flatShading />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** Utility for other modules: a point on the sidewalk of an edge. */
export function sidewalkPoint(e: RoadEdge, s: number, side: 1 | -1) {
  const { p, t } = pointAt(e.points, e.cum, s)
  const n = right(t)
  const off = (e.width / 2 + SIDEWALK * 0.5) * side
  return { x: p.x + n.x * off, z: p.z + n.z * off, t }
}

export { inParcel }
