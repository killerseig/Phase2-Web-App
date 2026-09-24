import { describe, expect, it } from 'vitest'
import { defaultGrid, resizeDirections } from './grid'
import { normalizeRotation, pointerRotation, resizeRotated } from './transform'

describe('canvas transforms', () => {
  const origin = { x: 20, y: 20, w: 8, h: 6, z: 2 }
  function point(layout: typeof origin, x: number, y: number, degrees: number) {
    const angle = (degrees * Math.PI) / 180
    const dx = (x * layout.w * 45) / 2,
      dy = (y * layout.h * 32) / 2
    return {
      x: (layout.x + layout.w / 2) * 45 + Math.cos(angle) * dx - Math.sin(angle) * dy,
      y: (layout.y + layout.h / 2) * 32 + Math.sin(angle) * dx + Math.cos(angle) * dy,
    }
  }
  it('rotates continuously across the angle seam and snaps to 15-degree steps', () => {
    expect(pointerRotation(10, (179 * Math.PI) / 180, (-179 * Math.PI) / 180, false)).toBe(12)
    expect(pointerRotation(0, 0, 0.7, true)).toBe(45)
    expect(normalizeRotation(370)).toBe(10)
    expect(normalizeRotation(-190)).toBe(170)
  })
  it('keeps the opposite corner or edge fixed for every rotated resize handle', () => {
    for (const rotation of [-120, -30, 45, 90])
      for (const direction of resizeDirections) {
        const x = direction.includes('left') ? 1 : direction.includes('right') ? -1 : 0
        const y = direction.includes('top') ? 1 : direction.includes('bottom') ? -1 : 0
        const resized = resizeRotated(origin, 3, 2, direction, defaultGrid(), rotation)
        const before = point(origin, x, y, rotation),
          after = point(resized, x, y, rotation)
        expect(after.x).toBeCloseTo(before.x, 1)
        expect(after.y).toBeCloseTo(before.y, 1)
        expect(resized.z).toBe(2)
      }
  })
  it('resizes along local axes and respects finite canvas and minimum size bounds', () => {
    const right = resizeRotated(origin, 0, 45 / 32, 'right', defaultGrid(), 90)
    expect(right.w).toBe(9)
    expect(right.h).toBe(6)
    for (const rotation of [-180, -75, 30, 90, 170])
      for (const direction of resizeDirections) {
        const result = resizeRotated(
          { ...origin, x: 0, y: 0 },
          20000,
          -20000,
          direction,
          defaultGrid(),
          rotation,
        )
        expect(result.x).toBeGreaterThanOrEqual(0)
        expect(result.y).toBeGreaterThanOrEqual(0)
        expect(result.w).toBeGreaterThanOrEqual(1)
        expect(result.h).toBeGreaterThanOrEqual(1)
        expect(result.x + result.w).toBeLessThanOrEqual(1000)
        expect(result.y + result.h).toBeLessThanOrEqual(10000)
      }
  })
})
