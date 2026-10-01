// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { validateTheme } from '../../../functions/src/websiteTheme'
import { validateMotion } from '../../../functions/src/websiteMotion'
import { compilePageCss } from '../../../functions/src/websiteDesign'
import {
  initialWebsite,
  validateWebsite,
  publishedWebsite,
} from '../../../functions/src/websiteModel'
import { themeStyle } from './theme'
import { newSection } from './types'
describe('website design tools', () => {
  it('saves responsive typography, presets, gradients and motion; publishes active design only', () => {
    const site = initialWebsite()
    site.theme = {
      textStyles: { pageTitle: { size: 64, font: 'Inter', devices: { mobile: { size: 30 } } } },
      presets: [{ name: 'Company', accent: '#00437f', theme: { bodyFont: 'Lora', radius: 8 } }],
    }
    const section = newSection('hero')
    section.imageSettings = { overlayMode: 'linear', overlayAngle: 90, overlayOpacity: 65 }
    section.appearance = {
      rotation: 10,
      motion: { effect: 'rise', delay: 100, duration: 800, easing: 'ease-out' },
    }
    site.pages[0]!.sections = [section]
    const draft = validateWebsite(site),
      published = publishedWebsite(draft)
    expect(draft.theme?.presets).toHaveLength(1)
    expect(published.theme?.presets).toBeUndefined()
    expect(published.pages[0]!.sections[0]!.imageSettings).toEqual(section.imageSettings)
    expect(published.pages[0]!.sections[0]!.appearance).toEqual(section.appearance)
    expect(themeStyle(published.theme, 'mobile')['--type-title-size']).toBe('30px')
    expect(themeStyle(published.theme, 'tablet')['--type-title-size']).toBe('64px')
    expect(themeStyle(published.theme, 'mobile')['--type-title-font']).toContain('Inter')
    expect(themeStyle(validateTheme({ ...site.theme, enabled: false }))).toEqual({})
  })
  it('rejects recursive presets, invalid typography and unsupported motion', () => {
    expect(() =>
      validateTheme({ presets: [{ name: 'Nested', accent: '#00437f', theme: { presets: [] } }] }),
    ).toThrow()
    expect(() =>
      validateTheme({ textStyles: { pageTitle: { devices: { mobile: { size: Infinity } } } } }),
    ).toThrow()
    expect(() => validateTheme({ textStyles: { body: { font: 'url(test)' } } })).toThrow()
    for (const motion of [
      { effect: 'spin' },
      { effect: 'fade', duration: -1 },
      { effect: 'fade', delay: 4000 },
      { effect: 'fade', easing: 'url(test)' },
    ])
      expect(() => validateMotion(motion)).toThrow()
  })
  it('scopes CSS animations and provides reduced-motion overrides without allowing arbitrary keyframes', () => {
    const css = compilePageCss(
      '.custom-photo { animation: fade-up 600ms ease-out 100ms; transition: opacity 200ms ease; }',
      'home',
    )
    expect(css).toContain('animation:website-home-fade-up 600ms ease-out 100ms both')
    expect(css).toContain('@keyframes website-home-fade-up')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(compilePageCss('.custom-photo { animation: fade-up 600ms; }', 'other')).toContain(
      '@keyframes website-other-fade-up',
    )
    for (const source of [
      '.widget { animation: arbitrary 1s; }',
      '.widget { animation: fade-in 4s; }',
      '.widget { transition: all 1s; }',
      '@keyframes other { from {opacity:0;} }',
    ])
      expect(() => compilePageCss(source, 'x')).toThrow()
  })
})
