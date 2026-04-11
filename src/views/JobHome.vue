<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppAlert from '@/components/common/AppAlert.vue'
import JobAccessBadge from '@/components/common/JobAccessBadge.vue'
import AppModuleCard from '@/components/common/AppModuleCard.vue'
import TimecardWeekStatusBadge from '@/components/common/TimecardWeekStatusBadge.vue'
import AppPageHeader from '@/components/layout/AppPageHeader.vue'
import { useAuthStore } from '@/stores/auth'
import { useJobsStore } from '@/stores/jobs'
import { useAppStore } from '@/stores/app'
import { useJobAccess } from '@/composables/useJobAccess'
import { formatWeekRange, getSaturdayFromSunday, snapToSunday } from '@/utils/modelValidation'
import { ROLES, ROUTE_NAMES } from '@/constants/app'
import { logError } from '@/utils/logger'

const props = defineProps<{
  jobId?: string
}>()

const router = useRouter()
const auth = useAuthStore()
const jobs = useJobsStore()
const app = useAppStore()
const jobAccess = useJobAccess()

const jobId = computed(() => String(props.jobId ?? ''))

const job = computed(() => jobs.currentJob)
const jobName = computed(() => job.value?.name ?? 'Job')
const jobCode = computed(() => job.value?.code ?? '')
const timecardPeriodEnd = computed(() => job.value?.timecardPeriodEndDate ?? null)
const timecardStatus = computed(() => job.value?.timecardStatus ?? 'pending')

const currentWeekStart = computed(() => snapToSunday(new Date()))
const currentWeekEnd = computed(() => getSaturdayFromSunday(currentWeekStart.value))
const currentWeekLabel = computed(() => formatWeekRange(currentWeekStart.value, currentWeekEnd.value))

const isAdmin = computed(() => auth.role === ROLES.ADMIN)

const isForemanAssigned = computed(() => auth.assignedJobIds.includes(jobId.value))
const isForeman = computed(() => isForemanAssigned.value)

const canEmployeeModules = computed(() => isAdmin.value || isForeman.value)
const canShopOrders = computed(() => isAdmin.value || isForeman.value)

async function boot() {
  if (!jobId.value) return
  if (!auth.ready) await auth.init()

  if (!jobAccess.canAccessJob(jobId.value)) {
    app.clearJob()
    await router.push({ name: ROUTE_NAMES.UNAUTHORIZED })
    return
  }

  try {
    jobs.subscribeJob(jobId.value)
    app.setCurrentJob(jobId.value, jobs.currentJob?.name ?? null)
  } catch (e) {
    app.clearJob()
    logError('JobHome', 'Failed to load job', e)
  }
}

onMounted(() => {
  void boot()
})

watch(
  () => jobId.value,
  (next, prev) => {
    if (!next || next === prev) return
    void boot()
  }
)

watch(
  () => job.value?.name ?? null,
  (name) => {
    if (!jobId.value) return
    app.setCurrentJob(jobId.value, name)
  }
)

onUnmounted(() => {
  jobs.stopCurrentJobSubscription()
  app.clearJob()
})

</script>

<template>
  <div class="app-page">
    <AppPageHeader eyebrow="Job Workspace" :title="jobName">
      <template #meta>
        <span v-if="jobCode"><i class="bi bi-briefcase"></i>Job: {{ jobCode }}</span>
      </template>
      <template #badges>
        <JobAccessBadge
          :is-foreman="isForeman"
          :is-admin="isAdmin"
          class="app-page-chip"
        />
        <TimecardWeekStatusBadge
          :status="timecardStatus"
          :period-end-date="timecardPeriodEnd"
          :current-week-end="currentWeekEnd"
          :current-week-label="currentWeekLabel"
          class="app-page-chip"
        />
      </template>
    </AppPageHeader>

    <!-- No Access Alert -->
    <div class="row g-3">
      <!-- Daily Logs -->
      <div v-if="canEmployeeModules" class="col-12 col-md-6">
        <AppModuleCard
          title="Daily Logs"
          description="Enter and review daily notes for this job."
          icon="bi bi-journal-text"
          icon-class="text-primary"
          :to="{ name: ROUTE_NAMES.JOB_DAILY_LOGS, params: { jobId } }"
        />
      </div>

      <!-- Timecards -->
      <div v-if="canEmployeeModules" class="col-12 col-md-6">
        <AppModuleCard
          title="Timecards"
          description="Enter, review, and submit weekly hours and production for this job."
          icon="bi bi-clock-history"
          icon-class="text-info"
          :to="{ name: ROUTE_NAMES.JOB_TIMECARDS, params: { jobId } }"
        />
      </div>

      <!-- Shop Orders -->
      <div v-if="canShopOrders" class="col-12 col-md-6">
        <AppModuleCard
          title="Shop Orders"
          description="Create and manage purchase requests for this job."
          icon="bi bi-receipt"
          icon-class="text-success"
          :to="{ name: ROUTE_NAMES.JOB_SHOP_ORDERS, params: { jobId } }"
        />
      </div>

      <!-- No Modules Alert -->
      <div v-if="!canEmployeeModules && !canShopOrders && !isAdmin" class="col-12">
        <AppAlert
          variant="secondary"
          class="mb-0"
          icon="bi bi-info-circle"
          message="You have access to this job, but no modules are available for your current role."
        />
      </div>
    </div>
  </div>
</template>
