// Browser-safe content contracts. Formatted text is rendered as nodes, never HTML.
import type { RichTextNode } from './websiteRichText'
export interface ImageSettings {
  focusX?: number
  focusY?: number
  zoom?: number
  caption?: string
  overlay?: string
  overlayOpacity?: number
}
export interface MenuLabel {
  label: string
  labelRichText?: RichTextNode
}
export interface MenuLink extends MenuLabel {
  id: string
  url: string
  children?: MenuLink[]
}
export interface NavigationSettings {
  pageLabels?: (MenuLabel & { id: string })[]
  loginLabel?: MenuLabel
  brandText?: string
  brandRichText?: RichTextNode
  showBrand: boolean
  showPages: boolean
  showLogin: boolean
  links: MenuLink[]
}
export function safeWebsiteLink(value: string): boolean {
  if (/^\/website(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?$/.test(value) || value === '/login') return true
  if (/^mailto:[^\s<>]+@[^\s<>]+$/.test(value) || /^tel:\+?[0-9() .-]+$/.test(value)) return true
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !/[\s<>\u0000-\u001f]/.test(value)
    )
  } catch {
    return false
  }
}
export type TextNode =
  | { type: 'text'; text: string }
  | { type: 'strong' | 'em' | 'link'; children: TextNode[]; href?: string }
export interface TextBlock {
  type: 'p' | 'h2' | 'h3' | 'ul' | 'ol'
  lines: TextNode[][]
}
export function inlineText(text: string, depth = 0): TextNode[] {
  function parse(
    start: number,
    closing: string,
    level: number,
  ): { nodes: TextNode[]; end: number; closed: boolean } {
    const nodes: TextNode[] = []
    function literal(value: string) {
      const previous = nodes.at(-1)
      if (previous?.type === 'text') previous.text += value
      else nodes.push({ type: 'text', text: value })
    }
    let index = start
    while (index < text.length) {
      const rest = text.slice(index)
      const escaped = /^\\([\\*\[\]#.-])/.exec(rest)
      if (escaped) {
        literal(escaped[1]!)
        index += escaped[0].length
        continue
      }
      if (
        closing &&
        rest.startsWith(closing) &&
        !(closing === '*' && rest.startsWith('**') && !rest.startsWith('***'))
      ) {
        return { nodes, end: index + closing.length, closed: true }
      }
      const link = /^\[((?:\\.|[^\]\\\n])+)\]\(([^\s)]+)\)/.exec(rest)
      if (link && level < 8) {
        if (safeWebsiteLink(link[2]!))
          nodes.push({ type: 'link', href: link[2], children: inlineText(link[1]!, level + 1) })
        else literal(link[0])
        index += link[0].length
        continue
      }
      const delimiter = rest.startsWith('**') ? '**' : rest.startsWith('*') ? '*' : ''
      if (delimiter && level < 8) {
        const nested = parse(index + delimiter.length, delimiter, level + 1)
        if (nested.closed && nested.nodes.length) {
          nodes.push({ type: delimiter === '**' ? 'strong' : 'em', children: nested.nodes })
          index = nested.end
          continue
        }
      }
      literal(text[index]!)
      index++
    }
    return { nodes, end: index, closed: false }
  }
  return parse(0, '', depth).nodes
}
export function formattedText(text: string): TextBlock[] {
  const result: TextBlock[] = []
  for (const line of text.split('\n')) {
    const match = /^(#{1,3})\s+(.*)$|^([-*]|\d+\.)\s+(.*)$/.exec(line)
    const type = match?.[1]
      ? match[1].length < 3
        ? 'h2'
        : 'h3'
      : match?.[3]
        ? /\d/.test(match[3])
          ? 'ol'
          : 'ul'
        : 'p'
    const nodes = inlineText(match?.[2] ?? match?.[4] ?? line)
    const previous = result[result.length - 1]
    if ((type === 'ul' || type === 'ol') && previous?.type === type) previous.lines.push(nodes)
    else result.push({ type, lines: [nodes] })
  }
  return result
}
export function textLinks(text: string): string[] {
  const links: string[] = []
  function visit(nodes: TextNode[]) {
    for (const node of nodes)
      if (node.type !== 'text') {
        if (node.href) links.push(node.href)
        visit(node.children)
      }
  }
  for (const block of formattedText(text)) for (const line of block.lines) visit(line)
  return links
}
export function menuLinks(links: MenuLink[]): MenuLink[] {
  return links.flatMap((link) => [link, ...(link.children || [])])
}
