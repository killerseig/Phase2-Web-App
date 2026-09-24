<script lang="ts">
import { defineComponent, h, ref, watch } from 'vue'
import { compilePageCss } from '../../../functions/src/websiteDesign'
export default defineComponent({
  props: { css: { type: String, default: '' }, scope: { type: String, required: true } },
  setup(props) {
    const compiled = ref('')
    watch(
      () => [props.css, props.scope],
      () => {
        try {
          compiled.value = compilePageCss(props.css, props.scope)
        } catch {
          /* Keep the last valid preview while typing. */
        }
      },
      { immediate: true },
    )
    return () => h('style', { textContent: compiled.value })
  },
})
</script>
