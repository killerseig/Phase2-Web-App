import { describe, expect, it } from 'vitest'
import { translateSelection, intersectingWidgets, cloneWidgets, layerSelection } from './selection'
import { newItem, newSection } from './types'

describe('website group edits', () => {
  const layouts = {
    first: { x: 2, y: 3, w: 4, h: 4, z: 1 },
    second: { x: 8, y: 5, w: 4, h: 3, z: 2 },
  }
  it('clamps the whole selection together without changing relative positions', () => {
    const moved = translateSelection(layouts, -10, -20)
    expect(moved.first!.x).toBe(0)
    expect(moved.second!.x - moved.first!.x).toBe(6)
    expect(moved.second!.y - moved.first!.y).toBe(2)
    const far = translateSelection(layouts, 10000, 10000)
    expect(far.second!.x + far.second!.w).toBe(1000)
    expect(far.second!.y + far.second!.h).toBe(10000)
    expect(layouts.first.x).toBe(2)
  })
  it('box-selects intersecting widgets and ignores adjacent edges', () => {
    expect(intersectingWidgets(layouts, { x: 0, y: 0, w: 6, h: 7, z: 0 })).toEqual(['first'])
    expect(intersectingWidgets(layouts, { x: 12, y: 0, w: 2, h: 20, z: 0 })).toEqual([])
  })
  it('copies complete groups with fresh IDs and independent nested content', () => {
    const source = [
      { ...newSection('cards'), id: 'a', layout: { ...layouts.first, z: 8 }, items: [newItem()] },
      { ...newSection('text'), id: 'b', layout: layouts.second },
    ]
    const copied = cloneWidgets(source, source, { x: 20, y: 20 })
    expect(copied.map((entry) => entry.id)).not.toEqual(['a', 'b'])
    expect(copied[0]!.items[0]!.id).not.toBe(source[0]!.items[0]!.id)
    expect(copied[0]!.layout!.x).toBe(20)
    expect(copied[1]!.layout!.x).toBe(26)
    expect(copied[0]!.layout!.z).toBeGreaterThan(copied[1]!.layout!.z)
    copied[0]!.items[0]!.title = 'Only the copy'
    expect(source[0]!.items[0]!.title).toBe('')
    expect(
      cloneWidgets(
        source,
        Array.from({ length: 29 }, () => newSection('text')),
      ),
    ).toEqual([])
  })
  it('changes layers without reordering content or overflowing layer limits', () => {
    const sections = [
      { ...newSection('text'), id: 'a', layout: { ...layouts.first, z: 10000 } },
      { ...newSection('text'), id: 'b', layout: layouts.second },
    ]
    expect(layerSelection(sections, ['b'], true).b!.z).toBe(2)
    expect(layerSelection(sections, ['a'], false).a!.z).toBe(1)
    expect(sections.map((entry) => entry.id)).toEqual(['a', 'b'])
    expect(sections[0]!.layout.z).toBe(10000)
  })
})
