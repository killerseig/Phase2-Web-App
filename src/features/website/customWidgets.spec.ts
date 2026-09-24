import { describe, expect, it } from 'vitest'
import {
  captureCustomWidget,
  customPlacement,
  detachCustom,
  updateCustomDefinition,
} from './customWidgets'
import { newSection, type WebsiteSite } from './types'
import {
  customDefinition,
  resolvedCustom,
  customDocument,
  validateCustomCode,
  type CustomWidgetDefinition,
} from '../../../functions/src/websiteCustom'
describe('custom widgets', () => {
  it('links designs while retaining instance settings and detached snapshots', () => {
    const source = {
      ...newSection('text'),
      title: 'Original',
      layout: { x: 2, y: 3, w: 8, h: 4, z: 1 },
    }
    const definition = captureCustomWidget([source], [source.id], 'Card')!
    const sourceId = definition.sections[0]!.id
    definition.fields = [
      {
        key: 'heading',
        label: 'Heading',
        type: 'text',
        defaultValue: 'Default',
        sectionId: sourceId,
        property: 'title',
      },
    ]
    const a = customPlacement(definition, []),
      b = customPlacement(definition, [a]),
      copy = customPlacement(definition, [a, b], false)
    a.custom!.values.heading = 'Local heading'
    const site: WebsiteSite = {
      name: 'Test',
      accent: '#174878',
      customWidgets: [definition],
      pages: [
        {
          id: 'home',
          slug: 'home',
          title: 'Home',
          description: '',
          inNavigation: true,
          chrome: 'widgets',
          sections: [a, b, copy],
        },
      ],
    }
    definition.fields[0]!.defaultValue = 'New default'
    definition.sections[0]!.appearance = { background: '#123456' }
    updateCustomDefinition(site, definition)
    expect(
      resolvedCustom(customDefinition(a.custom, site.customWidgets)!, a.custom!.values).sections[0]!
        .title,
    ).toBe('Local heading')
    expect(
      resolvedCustom(customDefinition(b.custom, site.customWidgets)!, b.custom!.values).sections[0]!
        .title,
    ).toBe('New default')
    expect(resolvedCustom(copy.custom!.inline!).sections[0]!.title).toBe('Default')
    detachCustom(a, site)
    definition.sections[0]!.appearance!.background = '#ffffff'
    expect(a.custom!.definitionId).toBeUndefined()
    expect(a.custom!.inline!.sections[0]!.appearance!.background).toBe('#123456')
    expect(a.custom!.inline!.sections[0]!.title).toBe('Local heading')
    expect(source.layout.y).toBe(3)
    expect(captureCustomWidget([b], [b.id], 'Nested')).toBeUndefined()
  })
  it('renders escaped settings inside an isolated static document', () => {
    const definition: CustomWidgetDefinition = {
      id: 'code',
      name: 'Code',
      kind: 'code',
      sections: [],
      html: '<h2>{{heading}}</h2>',
      css: 'h2 { color: {{accent}}; }',
      fields: [
        { key: 'heading', label: 'Heading', type: 'text', defaultValue: 'Hello' },
        { key: 'accent', label: 'Accent', type: 'color', defaultValue: '#123456' },
      ],
    }
    const html = customDocument(definition, { heading: '<script>bad()</script>' })
    expect(html).toContain('&lt;script&gt;bad()&lt;/script&gt;')
    expect(html).toContain('color: #123456')
    expect(html).toContain("script-src 'none'")
    expect(html).toContain("connect-src 'none'")
    for (const code of [
      '<script>alert(1)</script>',
      '<iframe src="https://example.com"></iframe>',
      '<img src="https://example.com/track">',
      '<div onclick="bad()">x</div>',
      '<a href="javascript:alert(1)">x</a>',
      '<form><input></form>',
      '<meta http-equiv="refresh">',
      '<a href="{{url}}">x</a>',
      '<svg onload="bad()"></svg>',
    ])
      expect(() => validateCustomCode(code, '')).toThrow()
    for (const css of [
      '@import "https://example.com";',
      'p{background:url(https://example.com)}',
      '</style><script>bad()</script>',
      'p{background:u\\72l(test)}',
    ])
      expect(() => validateCustomCode('<p>Safe</p>', css)).toThrow()
    expect(() =>
      validateCustomCode(
        '<section><h2 class="title">Welcome</h2><a href="/website">Home</a></section>',
        '@media(max-width:600px){.title{font-size:24px}}',
      ),
    ).not.toThrow()
  })
})
