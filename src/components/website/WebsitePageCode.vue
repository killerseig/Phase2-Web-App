<script setup lang="ts">
import { computed } from 'vue'
import { parseWebsiteHtml, websiteHtmlTemplate } from '../../../functions/src/websiteLayout'
import WebsiteCssEditor from './WebsiteCssEditor.vue'
import type { WebsitePage } from '@/features/website/types'
const props = defineProps<{ page?: WebsitePage; shared?: boolean; css?: string; js?: string }>()
const emit = defineEmits<{
  html: [value: string | undefined]
  css: [value: string]
  js: [value: string]
}>()
const ids = computed(
  () =>
    props.page?.sections.filter((section) => !section.parentId).map((section) => section.id) || [],
)
const slotId = computed(
  () => props.page?.sections.find((section) => section.type === 'page-content')?.id,
)
const html = computed(() => props.page?.html ?? websiteHtmlTemplate(ids.value, slotId.value))
const htmlError = computed(() => {
  try {
    parseWebsiteHtml(
      html.value,
      ids.value.filter((id) => id !== slotId.value),
      !!props.shared,
    )
    return ''
  } catch (error) {
    return error instanceof Error ? error.message : 'Check HTML.'
  }
})
</script>
<template>
  <div class="site-code">
    <details v-if="page" open>
      <summary>{{ shared ? 'Site layout HTML' : 'Page HTML' }}</summary>
      <p>
        Keep the widget references to retain visual editing. Add HTML wrappers and static content
        around them. Use classes beginning with custom- for CSS.
      </p>
      <p v-if="shared">
        Keep one &lt;page-content&gt;&lt;/page-content&gt; slot for the current page.
      </p>
      <label
        >{{ shared ? 'Site layout HTML' : 'Page HTML'
        }}<textarea
          :value="html"
          rows="12"
          spellcheck="false"
          maxlength="20000"
          @input="emit('html', ($event.target as HTMLTextAreaElement).value)"
        />
      </label>
      <p v-if="htmlError" role="alert">{{ htmlError }}</p>
      <button :disabled="page.html === undefined" @click="emit('html', undefined)">
        Use visual widget order
      </button>
    </details>
    <WebsiteCssEditor
      :model-value="css"
      :label="shared ? 'Site CSS' : 'Page CSS'"
      expanded
      @update:model-value="emit('css', $event)"
    />
    <details>
      <summary>{{ shared ? 'Site JavaScript' : 'Page JavaScript' }}</summary>
      <p>
        Runs after the website is rendered, with site code first and page code second. Use Run code
        preview to test. Scripts restart when changing pages. Network requests and application
        access are unavailable.
      </p>
      <label
        >{{ shared ? 'Site JavaScript' : 'Page JavaScript'
        }}<textarea
          :value="js || ''"
          rows="12"
          spellcheck="false"
          maxlength="20000"
          placeholder="document.querySelector('.custom-example')?.addEventListener('click', () => { /* ... */ })"
          @input="emit('js', ($event.target as HTMLTextAreaElement).value)"
        />
      </label>
    </details>
  </div>
</template>
<style scoped>
textarea {
  box-sizing: border-box;
  width: 100%;
  font:
    0.8rem/1.5 Consolas,
    monospace;
  background: var(--field);
  color: var(--text);
  border: 1px solid var(--border);
  padding: 0.5rem;
}
label {
  display: block;
}
details {
  padding: 0.5rem 0;
}
summary {
  cursor: pointer;
  font-weight: 600;
}
p {
  font-size: 0.8rem;
}
</style>
