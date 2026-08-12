<script setup lang="ts">
import JobDashboardHeader from '@/components/jobs/JobDashboardHeader.vue'
import JobDashboardPageShell from '@/components/jobs/JobDashboardPageShell.vue'
import ModuleLauncherGrid from '@/components/jobs/ModuleLauncherGrid.vue'
import { useRouteJobContext } from '@/composables/useRouteJobContext'
import { getJobDashboardModules } from '@/features/jobs/jobDashboardModules'
import { useJobDashboardLifecycle } from '@/features/jobs/useJobDashboardLifecycle'

const {
  job,
  jobId,
  subscribeRouteJob,
  stopRouteJobSubscription,
} = useRouteJobContext()

const modules = getJobDashboardModules()

useJobDashboardLifecycle({
  jobId,
  subscribeRouteJob,
  stopRouteJobSubscription,
})
</script>

<template>
  <JobDashboardPageShell test-id="job-dashboard-page">
    <template #header>
      <JobDashboardHeader :job="job" />
    </template>

    <template #modules>
      <ModuleLauncherGrid :job-id="jobId" :modules="modules" />
    </template>
  </JobDashboardPageShell>
</template>
