import { defaultTheme, type WebsiteTheme } from '../../../functions/src/websiteTheme'
import { websiteFonts } from '../../../functions/src/websiteFonts'
export { websiteFonts } from '../../../functions/src/websiteFonts'
export function themeStyle(
  theme?: WebsiteTheme,
  device: 'desktop' | 'tablet' | 'mobile' = 'desktop',
  automatic = false,
): Record<string, string | number> {
  if (!theme || theme.enabled === false) return {}
  const value = { ...defaultTheme, ...theme }
  const typography: Record<string, string | number> = {}
  for (const [name, style] of Object.entries(theme.textStyles || {})) {
    const text = { ...style, ...(device === 'desktop' ? {} : style.devices?.[device]) }
    const prefix = name === 'pageTitle' ? 'title' : name === 'sectionHeading' ? 'section' : 'body'
    if (text.font) typography[`--type-${prefix}-font`] = websiteFonts[text.font]
    if (text.size !== undefined) {
      const size =
        automatic &&
        device !== 'desktop' &&
        prefix !== 'body' &&
        style.devices?.[device]?.size === undefined
          ? Math.min(text.size, device === 'mobile' ? 40 : 56)
          : text.size
      typography[`--type-${prefix}-size`] = size + 'px'
    }
    if (text.weight !== undefined) typography[`--type-${prefix}-weight`] = text.weight
    if (text.lineHeight !== undefined) typography[`--type-${prefix}-leading`] = text.lineHeight
  }
  return {
    ...typography,
    '--site-background': value.background,
    '--site-surface': value.surface,
    '--site-text': value.text,
    '--site-muted': value.muted,
    '--site-border': value.border,
    '--site-button-text': value.buttonText,
    '--site-body-font': websiteFonts[value.bodyFont],
    '--site-heading-font': websiteFonts[value.headingFont],
    '--site-font-size': value.fontSize + 'px',
    '--site-line-height': value.lineHeight,
    '--site-radius': value.radius + 'px',
    '--site-spacing': value.spacing + 'px',
    '--site-content-width': value.contentWidth + 'px',
  }
}
