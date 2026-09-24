import { describe, expect, it } from 'vitest'
import type { JSONContent } from '@tiptap/vue-3'
import { inlineDocument, inlineValue } from './inlineText'
import { formattedText, inlineText, textLinks } from '../../../functions/src/websiteContent'

const paragraph = (content: JSONContent[]): JSONContent => ({ type: 'paragraph', content })
const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content })
const text = (value: string, ...marks: string[]): JSONContent => ({
  type: 'text',
  text: value,
  marks: marks.map((type) => ({ type })),
})

describe('inline website text', () => {
  it('preserves plain text, blank lines, literal markup and non-ASCII content', () => {
    const value = '# Hello **literal** [link]\n\n<svg onload=alert(1)> © Café \\files\n'
    expect(inlineValue(inlineDocument(value))).toEqual({ text: value })
  })
  it('round trips headings, lists, safe links and overlapping marks', () => {
    const original = doc(
      { type: 'heading', attrs: { level: 2 }, content: [text('Title')] },
      paragraph([text('Bold ', 'bold'), text('and italic', 'bold', 'italic'), text(' & ordinary')]),
      paragraph([text('Italic ', 'italic'), text('and bold', 'italic', 'bold')]),
      {
        type: 'bulletList',
        content: ['One', 'Two'].map((value) => ({
          type: 'listItem',
          content: [paragraph([text(value)])],
        })),
      },
      {
        type: 'orderedList',
        content: [{ type: 'listItem', content: [paragraph([text('First')])] }],
      },
      paragraph([
        {
          type: 'text',
          text: 'Email',
          marks: [{ type: 'link', attrs: { href: 'mailto:office@example.com' } }],
        },
      ]),
    )
    const saved = inlineValue(original)
    expect(saved.format).toBe('markdown')
    expect(inlineDocument(saved.text, saved.format)).toEqual(original)
    expect(textLinks(saved.text)).toEqual(['mailto:office@example.com'])
  })
  it('escapes literal markdown when formatting is added elsewhere', () => {
    const original = doc(
      paragraph([text('# literal *stars* [brackets] \\path 1. hello - dash')]),
      paragraph([text('Bold', 'bold')]),
    )
    const saved = inlineValue(original)
    expect(formattedText(saved.text).map((block) => block.type)).toEqual(['p', 'p'])
    expect(inlineDocument(saved.text, saved.format)).toEqual(original)
    expect(inlineText('Unfinished **bold')).toEqual([{ type: 'text', text: 'Unfinished **bold' }])
  })
  it('rejects unsafe links and text beyond the server limits without truncation', () => {
    expect(() => inlineValue(inlineDocument('x'.repeat(161)), true)).toThrow('160')
    expect(() => inlineValue(inlineDocument('x'.repeat(8001)))).toThrow('8,000')
    expect(() => inlineValue(inlineDocument('two\nlines'), true)).toThrow('single line')
    expect(() =>
      inlineValue(
        doc(
          paragraph([
            {
              type: 'text',
              text: 'Bad',
              marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
            },
          ]),
        ),
      ),
    ).toThrow('valid HTTPS')
    expect(
      inlineValue(
        doc({
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [paragraph([text('One')]), paragraph([text('Two')])] },
          ],
        }),
      ),
    ).toHaveProperty('rich')
  })
  it('keeps existing markdown semantics without converting HTML into nodes', () => {
    const value =
      '## Heading\n**Bold** and *italic*\n- One\n- Two\n1. First\n[Home](/website)\n<script>alert(1)</script>'
    const parsed = inlineDocument(value, 'markdown')
    const saved = inlineValue(parsed, false, true)
    expect(inlineDocument(saved.text, saved.format)).toEqual(parsed)
    expect(parsed.content!.at(-1)!.content![0]!.text).toBe('<script>alert(1)</script>')
  })
})
