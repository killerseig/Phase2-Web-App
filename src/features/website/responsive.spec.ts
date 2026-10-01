import { describe, expect, it } from 'vitest'
import { compilePageCss, pageCssTemplate } from '../../../functions/src/websiteDesign'
import {
  containerStyle,
  deviceForWidth,
  responsiveSection,
  sizingStyle,
  isFlow,
} from './responsive'
import { newSection } from './types'
import { copyPage } from './pageTools'

describe('page CSS', () => {
  it('scopes each selector and converts breakpoints to preview width queries', () => {
    const css = compilePageCss(pageCssTemplate, 'preview')
    expect(css).toContain('[data-page-scope="preview"]{')
    expect(css).toContain('@container website-page (max-width: 767px)')
    expect(compilePageCss('.custom-feature:hover, .page:hover { color: #fff; }', 'x')).toBe(
      '[data-page-scope="x"] .custom-feature:hover,[data-page-scope="x"]:hover{color:#fff!important;}',
    )
    expect(compilePageCss('.widget {padding: clamp(1px, 2%, 30px);}', 'x')).toContain(
      'clamp(1px, 2%, 30px)!important',
    )
  })
  it.each([
    'body { color: red; }',
    '.page + body { color: red; }',
    '.widget { background: url(https://example.com/x); }',
    '@import "example.css";',
    '@font-face {font-family: example;}',
    '</style><script>alert(1)</script>',
    '.widget {position: fixed;}',
    '.widget {transform: rotate(3deg);}',
    '.widget {color: red;',
    '.widget {color: red;} body {color: blue;}',
    '.widget {color: var(--bad;}',
    '.widget {background: u\\72l(foo);}',
    '@media (max-width: 99999px) {.widget {color:red;}}',
    '@media (max-width: 767px) {@media (min-width: 300px) {.widget {color:red;}}}',
    '.widget { .widget-title {color: red;} }',
    '/* unclosed',
  ])('rejects unsupported or unsafe CSS: %s', (source) => {
    expect(() => compilePageCss(source, 'x')).toThrow()
  })
  it('reports line numbers and limits input and rule count', () => {
    expect(() => compilePageCss('\n\nbody {color:red}', 'x')).toThrow('Line 3')
    expect(() => compilePageCss(' '.repeat(12001), 'x')).toThrow('12,000')
    expect(() => compilePageCss('.widget {color:red}'.repeat(101), 'x')).toThrow('100 CSS rules')
  })
})
describe('device layouts', () => {
  it('inherits desktop values, overrides only selected devices, and honors global hiding', () => {
    const section = newSection('text')
    section.appearance = { color: '#123456', rotation: 5 }
    section.devices = { mobile: { appearance: { rotation: 10 }, hidden: true } }
    expect(responsiveSection(section, 'tablet').appearance).toEqual(section.appearance)
    expect(responsiveSection(section, 'mobile').appearance).toEqual({
      color: '#123456',
      rotation: 10,
    })
    expect(responsiveSection(section, 'mobile').hidden).toBe(true)
    section.hidden = true
    section.devices.mobile!.hidden = false
    expect(responsiveSection(section, 'mobile').hidden).toBe(true)
    expect([767, 768, 1023, 1024].map(deviceForWidth)).toEqual([
      'mobile',
      'tablet',
      'tablet',
      'desktop',
    ])
    expect(isFlow(undefined, 'mobile')).toBe(true)
    expect(isFlow(undefined, 'tablet')).toBe(true)
    expect(isFlow(undefined, 'desktop')).toBe(false)
    expect(isFlow({ mobile: 'scale' }, 'mobile')).toBe(false)
    expect(sizingStyle({ grow: 2, basis: 30, minHeight: 200 })).toMatchObject({
      flexGrow: 2,
      flexBasis: '30%',
      minHeight: '200px',
    })
  })
  it('reflows inherited rows, spacing and content heights without rewriting authored data', () => {
    const parent = newSection('container')
    parent.container = { direction: 'row', gap: 40, wrap: false, align: 'center' }
    const card = newSection('card')
    card.parentId = parent.id
    card.appearance = { padding: 64, paddingLeft: 80, headingSize: 72, color: '#123456' }
    card.sizing = { height: 300, minHeight: 250, basis: 33, grow: 2, align: 'center' }
    const before = structuredClone({ parent, card })
    const phone = responsiveSection(card, 'mobile', { flow: true, parent })
    expect(phone.appearance).toMatchObject({
      padding: 24,
      paddingLeft: 24,
      headingSize: 40,
      color: '#123456',
    })
    expect(phone.sizing).toEqual({ grow: 0 })
    expect(responsiveSection(parent, 'mobile', { flow: true }).container).toMatchObject({
      direction: 'column',
      gap: 24,
      align: 'stretch',
    })
    const tablet = responsiveSection(parent, 'tablet', { flow: true })
    expect(tablet.container).toMatchObject({ direction: 'row', wrap: true, gap: 32 })
    expect(containerStyle(tablet.container, true, 2)['--child-basis']).toBe(
      'calc((100% - 32px) / 2)',
    )
    expect({ parent, card }).toEqual(before)
    expect(responsiveSection(card, 'desktop', { flow: true, parent }).sizing).toEqual(card.sizing)
    expect(responsiveSection(card, 'mobile', { flow: false, parent }).sizing).toEqual(card.sizing)
    expect(responsiveSection(card, 'mobile', { flow: false, parent }).appearance).toEqual(
      card.appearance,
    )
  })
  it('keeps explicit device choices and lets a device shorthand replace desktop edges', () => {
    const parent = newSection('container')
    parent.container = { direction: 'row', gap: 20 }
    parent.devices = { mobile: { container: { direction: 'row', gap: 4, wrap: false } } }
    const card = newSection('card')
    card.appearance = { padding: 64, paddingLeft: 80, paddingBottom: 60, headingSize: 72 }
    card.sizing = { height: 300, minHeight: 250, basis: 33, grow: 2 }
    card.devices = {
      mobile: {
        appearance: { padding: 12, paddingBottom: 0, headingSize: 52 },
        sizing: { height: 220, minHeight: 0, basis: 60, grow: 3 },
      },
    }
    const phone = responsiveSection(card, 'mobile', { flow: true, parent })
    expect(phone.appearance).toMatchObject({
      padding: 12,
      paddingLeft: 12,
      paddingBottom: 0,
      headingSize: 52,
    })
    expect(phone.sizing).toEqual(card.devices.mobile?.sizing)
    expect(responsiveSection(parent, 'mobile', { flow: true }).container).toEqual(
      parent.devices.mobile?.container,
    )
    delete card.devices.mobile
    expect(responsiveSection(card, 'mobile', { flow: true, parent }).sizing).toEqual({
      basis: 33,
      grow: 2,
    })
  })
  it('keeps inherited media and navigation frames while content widgets grow to fit', () => {
    for (const type of ['image', 'video', 'spacer', 'navigation', 'custom'] as const) {
      const section = newSection(type)
      section.sizing = { height: 96 }
      expect(responsiveSection(section, 'mobile', { flow: true }).sizing?.height).toBe(96)
    }
    const form = newSection('form')
    form.sizing = { height: 200, minHeight: 150 }
    expect(responsiveSection(form, 'mobile', { flow: true }).sizing).toEqual({})
  })
  it('copies responsive settings without sharing mutable objects', () => {
    const section = newSection('text')
    section.devices = { mobile: { appearance: { rotation: 10 } } }
    const page = {
      id: 'home',
      slug: 'home',
      title: 'Home',
      description: '',
      inNavigation: true,
      sections: [section],
      layout: { mobile: 'flow' as const },
    }
    const copy = copyPage(page, [page])
    copy.sections[0]!.devices!.mobile!.appearance!.rotation = 90
    copy.layout!.mobile = 'scale'
    expect(section.devices.mobile!.appearance!.rotation).toBe(10)
    expect(page.layout.mobile).toBe('flow')
  })
})
