import { expect, test } from 'vitest'
import { PLAN } from './plan'
import { BUILDINGS } from '../data/city'
import { hashString } from '../lib/random'

/**
 * Every device must build exactly the same city: parcel ids go into the shared ledger.
 * These hashes were checked to match in V8 (Chrome, Android) and JavaScriptCore (Safari, iPhone).
 */

/**
 * THE MAP IS FROZEN. Streets and parcels (ids, positions, sizes) must never change: players'
 * purchases are stored by parcel id, and a different layout silently takes their buildings
 * away. If the layout really has to change, ship a migration of old parcel ids in the same
 * commit (see docs/DECISIONS.md, «Карта заморожена»), then update this hash.
 */
test('the street network and parcels never change', () => {
  const geometry = {
    edges: PLAN.edges.map((e) => [e.id, e.a, e.b, e.kind, e.points.length]),
    parcels: PLAN.parcels.map((p) => [p.id, p.zone, p.edge, +p.c.x.toFixed(3), +p.c.z.toFixed(3), +p.w.toFixed(3), +p.d.toFixed(3), +p.rot.toFixed(4)]),
  }
  expect(hashString(JSON.stringify(geometry))).toBe(GEOMETRY_HASH)
})

/** Uses and buildings may change on purpose (update this hash then), but must be the same everywhere. */
test('the city plan is the same everywhere', () => {
  expect(hashString(JSON.stringify(PLAN))).toBe(2688385870)
  expect(hashString(JSON.stringify(BUILDINGS))).toBe(2135143489)
})

const GEOMETRY_HASH = 3535178620
