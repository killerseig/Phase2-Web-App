<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { getCurrentRoleLabel } from '@/auth/capabilities'
import PagePanel from '@/components/PagePanel.vue'
import RoleDashboardJobShortcuts from '@/components/dashboard/RoleDashboardJobShortcuts.vue'
import RoleDashboardModuleGrid from '@/components/dashboard/RoleDashboardModuleGrid.vue'
import { getRoleDashboardJobShortcuts } from '@/features/dashboard/roleDashboardJobShortcuts'
import { getTargetRoleDashboardModules } from '@/features/dashboard/roleDashboardModules'
import AppShell from '@/layouts/AppShell.vue'
import { useAuthStore } from '@/stores/auth'
import { useJobsStore } from '@/stores/jobs'

const auth = useAuthStore()
const jobsStore = useJobsStore()

const roleLabel = computed(() => getCurrentRoleLabel(auth.rawRole))
const displayName = computed(() => auth.displayName || roleLabel.value)
const modules = computed(() => getTargetRoleDashboardModules(auth.rawRole))
const jobShortcuts = computed(() => getRoleDashboardJobShortcuts({
  assignedJobIds: auth.assignedJobIds,
  jobs: jobsStore.activeJobs,
  rawRole: auth.rawRole,
}))

onMounted(() => {
  jobsStore.subscribeVisibleJobs()
})

onBeforeUnmount(() => {
  jobsStore.stopJobsSubscription()
})
</script>

<template>
  <AppShell>
    <div class="role-dashboard-page" data-testid="role-dashboard-page">
      <PagePanel
        eyebrow="Role Dashboard"
        :title="`Welcome, ${displayName}`"
        :description="`Signed in as ${roleLabel}. Start with the tools available to your role, or open Jobs to drill into a shared job dashboard.`"
      >
        <RoleDashboardModuleGrid :modules="modules" />
        <RoleDashboardJobShortcuts
          :error="jobsStore.error"
          :loading="jobsStore.loading"
          :shortcuts="jobShortcuts"
        />
      </PagePanel>
    </div>
  </AppShell>
</template>

<style scoped>
.role-dashboard-page {
  display: grid;
  gap: 1rem;
}
</style>
