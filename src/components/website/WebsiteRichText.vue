<script lang="ts">
import { defineComponent, h, type PropType, type VNodeChild } from 'vue'
import { validateRichText, type RichTextNode } from '../../../functions/src/websiteRichText'
function render(node: RichTextNode, heading: boolean): VNodeChild {
  if (node.type === 'text') {
    let result: VNodeChild = node.text || ''
    for (const mark of [...(node.marks || [])].reverse()) {
      const tag =
        {
          bold: 'strong',
          italic: 'em',
          underline: 'u',
          strike: 's',
          subscript: 'sub',
          superscript: 'sup',
          code: 'code',
          link: 'a',
          textStyle: 'span',
        }[mark.type] || 'span'
      result = h(
        tag,
        mark.type === 'textStyle'
          ? { style: mark.attrs }
          : mark.type === 'link'
            ? { href: mark.attrs?.href, rel: 'noopener noreferrer' }
            : {},
        [result],
      )
    }
    return result
  }
  const tag =
    node.type === 'heading'
      ? `h${node.attrs?.level || 2}`
      : {
          paragraph: heading ? 'span' : 'p',
          bulletList: 'ul',
          orderedList: 'ol',
          listItem: 'li',
          blockquote: 'blockquote',
          codeBlock: 'pre',
          horizontalRule: 'hr',
          hardBreak: 'br',
        }[node.type] || 'div'
  const content = (node.content || []).map((child) => render(child, heading))
  return h(
    tag,
    {
      ...(node.type === 'orderedList' ? { start: node.attrs?.start, type: node.attrs?.type } : {}),
      style: {
        textAlign: node.attrs?.textAlign,
        lineHeight: node.attrs?.lineHeight,
        paddingInlineStart: node.attrs?.indent ? Number(node.attrs.indent) * 1.5 + 'em' : undefined,
        ...(heading && node.type === 'paragraph' ? { display: 'block' } : {}),
      },
    },
    node.type === 'codeBlock'
      ? [h('code', {}, content)]
      : ['hardBreak', 'horizontalRule'].includes(node.type)
        ? undefined
        : content,
  )
}
export default defineComponent({
  props: {
    value: { type: Object as PropType<RichTextNode>, required: true },
    heading: Boolean,
    preview: Boolean,
    fallback: { type: String, default: '' },
  },
  setup(props) {
    return () => {
      let content: VNodeChild[]
      try {
        content = (validateRichText(props.value, props.heading).content || []).map((node) =>
          render(node, props.heading),
        )
      } catch {
        content = [props.fallback]
      }
      return h(
        props.heading ? 'span' : 'div',
        {
          class: [
            'website-rich-text',
            { 'rich-heading': props.heading, 'widget-text': !props.heading },
          ],
          onClick: (event: MouseEvent) => {
            if (props.preview) event.preventDefault()
          },
        },
        content,
      )
    }
  },
})
</script>
<style scoped>
.website-rich-text {
  line-height: inherit;
  overflow-wrap: anywhere;
}
.website-rich-text :deep(p) {
  white-space: pre-wrap;
  margin: 0 0 0.8rem;
  min-height: 1em;
}
.website-rich-text :deep(a) {
  color: var(--website-accent);
  text-decoration: underline;
}
.website-rich-text :deep(blockquote) {
  border-inline-start: 3px solid currentColor;
  padding-inline-start: 1em;
  margin: 1em 0;
  opacity: 0.9;
}
.website-rich-text :deep(pre) {
  padding: 0.8em;
  background: #172c4010;
  border-radius: 4px;
  white-space: pre-wrap;
}
.website-rich-text :deep(code) {
  font-family: monospace;
  background: #172c4010;
}
.website-rich-text :deep(ul),
.website-rich-text :deep(ol) {
  padding-inline-start: 1.5em;
}
.website-rich-text :deep(h1),
.website-rich-text :deep(h2),
.website-rich-text :deep(h3),
.website-rich-text :deep(h4),
.website-rich-text :deep(h5),
.website-rich-text :deep(h6) {
  margin: 0.7rem 0;
}
.rich-heading {
  display: block;
  font: inherit;
  line-height: inherit;
  white-space: pre-wrap;
}
</style>
