<script setup lang="ts">
import ModulePlaceholder from '@/components/ModulePlaceholder.vue'
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
        description="These fixed lists are managed by admins and reused throughout jobs, employees, and workflow forms."
      >
        <ModulePlaceholder
          eyebrow="Reference Lists"
          title="List management scaffold"
          description="Reference list CRUD will live here when the admin setup workflow is expanded."
          :highlights="['Job types, GCs, and occupations will share this admin surface.']"
        />
      </PagePanel>
    </div>
  </AppShell>
</template>
