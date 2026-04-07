<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppBadge from '@/components/common/AppBadge.vue'
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import AppListCard from '@/components/common/AppListCard.vue'
import AppSelectableListItem from '@/components/common/AppSelectableListItem.vue'
import AppSectionCard from '@/components/common/AppSectionCard.vue'
import AppPageHeader from '@/components/layout/AppPageHeader.vue'
import { useJobAccess } from '@/composables/useJobAccess'
import { useToast } from '@/composables/useToast'
import { ROUTE_NAMES } from '@/constants/app'
import { normalizeError } from '@/services/serviceUtils'

const router = useRouter()
const { isAdmin, visibleActiveJobs, visibleArchivedJobs, loadJobsForCurrentUser, stopJobsForCurrentUser } = useJobAccess()
const toast = useToast()

const err = ref('')

const activeJobs = visibleActiveJobs
const archivedJobs = visibleArchivedJobs

async function init() {
  err.value = ''
  try {
    await loadJobsForCurrentUser()
  } catch (e) {
    err.value = normalizeError(e, 'Failed to load jobs')
    toast.show('Failed to load jobs', 'error')
  }
}

function openJob(jobId: string) {
  // Simply navigate to job home - JobHome.vue will load job details
  void router.push({ name: ROUTE_NAMES.JOB_HOME, params: { jobId } })
}

onMounted(() => {
  void init()
})

onUnmounted(() => {
  stopJobsForCurrentUser()
})
</script>

<template>
  <div class="app-page">
    <AppPageHeader eyebrow="Workspace" title="Dashboard" subtitle="Pick a job to continue." />

    <AppSectionCard v-if="activeJobs.length === 0 && archivedJobs.length === 0" class="app-empty-state-card">
      <AppEmptyState
        icon="bi bi-briefcase"
        title="No jobs found"
        message="Jobs you can access will appear here."
      />
    </AppSectionCard>

    <div v-else>
      <AppListCard
        v-if="activeJobs.length > 0"
        class="mb-4"
        :title="isAdmin ? 'Active Jobs' : 'Your Jobs'"
        :badge-label="activeJobs.length"
      >
        <div class="list-group list-group-flush app-selectable-list app-selectable-list--stacked">
          <AppSelectableListItem
            v-for="j in activeJobs"
            :key="j.id"
            as="button"
            tone="muted"
            class="job-item d-flex justify-content-between align-items-center"
            @activate="openJob(j.id)"
          >
            <div>
              <div class="fw-semibold">{{ j.name }}</div>
              <div class="app-selectable-list-meta small">
                <span v-if="j.code">Job Number: {{ j.code }}</span>
              </div>
            </div>

            <i class="bi bi-chevron-right app-selectable-list-meta" />
          </AppSelectableListItem>
        </div>
      </AppListCard>

      <AppListCard
        v-if="isAdmin && archivedJobs.length > 0"
        title="Archived Jobs"
        :badge-label="archivedJobs.length"
        badge-variant-class="text-bg-warning"
      >
        <div class="list-group app-selectable-list app-selectable-list--stacked">
          <AppSelectableListItem
            v-for="j in archivedJobs"
            :key="j.id"
            as="button"
            tone="muted"
            class="job-item d-flex justify-content-between align-items-center"
            @activate="openJob(j.id)"
          >
            <div>
              <div class="fw-semibold">{{ j.name }}</div>
              <div class="app-selectable-list-meta small">
                <span v-if="j.code">Job Number: {{ j.code }}</span>
                <AppBadge label="Archived" variant-class="text-bg-warning" class="ms-2" />
              </div>
            </div>

            <i class="bi bi-chevron-right app-selectable-list-meta" />
          </AppSelectableListItem>
        </div>
      </AppListCard>
    </div>
  </div>
</template>

