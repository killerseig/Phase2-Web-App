<script setup lang="ts">
import { ref, watch } from 'vue'
import { websiteCommand, websiteError } from '@/services/website'
import type { WebsiteSite } from '@/features/website/types'
import type { WebsiteComparison } from '../../../functions/src/websiteChanges'
import WebsiteChangeList from './WebsiteChangeList.vue'
const props = defineProps<{ site: WebsiteSite; version: number; disabled: boolean }>()
const result = ref<WebsiteComparison & { publishedAt: number | null }>()
const busy = ref(false),
  error = ref(''),
  stale = ref(false)
let request = 0
watch(
  () => [props.site, props.version],
  () => {
    request++
    busy.value = false
    stale.value = !!result.value
    error.value = ''
  },
  { deep: true },
)
async function compare() {
  const generation = ++request
  busy.value = true
  error.value = ''
  try {
    const comparison = await websiteCommand<NonNullable<typeof result.value>>('comparePublished', {
      site: JSON.parse(JSON.stringify(props.site)),
      version: props.version,
    })
    if (generation !== request) return
    result.value = comparison
    stale.value = false
  } catch (reason) {
    if (generation === request) error.value = websiteError(reason)
  } finally {
    if (generation === request) busy.value = false
  }
}
</script>
<template>
  <details class="publish-comparison">
    <summary>Compare with live site</summary>
    <p>
      Review the public changes in your current draft, including unsaved edits. Hidden widgets and
      private library settings are excluded.
    </p>
    <button type="button" :disabled="disabled || busy" @click="compare">
      {{ busy ? 'Comparing…' : 'Compare current draft' }}
    </button>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="stale" role="status">The draft changed. Compare again to refresh these results.</p>
    <template v-if="result && !stale">
      <p v-if="result.publishedAt">
        Compared with the site published {{ new Date(result.publishedAt).toLocaleString() }}.
      </p>
      <p v-else>Nothing is published yet. These changes would create the first live site.</p>
      <WebsiteChangeList
        :comparison="result"
        before-label="Live site"
        after-label="Current draft"
      />
    </template>
  </details>
</template>
<style scoped>
details {
  margin: 1rem 0;
}
summary {
  cursor: pointer;
  font-weight: 600;
}
p,
button {
  font-size: 0.8rem;
}
button {
  font-family: inherit;
  padding: 0.4rem 0.55rem;
  color: inherit;
  background: var(--field);
  border: 1px solid var(--border);
  border-radius: 5px;
  cursor: pointer;
}
button:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
