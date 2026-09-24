import type { TextBox, TextBoxValues, TextBoxes } from '../../../functions/src/websiteTextBox'
import type { WebsiteDevice } from './types'

export type ElementField = keyof TextBoxes
export const elementDimensions = [
  'x',
  'y',
  'width',
  'height',
  'rotation',
  'padding',
  'lockAspect',
] as const
export function resolveElementBox(box: TextBox | undefined, device: WebsiteDevice): TextBoxValues {
  const { devices, ...base } = box || {}
  return { ...base, ...(device === 'desktop' ? {} : devices?.[device]) }
}
export function resolveElementBoxes(boxes: TextBoxes | undefined, device: WebsiteDevice) {
  if (!boxes) return undefined
  return Object.fromEntries(
    Object.entries(boxes).map(([key, box]) => [key, resolveElementBox(box, device)]),
  ) as TextBoxes
}
// Save only changed dimensions so later desktop edits still reach inherited fields.
export function changeElementBox(
  box: TextBox | undefined,
  device: WebsiteDevice,
  patch: TextBoxValues,
): TextBox {
  const next: TextBox = JSON.parse(JSON.stringify(box || {}))
  if (device === 'desktop') return { ...next, ...patch }
  const current = resolveElementBox(box, device)
  const override = { ...next.devices?.[device] }
  for (const key of elementDimensions) {
    if (patch[key] !== undefined && patch[key] !== current[key])
      Object.assign(override, { [key]: patch[key] })
  }
  if (Object.keys(override).length) next.devices = { ...next.devices, [device]: override }
  return next
}
export function resetElementBox(
  box: TextBox | undefined,
  device: WebsiteDevice,
  keys: readonly (keyof TextBoxValues)[],
): TextBox {
  const next: TextBox = JSON.parse(JSON.stringify(box || {}))
  const values = device === 'desktop' ? next : next.devices?.[device]
  if (values) for (const key of keys) delete values[key]
  if (device !== 'desktop' && values && !Object.keys(values).length) delete next.devices?.[device]
  if (next.devices && !Object.keys(next.devices).length) delete next.devices
  return next
}
