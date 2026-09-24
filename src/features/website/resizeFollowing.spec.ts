import { describe, expect, it } from 'vitest'
import { resizeWithFollowing } from './grid'
import { newSection } from './types'

function widget(id: string, y: number, h = 4, x = 0) {
  return { ...newSection('text'), id, layout: { x, y, w: 12, h, z: 1 } }
}

describe('section resize following content', () => {
  it('moves later rows together in either direction while preserving gaps and columns', () => {
    const nav = widget('nav', 0)
    const sections = [nav, widget('left', 6), widget('right', 6, 4, 12), widget('footer', 12)]
    const shrunk = resizeWithFollowing(sections, 'nav', { ...nav.layout, h: 2 })
    expect(shrunk.left).toMatchObject({ x: 0, y: 4, h: 4 })
    expect(shrunk.right).toMatchObject({ x: 12, y: 4, h: 4 })
    expect(shrunk.footer?.y).toBe(10)
    const grown = resizeWithFollowing(sections, 'nav', { ...nav.layout, h: 7 })
    expect(grown.left?.y).toBe(9)
    expect(grown.footer?.y).toBe(15)
    expect(sections[1]!.layout.y).toBe(6)
  })

  it('leaves overlapping, adjacent, nested and locked widgets in place', () => {
    const nav = widget('nav', 0)
    const sections = [
      nav,
      widget('overlap', 2),
      widget('adjacent', 0, 4, 12),
      { ...widget('child', 6), parentId: 'nav' },
      { ...widget('locked', 6), locked: true },
      widget('next', 6),
    ]
    expect(Object.keys(resizeWithFollowing(sections, 'nav', { ...nav.layout, h: 2 }))).toEqual([
      'nav',
      'next',
    ])
  })

  it('does not shift rows for moving, width changes or a resize with an anchored bottom', () => {
    const nav = widget('nav', 0)
    const sections = [nav, widget('next', 6)]
    for (const change of [{ y: 1 }, { w: 20 }, { y: 1, h: 3 }])
      expect(
        Object.keys(resizeWithFollowing(sections, 'nav', { ...nav.layout, ...change })),
      ).toEqual(['nav'])
  })

  it('limits growth as a group at the canvas boundary without compressing spacing', () => {
    const nav = widget('nav', 0)
    const layouts = resizeWithFollowing([nav, widget('next', 9994)], 'nav', {
      ...nav.layout,
      h: 12,
    })
    expect(layouts.nav?.h).toBe(6)
    expect(layouts.next?.y).toBe(9996)
  })
})
