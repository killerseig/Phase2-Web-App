<script setup lang="ts">
defineProps<{ kind: string; scope: string; shared?: boolean }>()
</script>

<template>
  <div class="selection-context" role="group" aria-label="Selection scope">
    <strong>{{ kind }}</strong>
    <span :title="scope"><i v-if="shared" class="pi pi-link" aria-hidden="true" />{{ scope }}</span>
  </div>
</template>

<style scoped>
.selection-context {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  padding-block: 0.35rem;
  font-size: 0.72rem;
  border-bottom: 1px solid var(--border);
}
strong {
  flex-shrink: 0;
}
span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--muted);
}
i {
  margin-inline-end: 0.3rem;
  font-size: 0.7rem;
}
</style>
