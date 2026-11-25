import { expect, test } from 'vitest'
import { PLAN } from './plan'
import { BUILDINGS } from '../data/city'
import { hashString } from '../lib/random'

/**
 * Every device must build exactly the same city: parcel ids go into the shared ledger.
 * These hashes were checked to match in V8 (Chrome, Android) and JavaScriptCore (Safari, iPhone).
 * If you change the planner on purpose, update them, and remember old saves name old parcel ids.
 */
test('the city plan is the same everywhere', () => {
  expect(hashString(JSON.stringify(PLAN))).toBe(2688385870)
  expect(hashString(JSON.stringify(BUILDINGS))).toBe(2135143489)
})
