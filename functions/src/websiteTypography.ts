import { websiteFonts, type WebsiteFont } from './websiteFonts'
export const textStyleNames = {
  pageTitle: 'Page title',
  sectionHeading: 'Section heading',
  body: 'Body text',
} as const
export interface TextStyleValues {
  font?: WebsiteFont
  size?: number
  weight?: number
  lineHeight?: number
}
export interface WebsiteTextStyle extends TextStyleValues {
  devices?: { tablet?: TextStyleValues; mobile?: TextStyleValues }
}
export type WebsiteTextStyles = Partial<Record<keyof typeof textStyleNames, WebsiteTextStyle>>
export const textStyleLimits = {
  size: { min: 8, max: 160 },
  weight: { min: 100, max: 900 },
  lineHeight: { min: 1, max: 3 },
} as const
export function validateTextStyles(raw: unknown): WebsiteTextStyles {
  const object = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('Invalid reusable text style.')
    return value as Record<string, unknown>
  }
  function values(raw: unknown, responsive = false): WebsiteTextStyle {
    const data = object(raw),
      result: WebsiteTextStyle = {}
    if (
      Object.keys(data).some(
        (key) =>
          !['font', ...Object.keys(textStyleLimits), ...(responsive ? ['devices'] : [])].includes(
            key,
          ),
      )
    )
      throw new Error('Unknown text style setting.')
    if (data.font !== undefined) {
      if (!Object.keys(websiteFonts).includes(String(data.font)))
        throw new Error('Choose a supported text style font.')
      result.font = data.font as WebsiteFont
    }
    for (const [key, limits] of Object.entries(textStyleLimits)) {
      if (data[key] === undefined) continue
      if (
        typeof data[key] !== 'number' ||
        !Number.isFinite(data[key]) ||
        data[key] < limits.min ||
        data[key] > limits.max
      )
        throw new Error(`Invalid text style ${key}.`)
      Object.assign(result, { [key]: data[key] })
    }
    if (data.devices !== undefined) {
      const devices = object(data.devices)
      if (Object.keys(devices).some((key) => !['tablet', 'mobile'].includes(key)))
        throw new Error('Invalid typography device.')
      result.devices = {}
      for (const device of ['tablet', 'mobile'] as const)
        if (devices[device] !== undefined) result.devices[device] = values(devices[device])
    }
    return result
  }
  const data = object(raw),
    result: WebsiteTextStyles = {}
  for (const key of Object.keys(data)) {
    if (!Object.keys(textStyleNames).includes(key)) throw new Error('Unknown reusable text style.')
    result[key as keyof WebsiteTextStyles] = values(data[key], true)
  }
  return result
}
