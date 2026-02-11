<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Toast from '../components/Toast.vue'
import { useAuthStore } from '../stores/auth'
import { useJobsStore } from '../stores/jobs'
import { useUsersStore } from '../stores/users'

const toastRef = ref<InstanceType<typeof Toast> | null>(null)

const router = useRouter()
const auth = useAuthStore()
const jobsStore = useJobsStore()
const usersStore = useUsersStore()

const err = ref('')

const uid = computed(() => auth.user?.uid ?? null)
const isAdmin = computed(() => auth.role === 'admin')
const isForeman = computed(() => auth.role === 'foreman')

// Get current user profile for assigned job IDs
const currentUserProfile = computed(() => usersStore.currentUserProfile)
const profileLoaded = computed(() => usersStore.currentUserProfile !== null)
const assignedJobIds = computed(() => auth.assignedJobIds ?? [])

// Split jobs into active and archived for admin view
const activeJobs = computed(() => {
  const jobs = jobsStore.activeJobs
  
  // For foreman, only show assigned jobs
  if (isForeman.value) {
    return jobs.filter(j => assignedJobIds.value.includes(j.id))
  }
  
  // Admin sees all jobs
  return jobs
})

const archivedJobs = computed(() => {
  // Only admins can see archived jobs
  if (isAdmin.value) {
    return jobsStore.archivedJobs
  }
  return []
})

async function init() {
  err.value = ''
  try {
    await jobsStore.fetchAllJobs(isAdmin.value)
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
  if (!auth.ready) await auth.init()
  await init()
})
</script>

<template>
  <Toast ref="toastRef" />
  
  <div class="container-fluid py-4" style="max-width: 1200px;">
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
        <div class="list-group mb-4">
          <button
            v-for="j in activeJobs"
            :key="j.id"
            type="button"
            class="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
            @click="openJob(j.id)"
          >
            <div>
              <div class="fw-semibold">{{ j.name }}</div>
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
        <div class="list-group">
          <button
            v-for="j in archivedJobs"
            :key="j.id"
            type="button"
            class="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
            @click="openJob(j.id)"
          >
            <div>
              <div class="fw-semibold text-muted">{{ j.name }}</div>
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

    <div class="text-muted small mt-3">
      Tip: If job filtering feels slow, add <code>memberUids</code> (array) to jobs for fast queries.
    </div>
  </div>
</template>
