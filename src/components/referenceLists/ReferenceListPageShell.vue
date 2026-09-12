<script setup lang="ts">
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import PagePanel from '@/components/PagePanel.vue'
import AppShell from '@/layouts/AppShell.vue'

defineProps<{
  title: string
}>()
</script>

<template>
  <AppShell>
    <div data-testid="reference-list-page">
      <PagePanel
        eyebrow="Admin"
        :title="title"
        description="Shared choices used in jobs, employee records, and forms."
      >
        <AppEmptyState message="List editing is not available yet." />
      </PagePanel>
    </div>
  </AppShell>
</template>
