<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AppShell from '@/layouts/AppShell.vue'
import PagePanel from '@/components/PagePanel.vue'
import { useJobsStore } from '@/stores/jobs'
import { formatJobTypeLabel } from '@/types/domain'

const route = useRoute()
const jobsStore = useJobsStore()

const jobId = computed(() => String(route.params.jobId ?? ''))
const job = computed(() => {
  if (jobsStore.currentJob?.id === jobId.value) return jobsStore.currentJob
  return jobsStore.jobs.find((item) => item.id === jobId.value) ?? null
})

const modules = [
  {
    label: 'Timecards',
    detail: 'Weekly card workflow stays the first production priority.',
    to: 'timecards',
  },
  {
    label: 'Daily Logs',
    detail: 'Structured daily reporting with shared recipients.',
    to: 'daily-logs',
  },
  {
    label: 'Shop Orders',
    detail: 'Explorer-style ordering workspace with custom items.',
    to: 'shop-orders',
  },
]

function syncJobSubscription() {
  if (!jobId.value) return
  jobsStore.subscribeJob(jobId.value)
}

onMounted(() => {
  syncJobSubscription()
})

watch(jobId, () => {
  syncJobSubscription()
})

onUnmounted(() => {
  jobsStore.stopCurrentJobSubscription()
})
</script>

<template>
  <AppShell>
    <div class="workspace-grid">
      <PagePanel
        eyebrow="Job"
        :title="job ? `${job.code || 'No Job #'} · ${job.name}` : 'Job not found'"
        description="Foremen land on the job dashboard first, then choose a module."
      >
        <div class="dashboard-header">
          <div class="dashboard-header__meta">
            <span v-if="job">Type: {{ formatJobTypeLabel(job.type) }}</span>
            <span v-if="job?.gc">GC: {{ job.gc }}</span>
            <span>Mode: module launcher</span>
          </div>
        </div>
      </PagePanel>

      <div class="module-launcher-grid">
        <RouterLink
          v-for="module in modules"
          :key="module.label"
          :to="`/jobs/${route.params.jobId}/${module.to}`"
          class="module-launcher"
        >
          <span class="module-launcher__eyebrow">{{ module.label }}</span>
          <strong>{{ module.label }}</strong>
          <p>{{ module.detail }}</p>
        </RouterLink>
      </div>
    </div>
  </AppShell>
</template>
