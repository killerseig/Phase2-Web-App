<script setup lang="ts">
import JobDashboardHeader from '@/components/jobs/JobDashboardHeader.vue'
import ModuleLauncherGrid from '@/components/jobs/ModuleLauncherGrid.vue'
import type { ModuleLauncherItem } from '@/components/jobs/ModuleLauncherGrid.vue'
import { useRouteJobContext } from '@/composables/useRouteJobContext'
import { useJobDashboardLifecycle } from '@/features/jobs/useJobDashboardLifecycle'
import AppShell from '@/layouts/AppShell.vue'

const {
  job,
  jobId,
  subscribeRouteJob,
  stopRouteJobSubscription,
} = useRouteJobContext()

const modules: ModuleLauncherItem[] = [
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

useJobDashboardLifecycle({
  jobId,
  subscribeRouteJob,
  stopRouteJobSubscription,
})
</script>

<template>
  <AppShell>
    <div class="workspace-grid" data-testid="job-dashboard-page">
      <JobDashboardHeader :job="job" />
      <ModuleLauncherGrid :job-id="jobId" :modules="modules" />
    </div>
  </AppShell>
</template>

<style scoped>
.workspace-grid {
  display: grid;
  gap: 1rem;
}
</style>
