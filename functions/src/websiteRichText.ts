import { safeWebsiteLink } from './websiteContent'
import { textFonts } from './websiteFonts'
export { textFonts } from './websiteFonts'

// A deliberately bounded document schema shared by the editor, server and renderer.
// Authored HTML, event handlers and arbitrary CSS are never stored or rendered.
export interface RichTextNode {
  type: string
  text?: string
  attrs?: Record<string, string | number>
  marks?: { type: string; attrs?: Record<string, string | number> }[]
  content?: RichTextNode[]
}
export const textSizes = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72, 96]
export const lineHeights = [1, 1.2, 1.5, 1.8, 2, 2.5, 3]
const blocks = [
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'blockquote',
  'codeBlock',
  'horizontalRule',
]
const marks = [
  'bold',
  'italic',
  'underline',
  'strike',
  'subscript',
  'superscript',
  'code',
  'link',
  'textStyle',
]
function invalid(message = 'Unsupported rich text formatting.'): never {
  throw new Error(message)
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  return value as Record<string, unknown>
}
export function textColor(value: unknown): string {
  if (typeof value !== 'string') return invalid('Choose a valid text color.')
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase()
  const rgb = /^rgb\(\s*(\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\s*\)$/.exec(value)
  if (rgb && rgb.slice(1).every((n) => Number(n) <= 255))
    return (
      '#' +
      rgb
        .slice(1)
        .map((n) => Number(n).toString(16).padStart(2, '0'))
        .join('')
    )
  return invalid('Choose a valid text color.')
}
export function richTextPlain(node: RichTextNode): string {
  if (node.type === 'text') return node.text || ''
  if (node.type === 'hardBreak') return '\n'
  return (node.content || [])
    .map(richTextPlain)
    .join(['paragraph', 'heading', 'codeBlock'].includes(node.type) ? '' : '\n')
}
export function richTextLinks(node?: RichTextNode): string[] {
  if (!node) return []
  return [
    ...(node.marks || [])
      .filter((mark) => mark.type === 'link')
      .map((mark) => String(mark.attrs!.href)),
    ...(node.content || []).flatMap(richTextLinks),
  ]
}
export function mapRichTextLinks(node: RichTextNode | undefined, map: (href: string) => string) {
  if (!node) return
  for (const mark of node.marks || [])
    if (mark.type === 'link' && mark.attrs) mark.attrs.href = map(String(mark.attrs.href))
  for (const child of node.content || []) mapRichTextLinks(child, map)
}
export function validateRichText(value: unknown, heading: boolean | 'title' = false): RichTextNode {
  if (JSON.stringify(value).length > 100000)
    invalid('This text has too much formatting. Simplify it before saving.')
  let count = 0
  function attrs(value: unknown, type: string): Record<string, string | number> | undefined {
    if (value === undefined) return
    const data = object(value),
      result: Record<string, string | number> = {}
    const allowed =
      type === 'textStyle'
        ? ['fontFamily', 'fontSize', 'color', 'backgroundColor', 'lineHeight']
        : type === 'link'
          ? ['href', 'target', 'rel', 'class', 'title']
          : type === 'paragraph' || type === 'heading'
            ? ['textAlign', 'indent', 'lineHeight', ...(type === 'heading' ? ['level'] : [])]
            : type === 'orderedList'
              ? ['start', 'type']
              : type === 'codeBlock'
                ? ['language']
                : []
    for (const [key, item] of Object.entries(data)) {
      if (!allowed.includes(key)) invalid()
      if (item == null || item === '') continue
      if (key === 'href') {
        if (typeof item !== 'string' || !safeWebsiteLink(item))
          invalid('Enter a valid HTTPS, email, phone, or website page link.')
        result[key] = item
      } else if (['target', 'rel', 'class', 'language', 'title'].includes(key)) {
        /* Rendering chooses safe attributes; no authored classes. */
      } else if (key === 'fontFamily') {
        if (!textFonts.includes(String(item))) invalid('Choose a supported font.')
        result[key] = String(item)
      } else if (key === 'fontSize') {
        if (
          !/^\d+(?:\.\d+)?px$/.test(String(item)) ||
          parseFloat(String(item)) < 8 ||
          parseFloat(String(item)) > 160
        )
          invalid('Font size must be between 8 and 160 px.')
        result[key] = String(item)
      } else if (key === 'color' || key === 'backgroundColor') result[key] = textColor(item)
      else if (key === 'textAlign') {
        if (!['left', 'center', 'right', 'justify'].includes(String(item))) invalid()
        result[key] = String(item)
      } else if (key === 'lineHeight') {
        if (!lineHeights.includes(Number(item))) invalid()
        result[key] = String(item)
      } else if (key === 'type') {
        if (!['1', 'a', 'A', 'i', 'I'].includes(String(item))) invalid()
        result[key] = String(item)
      } else {
        const n = Number(item)
        if (
          !Number.isInteger(n) ||
          n < (key === 'indent' ? 0 : 1) ||
          n > (key === 'level' ? 6 : key === 'indent' ? 8 : 1000000)
        )
          invalid()
        result[key] = n
      }
    }
    if (type === 'link' && !result.href) invalid('Add a link address.')
    if (type === 'heading' && !result.level) invalid()
    return Object.keys(result).length ? result : undefined
  }
  function visit(raw: unknown, parent: string, depth: number): RichTextNode {
    if (++count > 2000 || depth > 12) invalid('This text has too much nesting or formatting.')
    const node = object(raw),
      type = String(node.type)
    if (
      Object.keys(node).some((key) => !['type', 'text', 'attrs', 'marks', 'content'].includes(key))
    )
      invalid()
    const allowed =
      parent === ''
        ? ['doc']
        : parent === 'paragraph' || parent === 'heading'
          ? ['text', 'hardBreak']
          : parent === 'codeBlock'
            ? ['text']
            : parent === 'bulletList' || parent === 'orderedList'
              ? ['listItem']
              : blocks
    if (!allowed.includes(type)) invalid()
    if (type !== 'text' && node.text !== undefined) invalid()
    const result: RichTextNode = { type },
      attributes = attrs(node.attrs, type)
    if (attributes) result.attrs = attributes
    if (type === 'heading' && !attributes?.level) invalid()
    if (type === 'text') {
      if (typeof node.text !== 'string' || !node.text.length) invalid()
      result.text = node.text
    }
    if (node.marks !== undefined) {
      if (
        type !== 'text' ||
        !Array.isArray(node.marks) ||
        node.marks.length > 9 ||
        (parent === 'codeBlock' && node.marks.length)
      )
        invalid()
      result.marks = node.marks.map((raw) => {
        const mark = object(raw),
          type = String(mark.type)
        if (
          !marks.includes(type) ||
          Object.keys(mark).some((key) => !['type', 'attrs'].includes(key))
        )
          invalid()
        const attributes = attrs(mark.attrs, type)
        if (type === 'link' && !attributes?.href) invalid('Add a link address.')
        return { type, ...(attributes ? { attrs: attributes } : {}) }
      })
    }
    if (['text', 'hardBreak', 'horizontalRule'].includes(type)) {
      if (node.content !== undefined) invalid()
    } else {
      if (node.content !== undefined && !Array.isArray(node.content)) invalid()
      result.content = ((node.content || []) as unknown[]).map((child) =>
        visit(child, type, depth + 1),
      )
      if (
        ['doc', 'listItem', 'bulletList', 'orderedList', 'blockquote'].includes(type) &&
        !result.content.length
      )
        invalid()
      if (type === 'listItem' && result.content[0]?.type !== 'paragraph') invalid()
    }
    return result
  }
  const doc = visit(value, '', 0)
  if (
    heading === true &&
    (doc.content?.length !== 1 ||
      doc.content[0]?.type !== 'paragraph' ||
      doc.content[0]?.content?.some((node) => node.type !== 'text'))
  )
    invalid('Headings use a single line.')
  if (richTextPlain(doc).length > (heading ? 160 : 8000))
    invalid(
      `Keep this ${heading ? 'heading' : 'text'} under ${heading ? '160' : '8,000'} characters.`,
    )
  return doc
}
