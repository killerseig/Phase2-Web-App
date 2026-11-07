import { describe, expect, it } from 'vitest'
import { keyboardGeometry, type KeyboardGeometryIntent } from './keyboardGeometry'

const original = [
  { x: 2.25, y: 3.125, w: 6, h: 8 },
  { x: 11.25, y: 4, w: 6, h: 8 },
]
const intent: KeyboardGeometryIntent = {
  key: 'ArrowRight',
  precise: false,
  action: 'move',
  surfaceWidth: 960,
  scale: 0.5,
  spacing: { x: 0.5, y: 2 },
}
describe('dashboard keyboard geometry', () => {
  it('adds configured spacing and preserves off-grid offsets and group gaps', () => {
    expect(keyboardGeometry(original, intent)).toEqual([
      { ...original[0], x: 2.75 },
      { ...original[1], x: 11.75 },
    ])
    expect(keyboardGeometry(original, { ...intent, key: 'ArrowDown' })[0]?.y).toBe(5.125)
  })
  it.each([
    { width: 960, scale: 0.5 },
    { width: 390, scale: 1 },
    { width: 227, scale: 0.3 },
  ])('moves one screen pixel at width $width and scale $scale', ({ width, scale }) => {
    const result = keyboardGeometry(original, {
      ...intent,
      precise: true,
      surfaceWidth: width,
      scale,
    })
    expect((((result[0]!.x - original[0]!.x) * width) / 24) * scale).toBeCloseTo(1, 4)
    expect(result[1]!.x - result[0]!.x).toBeCloseTo(9, 5)
    const vertical = keyboardGeometry(original, { ...intent, key: 'ArrowUp', precise: true, scale })
    expect((vertical[0]!.y - original[0]!.y) * 32 * scale).toBeCloseTo(-1, 4)
  })
  it('clamps the group together and preserves unchanged geometry at a boundary', () => {
    const atEdge = [
      { ...original[0]!, x: 0 },
      { ...original[1]!, x: 18 },
    ]
    expect(keyboardGeometry(atEdge, intent)).toEqual(atEdge)
    expect(keyboardGeometry(atEdge, { ...intent, key: 'ArrowLeft' })).toEqual(atEdge)
    const result = keyboardGeometry(original, { ...intent, spacing: { x: 50, y: 1 } })
    expect(result[1]!.x + result[1]!.w).toBe(24)
    expect(result[1]!.x - result[0]!.x).toBe(9)
  })
  it('resizes a precise edge without moving its opposite anchor or snapping the offset', () => {
    const [p] = keyboardGeometry([original[0]!], {
      ...intent,
      precise: true,
      action: 'resize',
      direction: 'e',
    })
    expect(p!.x).toBe(original[0]!.x)
    expect((p!.w - original[0]!.w) * 20).toBeCloseTo(1, 5)
    const [west] = keyboardGeometry([original[0]!], {
      ...intent,
      precise: true,
      action: 'resize',
      direction: 'w',
    })
    expect(west!.x + west!.w).toBeCloseTo(original[0]!.x + original[0]!.w, 5)
  })
  it('resizes a group proportionally with fine keyboard precision', () => {
    const result = keyboardGeometry(original, {
      ...intent,
      precise: true,
      action: 'resize',
      direction: 'e',
    })
    const beforeWidth = original[1]!.x + original[1]!.w - original[0]!.x
    const afterWidth = result[1]!.x + result[1]!.w - result[0]!.x
    expect((afterWidth - beforeWidth) * 20).toBeCloseTo(1, 3)
    expect(result[0]!.x).toBe(original[0]!.x)
    expect(result[0]!.w).toBe(result[1]!.w)
  })
  it.each([0, Infinity, NaN])('ignores unusable surface metric %s', (scale) => {
    expect(keyboardGeometry(original, { ...intent, scale })).toEqual(original)
  })
  it('ignores non-arrow keys, empty selections and locked movement', () => {
    expect(keyboardGeometry(original, { ...intent, key: 'Enter' })).toEqual(original)
    expect(keyboardGeometry([], intent)).toEqual([])
    expect(keyboardGeometry(original, { ...intent, positionLocked: true })).toEqual(original)
  })
})
