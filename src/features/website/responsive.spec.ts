import { describe, expect, it } from 'vitest'
import { compilePageCss, pageCssTemplate } from '../../../functions/src/websiteDesign'
import { deviceForWidth, responsiveSection, sizingStyle, isFlow } from './responsive'
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
    expect(isFlow(undefined, 'mobile')).toBe(false)
    expect(sizingStyle({ grow: 2, basis: 30, minHeight: 200 })).toMatchObject({
      flexGrow: 2,
      flexBasis: '30%',
      minHeight: '200px',
    })
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
