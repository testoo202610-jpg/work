import { describe, expect, it } from 'vitest'
import { isoDepth, isoDiamond, isoToWorld, worldToIso } from './isometric'

describe('isometric projection', () => {
  it.each([{ x: 0, y: 0 }, { x: 300, y: 560 }, { x: 1660, y: 520 }, { x: 1990, y: 1100 }])('round trips $x,$y', (point) => {
    const screen = worldToIso(point)
    const result = isoToWorld(screen)
    expect(result.x).toBeCloseTo(point.x, 6)
    expect(result.y).toBeCloseTo(point.y, 6)
  })
  it('orders depth by world south-east position', () => {
    expect(isoDepth({ x: 100, y: 200 })).toBeLessThan(isoDepth({ x: 200, y: 300 }))
  })
  it('creates a four-corner diamond', () => {
    expect(isoDiamond({ x: 10, y: 10 })).toHaveLength(4)
  })
})
