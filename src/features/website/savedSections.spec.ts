import { describe, expect, it } from 'vitest'
import { captureSavedSection, insertSavedSection } from './savedSections'
import { newSection } from './types'

function fixture() {
  return [
    { ...newSection('container'), id: 'outer', layout: { x: 0, y: 0, w: 24, h: 20, z: 2 } },
    {
      ...newSection('container'),
      id: 'group',
      parentId: 'outer',
      layout: { x: 4, y: 8, w: 12, h: 8, z: 3 },
    },
    {
      ...newSection('image'),
      id: 'photo',
      parentId: 'group',
      imageId: 'asset',
      layout: { x: 0, y: 0, w: 4, h: 4, z: 1 },
      devices: { mobile: { appearance: { rotation: 12 } } },
    },
    { ...newSection('text'), id: 'note', layout: { x: 20, y: 12, w: 4, h: 4, z: 5 } },
  ]
}
describe('saved website sections', () => {
  it('captures a detached, independent subtree with remapped IDs and shared immutable assets', () => {
    const source = fixture()
    const saved = captureSavedSection(source, ['group', 'photo'], '  Project intro  ')!
    expect(saved.name).toBe('Project intro')
    expect(saved.sections).toHaveLength(2)
    expect(saved.sections[0]!.parentId).toBeUndefined()
    expect(saved.sections[0]!.layout).toMatchObject({ x: 0, y: 0, w: 12, h: 8 })
    expect(saved.sections[1]!.parentId).toBe(saved.sections[0]!.id)
    expect(saved.sections[1]!.imageId).toBe('asset')
    saved.sections[1]!.devices!.mobile!.appearance!.rotation = 40
    expect(source[2]!.devices!.mobile!.appearance!.rotation).toBe(12)
    expect(saved.sections.some((section) => source.some((entry) => entry.id === section.id))).toBe(
      false,
    )
  })
  it('inserts fresh copies below root widgets, preserving relative geometry and nested settings', () => {
    const saved = captureSavedSection(fixture(), ['group', 'note'], 'Group')!
    const existing = fixture()
    existing[2]!.layout!.y = 500 // a child's stored free-grid position does not reserve page space
    const result = insertSavedSection(saved, existing)!
    const copies = result.slice(existing.length)
    const roots = copies.filter((section) => !section.parentId)
    expect(roots.map((section) => section.layout!.y)).toEqual([21, 25])
    expect(roots.map((section) => section.layout!.x)).toEqual([0, 16])
    expect(copies[1]!.parentId).toBe(copies[0]!.id)
    expect(copies[1]!.devices).toEqual(saved.sections[1]!.devices)
    copies[1]!.devices!.mobile!.appearance!.rotation = 77
    expect(saved.sections[1]!.devices!.mobile!.appearance!.rotation).toBe(12)
    const again = insertSavedSection(saved, result)!.slice(result.length)
    expect(new Set([...copies, ...again].map((section) => section.id)).size).toBe(
      copies.length + again.length,
    )
    expect(existing[0]!.layout!.z).toBe(2)
  })
  it('rejects empty selections, invalid names and insertions beyond page limits', () => {
    expect(captureSavedSection(fixture(), [], 'Name')).toBeUndefined()
    expect(captureSavedSection(fixture(), ['note'], ' ')).toBeUndefined()
    expect(captureSavedSection(fixture(), ['note'], 'x'.repeat(81))).toBeUndefined()
    const saved = captureSavedSection(fixture(), ['note'], 'Name')!
    expect(
      insertSavedSection(
        saved,
        Array.from({ length: 30 }, (_, index) => ({ ...newSection('text'), id: String(index) })),
      ),
    ).toBeUndefined()
    const full = [{ ...newSection('text'), layout: { x: 0, y: 9999, w: 4, h: 1, z: 10000 } }]
    expect(insertSavedSection(saved, full)).toBeUndefined()
  })
})
