<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppBadge from '@/components/common/AppBadge.vue'
import AppEmptyState from '@/components/common/AppEmptyState.vue'
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

    <div v-if="activeJobs.length === 0 && archivedJobs.length === 0" class="card app-section-card">
      <AppEmptyState
        class="card-body"
        icon="bi bi-briefcase"
        title="No jobs found"
        message="Jobs you can access will appear here."
      />
    </div>

    <div v-else>
      <!-- Active Jobs Section -->
      <div v-if="activeJobs.length > 0" class="card app-list-card mb-4">
        <div class="card-header panel-header d-flex justify-content-between align-items-center gap-2">
          <h3 class="h5 mb-0">{{ isAdmin ? 'Active Jobs' : 'Your Jobs' }}</h3>
          <AppBadge :label="activeJobs.length" />
        </div>
        <div class="list-group list-group-flush job-list">
          <button
            v-for="j in activeJobs"
            :key="j.id"
            type="button"
            class="list-group-item list-group-item-action d-flex justify-content-between align-items-center job-item"
            @click="openJob(j.id)"
          >
            <div>
              <div class="fw-semibold job-name">{{ j.name }}</div>
              <div class="text-muted small">
                <span v-if="j.code">Job Number: {{ j.code }}</span>
              </div>
            </div>

            <i class="bi bi-chevron-right text-muted" />
          </button>
        </div>
      </div>

      <!-- Archived Jobs Section (Admins Only) -->
      <div v-if="isAdmin && archivedJobs.length > 0" class="card app-list-card">
        <div class="card-header panel-header d-flex justify-content-between align-items-center gap-2">
          <h3 class="h5 mb-0">Archived Jobs</h3>
          <AppBadge :label="archivedJobs.length" variant-class="text-bg-warning" />
        </div>
        <div class="list-group job-list">
          <button
            v-for="j in archivedJobs"
            :key="j.id"
            type="button"
            class="list-group-item list-group-item-action d-flex justify-content-between align-items-center job-item"
            @click="openJob(j.id)"
          >
            <div>
              <div class="fw-semibold text-muted job-name">{{ j.name }}</div>
              <div class="text-muted small">
                <span v-if="j.code">Job Number: {{ j.code }}</span>
                <AppBadge label="Archived" variant-class="text-bg-warning" class="ms-2" />
              </div>
            </div>

            <i class="bi bi-chevron-right text-muted" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;

.job-list .job-item {
  background: $surface-2;
  color: $body-color;
  border: 1px solid $border-color;
  transition: background-color 0.2s ease, border-color 0.2s ease, transform 0.15s ease;
}

.job-list .job-item + .job-item {
  margin-top: 0.5rem;
}

.job-list .job-item:hover,
.job-list .job-item:focus {
  background: rgba($primary, 0.10);
  border-color: rgba($primary, 0.4);
  color: $body-color;
  transform: translateY(-1px);
}

.job-list .job-item:active {
  transform: translateY(0);
}

.job-name {
  color: $body-color;
}

.job-list .list-group-item {
  border-radius: $border-radius-sm;
}

.job-list .list-group-item-action:focus {
  box-shadow: 0 0 0 0.15rem rgba($primary, 0.25);
}
</style>

