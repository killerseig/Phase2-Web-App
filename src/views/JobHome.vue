<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useJobsStore } from '../stores/jobs'
import { useJobRosterStore } from '../stores/jobRoster'
import { useJobAccess } from '@/composables/useJobAccess'
import { formatWeekRange, getSaturdayFromSunday, snapToSunday } from '@/utils/modelValidation'

defineProps<{
  jobId?: string
}>()

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const jobs = useJobsStore()
const roster = useJobRosterStore()
const jobAccess = useJobAccess()

const jobId = computed(() => String(route.params.jobId))

const job = computed(() => jobs.currentJob)
const jobName = computed(() => job.value?.name ?? 'Job')
const jobCode = computed(() => job.value?.code ?? '')
const timecardPeriodEnd = computed(() => job.value?.timecardPeriodEndDate ?? null)
const timecardStatus = computed(() => job.value?.timecardStatus ?? 'pending')

const currentWeekStart = computed(() => snapToSunday(new Date()))
const currentWeekEnd = computed(() => getSaturdayFromSunday(currentWeekStart.value))
const currentWeekLabel = computed(() => formatWeekRange(currentWeekStart.value, currentWeekEnd.value))

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

  if (!jobAccess.canAccessJob(jobId.value)) {
    await router.push({ name: 'unauthorized' })
    return
  }

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
  <div class="container-fluid py-4 wide-container-1200">
    <div class="mb-4">
      <h2 class="h3 mb-1">{{ jobName }}</h2>
      <div class="text-muted small d-flex align-items-center gap-2 flex-wrap">
        <span v-if="jobCode"><i class="bi bi-briefcase"></i>Job: {{ jobCode }}</span>
        <span v-if="isForeman" class="badge bg-success"><i class="bi bi-person-badge me-1"></i>You are Foreman</span>
        <span v-else-if="isAdmin" class="badge bg-primary"><i class="bi bi-shield-check me-1"></i>Admin</span>
        <span v-else-if="currentUserRosterEntry?.active" class="badge bg-info"><i class="bi bi-person me-1"></i>On Roster</span>
        <span
          class="badge"
          :class="timecardStatus === 'submitted' && timecardPeriodEnd === currentWeekEnd ? 'text-bg-success' : 'text-bg-danger'"
          :title="`Timecards for week ${currentWeekLabel}: ${timecardStatus === 'submitted' && timecardPeriodEnd === currentWeekEnd ? 'Submitted' : 'Not submitted'}`"
        >
          {{ timecardStatus === 'submitted' && timecardPeriodEnd === currentWeekEnd ? 'Timecards submitted this week' : 'Timecards not submitted this week' }}
        </span>
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

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;

.wide-container-1200 {
  max-width: 1200px;
}
</style>
