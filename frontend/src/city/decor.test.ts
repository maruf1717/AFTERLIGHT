import { describe, expect, it } from 'vitest'
import { inBuildingPlot, lawnDecor, streetDecor } from './decor'

describe('V3 + V4: decor stays off the plots', () => {
  for (const stage of [0, 1, 2, 3]) {
    it(`no tree or lamp inside a plot (stage ${stage})`, () => {
      const { trees, lamps } = streetDecor(stage)
      expect(trees.length).toBeGreaterThan(20)
      expect(lamps.length).toBeGreaterThan(5)
      for (const t of trees) expect(inBuildingPlot(t, 1)).toBe(false)
      for (const l of lamps) expect(inBuildingPlot(l, 1)).toBe(false)
    })
  }
  it('no lawn tree inside a plot', () => {
    for (const t of lawnDecor()) expect(inBuildingPlot(t, 1)).toBe(false)
  })
})
