<script lang="ts">
import { defineComponent, h, type VNodeChild, type PropType } from 'vue'
import WebsiteRichText from './WebsiteRichText.vue'
import type { RichTextNode } from '../../../functions/src/websiteRichText'
import { formattedText, type TextNode } from '../../../functions/src/websiteContent'
function nodes(values: TextNode[]): VNodeChild[] {
  return values.map((node) =>
    node.type === 'text'
      ? node.text
      : h(
          node.type === 'link' ? 'a' : node.type,
          node.type === 'link' ? { href: node.href } : {},
          nodes(node.children),
        ),
  )
}
export default defineComponent({
  props: {
    text: { type: String, default: '' },
    format: String,
    preview: Boolean,
    rich: Object as PropType<RichTextNode>,
  },
  setup(props) {
    return () =>
      props.rich
        ? h(WebsiteRichText, { value: props.rich, fallback: props.text, preview: props.preview })
        : props.format !== 'markdown'
          ? h('p', { class: 'widget-text', style: { whiteSpace: 'pre-wrap' } }, props.text)
          : h(
              'div',
              {
                class: 'widget-text formatted-text',
                onClick: (event: MouseEvent) => {
                  if (props.preview) event.preventDefault()
                },
              },
              formattedText(props.text).map((block) =>
                h(
                  block.type,
                  {},
                  block.type === 'ul' || block.type === 'ol'
                    ? block.lines.map((line) => h('li', {}, nodes(line)))
                    : nodes(block.lines[0] || []),
                ),
              ),
            )
  },
})
</script>
<style scoped>
.formatted-text {
  line-height: 1.65;
  overflow-wrap: anywhere;
}
.formatted-text :deep(p) {
  white-space: pre-wrap;
  margin: 0 0 0.8rem;
  min-height: 1em;
}
.formatted-text :deep(a) {
  color: var(--website-accent);
  text-decoration: underline;
}
.formatted-text :deep(h2),
.formatted-text :deep(h3) {
  margin: 0.7rem 0;
}
</style>
