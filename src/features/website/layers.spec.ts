import { describe, expect, it } from 'vitest'
import { layerRows, layerSiblings, reorderLayer } from './layers'
import { newSection } from './types'

function item(id: string, z: number, parentId?: string) {
  return { ...newSection('container'), id, parentId, layout: { x: 2, y: 4, w: 5, h: 6, z } }
}
describe('website layer hierarchy', () => {
  it('matches paint order, breaking ties with later siblings and nesting within parents', () => {
    const sections = [
      item('back', 0),
      item('container', 10),
      item('child', 99, 'container'),
      item('front', 10),
    ]
    expect(layerRows(sections).map((row) => [row.section.id, row.depth])).toEqual([
      ['front', 0],
      ['container', 0],
      ['child', 1],
      ['back', 0],
    ])
    sections[1]!.hidden = true
    expect(layerRows(sections).find((row) => row.section.id === 'child')!.inheritedHidden).toBe(
      true,
    )
  })
  it('reorders only sibling stacking values and retains geometry, content order and membership', () => {
    const sections = [
      item('a', 7),
      item('container', 10),
      item('child-a', 4, 'container'),
      item('child-b', 4, 'container'),
      item('c', 99),
    ]
    const original = structuredClone(sections)
    const reordered = reorderLayer(sections, 'a', 'c', 'before')
    expect(layerSiblings(reordered).map((section) => section.id)).toEqual(['a', 'c', 'container'])
    expect(reordered.map((section) => section.id)).toEqual(sections.map((section) => section.id))
    expect(sections).toEqual(original)
    expect(reordered[0]!.layout).toMatchObject({ x: 2, y: 4, w: 5, h: 6 })
    expect(reordered[2]).toEqual(sections[2])
    const children = reorderLayer(reordered, 'child-b', 'child-a', 'after')
    expect(layerSiblings(children, 'container').map((section) => section.id)).toEqual([
      'child-a',
      'child-b',
    ])
    expect(layerSiblings(children).map((section) => section.layout?.z)).toEqual(
      layerSiblings(reordered).map((section) => section.layout?.z),
    )
    expect(children[2]!.parentId).toBe('container')
  })
  it('ignores unchanged, missing and cross-container drops', () => {
    const sections = [item('a', 1), item('b', 2), item('child', 3, 'a')]
    for (const [source, target, placement] of [
      ['a', 'b', 'after'],
      ['a', 'child', 'before'],
      ['missing', 'a', 'before'],
      ['a', 'a', 'after'],
    ] as const)
      expect(reorderLayer(sections, source, target, placement)).toBe(sections)
  })
})
