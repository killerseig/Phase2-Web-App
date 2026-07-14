<script setup lang="ts">
import PagePanel from '@/components/PagePanel.vue'
import { formatJobTypeLabel } from '@/types/domain'
import type { JobRecord } from '@/types/domain'

defineProps<{
  job: JobRecord | null
}>()
</script>

<template>
  <PagePanel
    eyebrow="Job"
    :title="job ? `${job.code || 'No Job #'} - ${job.name}` : 'Job not found'"
    description="Foremen land on the job dashboard first, then choose a module."
  >
    <div class="job-dashboard-header">
      <div class="job-dashboard-header__meta">
        <span v-if="job">Type: {{ formatJobTypeLabel(job.type) }}</span>
        <span v-if="job?.gc">GC: {{ job.gc }}</span>
        <span>Mode: module launcher</span>
      </div>
    </div>
  </PagePanel>
</template>

<style scoped>
.job-dashboard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.job-dashboard-header__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  color: var(--text-muted);
}

@media (max-width: 820px) {
  .job-dashboard-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
