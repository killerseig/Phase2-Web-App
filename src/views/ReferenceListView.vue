<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppShell from '@/layouts/AppShell.vue'
import PagePanel from '@/components/PagePanel.vue'

const route = useRoute()

const title = computed(() => {
  const key = String(route.params.listKey)
  if (key === 'job-types') return 'Job Types'
  if (key === 'gcs') return 'GCs'
  return 'Occupations'
})
</script>

<template>
  <AppShell>
    <PagePanel
      eyebrow="Admin"
      :title="title"
      description="These fixed lists are managed by admins and reused throughout jobs, employees, and workflow forms."
    >
      <div class="catalog-tree-preview">
        <div class="catalog-tree-preview__node">List management scaffold</div>
      </div>
    </PagePanel>
  </AppShell>
</template>
