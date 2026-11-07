import { describe, expect, it } from 'vitest'
import type { SharedDashboardWidget as Widget } from './sharedDashboards'
import {
  assignWidgetSurface,
  planWidgetMove,
  resolveMoveSurface,
  type MoveSurface,
} from './widgetMove'
import type { Placement } from './widgetPlacement'

const a: Widget = {
  id: 'a',
  type: 'text',
  title: 'Alpha',
  text: 'Private text',
  span: 6,
  placement: { x: 1.25, y: 2.5, w: 4, h: 6 },
  devices: { phone: { x: 0, y: 5, w: 24, h: 8 } },
}
const panel: Widget = {
  id: 'panel',
  type: 'container',
  title: 'Panel',
  text: '',
  span: 12,
  placement: { x: 9, y: 1, w: 15, h: 18 },
  container: {
    kind: 'tabs',
    labels: ['One', 'Two'],
    direction: 'row',
    ratio: 50,
    collapsed: false,
  },
}
function surface(
  widgets: Widget[],
  parentId = '',
  region = '0',
  width = 1080,
  measured = new Map<string, Placement>(),
): MoveSurface {
  const identity = { parentId, region }
  return {
    ...identity,
    width,
    scale: 1,
    positions: resolveMoveSurface(widgets, identity, 'desktop', measured),
  }
}
function move(widgets: Widget[], extra: Partial<Parameters<typeof planWidgetMove>[0]> = {}) {
  return planWidgetMove({
    widgets,
    ids: ['a'],
    primaryId: 'a',
    device: 'desktop',
    scope: 'personal',
    source: surface(widgets),
    target: surface(widgets, 'panel', '0', 540),
    point: { x: 180, y: 96 },
    grid: { x: 1, y: 1, snap: false },
    ...extra,
  })
}
describe('atomic widget moves between surfaces', () => {
  it('supports inspector assignments without rounding local placements or reflowing destination siblings', () => {
    const sibling = { ...a, id: 'flow', parentId: 'panel', region: '0', placement: undefined }
    const widgets = [a, panel, sibling]
    const measured = { x: 0.123456, y: 0.234567, w: 12.345678, h: 9.123456 }
    const result = move(widgets, {
      preserveLocalPlacement: true,
      target: surface(widgets, 'panel', '0', 540, new Map([['flow', measured]])),
    })
    expect(result.reason).toBe('')
    expect(result.widgets[0]!.placement).toEqual(a.placement)
    expect(result.widgets[2]!.placement).toEqual(measured)
    expect(result.widgets[0]!.devices).toBe(a.devices)
  })
  it('projects physical dimensions, retains IDs/content/device overrides and changes one root', () => {
    const widgets = [a, panel]
    const result = move(widgets)
    expect(result.reason).toBe('')
    expect(result.widgets[0]).toMatchObject({
      id: 'a',
      parentId: 'panel',
      region: '0',
      text: 'Private text',
    })
    expect(result.widgets[0]!.placement).toEqual({ x: 8, y: 3, w: 8, h: 6 })
    expect(result.widgets[0]!.devices).toBe(a.devices)
    expect(result.widgets[1]).toBe(panel)
    expect(a.parentId).toBeUndefined()
  })
  it('moves multiple roots with one bounded delta and preserves descendants locally', () => {
    const b = { ...a, id: 'b', placement: { x: 6.25, y: 4.5, w: 3, h: 5 } }
    const group = { ...a, id: 'a', type: 'container' as const, container: panel.container }
    const child = {
      ...a,
      id: 'child',
      parentId: 'a',
      region: '1',
      placement: { x: 0, y: 0, w: 6, h: 4 },
    }
    const widgets = [group, b, child, panel]
    const result = move(widgets, {
      ids: ['a', 'b', 'child'],
      primaryId: 'child',
      point: { x: 900, y: -100 },
    })
    expect(result.reason).toBe('')
    expect(result.widgets[1]!.placement!.x - result.widgets[0]!.placement!.x).toBe(10)
    expect(result.widgets[1]!.placement!.y - result.widgets[0]!.placement!.y).toBe(2)
    expect(result.widgets[1]!.placement!.x + result.widgets[1]!.placement!.w).toBe(24)
    expect(result.widgets[0]!.placement!.y).toBe(0)
    expect(result.widgets[2]).toBe(child)
    expect(result.widgets.slice(0, 2).map((w) => w.parentId)).toEqual(['panel', 'panel'])
  })
  it('converts unequal split regions and accounts for scale without changing physical size', () => {
    const widgets = [
      { ...panel, container: { ...panel.container!, kind: 'split' as const } },
      { ...a, parentId: 'panel', region: '0' },
    ]
    const source = surface(widgets, 'panel', '0', 600),
      target = surface(widgets, 'panel', '1', 300)
    source.scale = 0.5
    target.scale = 0.75
    const result = move(widgets, { source, target })
    expect(result.reason).toBe('')
    const p = result.widgets[1]!.placement!
    expect((p.w / 24) * target.width * target.scale).toBeCloseTo(
      (a.placement!.w / 24) * source.width * source.scale,
    )
    expect(p.h * target.scale).toBeCloseTo(a.placement!.h * source.scale)
    expect(result.widgets[1]!.region).toBe('1')
  })
  it('moves nested widgets out to root without leaving parent/region fields', () => {
    const widgets = [panel, { ...a, parentId: 'panel', region: '1' }]
    const result = move(widgets, {
      source: surface(widgets, 'panel', '1', 540),
      target: surface(widgets),
    })
    expect(result.reason).toBe('')
    expect(result.widgets[1]!.parentId).toBeUndefined()
    expect(result.widgets[1]!.region).toBeUndefined()
    expect(result.widgets[1]!.placement!.w).toBe(2)
  })
  it.each(['tablet', 'phone'] as const)(
    'rejects shared membership changes from %s without changing overrides',
    (device) => {
      const widgets = [a, panel]
      const result = move(widgets, { device })
      expect(result.widgets).toBe(widgets)
      expect(result.reason).toContain('Desktop')
      expect(
        assignWidgetSurface(widgets, ['a'], { parentId: 'panel', region: '0' }, device, 'personal')
          .widgets,
      ).toBe(widgets)
    },
  )
  it('still supports same-surface device moves and exact no-ops', () => {
    const widgets = [a, panel],
      source = surface(widgets)
    const unchanged = move(widgets, {
      target: source,
      point: { x: (a.placement!.x / 24) * 1080, y: 80 },
      grid: { x: 0.25, y: 0.5, snap: true },
    })
    expect(unchanged.widgets).toBe(widgets)
    const changed = move(widgets, { target: source, device: 'tablet' })
    expect(changed.reason).toBe('')
    expect(changed.widgets[0]!.placement).toBe(a.placement)
    expect(changed.widgets[0]!.devices!.phone).toBe(a.devices!.phone)
    expect(changed.widgets[0]!.devices!.tablet).toBeDefined()
  })
  it('rejects selections that would need individual resizing or have incompatible source regions', () => {
    const widgets = [{ ...a, placement: { ...a.placement!, w: 20 } }, panel]
    expect(move(widgets).reason).toContain('Resize')
    expect(move(widgets).widgets).toBe(widgets)
    const mixed = [a, { ...a, id: 'b', parentId: 'panel', region: '1' }, panel]
    expect(move(mixed, { ids: ['a', 'b'] }).reason).toContain('one container region')
  })
  it.each(['own', 'ancestor', 'destination'] as const)(
    'rejects effective position locks on %s',
    (kind) => {
      const sourceParent = { ...panel, id: 'source', positionLocked: kind === 'ancestor' }
      const widgets = [
        sourceParent,
        { ...a, parentId: 'source', positionLocked: kind === 'own' },
        { ...panel, positionLocked: kind === 'destination' },
      ]
      const result = move(widgets, { source: surface(widgets, 'source') })
      expect(result.widgets).toBe(widgets)
      expect(result.reason).toMatch(/lock/i)
    },
  )
  it('permits size-locked roots to move without physical resizing', () => {
    const widgets = [{ ...a, sizeLocked: true }, panel]
    const result = move(widgets)
    expect(result.reason).toBe('')
    expect(result.widgets[0]!.sizeLocked).toBe(true)
    expect((result.widgets[0]!.placement!.w / 24) * 540).toBe((a.placement!.w / 24) * 1080)
  })
  it('rejects cycles, invalid regions and descendant depth overflow atomically', () => {
    const group = { ...panel, id: 'a' },
      child = { ...panel, id: 'child', parentId: 'a' }
    const widgets = [group, child, panel]
    expect(
      assignWidgetSurface(widgets, ['a'], { parentId: 'child', region: '0' }, 'desktop', 'personal')
        .reason,
    ).toContain('children')
    expect(
      assignWidgetSurface(widgets, ['a'], { parentId: 'panel', region: '5' }, 'desktop', 'personal')
        .widgets,
    ).toBe(widgets)
    const nested = [
      panel,
      ...['p1', 'p2', 'p3', 'p4'].map((id, i, ids) => ({
        ...panel,
        id,
        parentId: i ? ids[i - 1] : 'panel',
      })),
      a,
    ]
    expect(
      assignWidgetSurface(nested, ['a'], { parentId: 'p4', region: '0' }, 'desktop', 'personal')
        .reason,
    ).toContain('depth')
  })
  it('pins affected source/destination fallback siblings but preserves hidden and authored widgets', () => {
    const b = { ...a, id: 'b', placement: undefined },
      c = { ...a, id: 'c', parentId: 'panel', placement: undefined }
    const hidden = { ...a, id: 'hidden', parentId: 'panel', region: '1', placement: undefined }
    const widgets = [a, b, panel, c, hidden]
    const source = surface(widgets),
      target = surface(widgets, 'panel', '0', 540, new Map([['c', { x: 0, y: 0, w: 12, h: 6 }]]))
    const result = move(widgets, { source, target })
    expect(result.reason).toBe('')
    expect(result.widgets[1]!.placement).toEqual(source.positions.get('b'))
    expect(result.widgets[3]!.placement).toEqual(target.positions.get('c'))
    expect(result.widgets[2]).toBe(panel)
    expect(result.widgets[4]).toBe(hidden)
  })
  it('preserves remaining source siblings when its last authored widget leaves', () => {
    const b = { ...a, id: 'b', parentId: 'panel', placement: undefined }
    const widgets = [panel, { ...a, parentId: 'panel' }, b]
    const source = surface(widgets, 'panel', '0', 540),
      target = surface(widgets)
    const result = move(widgets, { source, target })
    expect(result.reason).toBe('')
    expect(result.widgets[2]!.placement).toEqual(source.positions.get('b'))
  })
  it('preserves measured flow siblings and rejects missing/invalid boxes without guessing', () => {
    const b = { ...a, id: 'b', placement: undefined }
    const widgets = [{ ...a, placement: undefined }, b, { ...panel, placement: undefined }]
    const boxes = new Map([
      ['a', a.placement!],
      ['b', { x: 12, y: 0, w: 12, h: 8 }],
      ['panel', { x: 0, y: 15, w: 24, h: 20 }],
    ])
    const source = surface(widgets, '', '0', 1080, boxes)
    const result = move(widgets, { source })
    expect(result.reason).toBe('')
    expect(result.widgets[1]!.placement).toEqual(boxes.get('b'))
    expect(result.widgets[2]!.placement).toEqual(boxes.get('panel'))
    boxes.delete('b')
    expect(move(widgets, { source }).widgets).toBe(widgets)
  })
  it('retains required tools and private identity when moving a subtree', () => {
    const tools = { ...a, type: 'workflows' as const }
    const widgets = [tools, panel]
    const result = move(widgets, { scope: 'job' })
    expect(result.reason).toBe('')
    expect(result.widgets[0]).toMatchObject({ id: 'a', type: 'workflows', text: a.text })
    expect(result.widgets).toHaveLength(widgets.length)
  })
})
