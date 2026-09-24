import { describe, expect, it } from 'vitest'
import { formattedText, inlineText, textLinks } from '../../../functions/src/websiteContent'
import { convertPageChrome } from './chrome'
import { layoutLocked } from './containers'
import { publishingChecks } from './publishing'
import { newSection, type WebsiteSite } from './types'
import { copyPage } from './pageTools'
import { captureCustomWidget, customPlacement } from './customWidgets'

function site(): WebsiteSite {
  return {
    name: 'Example',
    accent: '#174878',
    pages: [
      {
        id: 'home',
        title: 'Home',
        slug: 'home',
        description: '',
        inNavigation: true,
        chrome: 'widgets',
        sections: [],
      },
    ],
  }
}
describe('website content tools', () => {
  it('points broken brand links to their navigation or footer widget', () => {
    const current = site()
    const navigation = newSection('navigation')
    navigation.navigation!.brandRichText = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Our company',
              marks: [{ type: 'link', attrs: { href: '/website/missing' } }],
            },
          ],
        },
      ],
    }
    current.pages[0]!.sections = [navigation, newSection('text')]
    expect(
      publishingChecks(current).filter((issue) => issue.message.startsWith('Brand name:')),
    ).toEqual([
      expect.objectContaining({ pageId: 'home', sectionId: navigation.id, level: 'error' }),
    ])
    current.pages.push({ ...current.pages[0]!, id: 'missing', slug: 'missing' })
    expect(
      publishingChecks(current).filter((issue) => issue.message.startsWith('Brand name:')),
    ).toEqual([])
  })
  it('keeps publishing issues attached to each placement of a reused widget', () => {
    const current = site()
    const source = {
      ...newSection('text'),
      linkLabel: 'Missing destination',
      layout: { x: 0, y: 0, w: 8, h: 4, z: 1 },
    }
    const definition = captureCustomWidget([source], [source.id], 'Reusable link')!
    current.customWidgets = [definition]
    const first = customPlacement(definition, [])
    const second = customPlacement(definition, [first])
    current.pages[0]!.sections = [first, second]
    const issues = publishingChecks(current).filter((issue) =>
      issue.message.includes('complete both'),
    )
    expect(issues.map((issue) => issue.sectionId)).toEqual([first.id, second.id])
    expect(issues.every((issue) => issue.target === 'widgets' && issue.pageId === 'home')).toBe(
      true,
    )
  })
  it('parses formatted text without treating HTML or unsafe URLs as executable content', () => {
    const blocks = formattedText(
      '## Title\n**Bold** and *italic*\n- One\n- Two\n1. First\n2. Second',
    )
    expect(blocks.map((block) => block.type)).toEqual(['h2', 'p', 'ul', 'ol'])
    expect(blocks[2]!.lines).toHaveLength(2)
    expect(blocks[1]!.lines[0]!.map((node) => node.type)).toEqual(['strong', 'text', 'em'])
    expect(inlineText('<script>alert(1)</script>')).toEqual([
      { type: 'text', text: '<script>alert(1)</script>' },
    ])
    expect(
      textLinks('[Bad](javascript:alert) [Good](/website) [Mail](mailto:office@example.com)'),
    ).toEqual(['/website', 'mailto:office@example.com'])
  })
  it('keeps blank widget pages empty and converts legacy chrome once without moving children', () => {
    const current = site()
    expect(convertPageChrome(current.pages[0]!, current).sections).toEqual([])
    const page = current.pages[0]!
    delete page.chrome
    const parent = { ...newSection('container'), layout: { x: 2, y: 3, w: 12, h: 8, z: 1 } }
    const child = {
      ...newSection('text'),
      parentId: parent.id,
      layout: { x: 1, y: 1, w: 4, h: 4, z: 2 },
    }
    page.sections = [parent, child]
    current.branding = {
      logoId: '',
      logoAlt: '',
      footerText: 'Office details',
      footerLinks: [{ id: 'mail', label: 'Email', url: 'mailto:office@example.com' }],
    }
    const converted = convertPageChrome(page, current)
    expect(converted.sections.map((section) => section.type)).toEqual([
      'navigation',
      'container',
      'text',
      'footer',
    ])
    expect(converted.sections[1]!.layout!.y).toBe(7)
    expect(converted.sections[2]!.layout).toEqual(child.layout)
    expect(converted.sections[3]!.text).toBe('Office details')
    expect(convertPageChrome(converted, current)).toBe(converted)
    expect(page.sections[0]!.layout!.y).toBe(3)
    page.sections = Array.from({ length: 29 }, () => newSection('text'))
    expect(convertPageChrome(page, current)).toBe(page)
  })
  it('inherits layout locks and copies menu, image and formatted self links independently', () => {
    const current = site(),
      page = current.pages[0]!
    const parent = { ...newSection('container'), locked: true }
    const nav = { ...newSection('navigation'), parentId: parent.id }
    nav.navigation!.links = [
      {
        id: 'home',
        label: 'Home',
        url: '/website',
        children: [{ id: 'child', label: 'Self', url: '/website' }],
      },
    ]
    nav.text = '[Home](/website)'
    nav.textFormat = 'markdown'
    nav.imageSettings = { zoom: 1.5 }
    page.sections = [parent, nav]
    expect(layoutLocked(page.sections, nav.id)).toBe(true)
    const copied = copyPage(page, [page])
    const copy = copied.sections[1]!
    expect(copy.navigation!.links[0]!.children![0]!.url).toBe('/website/home-copy')
    expect(copy.text).toBe('[Home](/website/home-copy)')
    copy.imageSettings!.zoom = 2
    expect(nav.imageSettings.zoom).toBe(1.5)
    expect(nav.navigation!.links[0]!.url).toBe('/website')
    parent.locked = false
    expect(layoutLocked(page.sections, nav.id)).toBe(false)
  })
  it('blocks incomplete visible content and broken formatted/menu links, but skips hidden content', () => {
    const current = site(),
      page = current.pages[0]!
    expect(publishingChecks(current).some((issue) => issue.level === 'error')).toBe(true)
    const text = newSection('text')
    page.sections = [text]
    expect(publishingChecks(current).filter((issue) => issue.level === 'error')).toEqual([])
    text.textFormat = 'markdown'
    text.text = '[Missing](/website/missing)'
    expect(publishingChecks(current).some((issue) => issue.level === 'error')).toBe(true)
    text.hidden = true
    const nav = newSection('navigation')
    page.sections.push(nav)
    nav.navigation!.links = [
      {
        id: 'menu',
        label: 'Company',
        url: '',
        children: [{ id: 'home', label: 'Home', url: '/website' }],
      },
    ]
    expect(publishingChecks(current).filter((issue) => issue.level === 'error')).toEqual([])
    nav.navigation!.links[0]!.children![0]!.url = '/website/unknown'
    expect(publishingChecks(current).some((issue) => issue.level === 'error')).toBe(true)
  })
})
