import type { JSONContent } from '@tiptap/vue-3'
import {
  validateRichText,
  richTextPlain,
  type RichTextNode,
} from '../../../functions/src/websiteRichText'
import {
  formattedText,
  safeWebsiteLink,
  type TextNode,
} from '../../../functions/src/websiteContent'

function textNodes(
  nodes: TextNode[],
  marks: NonNullable<JSONContent['marks']> = [],
): JSONContent[] {
  return nodes.flatMap((node): JSONContent[] =>
    node.type === 'text'
      ? node.text
        ? [{ type: 'text', text: node.text, marks }]
        : []
      : textNodes(node.children, [
          ...marks,
          {
            type: node.type === 'strong' ? 'bold' : node.type === 'em' ? 'italic' : 'link',
            ...(node.href ? { attrs: { href: node.href } } : {}),
          },
        ]),
  )
}
export function inlineDocument(text: string, format?: string, rich?: RichTextNode): JSONContent {
  if (rich) return validateRichText(rich)
  return {
    type: 'doc',
    content:
      format !== 'markdown'
        ? text.split('\n').map((line) => ({
            type: 'paragraph',
            content: line ? [{ type: 'text', text: line }] : [],
          }))
        : formattedText(text).map((block) => {
            if (block.type === 'ul' || block.type === 'ol')
              return {
                type: block.type === 'ul' ? 'bulletList' : 'orderedList',
                content: block.lines.map((line) => ({
                  type: 'listItem',
                  content: [{ type: 'paragraph', content: textNodes(line) }],
                })),
              }
            return {
              type: block.type === 'p' ? 'paragraph' : 'heading',
              ...(block.type === 'p' ? {} : { attrs: { level: block.type === 'h2' ? 2 : 3 } }),
              content: textNodes(block.lines[0] || []),
            }
          }),
  }
}
const escapeText = (text: string) => text.replace(/[\\*\[\]#.-]/g, '\\$&')

// Share mark boundaries across adjacent text runs, including overlapping bold/italic.
function markedText(nodes: JSONContent[], depth = 0): string {
  let result = ''
  for (let i = 0; i < nodes.length; ) {
    const node = nodes[i]!
    const mark = node.marks?.[depth]
    if (!mark) {
      result += escapeText(node.text || '')
      i++
      continue
    }
    let end = i + 1
    while (
      end < nodes.length &&
      JSON.stringify(nodes[end]!.marks?.[depth]) === JSON.stringify(mark)
    )
      end++
    const content = markedText(nodes.slice(i, end), depth + 1)
    result +=
      mark.type === 'bold'
        ? `**${content}**`
        : mark.type === 'italic'
          ? `*${content}*`
          : `[${content}](${String(mark.attrs?.href).replace(/\(/g, '%28').replace(/\)/g, '%29')})`
    i = end
  }
  return result
}

export function inlineValue(
  doc: JSONContent,
  title = false,
  keepMarkdown = false,
): { text: string; format?: 'markdown'; rich?: RichTextNode } {
  const rich = validateRichText(doc, title)
  function advanced(node: RichTextNode): boolean {
    return (
      !['doc', 'paragraph', 'heading', 'bulletList', 'orderedList', 'listItem', 'text'].includes(
        node.type,
      ) ||
      Object.entries(node.attrs || {}).some(
        ([key, value]) =>
          !(key === 'level' && [2, 3].includes(Number(value))) &&
          !(key === 'start' && value === 1) &&
          !(key === 'indent' && value === 0),
      ) ||
      (node.marks || []).some((mark) => title || !['bold', 'italic', 'link'].includes(mark.type)) ||
      (node.type === 'listItem' &&
        (node.content?.length !== 1 || node.content[0]?.type !== 'paragraph')) ||
      (node.content || []).some(advanced)
    )
  }
  if (advanced(rich)) return { text: richTextPlain(rich), rich }
  let formatted = keepMarkdown
  function line(node: JSONContent): string {
    if (!['paragraph', 'heading'].includes(node.type || ''))
      throw new Error('Use paragraphs or a single-level list.')
    if (node.type === 'heading') formatted = true
    for (const child of node.content || []) {
      if (child.type !== 'text') throw new Error('Use Enter to start a new paragraph.')
      for (const mark of child.marks || []) {
        if (!['bold', 'italic', 'link'].includes(mark.type))
          throw new Error('This formatting is not supported.')
        if (mark.type === 'link' && !safeWebsiteLink(String(mark.attrs?.href || '')))
          throw new Error('Enter a valid HTTPS, email, phone, or website page link.')
        formatted = true
      }
    }
    return (node.content || []).map((child) => child.text || '').join('')
  }
  const blocks = doc.content || []
  if (title && (blocks.length !== 1 || blocks[0]?.type !== 'paragraph'))
    throw new Error('Headings use a single line.')
  const plain = blocks
    .map((block) => {
      if (block.type === 'bulletList' || block.type === 'orderedList') {
        formatted = true
        return (block.content || [])
          .map((item) => {
            if (item.type !== 'listItem' || item.content?.length !== 1)
              throw new Error('Use a single-level list.')
            return line(item.content[0]!)
          })
          .join('\n')
      }
      return line(block)
    })
    .join('\n')
  const renderLine = (node: JSONContent) =>
    (node.type === 'heading' ? (node.attrs?.level === 3 ? '### ' : '## ') : '') +
    markedText(node.content || [])
  const text =
    title || !formatted
      ? plain
      : blocks
          .map((block) =>
            block.type === 'bulletList' || block.type === 'orderedList'
              ? (block.content || [])
                  .map(
                    (item, index) =>
                      (block.type === 'bulletList' ? '- ' : `${index + 1}. `) +
                      renderLine(item.content![0]!),
                  )
                  .join('\n')
              : renderLine(block),
          )
          .join('\n')
  const limit = title ? 160 : 8000
  if (text.length > limit)
    throw new Error(
      `Keep this ${title ? 'heading' : 'text'} under ${limit.toLocaleString()} characters, including formatting.`,
    )
  return { text, ...(formatted && !title ? { format: 'markdown' as const } : {}) }
}
