import { describe, it, expect } from 'vitest'
import { placeWidget, resizeWidget } from '@/features/dashboard/widgetPlacement'
import { validateSharedWidgets } from '../../functions/src/sharedDashboardModel'
describe('free dashboard placement', () => {
  const widget = { id: 'text', type: 'text', span: 6, title: 'Text', text: '' }
  it('persists gaps and overlapping positions without compacting them', () => {
    const placement = { x: 5.25, y: 16.5, w: 8, h: 9 }
    const result = validateSharedWidgets([{ ...widget, placement }, { ...widget, id: 'second', placement }], 'personal')
    expect(result.map(w => w.placement)).toEqual([placement, placement])
    expect(validateSharedWidgets([widget], 'personal')[0]?.placement).toBeUndefined()
  })
  it.each([
    { x: -1, y: 0, w: 8, h: 9 }, { x: 20, y: 0, w: 8, h: 9 },
    { x: 0, y: Infinity, w: 8, h: 9 }, { x: 0, y: 0, w: 1, h: 9 },
    { x: 0, y: 999, w: 8, h: 9 }, { x: 0, y: 0, w: 8, h: 9, css: 'bad' },
  ])('rejects unsafe geometry %j', placement => {
    expect(() => validateSharedWidgets([{ ...widget, placement }], 'personal')).toThrow()
  })
  it('resizes at the original position and clamps the edge instead of shifting the widget', () => {
    expect(resizeWidget({ x: 10, y: 20, w: 8, h: 9 }, 50, 4)).toEqual({ x: 10, y: 20, w: 14, h: 13 })
    expect(resizeWidget({ x: 10, y: 20, w: 8, h: 9 }, -50, -50)).toEqual({ x: 10, y: 20, w: 2, h: 3 })
  })
  it('snaps like Networking and clamps the complete widget within the canvas', () => {
    expect(placeWidget(5.4, 6.6, 8, 9)).toEqual({ x: 5, y: 7, w: 8, h: 9 })
    expect(placeWidget(23, 999, 8, 9)).toEqual({ x: 16, y: 991, w: 8, h: 9 })
    expect(placeWidget(5.4, 6.6, 8, 9, false)).toEqual({ x: 5.4, y: 6.594, w: 8, h: 9 })
  })
})
