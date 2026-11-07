import { describe, expect, it } from 'vitest'
import { defaultGrid } from './grid'
import { keyboardGeometry, type KeyboardGeometryIntent } from './keyboardGeometry'

const origin = { x: 2.12749, y: 3.23453, w: 8.31217, h: 6.18741, z: 4 }
const original = { card: origin }
const intent: KeyboardGeometryIntent = {
  key: 'ArrowRight',
  precise: false,
  action: 'move',
  scale: 1,
  settings: { ...defaultGrid(), spacingX: 0.5, spacingY: 2 },
}

describe('Website keyboard geometry', () => {
  it('adds configured steps without snapping either authored offset', () => {
    expect(keyboardGeometry(original, intent).card).toEqual({ ...origin, x: 2.62749 })
    expect(keyboardGeometry(original, { ...intent, key: 'ArrowDown' }).card).toEqual({
      ...origin,
      y: 5.23453,
    })
    expect(original.card).toEqual(origin)
  })

  it.each([0.1, 0.5, 1, 2, 3])(
    'moves one screen pixel at %sx while preserving the other axis',
    (scale) => {
      const right = keyboardGeometry(original, { ...intent, scale, precise: true }).card!
      expect((right.x - origin.x) * 45 * scale).toBeCloseTo(1, 8)
      expect({ ...right, x: origin.x }).toEqual(origin)
      const up = keyboardGeometry(original, {
        ...intent,
        key: 'ArrowUp',
        scale,
        precise: true,
      }).card!
      expect((up.y - origin.y) * 32 * scale).toBeCloseTo(-1, 8)
      expect({ ...up, y: origin.y }).toEqual(origin)
      expect(
        keyboardGeometry({ card: right }, { ...intent, scale, precise: true, key: 'ArrowLeft' })
          .card,
      ).toEqual(origin)
    },
  )

  it('preserves the existing authored-pixel ordinary step when grid snapping is off', () => {
    const next = keyboardGeometry(original, {
      ...intent,
      scale: 2,
      settings: { ...defaultGrid(), snap: false },
    }).card!
    expect((next.x - origin.x) * 45).toBeCloseTo(1, 8)
    expect(next.y).toBe(origin.y)
  })

  it('moves a selection together and clamps its common delta at a boundary', () => {
    const group = { card: origin, second: { ...origin, x: 990, w: 9.75 } }
    const moved = keyboardGeometry(group, intent)
    expect(moved.card!.x).toBe(origin.x + 0.25)
    expect(moved.second!.x).toBe(990.25)
    expect(moved.card!.y).toBe(origin.y)
    expect(keyboardGeometry(moved, intent)).toEqual(moved)
    const left = { card: { ...origin, x: 0 }, second: { ...origin, x: 20.123456789 } }
    expect(keyboardGeometry(left, { ...intent, key: 'ArrowLeft' })).toEqual(left)
  })

  it.each([
    { action: 'top-left', x: 1, w: -1, y: 1, h: -1 },
    { action: 'top', x: 0, w: 0, y: 1, h: -1 },
    { action: 'top-right', x: 0, w: 1, y: 1, h: -1 },
    { action: 'right', x: 0, w: 1, y: 0, h: 0 },
    { action: 'bottom-right', x: 0, w: 1, y: 0, h: 1 },
    { action: 'bottom', x: 0, w: 0, y: 0, h: 1 },
    { action: 'bottom-left', x: 1, w: -1, y: 0, h: 1 },
    { action: 'left', x: 1, w: -1, y: 0, h: 0 },
  ] as const)(
    'resizes the $action peg relative to its edge and preserves opposite anchors',
    ({ action, x, w, y, h }) => {
      const horizontal = keyboardGeometry(original, {
        ...intent,
        action,
        precise: true,
        scale: 0.5,
      }).card!
      expect((horizontal.x - origin.x) * 22.5).toBeCloseTo(x, 8)
      expect((horizontal.w - origin.w) * 22.5).toBeCloseTo(w, 8)
      expect(horizontal.y).toBe(origin.y)
      expect(horizontal.h).toBe(origin.h)
      const vertical = keyboardGeometry(original, {
        ...intent,
        key: 'ArrowDown',
        action,
        precise: true,
        scale: 2,
      }).card!
      expect((vertical.y - origin.y) * 64).toBeCloseTo(y, 8)
      expect((vertical.h - origin.h) * 64).toBeCloseTo(h, 8)
      expect(vertical.x).toBe(origin.x)
      expect(vertical.w).toBe(origin.w)
      expect(vertical.z).toBe(origin.z)
    },
  )

  it('clamps minimum dimensions and retains exact no-ops at all outer boundaries', () => {
    const atLimit = { card: { x: 999, y: 9999, w: 1, h: 1, z: 5 } }
    expect(keyboardGeometry(atLimit, intent)).toEqual(atLimit)
    expect(keyboardGeometry(atLimit, { ...intent, key: 'ArrowDown' })).toEqual(atLimit)
    expect(keyboardGeometry(atLimit, { ...intent, action: 'top-left' })).toEqual(atLimit)
    expect(keyboardGeometry(atLimit, { ...intent, key: 'ArrowDown', action: 'top-left' })).toEqual(
      atLimit,
    )
    expect(keyboardGeometry(atLimit, { ...intent, action: 'bottom-right' })).toEqual(atLimit)
    expect(
      keyboardGeometry(atLimit, { ...intent, key: 'ArrowDown', action: 'bottom-right' }),
    ).toEqual(atLimit)
    const atOrigin = { card: { ...origin, x: 0, y: 0 } }
    expect(keyboardGeometry(atOrigin, { ...intent, key: 'ArrowLeft', action: 'left' })).toEqual(
      atOrigin,
    )
    expect(keyboardGeometry(atOrigin, { ...intent, key: 'ArrowUp', action: 'top' })).toEqual(
      atOrigin,
    )
  })

  it.each([0, -1, Infinity, NaN])('ignores unusable surface scale %s', (scale) => {
    expect(keyboardGeometry(original, { ...intent, scale })).toEqual(original)
  })

  it('keeps strict saved bounds while resizing a fractional edge anchored at the canvas maximum', () => {
    for (const scale of [0.1, 0.3, 0.5, 1, 2, 3]) {
      for (const coordinate of [0.127491234567, 2.12749, 200.123456789111, 998.5]) {
        const anchored = {
          card: { x: coordinate, y: coordinate, w: 1000 - coordinate, h: 10000 - coordinate, z: 1 },
        }
        const horizontal = keyboardGeometry(anchored, {
          ...intent,
          precise: true,
          scale,
          action: 'left',
        }).card!
        const vertical = keyboardGeometry(anchored, {
          ...intent,
          precise: true,
          scale,
          action: 'top',
          key: 'ArrowDown',
        }).card!
        expect(horizontal.x + horizontal.w).toBeLessThanOrEqual(1000)
        expect(horizontal.x + horizontal.w).toBeCloseTo(1000, 10)
        expect(horizontal.w).toBeGreaterThanOrEqual(1)
        expect(vertical.y + vertical.h).toBeLessThanOrEqual(10000)
        expect(vertical.y + vertical.h).toBeCloseTo(10000, 10)
        expect(vertical.h).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('ignores unrelated keys, invalid geometry, empty selections and group resize', () => {
    expect(keyboardGeometry(original, { ...intent, key: 'Enter' })).toEqual(original)
    expect(keyboardGeometry({}, intent)).toEqual({})
    const invalid = { card: { ...origin, x: NaN } }
    expect(keyboardGeometry(invalid, intent)).toEqual(invalid)
    const group = { ...original, second: { ...origin, x: 20 } }
    expect(keyboardGeometry(group, { ...intent, action: 'right' })).toEqual(group)
  })
})
