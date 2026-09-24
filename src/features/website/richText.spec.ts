import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import {
  validateRichText,
  richTextLinks,
  richTextPlain,
  type RichTextNode,
} from '../../../functions/src/websiteRichText'
import { inlineDocument, inlineValue } from './inlineText'
import { copyPage } from './pageTools'
import { newSection } from './types'
import { publishingChecks } from './publishing'
import WebsiteRichText from '@/components/website/WebsiteRichText.vue'

function rich(): RichTextNode {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        attrs: { textAlign: 'center', indent: 2, lineHeight: '1.5' },
        content: [
          {
            type: 'text',
            text: '<img onerror=alert(1)> Safe',
            marks: [
              { type: 'underline' },
              {
                type: 'textStyle',
                attrs: {
                  color: '#c02030',
                  backgroundColor: '#fff59d',
                  fontFamily: 'Georgia',
                  fontSize: '24px',
                },
              },
              { type: 'link', attrs: { href: '/website' } },
            ],
          },
        ],
      },
    ],
  }
}
describe('website rich text', () => {
  it('round trips styles and heading marks without putting JSON in plain content fields', () => {
    const value = inlineValue(rich())
    expect(value.text).toBe('<img onerror=alert(1)> Safe')
    expect(value.rich).toEqual(rich())
    expect(inlineDocument(value.text, value.format, value.rich)).toEqual(rich())
    const heading = inlineValue(rich(), true)
    expect(heading.rich).toEqual(rich())
    expect(richTextLinks(heading.rich)).toEqual(['/website'])
  })
  it('renders styles as safe nodes while preserving literal HTML and semantic links', () => {
    const view = mount(WebsiteRichText, { props: { value: rich() } })
    expect(view.find('img').exists()).toBe(false)
    expect(view.find('p').attributes('style')).toContain('text-align: center')
    expect(view.find('u').text()).toContain('<img onerror=alert(1)>')
    expect(view.find('a').attributes('href')).toBe('/website')
    expect(view.find('span').attributes('style')).toContain('font-family: Georgia')
    expect(view.find('span').attributes('style')).toContain('font-size: 24px')
  })
  it('rejects arbitrary HTML, CSS, unsafe URLs, malformed structures and excessive documents', () => {
    for (const value of [
      { type: 'doc', content: [{ type: 'script', text: 'alert(1)' }] },
      { type: 'doc', content: [{ type: 'text', text: 'outside a block' }] },
      { type: 'doc', content: [{ type: 'paragraph', attrs: { onclick: 'alert(1)' } }] },
      {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'URL',
                marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
              },
            ],
          },
        ],
      },
      {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'CSS',
                marks: [{ type: 'textStyle', attrs: { color: 'url(https://example.com)' } }],
              },
            ],
          },
        ],
      },
      {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x'.repeat(8001) }] }],
      },
    ])
      expect(() => validateRichText(value)).toThrow()
    expect(() =>
      validateRichText(
        {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x'.repeat(161) }] }],
        },
        true,
      ),
    ).toThrow('160')
  })
  it('preserves nested lists, quotes, soft breaks, code and heading levels', () => {
    const p = (text: string): RichTextNode => ({
      type: 'paragraph',
      content: [{ type: 'text', text }],
    })
    const document: RichTextNode = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 4 }, content: [{ type: 'text', text: 'Title' }] },
        { type: 'blockquote', content: [p('Quoted')] },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                p('Parent'),
                {
                  type: 'orderedList',
                  attrs: { start: 3 },
                  content: [{ type: 'listItem', content: [p('Nested')] }],
                },
              ],
            },
          ],
        },
        { type: 'codeBlock', content: [{ type: 'text', text: '<script>literal()</script>' }] },
        { type: 'horizontalRule' },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'A' },
            { type: 'hardBreak' },
            { type: 'text', text: 'B' },
          ],
        },
      ],
    }
    const saved = inlineValue(document)
    expect(saved.rich).toEqual(document)
    expect(richTextPlain(saved.rich!)).toContain('Parent\nNested')
    const view = mount(WebsiteRichText, { props: { value: document } })
    expect(view.find('ul ol').attributes('start')).toBe('3')
    expect(view.find('script').exists()).toBe(false)
    expect(view.find('pre code').text()).toBe('<script>literal()</script>')
  })
  it('copies formatted documents independently and checks links before publication', () => {
    const page = {
      id: 'home',
      slug: 'home',
      title: 'Home',
      description: '',
      inNavigation: true,
      chrome: 'widgets' as const,
      sections: [{ ...newSection('text'), textRichText: rich(), titleRichText: rich() }],
    }
    const copied = copyPage(page, [page])
    expect(richTextLinks(copied.sections[0]!.textRichText)).toEqual(['/website/home-copy'])
    expect(richTextLinks(page.sections[0]!.textRichText)).toEqual(['/website'])
    expect(
      publishingChecks({ name: 'Phase 2', accent: '#174878', pages: [page] }).filter(
        (issue) => issue.level === 'error',
      ),
    ).toHaveLength(0)
    page.sections[0]!.textRichText.content![0]!.content![0]!.marks![2]!.attrs!.href =
      '/website/missing'
    expect(
      publishingChecks({ name: 'Phase 2', accent: '#174878', pages: [page] }).some(
        (issue) => issue.level === 'error',
      ),
    ).toBe(true)
  })
})
