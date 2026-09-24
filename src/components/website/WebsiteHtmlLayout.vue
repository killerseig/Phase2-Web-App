<script lang="ts">
import { defineComponent, h, Fragment, computed, type PropType, type VNodeChild } from 'vue'
import {
  parseWebsiteHtml,
  websiteHtmlTemplate,
  type HtmlNode,
} from '../../../functions/src/websiteLayout'
export default defineComponent({
  props: {
    html: String,
    preview: Boolean,
    ids: { type: Array as PropType<string[]>, required: true },
    slotId: String,
  },
  setup(props, { slots }) {
    const nodes = computed(() => {
      const ids = props.ids.filter((id) => id !== props.slotId)
      try {
        return parseWebsiteHtml(
          props.html ?? websiteHtmlTemplate(props.ids, props.slotId),
          ids,
          !!props.slotId,
        )
      } catch {
        return parseWebsiteHtml(websiteHtmlTemplate(props.ids, props.slotId), ids, !!props.slotId)
      }
    })
    function render(node: HtmlNode): VNodeChild {
      if (node.widget || node.content) return slots.widget?.({ id: node.widget || props.slotId })
      if (node.text !== undefined)
        return node.text.replace(
          /&(amp|lt|gt|quot|#39);/g,
          (_, entity: string) =>
            ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[entity] || '',
        )
      return h(node.tag!, { ...node.attrs, ...(props.preview && node.tag === 'a' ? { onClick: (event: MouseEvent) => event.preventDefault() } : {}) }, node.children?.map(render))
    }
    return () => h(Fragment, nodes.value.map(render))
  },
})
</script>
