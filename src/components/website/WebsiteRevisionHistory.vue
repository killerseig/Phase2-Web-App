<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { websiteCommand, websiteError } from '@/services/website'
import type { WebsiteSite } from '@/features/website/types'
import { compareWebsites } from '../../../functions/src/websiteChanges'
import WebsiteChangeList from './WebsiteChangeList.vue'
const props = defineProps<{ version: number; disabled: boolean; site: WebsiteSite }>()
defineEmits<{ restore: [id: string] }>()
const entries = ref<
  { id: string; version: number; savedAt: number; name: string; savedBy?: string }[]
>([])
const activity = ref<
  {
    id: string
    version: number
    savedAt: number
    savedBy: string
    action: string
    total?: number
    paths?: string[]
    source?: string
  }[]
>([])
const selected = ref<{ id: string; version: number; draft: WebsiteSite }>()
const comparing = ref('')
const comparison = computed(() =>
  selected.value ? compareWebsites(selected.value.draft, props.site) : undefined,
)
const actionLabels: Record<string, string> = {
  save: 'Draft saved',
  publish: 'Published',
  unpublish: 'Taken offline',
  restore: 'Previous publication restored to draft',
  restoreRevision: 'Saved version restored to draft',
}
const busy = ref(false),
  error = ref(''),
  open = ref(false)
let request = 0
let comparisonRequest = 0
async function compare(entry: (typeof entries.value)[number]) {
  const generation = ++comparisonRequest
  comparing.value = entry.id
  error.value = ''
  try {
    const { draft } = await websiteCommand<{ draft: WebsiteSite }>('getRevision', {
      revisionId: entry.id,
    })
    if (generation === comparisonRequest)
      selected.value = { id: entry.id, version: entry.version, draft }
  } catch (reason) {
    if (generation === comparisonRequest) error.value = websiteError(reason)
  } finally {
    if (generation === comparisonRequest) comparing.value = ''
  }
}
async function load() {
  const generation = ++request
  busy.value = true
  error.value = ''
  try {
    const result = await websiteCommand<{
      revisions: typeof entries.value
      activity?: typeof activity.value
    }>('listRevisions')
    if (generation === request) {
      entries.value = result.revisions
      activity.value = result.activity || []
      if (selected.value && !entries.value.some((entry) => entry.id === selected.value?.id))
        selected.value = undefined
    }
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
    <summary>Change history</summary>
    <p>
      The last 10 saved drafts, including autosaves. Compare any version with your current draft
      before restoring. Restoring replaces the draft and saved widget library; the published site
      stays unchanged.
    </p>
    <button type="button" :disabled="busy || disabled" @click="load">Refresh draft history</button>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-else-if="busy">Loading revisions...</p>
    <p v-else-if="!entries.length">Save a draft to start its history.</p>
    <article v-for="entry in entries" :key="entry.id">
      <strong>Version {{ entry.version }}</strong
      ><small>{{ new Date(entry.savedAt).toLocaleString() }} · {{ entry.name }}</small>
      <small v-if="entry.savedBy">{{ entry.savedBy }}</small>
      <button
        type="button"
        :disabled="disabled || busy || !!comparing"
        :aria-label="`Compare draft version ${entry.version}`"
        @click="compare(entry)"
      >
        Compare changes
      </button>
      <button
        type="button"
        :disabled="disabled || busy"
        :aria-label="`Restore draft version ${entry.version}`"
        @click="$emit('restore', entry.id)"
      >
        Restore to draft
      </button>
      <WebsiteChangeList
        v-if="selected?.id === entry.id && comparison"
        :comparison="comparison"
        :before-label="`Saved version ${entry.version}`"
        after-label="Current draft (including unsaved edits)"
      />
    </article>
    <details class="activity">
      <summary>Recent activity</summary>
      <p>
        The last 50 saves, restores and publishing actions recorded since change tracking was added.
      </p>
      <p v-if="!activity.length">No activity recorded yet.</p>
      <article v-for="entry in activity" :key="entry.id">
        <strong>{{ actionLabels[entry.action] || entry.action }} · v{{ entry.version }}</strong>
        <small>{{ new Date(entry.savedAt).toLocaleString() }} · {{ entry.savedBy }}</small>
        <small v-if="entry.source">From {{ entry.source }}</small>
        <details v-if="entry.total">
          <summary>{{ entry.total }} changes</summary>
          <ul>
            <li v-for="(path, index) in entry.paths" :key="index">{{ path }}</li>
          </ul>
          <small v-if="entry.total > (entry.paths?.length || 0)"
            >Showing the first {{ entry.paths?.length }} changed areas.</small
          >
        </details>
      </article>
    </details>
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
  overflow-wrap: anywhere;
}
button {
  font-family: inherit;
  font-size: 0.75rem;
  padding: 0.4rem 0.55rem;
  margin: 0.3rem 0.3rem 0.3rem 0;
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
