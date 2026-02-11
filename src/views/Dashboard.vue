<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Toast from '../components/Toast.vue'
import { useJobAccess } from '@/composables/useJobAccess'

const toastRef = ref<InstanceType<typeof Toast> | null>(null)

const router = useRouter()
const { isAdmin, isForeman, visibleActiveJobs, visibleArchivedJobs, loadJobsForCurrentUser } = useJobAccess()

const err = ref('')

const activeJobs = visibleActiveJobs
const archivedJobs = visibleArchivedJobs

async function init() {
  err.value = ''
  try {
    await loadJobsForCurrentUser()
  } catch (e: any) {
    err.value = e?.message ?? 'Failed to load jobs'
    toastRef.value?.show('Failed to load jobs', 'error')
  }
}

async function openJob(jobId: string) {
  // Simply navigate to job home - JobHome.vue will load job details
  router.push({ name: 'job-home', params: { jobId } })
}

onMounted(async () => {
  await init()
})
</script>

<template>
  <Toast ref="toastRef" />
  
  <div class="container-fluid py-4 wide-container-1200">
    <div class="mb-4">
      <h2 class="h3 mb-1">Dashboard</h2>
      <div class="text-muted small">Pick a job to continue</div>
    </div>

    <div v-if="activeJobs.length === 0 && archivedJobs.length === 0" class="alert alert-secondary">
      No jobs found.
    </div>

    <div v-else>
      <!-- Active Jobs Section -->
      <div v-if="activeJobs.length > 0">
        <h5 class="mb-3">{{ isAdmin ? 'Active Jobs' : 'Your Jobs' }}</h5>
        <div class="list-group mb-4 job-list">
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
      <div v-if="isAdmin && archivedJobs.length > 0">
        <h5 class="mb-3 text-muted">Archived Jobs</h5>
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
                <span class="ms-2 badge text-bg-warning">Archived</span>
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

.wide-container-1200 {
  max-width: 1200px;
}

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
