import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  captureWidgetClipboard as capture,
  materializeWidgetClipboard as paste,
} from './widgetClipboard'
import type { SharedDashboardWidget as Widget } from './sharedDashboards'
import { fallbackPlacements } from './widgetPlacement'
import { validateSharedWidgets } from '../../../functions/src/sharedDashboardModel'

const widget = (id: string, extra: Partial<Widget> = {}): Widget => ({
  id,
  type: 'text',
  title: id,
  text: '',
  span: 6,
  placement: { x: 2.25, y: 3.125, w: 6, h: 5 },
  ...extra,
})
const panel = widget('panel', {
  type: 'container',
  placement: { x: 0, y: 0, w: 24, h: 30 },
  container: {
    kind: 'tabs',
    labels: ['One', 'Two'],
    direction: 'row',
    ratio: 50,
    collapsed: false,
  },
  positionLocked: true,
})
const snapshot = (entries: Widget[], ids = entries.map((w) => w.id)) =>
  capture(entries, ids, 'personal:a', 'desktop', fallbackPlacements(entries))
const insert = (copied: ReturnType<typeof capture>, entries: Widget[], context = 'personal:a') =>
  paste(copied, entries, context, 'desktop', { x: 1, y: 1 })
afterEach(() => vi.restoreAllMocks())

describe('dashboard configuration clipboard', () => {
  it('centers at a matching pointer, snaps one root, and advances repeated anchored paste', () => {
    const entries = [widget('a')],
      copied = snapshot(entries)
    const anchor = { x: 15, y: 12, parentId: '', region: '0' }
    const first = paste(
      copied,
      entries,
      'personal:a',
      'desktop',
      { x: 1, y: 1, snap: true },
      [],
      anchor,
    )
    expect(first.widgets[0]!.placement).toEqual({ x: 12, y: 10, w: 6, h: 5 })
    const second = paste(
      copied,
      [...entries, ...first.widgets],
      'personal:a',
      'desktop',
      { x: 1, y: 1, snap: true },
      [],
      anchor,
    )
    expect(second.widgets[0]!.placement).toEqual({ x: 13, y: 11, w: 6, h: 5 })
    expect(
      paste(copied, entries, 'personal:a', 'desktop', { x: 1, y: 1, snap: true }, [], anchor)
        .widgets[0]!.placement,
    ).toEqual(first.widgets[0]!.placement)
  })
  it('advances repeated pastes without re-quantizing offsets and reuses a position after undo', () => {
    const entries = [
      widget('a', { placement: { x: 2.123456, y: 3.123456, w: 6.123456, h: 5.123456 } }),
    ]
    const before = structuredClone(entries),
      copied = snapshot(entries)
    const first = insert(copied, entries),
      second = insert(copied, [...entries, ...first.widgets])
    expect(first.widgets[0]!.placement).toEqual({
      ...entries[0]!.placement!,
      x: 3.123456,
      y: 4.123456,
    })
    expect(second.widgets[0]!.placement!.x).toBe(4.123456)
    expect(insert(copied, entries).widgets[0]!.placement).toEqual(first.widgets[0]!.placement)
    expect(new Set([...entries, ...first.widgets, ...second.widgets].map((w) => w.id)).size).toBe(3)
    expect(entries).toEqual(before)
  })
  it('keeps multi-root gaps at an unsnapped nested anchor', () => {
    const entries = [
      panel,
      widget('a', { parentId: 'panel', region: '0' }),
      widget('b', { parentId: 'panel', region: '0', placement: { x: 12.125, y: 7, w: 5, h: 4 } }),
    ]
    const copied = snapshot(entries, ['a', 'b']),
      before = structuredClone(copied)
    const result = paste(
      copied,
      entries,
      'personal:a',
      'desktop',
      { x: 2, y: 2, snap: false },
      [],
      { x: 12.125, y: 14.25, parentId: 'panel', region: '0' },
    ).widgets
    expect(result[1]!.placement!.x - result[0]!.placement!.x).toBeCloseTo(9.875, 8)
    expect(result[1]!.placement!.y - result[0]!.placement!.y).toBeCloseTo(3.875, 8)
    expect((result[0]!.placement!.x + result[1]!.placement!.x + 5) / 2).toBeCloseTo(12.125, 8)
    expect(result.every((w) => w.parentId === 'panel' && w.region === '0')).toBe(true)
    expect(copied).toEqual(before)
  })
  it('moves only subtree roots and keeps child geometry and private content protections', () => {
    const parent = { ...panel, placement: { x: 1, y: 1, w: 12, h: 15 } }
    const child = widget('child', {
      parentId: parent.id,
      region: '0',
      type: 'notes',
      text: 'Private legacy note',
      devices: { phone: { x: 0, y: 2, w: 24, h: 5 } },
    })
    const entries = [parent, child]
    const result = paste(
      snapshot(entries, [parent.id]),
      entries,
      'personal:a',
      'desktop',
      { x: 1, y: 1 },
      [],
      { x: 18, y: 20, parentId: '', region: '0' },
    ).widgets
    expect(result[0]!.placement).toEqual({ x: 12, y: 13, w: 12, h: 15 })
    expect(result[1]!.placement).toEqual(child.placement)
    expect(result[1]!.devices).toEqual(child.devices)
    expect(result[1]!.parentId).toBe(result[0]!.id)
    expect(result[1]!.text).toBe('')
    expect(child.text).toBe('Private legacy note')
  })
  it('preserves all authored bounds even when a different device prevents exact anchoring', () => {
    const entries = [widget('a', { devices: { phone: { x: 0, y: 995, w: 24, h: 5 } } })]
    const result = paste(snapshot(entries), entries, 'personal:a', 'desktop', { x: 1, y: 1 }, [], {
      x: 20,
      y: 20,
      parentId: '',
      region: '0',
    }).widgets[0]!
    expect(result.placement!.x).toBe(2.25)
    expect(result.placement!.y).toBe(2.125)
    expect(result.devices!.phone).toEqual({ x: 0, y: 994, w: 24, h: 5 })
    expect(() => validateSharedWidgets([...entries, result], 'personal')).not.toThrow()
  })
  it('uses the active device geometry for centering and shares its delta with other authored views', () => {
    const entries = [widget('a', { devices: { phone: { x: 4, y: 5, w: 8, h: 6 } } })]
    const result = paste(snapshot(entries), entries, 'personal:a', 'phone', { x: 1, y: 1 }, [], {
      x: 14,
      y: 12,
      parentId: '',
      region: '0',
    }).widgets[0]!
    expect(result.devices!.phone).toEqual({ x: 10, y: 9, w: 8, h: 6 })
    expect(result.placement).toEqual({ x: 8.25, y: 7.125, w: 6, h: 5 })
    expect(result.devices!.tablet).toBeUndefined()
  })
  it.each([
    { x: 15, y: 12, parentId: 'unrelated', region: '0' },
    { x: 15, y: 12, parentId: '', region: '1' },
    { x: NaN, y: 12, parentId: '', region: '0' },
  ])('falls back for an unrelated or invalid anchor %j', (anchor) => {
    const entries = [widget('a')],
      copied = snapshot(entries)
    expect(
      paste(copied, entries, 'personal:a', 'desktop', { x: 1, y: 1 }, [], anchor).widgets[0]!
        .placement,
    ).toEqual(insert(copied, entries).widgets[0]!.placement)
  })
  it('keeps flow-only destinations flowing even with a matching pointer', () => {
    const entries = [widget('a', { placement: undefined })]
    const result = paste(snapshot(entries), entries, 'personal:a', 'desktop', { x: 1, y: 1 }, [], {
      x: 15,
      y: 12,
      parentId: '',
      region: '0',
    })
    expect(result.widgets[0]!.placement).toBeUndefined()
    expect(result.widgets[0]!.devices).toBeUndefined()
    expect(entries[0]!.placement).toBeUndefined()
  })
  it('clamps one shared delta at the boundary and retains group gaps in every authored device', () => {
    const entries = [
      widget('a', {
        placement: { x: 9, y: 994, w: 5, h: 5 },
        devices: { phone: { x: 0, y: 8, w: 24, h: 5 } },
      }),
      widget('b', {
        placement: { x: 19, y: 993, w: 5, h: 5 },
        devices: { phone: { x: 0, y: 18, w: 24, h: 5 } },
      }),
    ]
    const result = insert(snapshot(entries), entries).widgets
    expect(result[0]!.placement).toEqual({ x: 9, y: 995, w: 5, h: 5 })
    expect(result[1]!.placement).toEqual({ x: 19, y: 994, w: 5, h: 5 })
    expect(result.map((w) => w.devices!.phone!.y)).toEqual([9, 19])
    expect(() => validateSharedWidgets([...entries, ...result], 'personal')).not.toThrow()
  })
  it('copies a selected tree once, remaps children, and excludes legacy private note text', () => {
    const entries = [
      panel,
      widget('child', {
        type: 'notes',
        text: 'private',
        parentId: 'panel',
        region: '1',
        devices: { phone: { x: 0, y: 2, w: 20, h: 8 } },
      }),
    ]
    const captured = snapshot(entries, ['panel', 'child'])
    expect(captured.widgets[1]!.text).toBe('')
    const copied = insert(captured, entries)
    expect(copied.widgets).toHaveLength(2)
    expect(copied.roots).toEqual([copied.widgets[0]!.id])
    expect(copied.widgets[1]).toMatchObject({
      parentId: copied.widgets[0]!.id,
      region: '1',
      placement: entries[1]!.placement,
      devices: entries[1]!.devices,
      text: '',
    })
    expect(copied.widgets[0]!.positionLocked).toBe(true)
    expect(entries[1]!.text).toBe('private')
  })
  it('keeps valid local external parents, but detaches across contexts or after parent removal', () => {
    const entries = [panel, widget('child', { parentId: 'panel', region: '1' })]
    const captured = snapshot(entries, ['child'])
    expect(insert(captured, entries).widgets[0]).toMatchObject({ parentId: 'panel', region: '1' })
    expect(insert(captured, [panel], 'role:admin').widgets[0]).not.toHaveProperty('parentId')
    expect(insert(captured, []).widgets[0]).not.toHaveProperty('region')
  })
  it('compares collisions only within the destination parent and region', () => {
    const entries = [
      panel,
      widget('child', { parentId: 'panel', region: '1' }),
      widget('other', {
        parentId: 'panel',
        region: '0',
        placement: { x: 3.25, y: 4.125, w: 6, h: 5 },
      }),
    ]
    expect(insert(snapshot(entries, ['child']), entries).widgets[0]!.placement!.x).toBe(3.25)
  })
  it('uses phone occupancy and shifts authored overrides without adding absent tablet overrides', () => {
    const entries = [widget('a', { devices: { phone: { x: 3, y: 8, w: 10, h: 8 } } })]
    const copied = capture(entries, ['a'], 'personal:a', 'phone', [entries[0]!.devices!.phone!])
    const first = paste(copied, entries, 'personal:a', 'phone', { x: 0.5, y: 2 })
    const second = paste(copied, [...entries, ...first.widgets], 'personal:a', 'phone', {
      x: 0.5,
      y: 2,
    })
    expect(second.widgets[0]!.devices!.phone).toEqual({ x: 4, y: 12, w: 10, h: 8 })
    expect(second.widgets[0]!.devices).not.toHaveProperty('tablet')
    expect(second.widgets[0]!.placement!.x).toBe(3.25)
  })
  it('retains legacy flow without materializing unrelated widgets', () => {
    const entries = [widget('a', { placement: undefined }), widget('b', { placement: undefined })]
    const result = insert(snapshot(entries, ['a']), entries)
    expect(result.widgets[0]!.placement).toBeUndefined()
    expect(entries.every((w) => !w.placement)).toBe(true)
  })
  it('places copied flow widgets distinctly in a positioned destination without moving existing widgets', () => {
    const copied = snapshot([widget('source', { placement: undefined })])
    const entries = [widget('existing', { placement: { x: 12, y: 0, w: 12, h: 10 } })]
    const before = structuredClone(entries)
    const result = insert(copied, entries, 'role:admin')
    expect(result.widgets[0]!.placement).toBeDefined()
    expect(result.widgets[0]!.placement).not.toEqual(entries[0]!.placement)
    expect(entries).toEqual(before)
  })
  it('retains captured phone flow size when a positioned destination also needs a desktop fallback', () => {
    const source = [widget('source', { placement: undefined })]
    const copied = capture(source, ['source'], 'personal:a', 'phone', [{ x: 0, y: 0, w: 24, h: 5 }])
    const entries = [widget('existing', { placement: { x: 0, y: 0, w: 12, h: 10 } })]
    const result = paste(copied, entries, 'role:admin', 'phone', { x: 1, y: 1 }).widgets[0]!
    expect(result.devices?.phone || result.placement).toMatchObject({ w: 24, h: 5 })
    expect(result.placement).toMatchObject({ w: 12, h: 10 })
  })
  it('searches opposite-sign diagonals when edges and same-sign diagonals collide', () => {
    const entries = [
      widget('a', { placement: { x: 0, y: 1, w: 23, h: 5 } }),
      widget('b', { placement: { x: 0, y: 995, w: 23, h: 5 } }),
      widget('c', { placement: { x: 1, y: 1, w: 23, h: 5 } }),
      widget('d', { placement: { x: 0, y: 0, w: 23, h: 5 } }),
    ]
    const result = insert(snapshot(entries, ['a', 'b']), entries)
    expect(result.widgets.map((w) => w.placement)).toEqual([
      { x: 1, y: 0, w: 23, h: 5 },
      { x: 1, y: 994, w: 23, h: 5 },
    ])
  })
  it('rejects a mixed-region copy before replacing a prior clipboard', () => {
    const entries = [widget('a'), widget('b', { parentId: 'panel' }), panel]
    expect(() => snapshot(entries, ['a', 'b'])).toThrow('one container region')
  })
  it('fails atomically when no distinct bounded translation exists', () => {
    const entries = [
      widget('a', { placement: { x: 0, y: 0, w: 12, h: 100 } }),
      widget('b', { placement: { x: 12, y: 900, w: 12, h: 100 } }),
    ]
    const before = structuredClone(entries)
    expect(() => insert(snapshot(entries), entries)).toThrow('No distinct nearby position')
    expect(entries).toEqual(before)
  })
  it('rejects oversized subtrees and duplicate source IDs without mutating the snapshot', () => {
    const copied = snapshot([widget('source')])
    expect(() =>
      insert(
        copied,
        Array.from({ length: 12 }, (_, i) => widget(String(i))),
      ),
    ).toThrow('12-widget')
    const invalid = { ...copied, widgets: [...copied.widgets, ...copied.widgets] }
    expect(() => insert(invalid, [])).toThrow('invalid')
    expect(copied.widgets).toHaveLength(1)
  })
  it('retries colliding generated IDs and fails safely if IDs cannot be unique', () => {
    const entries = [widget('a')],
      copied = snapshot(entries)
    vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce('a' as ReturnType<typeof crypto.randomUUID>)
    expect(insert(copied, entries).widgets[0]!.id).not.toBe('a')
    vi.mocked(crypto.randomUUID).mockReturnValue('a' as ReturnType<typeof crypto.randomUUID>)
    expect(() => insert(copied, entries)).toThrow('unique widget IDs')
    expect(entries).toHaveLength(1)
  })
})
