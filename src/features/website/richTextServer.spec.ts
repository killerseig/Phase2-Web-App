// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  initialWebsite,
  validateWebsite,
  publishedWebsite,
} from '../../../functions/src/websiteModel'
import { newItem, newSection } from './types'
import type { RichTextNode } from '../../../functions/src/websiteRichText'

function document(link = '/website'): RichTextNode {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        attrs: { textAlign: 'center' },
        content: [
          {
            type: 'text',
            text: 'Formatted content',
            marks: [
              { type: 'underline' },
              { type: 'textStyle', attrs: { color: '#123456', fontSize: '24px' } },
              { type: 'link', attrs: { href: link } },
            ],
          },
        ],
      },
    ],
  }
}
describe('server rich-text contract', () => {
  it('preserves title blocks, darkened images and named fonts through publication', () => {
    const site = initialWebsite()
    const section = newSection('hero')
    section.titleRichText = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [
            {
              type: 'text',
              text: 'Our services',
              marks: [{ type: 'textStyle', attrs: { fontFamily: 'Montserrat' } }],
            },
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Construction' }] }],
            },
          ],
        },
      ],
    }
    section.imageSettings = { darken: 40, zoom: 1.5, overlayOpacity: 20 }
    section.appearance = { fontFamily: 'Lora' }
    site.theme = { bodyFont: 'Inter', headingFont: 'Montserrat' }
    site.pages[0]!.sections = [section]
    const published = publishedWebsite(validateWebsite(site))
    expect(published.pages[0]!.sections[0]!.titleRichText).toEqual(section.titleRichText)
    expect(published.pages[0]!.sections[0]!.imageSettings).toEqual(section.imageSettings)
    expect(published.pages[0]!.sections[0]!.appearance?.fontFamily).toBe('Lora')
    expect(published.theme).toEqual(site.theme)
    section.linkRichText = section.titleRichText
    expect(() => validateWebsite(site)).toThrow('single line')
    delete section.linkRichText
    section.imageSettings.darken = 101
    expect(() => validateWebsite(site)).toThrow('darken')
  })
  it('keeps independent text geometry through validation and publication', () => {
    const site = initialWebsite()
    const section = newSection('hero')
    section.textBoxes = {
      title: { x: -12, y: 30, width: 350, height: 120, rotation: 15 },
      image: {
        x: 12,
        width: 280,
        rotation: 98,
        lockAspect: true,
        padding: 12,
        devices: { mobile: { width: 200, rotation: 0 }, tablet: { width: 240 } },
      },
      button: { y: -8, width: 160, height: 48, rotation: -5 },
    }
    site.pages[0]!.sections = [section]
    expect(publishedWebsite(validateWebsite(site)).pages[0]!.sections[0]!.textBoxes).toEqual(
      section.textBoxes,
    )
    section.textBoxes.title!.rotation = Infinity
    expect(() => validateWebsite(site)).toThrow('text layout')
    section.textBoxes.title!.rotation = 0
    section.textBoxes.title!.width = -1
    expect(() => validateWebsite(site)).toThrow('text layout')
  })
  it('keeps section spacing and responsive heights through publication and rejects invalid values', () => {
    const site = initialWebsite()
    const section = newSection('navigation')
    section.appearance = { padding: 8, paddingTop: 0, margin: 12, marginBottom: 0 }
    section.sizing = { height: 64 }
    section.devices = { mobile: { appearance: { paddingLeft: 4 }, sizing: { height: 96 } } }
    site.pages[0]!.sections = [section]
    const saved = publishedWebsite(validateWebsite(site)).pages[0]!.sections[0]!
    expect(saved.appearance).toEqual(section.appearance)
    expect(saved.devices).toEqual(section.devices)
    expect(saved.sizing?.height).toBe(64)
    section.appearance.margin = -1
    expect(() => validateWebsite(site)).toThrow('margin')
    section.appearance.margin = 12
    section.sizing.height = 2001
    expect(() => validateWebsite(site)).toThrow('height')
  })
  it('preserves button formatting on widgets and collection items and rejects nested links', () => {
    const site = initialWebsite()
    const rich = document()
    const text = rich.content![0]!.content![0]!
    text.marks = [{ type: 'bold' }]
    const section = newSection('cards')
    section.linkRichText = rich
    section.linkUrl = '/website'
    section.items = [{ ...newItem(), linkRichText: rich, linkUrl: '/website' }]
    site.pages[0]!.sections = [section]
    const result = publishedWebsite(validateWebsite(site)).pages[0]!.sections[0]!
    expect(result.linkLabel).toBe('Formatted content')
    expect(result.items[0]!.linkLabel).toBe('Formatted content')
    expect(result.items[0]!.linkRichText).toEqual(rich)
    text.marks = [{ type: 'link', attrs: { href: '/website' } }]
    expect(() => validateWebsite(site)).toThrow('button destinations')
    text.marks = [{ type: 'bold' }]
    text.text = 'x'.repeat(81)
    expect(() => validateWebsite(site)).toThrow('Button label')
  })
  it('retains formatting in validated drafts and publication, with canonical text mirrors', () => {
    const site = initialWebsite()
    site.pages[0]!.sections = [
      { ...newSection('text'), titleRichText: document(), textRichText: document() },
    ]
    const draft = validateWebsite(site)
    expect(draft.pages[0]!.sections[0]!.title).toBe('Formatted content')
    expect(draft.pages[0]!.sections[0]!.textRichText).toEqual(document())
    const published = publishedWebsite(draft)
    expect(published.pages[0]!.sections[0]!.titleRichText).toEqual(document())
    expect(published.pages[0]!.sections[0]!.textRichText).toEqual(document())
  })
  it('rejects malicious formatting and blocks broken rich-text page links at publication', () => {
    const site = initialWebsite()
    site.pages[0]!.sections = [
      { ...newSection('text'), textRichText: document('javascript:alert(1)') },
    ]
    expect(() => validateWebsite(site)).toThrow('valid HTTPS')
    site.pages[0]!.sections[0]!.textRichText = document('/website/missing')
    expect(() => publishedWebsite(validateWebsite(site))).toThrow('does not exist')
    site.pages[0]!.sections[0]!.textRichText = document()
    site.pages[0]!.sections[0]!.textRichText!.content![0]!.attrs = {
      style: 'background:url(https://example.com)',
    }
    expect(() => validateWebsite(site)).toThrow('Unsupported rich text')
  })
})
