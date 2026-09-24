import { describe, expect, it } from 'vitest'
import { arrangeSelection, arrangementActions } from './arrangement'
import type { GeometryMap } from './selection'

describe('website selection arrangement', () => {
  const layouts: GeometryMap = {
    first: { x: 2, y: 3, w: 4, h: 2, z: 7 },
    middle: { x: 7, y: 8, w: 2, h: 4, z: 2 },
    last: { x: 20, y: 20, w: 6, h: 6, z: 1 },
  }
  it('aligns unequal widgets to selection edges and centers without changing sizes or layers', () => {
    const cases = [
      ['align-left', 'x', [2, 2, 2]],
      ['align-right', 'x', [22, 24, 20]],
      ['center-horizontal', 'x', [12, 13, 11]],
      ['align-top', 'y', [3, 3, 3]],
      ['align-bottom', 'y', [24, 22, 20]],
      ['center-vertical', 'y', [13.5, 12.5, 11.5]],
    ] as const
    for (const [action, axis, expected] of cases) {
      const arranged = { ...layouts, ...arrangeSelection(layouts, action, 'middle') }
      expect(Object.values(arranged).map((layout) => layout[axis])).toEqual(expected)
      expect(Object.values(arranged).map(({ w, h, z }) => [w, h, z])).toEqual(
        Object.values(layouts).map(({ w, h, z }) => [w, h, z]),
      )
    }
    expect(layouts.first!.x).toBe(2)
  })
  it('distributes equal gaps in spatial order and retains the outer edges', () => {
    for (const [action, axis, size] of [
      ['distribute-horizontal', 'x', 'w'],
      ['distribute-vertical', 'y', 'h'],
    ] as const) {
      const result = {
        ...layouts,
        ...arrangeSelection(
          { last: layouts.last!, first: layouts.first!, middle: layouts.middle! },
          action,
          'middle',
        ),
      }
      expect(result.first![axis]).toBe(layouts.first![axis])
      expect(result.last![axis]).toBe(layouts.last![axis])
      const firstGap = result.middle![axis] - result.first![axis] - result.first![size]
      const lastGap = result.last![axis] - result.middle![axis] - result.middle![size]
      expect(firstGap).toBeCloseTo(lastGap, 3)
    }
  })
  it('matches the primary size and rejects the entire edit if a widget would cross canvas bounds', () => {
    const widths = arrangeSelection(layouts, 'match-width', 'middle')
    expect(widths.first!.w).toBe(2)
    expect(widths.last!.w).toBe(2)
    expect(widths.middle).toBeUndefined()
    expect(arrangeSelection(layouts, 'match-height', 'last').first!.h).toBe(6)
    const edge = { ...layouts, edge: { x: 999, y: 9999, w: 1, h: 1, z: 3 } }
    expect(arrangeSelection(edge, 'match-width', 'middle')).toEqual({})
    expect(arrangeSelection(edge, 'match-height', 'middle')).toEqual({})
  })
  it('does not create edits for single selections, unchanged layouts or overlapping distribution', () => {
    for (const action of arrangementActions)
      expect(arrangeSelection({ first: layouts.first! }, action.id, 'first')).toEqual({})
    const aligned = { first: layouts.first!, second: { ...layouts.first! } }
    expect(arrangeSelection(aligned, 'align-left', 'first')).toEqual({})
    expect(arrangeSelection(aligned, 'distribute-horizontal', 'first')).toEqual({})
    expect(
      arrangeSelection(
        { ...aligned, third: { ...layouts.first! } },
        'distribute-horizontal',
        'first',
      ),
    ).toEqual({})
  })
})
