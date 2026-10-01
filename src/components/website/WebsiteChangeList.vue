<script setup lang="ts">
import type { WebsiteComparison } from '../../../functions/src/websiteChanges'
defineProps<{ comparison: WebsiteComparison; beforeLabel: string; afterLabel: string }>()
</script>
<template>
  <div class="change-list">
    <p v-if="!comparison.total">No differences found.</p>
    <p v-else>{{ comparison.total }} {{ comparison.total === 1 ? 'change' : 'changes' }}</p>
    <p v-if="comparison.total > comparison.changes.length">
      Showing the first {{ comparison.changes.length }} changes. Long values are shortened.
    </p>
    <details v-for="(change, index) in comparison.changes" :key="index">
      <summary>
        <span class="change-kind">{{ change.kind }}</span> {{ change.path }}
      </summary>
      <dl>
        <dt>{{ beforeLabel }}</dt>
        <dd>{{ change.before }}</dd>
        <dt>{{ afterLabel }}</dt>
        <dd>{{ change.after }}</dd>
      </dl>
    </details>
  </div>
</template>
<style scoped>
.change-list {
  font-size: 0.8rem;
  overflow-wrap: anywhere;
}
details {
  padding: 0.4rem 0;
  border-top: 1px solid var(--border);
}
summary {
  cursor: pointer;
}
.change-kind {
  text-transform: capitalize;
  font-weight: 600;
}
dl {
  margin: 0.5rem 0;
}
dt {
  font-weight: 600;
  color: var(--muted);
}
dd {
  margin: 0.25rem 0 0.65rem;
  white-space: pre-wrap;
}
</style>
