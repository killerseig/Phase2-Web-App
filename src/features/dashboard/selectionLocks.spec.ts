import { describe, expect, it } from 'vitest'
import { selectionLockState as state, setSelectionLock as change } from './selectionLocks'
import type { SharedDashboardWidget as Widget } from './sharedDashboards'

const widget = (id: string, extra: Partial<Widget> = {}): Widget => ({
  id,
  type: 'text',
  title: id,
  text: '',
  span: 6,
  placement: { x: 1.25, y: 2.5, w: 8, h: 6 },
  devices: { phone: { x: 0, y: 3, w: 12, h: 7 } },
  ...extra,
})
describe('selected outermost widget locks', () => {
  it('reports empty, unlocked, locked and mixed effective states independent of selection order', () => {
    const entries = [widget('a'), widget('b', { positionLocked: true })]
    expect(state(entries, [], 'positionLocked')).toMatchObject({
      total: 0,
      checked: false,
      mixed: false,
    })
    expect(state(entries, ['a'], 'positionLocked')).toMatchObject({
      ownCount: 0,
      checked: false,
      mixed: false,
    })
    expect(state(entries, ['b'], 'positionLocked')).toMatchObject({
      ownCount: 1,
      checked: true,
      mixed: false,
    })
    expect(state(entries, ['a', 'b'], 'positionLocked')).toMatchObject({
      total: 2,
      ownCount: 1,
      checked: false,
      mixed: true,
    })
    expect(state(entries, ['a', 'b'], 'positionLocked')).toEqual(
      state(entries, ['b', 'a'], 'positionLocked'),
    )
    expect(state(entries, ['a', 'b'], 'sizeLocked').mixed).toBe(false)
  })
  it('applies one immutable root change across regions without altering geometry or other flags', () => {
    const entries = [
      widget('a', { region: '0' }),
      widget('b', { region: '1', sizeLocked: true }),
      widget('unselected'),
    ]
    const result = change(entries, ['a', 'b'], 'positionLocked', true)
    expect(result.slice(0, 2).map((w) => w.positionLocked)).toEqual([true, true])
    expect(result[2]).toBe(entries[2])
    expect(result[1]!.sizeLocked).toBe(true)
    entries.forEach((w, i) => {
      expect(w.positionLocked).toBeUndefined()
      expect(result[i]!.placement).toBe(w.placement)
      expect(result[i]!.devices).toBe(w.devices)
    })
  })
  it('preserves hidden and explicitly selected descendant locks when changing a parent', () => {
    const entries = [
      widget('parent', { positionLocked: true }),
      widget('child', { parentId: 'parent', positionLocked: true }),
      widget('hidden', { parentId: 'parent', region: '1', sizeLocked: true }),
    ]
    const result = change(entries, ['parent', 'child'], 'positionLocked', false)
    expect(result[0]!.positionLocked).toBe(false)
    expect(result[1]).toBe(entries[1])
    expect(result[2]).toBe(entries[2])
    expect(state(result, ['child'], 'positionLocked')).toMatchObject({
      checked: true,
      ownCount: 1,
      inheritedCount: 0,
    })
  })
  it('reports all controlling ancestors and blocks the whole inherited axis without partial changes', () => {
    const entries = [
      widget('grandparent', { positionLocked: true }),
      widget('parent', { parentId: 'grandparent', positionLocked: true }),
      widget('child', { parentId: 'parent' }),
      widget('other'),
    ]
    expect(state(entries, ['child', 'other'], 'positionLocked')).toMatchObject({
      checked: false,
      mixed: true,
      inheritedCount: 1,
      ownCount: 0,
      blocked: true,
      parents: ['parent', 'grandparent'],
    })
    expect(change(entries, ['child', 'other'], 'positionLocked', true)).toBe(entries)
    expect(change(entries, ['child'], 'positionLocked', false)).toBe(entries)
    expect(change(entries, ['child'], 'sizeLocked', true)[2]!.sizeLocked).toBe(true)
  })
  it('does not dirty absent/false/already set flags or missing selections', () => {
    const entries = [
      widget('a'),
      widget('b', { positionLocked: false }),
      widget('c', { positionLocked: true }),
    ]
    expect(change(entries, ['a', 'b'], 'positionLocked', false)).toBe(entries)
    expect(change(entries, ['c'], 'positionLocked', true)).toBe(entries)
    expect(change(entries, ['missing'], 'positionLocked', true)).toBe(entries)
    expect(change(entries, [], 'positionLocked', true)).toBe(entries)
  })
  it('does not recurse forever through a broken ancestor chain', () => {
    const entries = [
      widget('a', { parentId: 'b' }),
      widget('b', { parentId: 'a', sizeLocked: true }),
    ]
    expect(state(entries, ['a'], 'sizeLocked')).toMatchObject({ total: 0, checked: false })
    expect(change(entries, ['a'], 'sizeLocked', false)).toBe(entries)
  })
})
