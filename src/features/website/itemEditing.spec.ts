import { describe, expect, it } from 'vitest'
import { inlineItem } from './itemEditing'
import { copySection } from './pageTools'
import { newItem, newSection } from './types'

describe('inline item editing', () => {
  it('resolves a field within its owner even when collections reuse child IDs', () => {
    const first = newSection('cards'),
      second = newSection('cards')
    first.items = [{ ...newItem(), id: 'card' }]
    second.items = [{ ...newItem(), id: 'card' }]
    const sections = [first, second]
    expect(inlineItem(sections, { id: second.id, key: 'card', field: 'title' })).toBe(
      second.items[0],
    )
    expect(inlineItem(sections, { id: first.id, field: 'linkLabel' })).toBe(first)
    expect(inlineItem(sections, { id: first.id, key: 'missing', field: 'text' })).toBeUndefined()
    expect(inlineItem(sections, { id: 'missing', key: 'card', field: 'title' })).toBeUndefined()
  })

  it('copies formatted button labels without sharing editable content', () => {
    const section = newSection('cards')
    section.linkRichText = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Read more', marks: [{ type: 'bold' }] }],
        },
      ],
    }
    section.items = [{ ...newItem(), linkRichText: structuredClone(section.linkRichText) }]
    const copy = copySection(section)
    copy.linkRichText!.content![0]!.content![0]!.text = 'Changed button'
    copy.items[0]!.linkRichText!.content![0]!.content![0]!.marks = []
    expect(section.linkRichText.content![0]!.content![0]!.text).toBe('Read more')
    expect(section.items[0]!.linkRichText!.content![0]!.content![0]!.marks).toEqual([
      { type: 'bold' },
    ])
  })
})
