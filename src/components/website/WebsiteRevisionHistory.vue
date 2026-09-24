<script setup lang="ts">
import { ref, watch } from 'vue'
import { websiteCommand, websiteError } from '@/services/website'
const props = defineProps<{ version: number; disabled: boolean }>()
defineEmits<{ restore: [id: string] }>()
const entries = ref<{ id: string; version: number; savedAt: number; name: string }[]>([])
const busy = ref(false),
  error = ref(''),
  open = ref(false)
let request = 0
async function load() {
  const generation = ++request
  busy.value = true
  error.value = ''
  try {
    const result = await websiteCommand<{ revisions: typeof entries.value }>('listRevisions')
    if (generation === request) entries.value = result.revisions
  } catch (reason) {
    if (generation === request) error.value = websiteError(reason)
  } finally {
    if (generation === request) busy.value = false
  }
}
watch(
  () => props.version,
  () => {
    if (open.value) void load()
  },
)
function toggle(event: Event) {
  open.value = (event.target as HTMLDetailsElement).open
  if (open.value) void load()
}
</script>
<template>
  <details @toggle="toggle">
    <summary>Saved draft history</summary>
    <p>
      The last 10 saved drafts. Restoring replaces the draft and section library; the published site
      stays unchanged.
    </p>
    <button type="button" :disabled="busy || disabled" @click="load">Refresh draft history</button>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-else-if="busy">Loading revisions...</p>
    <p v-else-if="!entries.length">Save a draft to start its history.</p>
    <article v-for="entry in entries" :key="entry.id">
      <strong>Version {{ entry.version }}</strong
      ><small>{{ new Date(entry.savedAt).toLocaleString() }} · {{ entry.name }}</small
      ><button
        type="button"
        :disabled="disabled || busy"
        :aria-label="`Restore draft version ${entry.version}`"
        @click="$emit('restore', entry.id)"
      >
        Restore to draft
      </button>
    </article>
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
small {
  font-size: 0.75rem;
}
small {
  display: block;
}
article {
  border-top: 1px solid var(--border);
  padding: 0.5rem 0;
}
button {
  font-size: 0.75rem;
  padding: 0.3rem;
}
</style>
