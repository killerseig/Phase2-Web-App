import { describe, expect, it } from 'vitest'
import { defaultGrid, resizeWithFollowing } from './grid'
import { newSection } from './types'
import { keyboardGeometry, KEYBOARD_GEOMETRY_PRECISION } from './keyboardGeometry'

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

  it.each([0.5, 1, 2])('preserves a one-screen-pixel keyboard height change and the following gap at %sx', scale => {
    const nav = widget('nav', 3.23453, 6.18741)
    const next = widget('next', 12.12347)
    const proposed = keyboardGeometry({ nav: nav.layout }, {
      key: 'ArrowDown', precise: true, action: 'bottom', scale, settings: defaultGrid(),
    }).nav!
    const layouts = resizeWithFollowing([nav, next], nav.id, proposed, KEYBOARD_GEOMETRY_PRECISION)
    expect((layouts.nav!.h - nav.layout.h) * 32 * scale).toBeCloseTo(1, 8)
    expect((layouts.next!.y - next.layout.y) * 32 * scale).toBeCloseTo(1, 8)
    expect(layouts.next!.y - layouts.nav!.y - layouts.nav!.h).toBeCloseTo(next.layout.y - nav.layout.y - nav.layout.h, 10)
    expect({ ...layouts.next!, y: next.layout.y }).toEqual(next.layout)
    expect({ ...layouts.nav!, h: nav.layout.h }).toEqual(nav.layout)
  })

  it('keeps high-precision following rows strictly inside saved bounds and avoids a blocked edit', () => {
    const nav = widget('nav', 0, 4.123456789123)
    const following = widget('following', 9994.23456789123, 4)
    const layouts = resizeWithFollowing([nav, following], nav.id, { ...nav.layout, h: 20 }, KEYBOARD_GEOMETRY_PRECISION)
    expect(layouts.following!.y + layouts.following!.h).toBeLessThanOrEqual(10000)
    expect(layouts.following!.y).toBe(9996)
    expect(layouts.nav!.h - nav.layout.h).toBeCloseTo(9996 - following.layout.y, 8)
    const blocked = { ...following, layout: { ...following.layout, h: 10000 - following.layout.y } }
    expect(resizeWithFollowing([nav, blocked], nav.id, { ...nav.layout, h: 20 }, KEYBOARD_GEOMETRY_PRECISION)).toEqual({ nav: nav.layout })
  })
})
