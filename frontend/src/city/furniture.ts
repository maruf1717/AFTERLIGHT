import { right } from './geometry'
import { inBuildingPlot } from './decor'
import { PLAN, roadOpen } from './plan'
import { driveRange, laneOffset, lanePoint, SIGNALS } from './traffic'

/*
 * Street furniture next to the roads: traffic light heads and road signs. Like trees and lamps
 * (city/decor.ts), none of it stands inside a building plot or closer than a metre to one
 * (round 2, 5.5).
 */

const RANK: Record<string, number> = { arterial: 3, ring: 3, secondary: 2, local: 1 }

export function lightSpots(stage: number) {
  const out: { node: number; edge: number; x: number; z: number; yaw: number }[] = []
  for (const sig of SIGNALS.values()) {
    for (const k of Object.keys(sig.group)) {
      const eid = Number(k)
      if (!roadOpen(eid, stage)) continue
      const e = PLAN.edges[eid]
      // The direction that drives towards this junction.
      const dir: 1 | -1 = e.b === sig.node ? 1 : -1
      if (e.oneway && dir === -1) continue
      const r = driveRange(eid, dir)
      const { p, d } = lanePoint(eid, dir, r.end - 1.5)
      const n = right(d)
      const off = e.width / 2 - laneOffset(eid) + 0.5
      const spot = { node: sig.node, edge: eid, x: p.x + n.x * off, z: p.z + n.z * off, yaw: Math.atan2(-d.z, d.x) }
      if (inBuildingPlot(spot, 1)) continue
      out.push(spot)
    }
  }
  return out
}

export function signSpots() {
  const giveWay: { x: number; z: number; yaw: number }[] = []
  const crossing: { x: number; z: number; yaw: number }[] = []
  for (const n of PLAN.nodes) {
    if (n.edges.length < 3 || SIGNALS.has(n.id)) continue
    const kinds = n.edges.map((e) => PLAN.edges[e].kind)
    if (kinds.includes('ring')) continue
    const top = Math.max(...kinds.map((k) => RANK[k]))
    for (const eid of n.edges) {
      const e = PLAN.edges[eid]
      const dir: 1 | -1 = e.b === n.id ? 1 : -1
      if (e.oneway && dir === -1) continue
      const r = driveRange(eid, dir)
      if (r.end - r.start < 8) continue
      const minor = RANK[e.kind] < top
      // The sign stands on the kerb at the right, a little before the stop line or the zebra.
      const at = minor ? r.end - 1.2 : r.end - 4.5
      const { p, d } = lanePoint(eid, dir, at)
      const nrm = right(d)
      const off = e.width / 2 - laneOffset(eid) + 0.45
      const spot = { x: p.x + nrm.x * off, z: p.z + nrm.z * off, yaw: Math.atan2(-d.x, -d.z) }
      if (inBuildingPlot(spot, 1)) continue
      if (minor) giveWay.push(spot)
      else crossing.push(spot)
    }
  }
  return { giveWay, crossing }
}
