import { describe, expect, it } from 'vitest'
import {
  defaultDashboardViewport,
  validateDashboardViewport,
  validateSharedWidgets,
  type SharedDashboardWidget as Widget,
} from '../../functions/src/sharedDashboardModel'
import {
  arrange,
  copyConfiguration,
  descendants,
  locked,
  resizeEdges,
  rootSelection,
  translate,
  type Direction,
} from '@/features/dashboard/editorGeometry'
import { startCamera, panCamera, alignmentOffset } from '@/features/dashboard/viewportGeometry'
const text = (id: string, extra: Partial<Widget> = {}): Widget => ({
  id,
  type: 'text',
  span: 6,
  title: id,
  text: 'Shared text',
  placement: { x: 2, y: 4, w: 6, h: 8 },
  ...extra,
})
const container = (id: string, extra: Partial<Widget> = {}): Widget =>
  text(id, {
    type: 'container',
    container: {
      kind: 'panel',
      labels: ['One', 'Two'],
      direction: 'row',
      ratio: 50,
      collapsed: false,
    },
    ...extra,
  })
const grid = { x: 0.25, y: 0.5, snap: true }
describe('Networking dashboard editor contracts', () => {
  it.each(['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as Direction[])(
    'resizes %s while keeping opposite edges anchored',
    (direction) => {
      const p = { x: 3, y: 5, w: 8, h: 9 },
        result = resizeEdges(p, 0.6, 1.2, direction, grid)
      expect(direction.includes('w') ? result.x + result.w : result.x).toBe(
        direction.includes('w') ? p.x + p.w : p.x,
      )
      expect(direction.includes('n') ? result.y + result.h : result.y).toBe(
        direction.includes('n') ? p.y + p.h : p.y,
      )
      expect(
        validateSharedWidgets([text('a', { placement: result })], 'personal')[0]!.placement,
      ).toEqual(result)
    },
  )
  it('respects position locks and clamps resize at canvas and minimum size boundaries', () => {
    const p = { x: 3, y: 5, w: 8, h: 9 }
    expect(resizeEdges(p, 5, 5, 'nw', grid, true)).toEqual(p)
    expect(resizeEdges(p, -100, -100, 'nw', grid)).toEqual({ x: 0, y: 0, w: 11, h: 14 })
    expect(resizeEdges(p, -100, -100, 'se', grid)).toEqual({ x: 3, y: 5, w: 2, h: 3 })
  })
  it('moves a group with its gaps intact and clamps the group at the canvas edge', () => {
    const original = [
      { x: 1, y: 2, w: 4, h: 5 },
      { x: 10, y: 8, w: 4, h: 5 },
    ]
    const moved = translate(original, 50, 2.2, grid)
    expect(moved[1]!.x + moved[1]!.w).toBe(24)
    expect(moved[1]!.x - moved[0]!.x).toBe(9)
    expect(moved[1]!.y - moved[0]!.y).toBe(6)
    expect(original[0]!.x).toBe(1)
  })
  it('distributes uneven widths with stable endpoints and matches primary size', () => {
    const p = [
      { x: 1, y: 2, w: 3, h: 5 },
      { x: 7, y: 8, w: 4, h: 7 },
      { x: 18, y: 4, w: 5, h: 8 },
    ]
    const result = arrange(p, 'horizontal', p[0]!)
    expect(result[0]).toEqual(p[0])
    expect(result[2]).toEqual(p[2])
    expect(result[1]!.x).toBe(9)
    expect(arrange(p, 'height', p[1]!).map((x) => x.h)).toEqual([7, 7, 7])
  })
  it('filters descendant selection and remaps clipboard trees without saved note content', () => {
    const entries = [
      container('parent'),
      text('child', {
        type: 'notes',
        parentId: 'parent',
        region: '0',
        text: 'Legacy private note',
      }),
      text('other'),
    ]
    expect(rootSelection(entries, ['parent', 'child']).map((w) => w.id)).toEqual(['parent'])
    expect(descendants(entries, ['parent'])).toHaveLength(2)
    const copies = copyConfiguration(entries, ['parent', 'child'])
    expect(copies).toHaveLength(2)
    expect(copies[0]!.id).not.toBe('parent')
    expect(copies[1]!.parentId).toBe(copies[0]!.id)
    expect(copies[1]!.text).toBe('')
    expect(entries[1]!.text).toBe('Legacy private note')
    expect(validateSharedWidgets(copies, 'personal')).toEqual(copies)
  })
  it('inherits locks from containers without granting any permission', () => {
    const entries = [
      container('parent', { positionLocked: true }),
      text('child', { parentId: 'parent' }),
    ]
    expect(locked(entries, entries[1]!, 'positionLocked')).toBe(true)
    expect(locked(entries, entries[1]!, 'sizeLocked')).toBe(false)
  })
  it('validates responsive overrides and explicit container configuration', () => {
    const p = text('child', {
      parentId: 'parent',
      region: '1',
      devices: { phone: { x: 1, y: 2, w: 20, h: 8 } },
      positionLocked: false,
      sizeLocked: true,
    })
    const parent = container('parent')
    parent.container!.kind = 'tabs'
    expect(validateSharedWidgets([parent, p], 'personal')).toEqual([parent, p])
  })
  it.each([
    [container('a', { parentId: 'b' }), container('b', { parentId: 'a' })],
    [text('child', { parentId: 'missing' })],
    [container('a'), text('child', { parentId: 'a', region: '1' })],
    [container('a'), text('child', { parentId: 'a', region: 0 as unknown as string })],
    [text('a', { devices: { phone: { x: 20, y: 0, w: 8, h: 5 } } })],
    Array.from({ length: 13 }, (_, i) => text('a' + i)),
    [text('a', { type: 'jobs' }), text('b', { type: 'jobs' })],
  ])('rejects unsafe or incompatible layout %#', (...entries) => {
    expect(() => validateSharedWidgets(entries, 'personal')).toThrow(
      /Invalid|Use between|Add each|Container|container/,
    )
  })
  it('retains required tools even inside containers', () => {
    const widgets = [container('a'), text('tools', { type: 'workflows', parentId: 'a' })]
    expect(validateSharedWidgets(widgets, 'job')).toEqual(widgets)
    expect(() => validateSharedWidgets([widgets[0]!], 'job')).toThrow('Keep Job tools')
  })
  it('round trips only supported viewport settings and rejects forged settings', () => {
    const config = defaultDashboardViewport()
    config.grid = { ...config.grid, x: 0.25, y: 2, snap: false, visible: true }
    expect(validateDashboardViewport(config)).toEqual(config)
    expect(() => validateDashboardViewport({ ...config, tenantId: 'someone-else' })).toThrow(
      'Invalid dashboard viewport settings.',
    )
    expect(() => validateDashboardViewport({ ...config, grid: { ...config.grid, x: 0 } })).toThrow(
      'Invalid dashboard viewport settings.',
    )
    expect(() => validateDashboardViewport({ ...config, width: Infinity })).toThrow(
      'Invalid dashboard viewport settings.',
    )
  })
  it('reads legacy viewport settings without mutating their record or independent spacing', () => {
    const { start: _start, ...legacy } = defaultDashboardViewport()
    const value = { ...legacy, grid: { x: 0.25, y: 2, visible: true, snap: false } }
    const original = JSON.stringify(value)
    expect(validateDashboardViewport(value)).toMatchObject({
      start: { x: 0, y: 0 },
      grid: { x: 0.25, y: 2, linked: false, majorEvery: 4 },
    })
    expect(JSON.stringify(value)).toBe(original)
  })
  it('canonicalizes linked axes and preserves signed fractional starting positions', () => {
    const value = defaultDashboardViewport()
    value.grid = { ...value.grid, x: 0.5, y: 2, linked: true, majorEvery: 8 }
    value.start = { x: -3.25, y: 5.5 }
    expect(validateDashboardViewport(value)).toMatchObject({
      start: { x: -3.25, y: 5.5 },
      grid: { x: 0.5, y: 0.5, linked: true, majorEvery: 8 },
    })
    expect(value.grid.y).toBe(2)
  })
  it.each([
    { start: null },
    { start: [] },
    { start: { x: 1 } },
    { start: { x: '1', y: 0 } },
    { start: { x: Infinity, y: 0 } },
    { start: { x: 0, y: -10001 } },
    { start: { x: 0, y: 0, owner: 'forged' } },
    { grid: { ...defaultDashboardViewport().grid, linked: 'true' } },
    ...[0, -1, 1.5, 33, null, Infinity].map((majorEvery) => ({
      grid: { ...defaultDashboardViewport().grid, majorEvery },
    })),
  ])('rejects malformed extended viewport settings %#', (patch) => {
    expect(() => validateDashboardViewport({ ...defaultDashboardViewport(), ...patch })).toThrow(
      'Invalid dashboard viewport settings.',
    )
  })
  it('pans beyond every content edge without changing zoom or widget coordinates', () => {
    const start = startCamera({ x: -2, y: 3.5 }, 1080)
    expect(start).toEqual({ x: -90, y: 112 })
    expect(panCamera(start, 1000, -2000, 0.5)).toEqual({ x: -2090, y: 4112 })
    expect(panCamera(start, 1000, -2000, 2)).toEqual({ x: -590, y: 1112 })
    expect(panCamera(start, Infinity, 0, 1)).toEqual(start)
    expect(start).toEqual({ x: -90, y: 112 })
    expect(alignmentOffset(1100, 500, 'center')).toBe(300)
    expect(alignmentOffset(500, 1100, 'end')).toBe(0)
  })
})
