import { describe, expect, it } from 'vitest'
import {
  canReorderWidgetLayers,
  reorderWidgetLayers,
  widgetLayer,
  type LayerAction,
} from './widgetLayers'

const entries = (...ids: string[]) => ids.map((id) => ({ id }))
const order = (widgets: readonly { id: string }[]) => widgets.map((widget) => widget.id)

describe('dashboard sibling layers', () => {
  it.each<[LayerAction, string[]]>([
    ['back', ['c', 'a', 'b', 'd']],
    ['backward', ['a', 'c', 'b', 'd']],
    ['forward', ['a', 'b', 'd', 'c']],
    ['front', ['a', 'b', 'd', 'c']],
  ])('moves a single widget %s without changing its fields', (action, expected) => {
    const widgets = Object.freeze(
      entries('a', 'b', 'c', 'd').map((widget) =>
        Object.freeze({ ...widget, placement: Object.freeze({ x: 1, y: 2, w: 6, h: 8 }) }),
      ),
    )
    const result = reorderWidgetLayers(widgets, ['c'], action)
    expect(order(result)).toEqual(expected)
    expect(order(widgets)).toEqual(['a', 'b', 'c', 'd'])
    result.forEach((widget) => expect(widget).toBe(widgets.find((entry) => entry.id === widget.id)))
  })

  it.each<[LayerAction, string[]]>([
    ['back', ['b', 'c', 'e', 'a', 'd', 'f']],
    ['backward', ['b', 'c', 'a', 'e', 'd', 'f']],
    ['forward', ['a', 'd', 'b', 'c', 'f', 'e']],
    ['front', ['a', 'd', 'f', 'b', 'c', 'e']],
  ])(
    'keeps selected and unselected relative order when moving several widgets %s',
    (action, expected) => {
      const widgets = entries('a', 'b', 'c', 'd', 'e', 'f')
      // Click order and duplicate ids must not become layer order.
      expect(order(reorderWidgetLayers(widgets, ['e', 'c', 'b', 'c'], action))).toEqual(expected)
    },
  )

  it('reorders only matching parent/region slots in an interleaved flat hierarchy', () => {
    const widgets = [
      { id: 'parent' },
      { id: 'a', parentId: 'parent' },
      { id: 'other-root' },
      { id: 'other-region', parentId: 'parent', region: '1' },
      { id: 'b', parentId: 'parent', region: '0' },
      { id: 'other-child', parentId: 'other-root' },
      { id: 'c', parentId: 'parent', region: '0' },
    ]
    const result = reorderWidgetLayers(widgets, ['a'], 'front')
    expect(order(result)).toEqual([
      'parent',
      'b',
      'other-root',
      'other-region',
      'c',
      'other-child',
      'a',
    ])
    for (const index of [0, 2, 3, 5]) expect(result[index]).toBe(widgets[index])
    expect(widgetLayer(result, 'a')).toEqual({
      index: 2,
      count: 3,
      parentId: 'parent',
      region: '0',
    })
    expect(widgetLayer(result, 'other-region')).toEqual({
      index: 0,
      count: 1,
      parentId: 'parent',
      region: '1',
    })
  })

  it('moves selected ancestors without reordering their selected descendants', () => {
    const widgets = [
      { id: 'parent' },
      { id: 'first-child', parentId: 'parent' },
      { id: 'sibling' },
      { id: 'last-child', parentId: 'parent' },
      { id: 'grandchild', parentId: 'last-child' },
    ]
    const result = reorderWidgetLayers(widgets, ['parent', 'first-child', 'grandchild'], 'front')
    expect(order(result)).toEqual(['sibling', 'first-child', 'parent', 'last-child', 'grandchild'])
    expect(result[1]).toBe(widgets[1])
    expect(result[3]).toBe(widgets[3])
    expect(result[4]).toBe(widgets[4])
  })

  it('handles independent selected sibling groups without crossing containers', () => {
    const widgets = [
      { id: 'a', parentId: 'one' },
      { id: 'c', parentId: 'two' },
      { id: 'b', parentId: 'one' },
      { id: 'd', parentId: 'two' },
    ]
    expect(order(reorderWidgetLayers(widgets, ['a', 'c'], 'forward'))).toEqual(['b', 'd', 'a', 'c'])
  })

  it('reports sibling-local boundaries and leaves empty, unknown or complete selections unchanged', () => {
    const widgets = entries('a', 'b', 'c')
    expect(widgetLayer(widgets, 'b')).toEqual({ index: 1, count: 3, parentId: '', region: '0' })
    expect(widgetLayer(widgets, 'missing')).toBeUndefined()
    for (const action of ['back', 'backward', 'forward', 'front'] as const) {
      for (const ids of [[], ['missing'], ['a', 'b', 'c']]) {
        expect(reorderWidgetLayers(widgets, ids, action)).toEqual(widgets)
        expect(canReorderWidgetLayers(widgets, ids, action)).toBe(false)
      }
      expect(reorderWidgetLayers([], ['a'], action)).toEqual([])
    }
    expect(canReorderWidgetLayers(widgets, ['a'], 'backward')).toBe(false)
    expect(canReorderWidgetLayers(widgets, ['c'], 'forward')).toBe(false)
    expect(canReorderWidgetLayers(widgets, ['b'], 'forward')).toBe(true)
    expect(canReorderWidgetLayers(widgets, ['a', 'b'], 'forward')).toBe(true)
  })
})
