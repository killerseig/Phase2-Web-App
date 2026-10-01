import type {
  WebsiteDevice,
  WebsiteSection,
  PageLayout,
  ContainerLayout,
  ItemSizing,
  WidgetAppearance,
} from './types'
import type { CSSProperties, InjectionKey, Ref } from 'vue'
import { resolveElementBoxes } from './elementLayout'

export const deviceWidth = { desktop: 1080, tablet: 820, mobile: 390 }
// Representative browser viewports in CSS pixels, independent of editor magnification.
export const deviceHeight = { desktop: 720, tablet: 1180, mobile: 844 }
export const websiteDeviceKey: InjectionKey<Readonly<Ref<WebsiteDevice>>> = Symbol('website-device')
export function deviceForWidth(width: number): WebsiteDevice {
  return width <= 767 ? 'mobile' : width <= 1023 ? 'tablet' : 'desktop'
}
function responsiveAppearance(
  base: WidgetAppearance = {},
  override: WidgetAppearance = {},
  device: WebsiteDevice,
  automatic: boolean,
): WidgetAppearance {
  const result = { ...base, ...override }
  const limit = device === 'mobile' ? 24 : 32
  for (const group of ['padding', 'margin'] as const) {
    if (automatic && override[group] === undefined && base[group] !== undefined)
      result[group] = Math.min(base[group], limit)
    for (const side of ['Top', 'Right', 'Bottom', 'Left'] as const) {
      const key = `${group}${side}` as const
      // A device shorthand must replace desktop edge values, just as in CSS.
      if (override[group] !== undefined) result[key] = override[key] ?? override[group]
      else if (automatic && override[key] === undefined && base[key] !== undefined)
        result[key] = Math.min(base[key], limit)
    }
  }
  if (automatic && override.headingSize === undefined && base.headingSize !== undefined)
    result.headingSize = Math.min(base.headingSize, device === 'mobile' ? 40 : 56)
  return result
}

function responsiveContainer(section: WebsiteSection, device: WebsiteDevice, automatic: boolean) {
  const override = device === 'desktop' ? undefined : section.devices?.[device]?.container
  if (override || !automatic || section.type !== 'container') return override || section.container
  return {
    ...section.container,
    direction: device === 'mobile' ? ('column' as const) : section.container?.direction || 'row',
    align: device === 'mobile' ? ('stretch' as const) : section.container?.align,
    gap: Math.min(section.container?.gap ?? 16, device === 'mobile' ? 24 : 32),
    wrap: device === 'tablet' && section.container?.direction !== 'column',
  }
}

export function responsiveSection(
  section: WebsiteSection,
  device: WebsiteDevice,
  options: { flow?: boolean; parent?: WebsiteSection } = {},
): WebsiteSection {
  const override = device === 'desktop' ? undefined : section.devices?.[device]
  const automatic = device !== 'desktop' && !!options.flow
  const sizing = { ...section.sizing, ...override?.sizing }
  if (automatic) {
    // Content needs room to wrap; media and deliberately sized navigation keep their frames.
    if (!['image', 'video', 'spacer', 'divider', 'navigation', 'custom'].includes(section.type)) {
      if (override?.sizing?.height === undefined) delete sizing.height
      if (override?.sizing?.minHeight === undefined) delete sizing.minHeight
    }
    const parent = options.parent
    if (parent) {
      const parentLayout = responsiveContainer(parent, device, true)
      if (parentLayout?.direction === 'column' || !parent.devices?.[device]?.container) {
        if (override?.sizing?.basis === undefined) delete sizing.basis
        if (override?.sizing?.grow === undefined) sizing.grow = 0
      }
      if (
        device === 'mobile' &&
        !parent.devices?.mobile?.container &&
        override?.sizing?.align === undefined
      )
        delete sizing.align
    }
  }
  return {
    ...section,
    textBoxes: resolveElementBoxes(section.textBoxes, device),
    items: section.items.map((item) => ({
      ...item,
      textBoxes: resolveElementBoxes(item.textBoxes, device),
    })),
    hidden: section.hidden || override?.hidden === true,
    appearance: responsiveAppearance(section.appearance, override?.appearance, device, automatic),
    container: responsiveContainer(section, device, automatic),
    sizing,
  }
}
export function isFlow(layout: PageLayout | undefined, device: WebsiteDevice) {
  return device === 'desktop' ? layout?.desktop === 'flow' : layout?.[device] !== 'scale'
}
export function containerStyle(
  layout?: ContainerLayout,
  flow = false,
  columns?: number,
): CSSProperties {
  const gap = layout?.gap ?? 16
  return {
    '--child-basis':
      flow && layout?.direction === 'column'
        ? 'auto'
        : columns
          ? `calc((100% - ${(columns - 1) * gap}px) / ${columns})`
          : '0px',
    flexDirection: layout?.direction || 'row',
    gap: `${layout?.gap ?? 16}px`,
    flexWrap: layout?.wrap ? 'wrap' : 'nowrap',
    alignItems: layout?.align || 'stretch',
    justifyContent: layout?.justify || 'start',
  }
}
export function sizingStyle(sizing?: ItemSizing): CSSProperties {
  return {
    flexGrow: sizing?.grow ?? 1,
    flexBasis: sizing?.basis === undefined ? 'var(--child-basis, 0px)' : `${sizing.basis}%`,
    height: sizing?.height === undefined ? undefined : `${sizing.height}px`,
    minHeight: sizing?.minHeight === undefined ? undefined : `${sizing.minHeight}px`,
    alignSelf: sizing?.align || 'auto',
  }
}
