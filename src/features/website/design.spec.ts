import { describe, expect, it } from 'vitest'
import { newSection, type WebsitePage } from './types'
import { descendants, canContain, visibleSections } from './containers'
import { cloneWidgets } from './selection'
import { copyPage } from './pageTools'
import { appearanceStyle, visualGeometry } from './appearance'

describe('website containers and appearance', () => {
  function tree() {
    return [
      {
        ...newSection('container'),
        id: 'outer',
        container: { direction: 'row' as const, gap: 20 },
      },
      { ...newSection('container'), id: 'inner', parentId: 'outer' },
      {
        ...newSection('text'),
        id: 'child',
        parentId: 'inner',
        appearance: { rotation: 15, color: '#123456' },
      },
      { ...newSection('text'), id: 'other' },
    ]
  }
  it('collects descendants and prevents cycles or non-container parents', () => {
    const sections = tree()
    expect(descendants(sections, ['outer']).map((entry) => entry.id)).toEqual([
      'outer',
      'inner',
      'child',
    ])
    expect(canContain(sections, 'outer', 'inner')).toBe(false)
    expect(canContain(sections, 'outer', 'outer')).toBe(false)
    expect(canContain(sections, 'outer', 'other')).toBe(false)
    expect(canContain(sections, 'child', 'outer')).toBe(true)
    sections[0]!.hidden = true
    expect(visibleSections(sections).map((entry) => entry.id)).toEqual(['other'])
  })
  it('copies complete container trees with independent styles and remapped parents', () => {
    const original = tree()
    const copied = cloneWidgets(descendants(original, ['outer']), original)
    expect(copied[1]!.parentId).toBe(copied[0]!.id)
    expect(copied[2]!.parentId).toBe(copied[1]!.id)
    copied[0]!.container!.gap = 99
    copied[2]!.appearance!.rotation = -15
    expect(original[0]!.container!.gap).toBe(20)
    expect(original[2]!.appearance!.rotation).toBe(15)
    const page: WebsitePage = {
      id: 'page',
      title: 'Home',
      slug: 'home',
      description: '',
      inNavigation: true,
      sections: original,
    }
    const copy = copyPage(page, [page])
    expect(copy.sections[1]!.parentId).toBe(copy.sections[0]!.id)
    expect(copy.sections[2]!.parentId).toBe(copy.sections[1]!.id)
    const detached = cloneWidgets([original[2]!], [])
    expect(detached[0]!.parentId).toBeUndefined()
  })
  it('preserves zero appearance values and measures rotated corners in design pixels', () => {
    expect(appearanceStyle({ padding: 12, paddingTop: 0, margin: 8, marginLeft: 0 })).toMatchObject(
      {
        paddingTop: '0px',
        paddingRight: '12px',
        paddingBottom: '12px',
        paddingLeft: '12px',
        marginTop: '8px',
        marginLeft: '0px',
        '--widget-margin-left': '0px',
        '--widget-margin-top': '8px',
      },
    )
    expect(appearanceStyle({ padding: 0, borderWidth: 0 })).toMatchObject({
      padding: '0px',
      borderWidth: '0px',
    })
    const layout = { x: 10, y: 10, w: 8, h: 4, z: 2 }
    expect(visualGeometry(layout)).toBe(layout)
    const rotated = visualGeometry(layout, 90)
    expect(rotated.w * 45).toBeCloseTo(128)
    expect(rotated.h * 32).toBeCloseTo(360)
    expect(rotated.x * 45 + (rotated.w * 45) / 2).toBeCloseTo(630)
    expect(visualGeometry(layout, -90)).toEqual(rotated)
  })
})
