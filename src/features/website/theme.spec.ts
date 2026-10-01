import { describe, expect, it } from 'vitest'
import {
  contrastRatio,
  defaultTheme,
  themeWarnings,
  validateTheme,
} from '../../../functions/src/websiteTheme'
import { themeStyle } from './theme'
import { newSection } from './types'
import { copySection } from './pageTools'
import { homepagePrototype } from '../../../e2e/fixtures/homepagePrototype'
import { publishingChecks } from './publishing'
describe('website shared design', () => {
  it('adapts inherited heading sizes in responsive flow and preserves device typography', () => {
    const theme = {
      textStyles: {
        pageTitle: { size: 72, devices: { mobile: { size: 48 } } },
        sectionHeading: { size: 64 },
        body: { size: 18 },
      },
    }
    expect(themeStyle(theme, 'mobile', true)['--type-title-size']).toBe('48px')
    expect(themeStyle(theme, 'mobile', true)['--type-section-size']).toBe('40px')
    expect(themeStyle(theme, 'tablet', true)['--type-title-size']).toBe('56px')
    expect(themeStyle(theme, 'mobile', true)['--type-body-size']).toBe('18px')
    expect(themeStyle(theme, 'tablet', false)['--type-title-size']).toBe('72px')
    expect(themeStyle(theme, 'desktop', true)['--type-title-size']).toBe('72px')
  })
  it('validates a bounded design contract without external fonts or CSS injection', () => {
    expect(validateTheme(defaultTheme)).toEqual(defaultTheme)
    for (const value of [
      { background: 'url(javascript:alert(1))' },
      { text: '#fff' },
      { bodyFont: 'https://example.com/font' },
      { spacing: Infinity },
      { contentWidth: 0 },
      { lineHeight: 3 },
      { css: '*{}' },
    ])
      expect(() => validateTheme(value)).toThrow()
    expect(themeStyle(undefined)).toEqual({})
    expect(themeStyle({ spacing: 20 })['--site-spacing']).toBe('20px')
  })
  it('flags readable color pairings conservatively without blocking publication', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBe(21)
    expect(contrastRatio('#112233', '#112233')).toBe(1)
    expect(themeWarnings(defaultTheme, '#145b88')).toEqual([])
    expect(themeWarnings({ ...defaultTheme, text: '#ffffff' }, '#145b88')).toContain(
      'Body text on widgets: increase color contrast for readable text.',
    )
  })
  it('keeps copies independent and the composed homepage valid', () => {
    const chart = newSection('chart'),
      copy = copySection(chart)
    copy.blockOptions!.chartType = 'donut'
    expect(chart.blockOptions!.chartType).toBe('bar')
    expect(
      publishingChecks(homepagePrototype()).filter((issue) => issue.level === 'error'),
    ).toEqual([])
  })
})
