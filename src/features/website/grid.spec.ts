import { describe, expect, it } from 'vitest'
import { changeGeometry, defaultGrid, materializeGrid, gridExtent, nextGeometry } from './grid'
import { newSection } from './types'

describe('networking-style website geometry', () => {
  it('keeps additions and duplicates within canvas and layer limits', () => {
    const existing = { ...newSection('text'), layout: { x: 0, y: 9990, w: 8, h: 10, z: 10000 } }
    const added = nextGeometry([existing])
    const copied = nextGeometry([existing], 'text', { w: 8, h: 30 })
    expect(added.y + added.h).toBe(10000)
    expect(copied.y + copied.h).toBe(10000)
    expect(added.z).toBe(10000)
  })
  const origin = { x: 3, y: 4, w: 8, h: 6, z: 2 }
  it('snaps movement, supports fractional spacing and never repacks other widgets', () => {
    expect(changeGeometry(origin, 1.4, 2.6, 'move', defaultGrid())).toEqual({
      ...origin,
      x: 4,
      y: 7,
    })
    expect(
      changeGeometry(origin, 0.3, 0.6, 'move', { ...defaultGrid(), spacingX: 0.25, spacingY: 0.5 }),
    ).toEqual({ ...origin, x: 3.25, y: 4.5 })
    expect(origin.x).toBe(3)
    expect(
      changeGeometry(origin, 1 / 45, 1 / 32, 'move', { ...defaultGrid(), snap: false }).x,
    ).toBe(3.022)
  })
  it('resizes opposite edges without moving the anchored edges and clamps minimum size', () => {
    expect(changeGeometry(origin, 2, 3, 'bottom-right', defaultGrid())).toEqual({
      ...origin,
      w: 10,
      h: 9,
    })
    expect(changeGeometry(origin, 2, 3, 'top-left', defaultGrid())).toEqual({
      ...origin,
      x: 5,
      y: 7,
      w: 6,
      h: 3,
    })
    const minimum = changeGeometry(origin, 100, 100, 'top-left', defaultGrid())
    expect(minimum.w).toBe(1)
    expect(minimum.h).toBe(1)
    expect(minimum.x + minimum.w).toBe(origin.x + origin.w)
    expect(changeGeometry(origin, -100, -100, 'move', defaultGrid()).x).toBe(0)
  })
  it('converts old rows once, preserves authored geometry and grows the canvas', () => {
    const a = { ...newSection('text'), span: 6 as const }
    const sections = materializeGrid([a, { ...a, id: 'other' }])
    expect(sections[0]!.layout!.x).toBe(0)
    expect(sections[1]!.layout!.x).toBe(12)
    expect(sections[0]!.layout!.y).toBe(sections[1]!.layout!.y)
    expect(materializeGrid(sections)).toEqual(sections)
    expect(gridExtent([{ ...origin, x: 25, y: 30 }])).toEqual({ width: 33 * 45, height: 36 * 32 })
    expect(gridExtent([])).toEqual({ width: 1080, height: 576 })
  })
})
