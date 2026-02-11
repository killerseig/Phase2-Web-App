<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useJobsStore } from '../stores/jobs'
import { useJobRosterStore } from '../stores/jobRoster'

defineProps<{
  jobId?: string
}>()

const route = useRoute()
const auth = useAuthStore()
const jobs = useJobsStore()
const roster = useJobRosterStore()

const jobId = computed(() => String(route.params.jobId))

const job = computed(() => jobs.currentJob)
const jobName = computed(() => job.value?.name ?? 'Job')
const jobCode = computed(() => job.value?.code ?? '')

const currentUser = computed(() => auth.user)
const isAdmin = computed(() => auth.role === 'admin')

// Check if current user is foreman of this job (either assigned via auth store OR has roster entry)
const isForemanAssigned = computed(() => auth.assignedJobIds.includes(jobId.value))

const currentUserRosterEntry = computed(() => {
  if (!currentUser.value?.uid) return null
  return roster.currentJobRoster.find(e => e.id === currentUser.value?.uid)
})

const isForeman = computed(() => isForemanAssigned.value || (currentUserRosterEntry.value?.isPrimaryForeman ?? false))

// Employees can access: Daily Logs, Timecards, Shop Orders
// Foremen can access: everything + roster management
// Admins can access: everything + admin panel

const canEmployeeModules = computed(() => isAdmin.value || isForeman.value || currentUserRosterEntry.value?.active)
const canShopOrders = computed(() => isAdmin.value || isForeman.value || currentUserRosterEntry.value?.active)
const canManageRoster = computed(() => isAdmin.value || isForeman.value)

async function boot() {
  if (!auth.ready) await auth.init()

  try {
    // Load job
    await jobs.fetchJob(jobId.value)
    
    // Load roster
    await roster.setCurrentJob(jobId.value)
    await roster.fetchJobRoster(jobId.value)
  } catch (e) {
    console.error('Failed to load job:', e)
  }
}

onMounted(boot)

watch(
  () => route.params.jobId,
  async () => {
    await boot()
  }
)

</script>

<template>
  <div class="container-fluid py-4" style="max-width: 1200px;">
    <div class="mb-4">
      <h2 class="h3 mb-1">{{ jobName }}</h2>
      <div class="text-muted small d-flex align-items-center gap-2 flex-wrap">
        <span v-if="jobCode"><i class="bi bi-briefcase"></i>Job: {{ jobCode }}</span>
        <span v-if="isForeman" class="badge bg-success"><i class="bi bi-person-badge me-1"></i>You are Foreman</span>
        <span v-else-if="isAdmin" class="badge bg-primary"><i class="bi bi-shield-check me-1"></i>Admin</span>
        <span v-else-if="currentUserRosterEntry?.active" class="badge bg-info"><i class="bi bi-person me-1"></i>On Roster</span>
      </div>
    </div>

    <!-- No Access Alert -->
    <div v-if="!isAdmin && !canEmployeeModules && !canShopOrders" class="alert alert-warning mb-4">
      <i class="bi bi-exclamation-triangle me-2"></i>
      You don't have roster access to this job. Contact an administrator to be added.
    </div>

    <div v-else class="row g-3">
      <!-- Daily Logs -->
      <div v-if="canEmployeeModules" class="col-12 col-md-6">
        <div class="card h-100 shadow-sm">
          <div class="card-body">
            <h5 class="card-title mb-2">
              <i class="bi bi-journal-text text-primary me-2"></i>Daily Logs
            </h5>
            <p class="text-muted small mb-3">Enter and review daily notes for this job.</p>
            <router-link class="btn btn-primary btn-sm" :to="{ name: 'job-daily-logs', params: { jobId } }">
              <i class="bi bi-arrow-right me-1"></i>Open
            </router-link>
          </div>
        </div>
      </div>

      <!-- Timecards -->
      <div v-if="canEmployeeModules" class="col-12 col-md-6">
        <div class="card h-100 shadow-sm">
          <div class="card-body">
            <h5 class="card-title mb-2">
              <i class="bi bi-clock-history text-info me-2"></i>Timecards
            </h5>
            <p class="text-muted small mb-3">Track hours and production for this job.</p>
            <router-link class="btn btn-primary btn-sm" :to="{ name: 'job-timecards', params: { jobId } }">
              <i class="bi bi-arrow-right me-1"></i>Open
            </router-link>
          </div>
        </div>
      </div>

      <!-- Shop Orders -->
      <div v-if="canShopOrders" class="col-12 col-md-6">
        <div class="card h-100 shadow-sm">
          <div class="card-body">
            <h5 class="card-title mb-2">
              <i class="bi bi-receipt text-success me-2"></i>Shop Orders
            </h5>
            <p class="text-muted small mb-3">Create and manage purchase requests for this job.</p>
            <router-link class="btn btn-primary btn-sm" :to="{ name: 'job-shop-orders', params: { jobId } }">
              <i class="bi bi-arrow-right me-1"></i>Open
            </router-link>
          </div>
        </div>
      </div>

      <!-- Foreman Tools (Foremen and Admins only) -->
      <div v-if="canManageRoster" class="col-12 col-md-6">
        <div class="card h-100 shadow-sm border-info">
          <div class="card-header bg-light border-info">
            <h5 class="card-title mb-0 text-info">
              <i class="bi bi-tools me-2"></i>Management Tools
            </h5>
          </div>
          <div class="card-body">
            <p class="text-muted small mb-3">Job roster and team management.</p>
            <div class="btn-group btn-group-sm w-100" role="group">
              <button class="btn btn-outline-info" disabled title="Manage roster in Admin > Jobs">
                <i class="bi bi-people me-1"></i>Roster
              </button>
              <button class="btn btn-outline-info" disabled title="Coming soon">
                <i class="bi bi-graph-up me-1"></i>Reports
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Admin Panel -->
      <div v-if="isAdmin" class="col-12 col-md-6">
        <div class="card h-100 shadow-sm border-danger">
          <div class="card-header bg-light border-danger">
            <h5 class="card-title mb-0 text-danger">
              <i class="bi bi-shield-lock me-2"></i>Admin Tools
            </h5>
          </div>
          <div class="card-body">
            <p class="text-muted small mb-3">System administration and configuration.</p>
            <router-link 
              class="btn btn-outline-danger btn-sm w-100" 
              :to="{ name: 'admin-jobs' }"
            >
              <i class="bi bi-gear me-1"></i>Job Settings
            </router-link>
          </div>
        </div>
      </div>

      <!-- No Modules Alert -->
      <div v-if="!canEmployeeModules && !canShopOrders && !canManageRoster && !isAdmin" class="col-12">
        <div class="alert alert-secondary mb-0">
          <i class="bi bi-info-circle me-2"></i>
          You have access to this job, but no modules are available for your current role.
        </div>
      </div>
    </div>
  </div>
</template>
