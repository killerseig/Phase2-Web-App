import type { ElementTarget } from './textBox'
import type { WebsiteSection } from './types'
export function inlineItem(sections: WebsiteSection[], target: ElementTarget) {
  const owner = sections.find((section) => section.id === target.id)
  return target.key ? owner?.items.find((item) => item.id === target.key) : owner
}
