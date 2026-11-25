import { describe, expect, it } from 'vitest'
import { inBuildingPlot } from './decor'
import { lightSpots, signSpots } from './furniture'
import { BUS_STOPS } from './transit'

describe('round 2, 5.5: street furniture stays off the plots', () => {
  it('bus stops (the whole shelter) are at least a metre from any plot', () => {
    expect(BUS_STOPS.length).toBeGreaterThan(5)
    for (const st of BUS_STOPS) {
      const along = { x: -st.face.z, z: st.face.x }
      for (const k of [-2, 0, 2]) expect(inBuildingPlot({ x: st.at.x + along.x * k, z: st.at.z + along.z * k }, 1)).toBe(false)
    }
  })
  it('road signs and traffic lights too', () => {
    const { giveWay, crossing } = signSpots()
    expect(giveWay.length + crossing.length).toBeGreaterThan(10)
    for (const s of [...giveWay, ...crossing]) expect(inBuildingPlot(s, 1)).toBe(false)
    const lights = lightSpots(0)
    expect(lights.length).toBeGreaterThan(10)
    for (const l of lights) expect(inBuildingPlot(l, 1)).toBe(false)
  })
})
