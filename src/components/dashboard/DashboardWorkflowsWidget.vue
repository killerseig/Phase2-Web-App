<script setup lang="ts">
import ModuleLauncherGrid from '@/components/jobs/ModuleLauncherGrid.vue'
import JobFormsList from '@/components/jobs/JobFormsList.vue'
import { getJobDashboardModules } from '@/features/jobs/jobDashboardModules'
import { useAuthStore } from '@/stores/auth'

defineProps<{ jobId: string; editing: boolean; scope?: 'personal' | 'role' | 'job' }>()
const auth = useAuthStore()
</script>

<template>
  <div class="dashboard-workflows" :inert="editing">
    <ModuleLauncherGrid
      :job-id="jobId"
      :modules="getJobDashboardModules()"
      :show-company-library="auth.hasWorkspaceAccess"
    />
    <JobFormsList
      v-if="!editing"
      :key="jobId"
      :job-id="jobId"
      :dashboard-scope="scope === 'personal' ? 'personal' : scope ? 'role' : undefined"
      :dashboard-return="
        scope === 'job' ? 'shared-job' : scope === 'role' ? 'shared-role' : undefined
      "
    />
    <p v-else>Available forms for this job appear when you finish editing the template.</p>
  </div>
</template>

<style scoped>
.dashboard-workflows {
  display: grid;
  gap: 1rem;
  min-width: 0;
}
</style>
