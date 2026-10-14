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
    // SSR omits DOM-only textContent. Preserve validated CSS in the initial HTML
    // and prevent any style-element closing token from reaching raw markup.
    return () => h('style', { innerHTML: compiled.value.replace(/</g, '\\3c ') })
  },
})
</script>
