import { websiteFonts, type WebsiteFont } from './websiteFonts'
import { validateTextStyles, type WebsiteTextStyles } from './websiteTypography'
export interface BrandPreset {
  name: string
  accent: string
  theme: Omit<WebsiteTheme, 'presets'>
}
export interface WebsiteTheme {
  enabled?: boolean
  background?: string
  surface?: string
  text?: string
  muted?: string
  border?: string
  buttonText?: string
  bodyFont?: WebsiteFont
  headingFont?: WebsiteFont
  fontSize?: number
  lineHeight?: number
  radius?: number
  spacing?: number
  contentWidth?: number
  textStyles?: WebsiteTextStyles
  presets?: BrandPreset[]
}
export const themeColors = [
  'background',
  'surface',
  'text',
  'muted',
  'border',
  'buttonText',
] as const
export const themeNumbers = {
  fontSize: { label: 'Body text size', min: 14, max: 24, step: 1 },
  lineHeight: { label: 'Line height', min: 1.3, max: 2, step: 0.05 },
  radius: { label: 'Button corner radius', min: 0, max: 32, step: 1 },
  spacing: { label: 'Default flow spacing', min: 0, max: 80, step: 1 },
  contentWidth: { label: 'Flow content width', min: 720, max: 1600, step: 10 },
} as const
export const defaultTheme: Required<Omit<WebsiteTheme, 'textStyles' | 'presets' | 'enabled'>> = {
  background: '#f4f6f8',
  surface: '#ffffff',
  text: '#172c40',
  muted: '#526779',
  border: '#d7e0e8',
  buttonText: '#ffffff',
  bodyFont: 'sans',
  headingFont: 'display',
  fontSize: 18,
  lineHeight: 1.6,
  radius: 6,
  spacing: 24,
  contentWidth: 1200,
}
export function validateTheme(value: unknown, allowPresets = true): WebsiteTheme {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid website design settings.')
  const data = value as Record<string, unknown>,
    result: Record<string, unknown> = {}
  if (
    Object.keys(data).some(
      (key) =>
        ![
          ...themeColors,
          ...Object.keys(themeNumbers),
          'bodyFont',
          'headingFont',
          'textStyles',
          'enabled',
          ...(allowPresets ? ['presets'] : []),
        ].includes(key),
    )
  )
    throw new Error('Unknown website design setting.')
  for (const key of themeColors)
    if (data[key] !== undefined) {
      if (typeof data[key] !== 'string' || !/^#[0-9a-f]{6}$/i.test(data[key] as string))
        throw new Error('Choose a six-digit hex color.')
      result[key] = data[key]
    }
  for (const [key, limits] of Object.entries(themeNumbers))
    if (data[key] !== undefined) {
      if (
        typeof data[key] !== 'number' ||
        !Number.isFinite(data[key]) ||
        Number(data[key]) < limits.min ||
        Number(data[key]) > limits.max
      )
        throw new Error(`Check ${limits.label.toLowerCase()}.`)
      result[key] = data[key]
    }
  for (const [key, choices] of Object.entries({
    bodyFont: Object.keys(websiteFonts),
    headingFont: Object.keys(websiteFonts),
  }))
    if (data[key] !== undefined) {
      if (!choices.includes(data[key] as string))
        throw new Error('Choose a supported website font.')
      result[key] = data[key]
    }
  if (data.enabled !== undefined) {
    if (typeof data.enabled !== 'boolean') throw new Error('Invalid shared design state.')
    result.enabled = data.enabled
  }
  if (data.textStyles !== undefined) result.textStyles = validateTextStyles(data.textStyles)
  if (data.presets !== undefined) {
    if (!Array.isArray(data.presets) || data.presets.length > 12)
      throw new Error('Keep up to 12 brand presets.')
    result.presets = data.presets.map((preset) => {
      if (
        !preset ||
        typeof preset !== 'object' ||
        Array.isArray(preset) ||
        typeof preset.name !== 'string' ||
        !preset.name.trim() ||
        preset.name.length > 64 ||
        typeof preset.accent !== 'string' ||
        !/^#[0-9a-f]{6}$/i.test(preset.accent)
      )
        throw new Error('Invalid brand preset.')
      return {
        name: preset.name.trim(),
        accent: preset.accent,
        theme: validateTheme(preset.theme, false),
      }
    })
  }
  return result as WebsiteTheme
}
export function contrastRatio(first: string, second: string): number {
  function luminance(color: string) {
    const values = [1, 3, 5]
      .map((start) => parseInt(color.slice(start, start + 2), 16) / 255)
      .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
    return values[0]! * 0.2126 + values[1]! * 0.7152 + values[2]! * 0.0722
  }
  const a = luminance(first),
    b = luminance(second)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}
export function themeWarnings(theme: WebsiteTheme, accent: string): string[] {
  const values = { ...defaultTheme, ...theme },
    warnings: string[] = []
  for (const [label, foreground, background] of [
    ['Body text on page', values.text, values.background],
    ['Body text on widgets', values.text, values.surface],
    ['Secondary text', values.muted, values.surface],
    ['Button text', values.buttonText, accent],
  ])
    if (contrastRatio(foreground!, background!) < 4.5)
      warnings.push(`${label}: increase color contrast for readable text.`)
  return warnings
}
