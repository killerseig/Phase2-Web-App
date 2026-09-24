import { defaultTheme, type WebsiteTheme } from '../../../functions/src/websiteTheme'
export const websiteFonts = {
  sans: "'Source Sans 3', 'Segoe UI', sans-serif",
  serif: 'Georgia, serif',
  mono: 'Consolas, monospace',
  display: "'Saira Semi Condensed', 'Source Sans 3', sans-serif",
}
export function themeStyle(theme?: WebsiteTheme) {
  if (!theme) return {}
  const value = { ...defaultTheme, ...theme }
  return {
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
