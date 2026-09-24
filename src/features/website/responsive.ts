import type {
  WebsiteDevice,
  WebsiteSection,
  PageLayout,
  ContainerLayout,
  ItemSizing,
} from './types'
import type { CSSProperties } from 'vue'
import { resolveElementBoxes } from './elementLayout'

export const deviceWidth = { desktop: 1080, tablet: 820, mobile: 390 }
export function deviceForWidth(width: number): WebsiteDevice {
  return width <= 767 ? 'mobile' : width <= 1023 ? 'tablet' : 'desktop'
}
export function responsiveSection(section: WebsiteSection, device: WebsiteDevice): WebsiteSection {
  const override = device === 'desktop' ? undefined : section.devices?.[device]
  return {
    ...section,
    textBoxes: resolveElementBoxes(section.textBoxes, device),
    items: section.items.map((item) => ({
      ...item,
      textBoxes: resolveElementBoxes(item.textBoxes, device),
    })),
    hidden: section.hidden || override?.hidden === true,
    appearance: { ...section.appearance, ...override?.appearance },
    container: override?.container || section.container,
    sizing: { ...section.sizing, ...override?.sizing },
  }
}
export function isFlow(layout: PageLayout | undefined, device: WebsiteDevice) {
  return device === 'desktop' ? layout?.desktop === 'flow' : layout?.[device] === 'flow'
}
export function containerStyle(layout?: ContainerLayout, flow = false): CSSProperties {
  return {
    '--child-basis': flow && layout?.direction === 'column' ? 'auto' : '0px',
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
