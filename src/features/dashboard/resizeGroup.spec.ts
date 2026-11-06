import { describe, expect, it } from 'vitest'
import { bounds, resizeEdges, resizeGroup, resizeDirections, type Grid } from './editorGeometry'
import { validateSharedWidgets } from '../../../functions/src/sharedDashboardModel'
import type { Placement } from './widgetPlacement'

const grid: Grid = { x: 0.25, y: 0.5, snap: true }
const original: Placement[] = [
  { x: 3, y: 10, w: 4, h: 6 },
  { x: 9, y: 20, w: 6, h: 10 },
]
function expectValid(placements: Placement[]) {
  expect(() =>
    validateSharedWidgets(
      placements.map((placement, index) => ({
        id: `widget-${index}`,
        type: 'text',
        title: '',
        text: '',
        span: 6,
        placement,
      })),
      'personal',
    ),
  ).not.toThrow()
}

describe('proportional group resizing', () => {
  it.each(resizeDirections)('snaps %s edges while preserving the opposite anchors', (direction) => {
    const before = bounds(original)
    const result = resizeGroup(original, 0.62, 1.24, direction, grid)
    const expected = resizeEdges(before, 0.62, 1.24, direction, grid, false, 1000)
    const after = bounds(result)
    for (const key of ['x', 'y', 'w', 'h'] as const)
      expect(after[key]).toBeCloseTo(expected[key], 2)
    expect(direction.includes('w') ? after.x + after.w : after.x).toBeCloseTo(
      direction.includes('w') ? before.x + before.w : before.x,
      3,
    )
    expect(direction.includes('n') ? after.y + after.h : after.y).toBeCloseTo(
      direction.includes('n') ? before.y + before.h : before.y,
      3,
    )
    expect(result[0]!.w / result[1]!.w).toBeCloseTo(4 / 6, 3)
    expect(result[0]!.h / result[1]!.h).toBeCloseTo(6 / 10, 3)
    expectValid(result)
    expect(original).toEqual([
      { x: 3, y: 10, w: 4, h: 6 },
      { x: 9, y: 20, w: 6, h: 10 },
    ])
  })

  it('stops the whole selection when one child is already at minimum width or height', () => {
    const widgets = [
      { x: 0, y: 5, w: 2, h: 3 },
      { x: 4, y: 12, w: 2, h: 9 },
    ]
    expect(resizeGroup(widgets, 1, 1, 'nw', grid)).toEqual(widgets)
    expect(resizeGroup(widgets, -100, -100, 'se', grid)).toEqual(widgets)
  })

  it('clamps to the smallest child before scaling and keeps west/north anchors fixed', () => {
    const result = resizeGroup(original, 100, 100, 'nw', grid)
    const after = bounds(result)
    expect(result).toEqual([
      { x: 9, y: 20, w: 2, h: 3 },
      { x: 12, y: 25, w: 3, h: 5 },
    ])
    expect(after.x + after.w).toBe(15)
    expect(after.y + after.h).toBe(30)
    expectValid(result)
  })

  it('limits group growth by every child maximum instead of changing gaps independently', () => {
    const widgets = [
      { x: 1, y: 10, w: 4, h: 50 },
      { x: 7, y: 70, w: 4, h: 20 },
    ]
    const result = resizeGroup(widgets, 0, 500, 's', grid)
    expect(result).toEqual([
      { x: 1, y: 10, w: 4, h: 100 },
      { x: 7, y: 130, w: 4, h: 40 },
    ])
    expectValid(result)
    const saturated = [
      { ...widgets[0]!, h: 100 },
      { ...widgets[1]!, y: 120 },
    ]
    expect(resizeGroup(saturated, 0, 500, 's', grid)).toEqual(saturated)
  })

  it.each(resizeDirections)(
    'keeps every widget inside the workspace during extreme %s growth',
    (direction) => {
      const widgets = [
        { x: 3, y: 940, w: 4, h: 10 },
        { x: 10, y: 970, w: 5, h: 10 },
      ]
      const result = resizeGroup(
        widgets,
        direction.includes('w') ? -10000 : 10000,
        direction.includes('n') ? -10000 : 10000,
        direction,
        grid,
      )
      const before = bounds(widgets)
      const after = bounds(result)
      expect(after.x).toBeGreaterThanOrEqual(0)
      expect(after.y).toBeGreaterThanOrEqual(0)
      expect(after.x + after.w).toBeLessThanOrEqual(24.001)
      expect(after.y + after.h).toBeLessThanOrEqual(1000)
      expect(direction.includes('w') ? after.x + after.w : after.x).toBeCloseTo(
        direction.includes('w') ? before.x + before.w : before.x,
        3,
      )
      expect(direction.includes('n') ? after.y + after.h : after.y).toBeCloseTo(
        direction.includes('n') ? before.y + before.h : before.y,
        3,
      )
      expectValid(result)
    },
  )

  it('keeps pixel-level edge snapping when the grid is disabled', () => {
    const free = { ...grid, snap: false }
    const before = bounds(original)
    const expected = resizeEdges(before, 0.037, 0.049, 'se', free, false, 1000)
    const after = bounds(resizeGroup(original, 0.037, 0.049, 'se', free))
    expect(after.w).toBeCloseTo(expected.w, 2)
    expect(after.h).toBeCloseTo(expected.h, 2)
    expect(after.x).toBe(before.x)
    expect(after.y).toBe(before.y)
  })

  it('handles an empty selection and ignores non-finite pointer deltas', () => {
    expect(resizeGroup([], 1, 1, 'se', grid)).toEqual([])
    expect(resizeGroup(original, Number.NaN, 1, 'se', grid)).toEqual(original)
    expect(resizeGroup(original, 1, Infinity, 'se', grid)).toEqual(original)
  })
})
