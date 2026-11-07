import { describe, expect, it } from 'vitest'
import type { SharedDashboardWidget as Widget } from './sharedDashboards'
import { arrangementLabels, arrangementSelection, planArrangement } from './selectionArrangement'
import type { Arrangement } from './editorGeometry'

const a: Widget = {
  id: 'a',
  type: 'text',
  title: 'Alpha',
  text: '',
  span: 6,
  placement: { x: 1.123456, y: 2.123456, w: 4.123456, h: 5.123456 },
}
const b: Widget = {
  ...a,
  id: 'b',
  placement: { x: 9.234567, y: 9.234567, w: 5.234567, h: 7.234567 },
}
const c: Widget = {
  ...a,
  id: 'c',
  placement: { x: 18.345678, y: 20.345678, w: 5.123456, h: 6.345678 },
}
const operations = Object.keys(arrangementLabels) as Arrangement[]
function plan(
  widgets: Widget[],
  operation: Arrangement,
  extra: Partial<Parameters<typeof planArrangement>[0]> = {},
) {
  return planArrangement({
    widgets,
    ids: widgets.map((w) => w.id),
    primaryId: 'b',
    device: 'desktop',
    operation,
    ...extra,
  })
}
describe('atomic selection arrangements', () => {
  it.each(operations)(
    '%s changes only its intended property and leaves descendants/overrides untouched',
    (operation) => {
      const children = [{ ...a, id: 'child', parentId: 'a', region: '1', placement: undefined }]
      const widgets = [
        a,
        b,
        { ...c, devices: { phone: { x: 0, y: 0, w: 24, h: 10 } } },
        ...children,
      ]
      const result = plan(widgets, operation, { ids: ['a', 'b', 'c', 'child'] })
      expect(result.reason).toBe('')
      const key = ['left', 'center', 'right', 'horizontal'].includes(operation)
        ? 'x'
        : ['top', 'middle', 'bottom', 'vertical'].includes(operation)
          ? 'y'
          : operation === 'width'
            ? 'w'
            : 'h'
      widgets.slice(0, 3).forEach((w, i) => {
        for (const field of ['x', 'y', 'w', 'h'] as const) {
          expect(
            field === key || result.widgets[i]!.placement![field] === w.placement![field],
          ).toBe(true)
        }
        expect(result.widgets[i]!.devices).toBe(w.devices)
      })
      expect(result.widgets[3]).toBe(children[0])
      expect(widgets[0]).toBe(a)
    },
  )
  it.each(operations)('%s rejects a direct or inherited relevant lock atomically', (operation) => {
    const size = operation === 'width' || operation === 'height'
    const key = size ? 'sizeLocked' : 'positionLocked'
    const own = [a, { ...b, [key]: true }, c]
    expect(plan(own, operation).widgets).toBe(own)
    expect(plan(own, operation).reason).toContain('Unlock')
    const inherited = [
      { ...a, id: 'parent', [key]: true },
      ...[a, b, c].map((w) => ({ ...w, parentId: 'parent' })),
    ]
    expect(plan(inherited, operation, { ids: ['a', 'b', 'c'] }).widgets).toBe(inherited)
  })
  it.each(['width', 'height'] as const)(
    'allows position-locked %s matching without moving origins',
    (operation) => {
      const widgets = [a, b, c].map((w) => ({ ...w, positionLocked: true }))
      const result = plan(widgets, operation)
      expect(result.reason).toBe('')
      expect(result.widgets.map((w) => [w.placement!.x, w.placement!.y])).toEqual(
        widgets.map((w) => [w.placement!.x, w.placement!.y]),
      )
      expect(result.widgets.map((w) => w.placement![operation === 'width' ? 'w' : 'h'])).toEqual([
        b.placement![operation === 'width' ? 'w' : 'h'],
        b.placement![operation === 'width' ? 'w' : 'h'],
        b.placement![operation === 'width' ? 'w' : 'h'],
      ])
    },
  )
  it('normalizes a primary child to its selected ancestor and preserves child-local coordinates', () => {
    const child = { ...c, id: 'child', parentId: 'a', placement: { x: 0, y: 0, w: 2, h: 3 } }
    const widgets = [a, b, child]
    const result = plan(widgets, 'width', { primaryId: 'child' })
    expect(result.widgets[1]!.placement!.w).toBe(a.placement!.w)
    expect(result.widgets[2]).toBe(child)
  })
  it('requires enough roots and one surface without treating selected children as extra roots', () => {
    expect(arrangementSelection([a, b], ['a', 'b'], 'b', 'horizontal').reason).toContain('3')
    expect(
      arrangementSelection([a, { ...b, parentId: 'a' }], ['a', 'b'], 'b', 'left').reason,
    ).toContain('2')
    expect(
      arrangementSelection([a, { ...b, region: '1' }], ['a', 'b'], 'b', 'left').reason,
    ).toContain('same container')
    expect(arrangementSelection([a, b], [], '', 'width').reason).toContain('2')
  })
  it.each(['width', 'height'] as const)(
    'rejects an out-of-bounds %s match rather than shrinking or moving any target',
    (operation) => {
      const edge =
        operation === 'width' ? { x: 22, y: 0, w: 2, h: 3 } : { x: 0, y: 997, w: 2, h: 3 }
      const widgets = [{ ...a, positionLocked: true, placement: edge }, b]
      const result = plan(widgets, operation)
      expect(result.widgets).toBe(widgets)
      expect(result.reason).toContain('does not fit')
    },
  )
  it('keeps fractional distribution endpoints and permits bounded overlapping gaps', () => {
    const widgets = [
      a,
      { ...b, placement: { x: 3, y: 9, w: 10, h: 4 } },
      { ...c, placement: { x: 5.123456, y: 10, w: 3, h: 4 } },
    ]
    const result = plan(widgets, 'horizontal')
    expect(result.reason).toBe('')
    expect(result.widgets[0]).toBe(widgets[0])
    expect(result.widgets[2]).toBe(widgets[2])
    expect(result.widgets[1]!.placement!.y).toBe(9)
  })
  it('leaves authored and unplaced siblings in other regions unchanged', () => {
    const hidden = { ...a, id: 'hidden', parentId: 'container', region: '1', placement: undefined }
    const fallback = { ...c, id: 'fallback', placement: undefined }
    const widgets = [a, b, hidden, fallback]
    const result = plan(widgets, 'left', { ids: ['a', 'b'] })
    expect(result.widgets[2]).toBe(hidden)
    expect(result.widgets[3]).toBe(fallback)
  })
  it.each(operations)('%s is a semantic no-op when repeated', (operation) => {
    const first = plan([a, b, c], operation)
    expect(first.reason).toBe('')
    const second = plan(first.widgets, operation)
    expect(second.reason).toBe('')
    expect(second.widgets).toBe(first.widgets)
  })
  it('resolves unplaced positioned siblings locally, independently of unrelated root order', () => {
    const widgets = [
      c,
      { ...a, parentId: 'container', placement: undefined },
      { ...b, parentId: 'container' },
    ]
    const result = plan(widgets, 'left', { ids: ['a', 'b'] })
    expect(result.widgets[1]!.placement).toBeUndefined()
    expect(result.widgets[2]!.placement!.x).toBe(0)
    expect(result.widgets[0]).toBe(c)
  })
  it.each(['desktop', 'tablet', 'phone'] as const)(
    'converts only direct flow siblings on %s after a real change',
    (device) => {
      const widgets = [a, b, c].map((w) => ({ ...w, parentId: 'panel', placement: undefined }))
      widgets.push({ ...a, id: 'hidden', parentId: 'hidden-region', placement: undefined })
      const measurements = new Map([a, b, c].map((w) => [w.id, w.placement!]))
      const result = plan(widgets, 'left', { ids: ['a', 'b'], device, measurements })
      expect(result.reason).toBe('')
      const current = (w: Widget) => (device === 'desktop' ? w.placement : w.devices?.[device])
      expect(current(result.widgets[1]!)!.x).toBe(a.placement!.x)
      expect(current(result.widgets[2]!)).toEqual(c.placement)
      expect(result.widgets[3]).toBe(widgets[3])
      expect(device === 'desktop' || result.widgets.every((w) => !w.placement)).toBe(true)
    },
  )
  it('does not convert a flow no-op even if an unrelated sibling is unmeasurable', () => {
    const widgets = [a, b, c].map((w) => ({ ...w, placement: undefined }))
    const measurements = new Map([
      ['a', a.placement!],
      ['b', { ...b.placement!, x: a.placement!.x }],
    ])
    expect(plan(widgets, 'left', { ids: ['a', 'b'], measurements }).widgets).toBe(widgets)
    expect(plan(widgets, 'right', { ids: ['a', 'b'], measurements }).reason).toContain(
      'cannot keep',
    )
  })
  it('rejects unavailable or invalid measured flow without fallback or partial conversion', () => {
    const widgets = [a, b, c].map((w) => ({ ...w, placement: undefined }))
    expect(plan(widgets, 'left').widgets).toBe(widgets)
    const measurements = new Map([
      ['a', a.placement!],
      ['b', b.placement!],
      ['c', { ...c.placement!, h: 101 }],
    ])
    expect(plan(widgets, 'left', { ids: ['a', 'b'], measurements }).widgets).toBe(widgets)
  })
  it.each(['tablet', 'phone'] as const)(
    'preserves all other device data while changing %s',
    (device) => {
      const other = device === 'tablet' ? 'phone' : 'tablet'
      const widgets = [a, b].map((w) => ({
        ...w,
        devices: { [other]: { x: 0, y: 10, w: 24, h: 10 } },
      }))
      const result = plan(widgets, 'left', { device })
      expect(result.widgets[1]!.devices![device]!.x).toBe(a.placement!.x)
      result.widgets.forEach((w, i) => {
        expect(w.placement).toBe(widgets[i]!.placement)
        expect(w.devices?.[other]).toBe(widgets[i]!.devices[other])
      })
    },
  )
})
