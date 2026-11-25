import { expect, test } from 'vitest'
import * as dm from './dmath'
test('dmath matches Math closely', () => {
  let worst = 0
  for (let i = 0; i < 20000; i++) {
    const x = (i - 10000) * 0.0137
    worst = Math.max(worst, Math.abs(dm.sin(x) - Math.sin(x)), Math.abs(dm.cos(x) - Math.cos(x)), Math.abs(dm.atan(x) - Math.atan(x)))
    const y = ((i * 7919) % 2000) / 100 - 10
    worst = Math.max(worst, Math.abs(dm.atan2(y, x) - Math.atan2(y, x)))
  }
  expect(worst).toBeLessThan(1e-12)
  expect(dm.atan2(0, -1)).toBeCloseTo(Math.PI, 15)
  expect(dm.atan2(-0.0001, -1)).toBeCloseTo(Math.atan2(-0.0001, -1), 14)
})
