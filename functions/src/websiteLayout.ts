import { validateCustomCode } from './websiteCustom'

export type HtmlNode = {
  tag?: string
  attrs?: Record<string, string>
  text?: string
  children?: HtmlNode[]
  widget?: string
  content?: boolean
}
// Parse a deliberately limited HTML fragment. Widgets remain Vue components; no v-html,
// event attributes, script tags or Vue expressions ever enter the application DOM.
export function parseWebsiteHtml(source: string, rootIds: string[], layout = false): HtmlNode[] {
  if (typeof source !== 'string' || source.length > 20000)
    throw new Error('Limit HTML to 20,000 characters.')
  const roots: HtmlNode[] = [],
    stack: HtmlNode[] = []
  const used = new Set<string>()
  let contentCount = 0
  const add = (node: HtmlNode) => (stack.at(-1)?.children || roots).push(node)
  const input = source.replace(/<!--[\s\S]*?-->/g, '')
  let offset = 0
  while (offset < input.length) {
    if (input[offset] !== '<') {
      const end = input.indexOf('<', offset)
      add({ text: input.slice(offset, end < 0 ? input.length : end) })
      offset = end < 0 ? input.length : end
      continue
    }
    const token = /^<(website-widget)\s+id="([a-zA-Z0-9_-]+)"\s*><\/website-widget\s*>/.exec(
      input.slice(offset),
    )
    if (token) {
      const id = token[2]!
      if (!rootIds.includes(id) || used.has(id))
        throw new Error('Reference each root widget once using its existing ID.')
      used.add(id)
      add({ widget: id })
      offset += token[0].length
      continue
    }
    const slot = /^<page-content\s*><\/page-content\s*>/.exec(input.slice(offset))
    if (slot) {
      if (!layout || ++contentCount !== 1)
        throw new Error('Only the site layout can contain one page-content slot.')
      add({ content: true })
      offset += slot[0].length
      continue
    }
    const tag = /^<(\/)?([a-z][a-z0-9]*)(\s[^<>]*?)?\s*(\/?)>/i.exec(input.slice(offset))
    if (!tag) throw new Error('Check the HTML tags and quoted attributes.')
    validateCustomCode(tag[0], '', true)
    const name = tag[2]!.toLowerCase()
    if (tag[1]) {
      if (stack.pop()?.tag !== name)
        throw new Error('Close HTML elements in the order they were opened.')
    } else {
      const attrs: Record<string, string> = {}
      for (const attr of (tag[3] || '').matchAll(/([a-z][a-z0-9-]*)\s*=\s*("[^"]*"|'[^']*')/gi))
        attrs[attr[1]!.toLowerCase()] = attr[2]!.slice(1, -1)
      const node: HtmlNode = { tag: name, attrs, children: [] }
      add(node)
      if (!tag[4] && !['img', 'br', 'hr', 'input'].includes(name)) stack.push(node)
      if (stack.length > 20) throw new Error('Use no more than 20 nested HTML elements.')
    }
    offset += tag[0].length
  }
  if (stack.length) throw new Error('Close all HTML elements.')
  if (used.size !== rootIds.length)
    throw new Error('Keep a reference to every root widget. Remove widgets in Design mode.')
  if (layout && contentCount !== 1)
    throw new Error('The site layout needs exactly one <page-content></page-content> slot.')
  return roots
}
export function websiteHtmlTemplate(ids: string[], slotId?: string) {
  return ids
    .map((id) =>
      id === slotId
        ? '<page-content></page-content>'
        : `<website-widget id="${id}"></website-widget>`,
    )
    .join('\n')
}
export function validateJavascript(value: unknown): string {
  if (typeof value !== 'string' || value.length > 20000)
    throw new Error('Limit JavaScript to 20,000 characters.')
  // Source is never evaluated on the server or in the employee application.
  return value
}

// Reconcile visual structure edits inside existing wrappers in the same undo step.
export function reconcileWebsiteHtml(
  source: string,
  previous: string[],
  next: string[],
  slotId?: string,
) {
  parseWebsiteHtml(
    source,
    previous.filter((id) => id !== slotId),
    !!slotId,
  )
  const markers = next.map((id) => websiteHtmlTemplate([id], slotId))
  let index = 0
  const result = source.replace(
    /<website-widget\s+id="[a-zA-Z0-9_-]+"\s*><\/website-widget\s*>|<page-content\s*><\/page-content\s*>/g,
    () => markers[index++] || '',
  )
  return result + (index < markers.length ? '\n' + markers.slice(index).join('\n') : '')
}
