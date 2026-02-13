<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import flatPickr from 'vue-flatpickr-component'
import 'flatpickr/dist/flatpickr.css'
import Toast from '../../components/Toast.vue'
import AdminCardWrapper from '../../components/admin/AdminCardWrapper.vue'
import StatusBadge from '../../components/admin/StatusBadge.vue'
import { useJobsStore } from '../../stores/jobs'
import { useJobRosterStore } from '../../stores/jobRoster'
import { useUsersStore } from '../../stores/users'
import type { Job } from '@/services'
import { formatWeekRange, getSaturdayFromSunday, snapToSunday } from '@/utils/modelValidation'
import { listSubmittedTimecards, listTimecardsByJobAndWeek } from '@/services/Timecards'
import { downloadCsv } from '@/utils/plexisIntegration'

const toastRef = ref<InstanceType<typeof Toast> | null>(null)
const jobsStore = useJobsStore()
const rosterStore = useJobRosterStore()
const usersStore = useUsersStore()

// Jobs state from store
const jobs = computed(() => jobsStore.allJobs)
const orderedJobs = computed(() =>
  [...jobsStore.allJobs].sort((a, b) => {
    if (a.active !== b.active) return Number(b.active) - Number(a.active)
    return (a.name || '').localeCompare(b.name || '')
  })
)
const loadingJobs = computed(() => jobsStore.isLoading)
const err = computed(() => jobsStore.error || '')

// Job form
const showJobModal = ref(false)
const jobForm = ref({
  name: '',
  code: '',
})
const creatingJob = ref(false)
const togglingJobId = ref('')

// Foreman modal (for job roster employees and foreman user assignment)
const showForemanModal = ref(false)
const selectedJobForForeman = ref<Job | null>(null)
const rosterEmployees = computed(() => rosterStore.currentJobRoster)
const loadingRoster = ref(false)

// Foreman user assignment
const selectedForemanUserId = ref<string>('')
const assigningForemanUser = ref(false)

// Computed foreman users
const foremanUsers = computed(() => usersStore.allUsers.filter(u => u.role === 'foreman' && u.active))
const loadingForemanUsers = computed(() => usersStore.isLoading)

// Foremen assigned to the selected job
const assignedForemen = computed(() => {
  if (!selectedJobForForeman.value) return []
  return usersStore.allUsers.filter(u => 
    u.role === 'foreman' && 
    u.active && 
    u.assignedJobIds?.includes(selectedJobForForeman.value!.id)
  )
})

const currentWeekStart = computed(() => snapToSunday(new Date()))
const currentWeekEnd = computed(() => getSaturdayFromSunday(currentWeekStart.value))
const currentWeekLabel = computed(() => formatWeekRange(currentWeekStart.value, currentWeekEnd.value))
const exportWeekEnding = ref<string>(currentWeekEnd.value)

const exportDateConfig = computed(() => ({
  dateFormat: 'Y-m-d',
  disableMobile: true,
  prevArrow: '<i class="bi bi-chevron-left"></i>',
  nextArrow: '<i class="bi bi-chevron-right"></i>',
  maxDate: currentWeekEnd.value,
}))

function normalizeWeekEnding(input?: string | Date | null): string | undefined {
  if (!input) return undefined
  if (typeof input === 'string') return input
  const year = input.getFullYear()
  const month = String(input.getMonth() + 1).padStart(2, '0')
  const day = String(input.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toCsv(headers: string[], rows: (string | number)[][]): string {
  const escape = (v: string | number) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\n')
}

async function exportAllSubmittedAllJobs(weekEndingInput?: string | Date | null) {
  try {
    const weekEnding = normalizeWeekEnding(weekEndingInput ?? exportWeekEnding.value)
    const jobList = jobs.value
    const rows: (string | number)[][] = []
    for (const job of jobList) {
      const tcs = weekEnding
        ? (await listTimecardsByJobAndWeek(job.id, weekEnding)).filter(t => t.status === 'submitted')
        : await listSubmittedTimecards(job.id)
      for (const tc of tcs) {
        rows.push([
          job.name,
          job.code || '',
          tc.weekEndingDate,
          tc.employeeNumber,
          tc.employeeName,
          tc.occupation,
          tc.days[0]?.hours ?? '',
          tc.days[1]?.hours ?? '',
          tc.days[2]?.hours ?? '',
          tc.days[3]?.hours ?? '',
          tc.days[4]?.hours ?? '',
          tc.days[5]?.hours ?? '',
          tc.days[6]?.hours ?? '',
          tc.totals.hoursTotal ?? '',
          tc.totals.productionTotal ?? '',
        ])
      }
    }

    if (rows.length === 0) {
      toastRef.value?.show('No submitted timecards to export', 'info')
      return
    }

    const headers = [
      'Job Name',
      'Job Code',
      'Week Ending',
      'Employee #',
      'Name',
      'Occupation',
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Total Hours',
      'Total Production',
    ]

    const filename = weekEnding
      ? `timecards-submitted-all-jobs-${weekEnding}.csv`
      : 'timecards-submitted-all-jobs.csv'

    downloadCsv(toCsv(headers, rows), filename)
    toastRef.value?.show('Exported submitted timecards', 'success')
  } catch (e: any) {
    toastRef.value?.show(e?.message ?? 'Failed to export timecards', 'error')
  }
}

const removingForemanId = ref<string>('')

function formatErr(e: any) {
  const msg = e?.message ? String(e.message) : String(e)
  return msg
}

async function loadJobs() {
  await jobsStore.fetchAllJobs(true)
}

async function submitJobForm() {
  creatingJob.value = true
  try {
    await jobsStore.createJob(jobForm.value.name, { code: jobForm.value.code })
    toastRef.value?.show('Job created successfully', 'success')
    showJobModal.value = false
    jobForm.value = { name: '', code: '' }
    await loadJobs()
  } catch (e: any) {
    toastRef.value?.show(formatErr(e), 'error')
  } finally {
    creatingJob.value = false
  }
}

async function handleEditJob(job: Job) {
  const newName = prompt('Edit job name:', job.name)
  if (!newName || newName === job.name) return

  try {
    await jobsStore.updateJob(job.id, { name: newName })
    toastRef.value?.show('Job updated', 'success')
  } catch (e: any) {
    toastRef.value?.show('Failed to update job', 'error')
  }
}

async function handleDeleteJob(job: Job) {
  if (!confirm(`Delete "${job.name}"? This action cannot be undone and will remove all associated data (daily logs, timecards, orders, etc.).`)) return

  try {
    await jobsStore.deleteJob(job.id)
    toastRef.value?.show('Job deleted', 'success')
    await loadJobs()
  } catch (e: any) {
    toastRef.value?.show('Failed to delete job', 'error')
  }
}

async function toggleArchive(job: Job, active: boolean) {
  togglingJobId.value = job.id
  try {
    await jobsStore.setJobActive(job.id, active)
    toastRef.value?.show(active ? 'Job restored' : 'Job archived', 'success')
    await loadJobs()
  } catch (e: any) {
    toastRef.value?.show(e?.message ?? 'Failed to update job status', 'error')
  } finally {
    togglingJobId.value = ''
  }
}

async function openForemanModal(job: Job) {
  selectedJobForForeman.value = job
  loadingRoster.value = true
  try {
    await rosterStore.setCurrentJob(job.id)
    await rosterStore.fetchJobRoster(job.id)
  } catch (e: any) {
    toastRef.value?.show('Failed to load roster', 'error')
  } finally {
    loadingRoster.value = false
    showForemanModal.value = true
  }
}

async function setForeman(employeeId: string, isPrimary: boolean) {
  if (!selectedJobForForeman.value) return
  
  try {
    await rosterStore.updateEmployee(selectedJobForForeman.value.id, employeeId, { 
      isPrimaryForeman: isPrimary 
    })
    toastRef.value?.show(`Foreman role updated`, 'success')
    // Refresh roster
    await rosterStore.fetchJobRoster(selectedJobForForeman.value.id)
  } catch (e: any) {
    toastRef.value?.show('Failed to update foreman', 'error')
  }
}

async function assignForemanUserToJob() {
  if (!selectedJobForForeman.value || !selectedForemanUserId.value) {
    toastRef.value?.show('Please select a foreman', 'error')
    return
  }

  assigningForemanUser.value = true
  try {
    await usersStore.assignJobToForeman(selectedForemanUserId.value, selectedJobForForeman.value.id)
    toastRef.value?.show('Foreman assigned to job', 'success')
    selectedForemanUserId.value = ''
    // Refresh users to update assignedForemen
    await usersStore.fetchAllUsers()
  } catch (e: any) {
    toastRef.value?.show(formatErr(e), 'error')
  } finally {
    assigningForemanUser.value = false
  }
}

async function removeForemanFromJob(foremanId: string) {
  if (!selectedJobForForeman.value) return
  
  if (!confirm('Remove this foreman from the job?')) return

  removingForemanId.value = foremanId
  try {
    await usersStore.removeJobFromForeman(foremanId, selectedJobForForeman.value.id)
    toastRef.value?.show('Foreman removed from job', 'success')
    // Refresh users to update assignedForemen
    await usersStore.fetchAllUsers()
  } catch (e: any) {
    toastRef.value?.show(formatErr(e), 'error')
  } finally {
    removingForemanId.value = ''
  }
}

onMounted(async () => {
  loadJobs()
  await usersStore.fetchAllUsers()
})

</script>

<template>
  <Toast ref="toastRef" />
  
  <div class="container-fluid py-4" style="max-width: 1200px;">
    <!-- Header -->
    <div class="mb-4">
      <h2 class="h3 mb-1">Jobs</h2>
      <p class="text-muted small mb-0">Create and manage jobs</p>
    </div>

    <!-- Create Job Button -->
    <div class="mb-3 d-flex gap-2 align-items-center flex-wrap">
      <button
        v-if="!showJobModal"
        @click="showJobModal = true"
        class="btn btn-primary"
      >
        <i class="bi bi-plus-circle me-2"></i>Create Job
      </button>
    </div>

    <!-- Office Exports -->
    <div class="card mb-4">
      <div class="card-body d-flex flex-column flex-md-row align-items-start align-items-md-center gap-3">
        <div>
          <h5 class="mb-1">Office Export</h5>
          <div class="text-muted small">Choose a week (Saturday) to export all submitted timecards across all jobs.</div>
        </div>
        <div class="ms-md-auto d-flex flex-wrap gap-2 align-items-center">
          <div class="d-flex align-items-center gap-2 flex-wrap">
            <label class="small text-muted mb-0">Week ending (Saturday)</label>
            <flat-pickr
              v-model="exportWeekEnding"
              :config="exportDateConfig"
              class="form-control form-control-sm"
              placeholder="Select Saturday"
              aria-label="Week ending date"
            />
          </div>
          <button class="btn btn-outline-success btn-sm" @click="exportAllSubmittedAllJobs(exportWeekEnding)">
            <i class="bi bi-download me-1"></i>Export Submitted (all jobs)
          </button>
        </div>
      </div>
    </div>

    <!-- Create Job Modal -->
    <div v-if="showJobModal" class="modal d-block" style="background: rgba(0,0,0,0.5);">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Create New Job</h5>
            <button type="button" class="btn-close" @click="showJobModal = false"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label">Job Name</label>
              <input v-model="jobForm.name" type="text" class="form-control" placeholder="Project Name" required />
            </div>
            <div class="mb-3">
              <label class="form-label">Job Code</label>
              <input v-model="jobForm.code" type="text" class="form-control" placeholder="JOB-001" />
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="showJobModal = false">Cancel</button>
            <button type="button" class="btn btn-primary" @click="submitJobForm" :disabled="creatingJob || !jobForm.name">
              <span v-if="creatingJob" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
              Create Job
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Foreman Assignment Modal -->
    <div v-if="showForemanModal && selectedJobForForeman" class="modal d-block" style="background: rgba(0,0,0,0.5);">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Assign Foremen - {{ selectedJobForForeman.name }}</h5>
            <button type="button" class="btn-close" @click="showForemanModal = false"></button>
          </div>
          <div class="modal-body">
            <div v-if="loadingRoster" class="text-center py-4">
              <div class="spinner-border text-primary" role="status"></div>
            </div>
            <div v-else>
              <!-- Roster Employees Section -->
              <div v-if="rosterEmployees.length > 0" class="mb-5">
                <h6 class="mb-3">Roster Employees</h6>
                <p class="text-muted small mb-3">Designate employees as foremen for this job. Primary foreman can manage timecards and approve submissions.</p>
                <div class="table-responsive">
                  <table class="table table-sm table-striped table-hover mb-0">
                    <thead>
                      <tr>
                        <th style="width: 40%;" class="small fw-semibold">Name</th>
                        <th style="width: 40%;" class="small fw-semibold">Occupation</th>
                        <th style="width: 20%;" class="small fw-semibold text-center">Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="emp in rosterEmployees" :key="emp.id">
                        <td style="padding: 8px;" class="fw-semibold">{{ emp.firstName }} {{ emp.lastName }}</td>
                        <td style="padding: 8px;" class="text-muted small">{{ emp.occupation }}</td>
                        <td style="padding: 8px; text-center;">
                          <select 
                            :value="emp.isPrimaryForeman ? 'primary' : 'employee'"
                            @change="(e) => setForeman(emp.id, (e.target as HTMLSelectElement).value === 'primary')"
                            class="form-select form-select-sm"
                          >
                            <option value="employee">Employee</option>
                            <option value="primary">Primary Foreman</option>
                          </select>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div v-else class="alert alert-info mb-5">
                No employees in roster yet.
              </div>

              <!-- Foreman User Assignment Section -->
              <div class="border-top pt-4">
                <h6 class="mb-3">Assigned Foremen</h6>
                <p class="text-muted small mb-3">Foremen users assigned to manage this job.</p>
                
                <!-- List of assigned foremen -->
                <div v-if="assignedForemen.length > 0" class="mb-4">
                  <div class="list-group">
                    <div v-for="foreman in assignedForemen" :key="foreman.id" class="list-group-item d-flex justify-content-between align-items-center">
                      <div>
                        <strong>{{ foreman.firstName }} {{ foreman.lastName }}</strong>
                        <div class="text-muted small">{{ foreman.email }}</div>
                      </div>
                      <button
                        @click="removeForemanFromJob(foreman.id)"
                        class="btn btn-sm btn-outline-danger"
                        :disabled="removingForemanId === foreman.id"
                        title="Remove from job"
                      >
                        <span v-if="removingForemanId === foreman.id" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                        <i v-else class="bi bi-trash"></i>
                      </button>
                    </div>
                  </div>
                </div>
                <div v-else class="alert alert-info mb-4">
                  No foremen assigned to this job yet.
                </div>

                <!-- Add new foreman -->
                <div class="border-top pt-3">
                  <label class="form-label">Add Foreman</label>
                  <div class="d-flex gap-2">
                    <select v-model="selectedForemanUserId" class="form-select" :disabled="loadingForemanUsers">
                      <option value="">-- Choose a foreman --</option>
                      <option 
                        v-for="foreman in foremanUsers" 
                        :key="foreman.id" 
                        :value="foreman.id"
                        :disabled="assignedForemen.some(f => f.id === foreman.id)"
                      >
                        {{ foreman.firstName }} {{ foreman.lastName }} ({{ foreman.email }})
                      </option>
                    </select>
                    <button 
                      type="button" 
                      class="btn btn-primary" 
                      @click="assignForemanUserToJob"
                      :disabled="assigningForemanUser || !selectedForemanUserId"
                    >
                      <span v-if="assigningForemanUser" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Add
                    </button>
                  </div>
                  <div v-if="foremanUsers.length === 0" class="alert alert-info mt-3 mb-0">
                    No foreman users found. Create a foreman in the Users tab first.
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="showForemanModal = false">Close</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Jobs List -->
    <AdminCardWrapper
      title="Jobs"
      icon="briefcase"
      :loading="loadingJobs"
      :error="err"
    >
      <template #default>
        <div v-if="loadingJobs" class="text-center py-5">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading…</span>
          </div>
        </div>

        <div v-else-if="orderedJobs.length === 0" class="alert alert-info text-center mb-0">
          No jobs found. Create your first job above.
        </div>

        <div v-else class="table-responsive">
          <table class="table table-sm table-striped table-hover mb-0">
            <thead>
              <tr>
                <th style="width: 25%;" class="small fw-semibold">Job Name</th>
                <th style="width: 15%;" class="small fw-semibold">Code</th>
                <th style="width: 15%;" class="small fw-semibold">Status</th>
                <th style="width: 15%;" class="small fw-semibold">Timecards This Week</th>
                <th style="width: 30%;" class="small fw-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="job in orderedJobs" :key="job.id">
                <td style="padding: 8px;" class="fw-semibold">{{ job.name }}</td>
                <td style="padding: 8px;" class="text-muted small">{{ job.code || '—' }}</td>
                <td style="padding: 8px;">
                  <StatusBadge :status="job.active ? 'active' : 'archived'" />
                </td>
                <td style="padding: 8px;">
                  <span
                    :class="['badge', job.timecardStatus === 'submitted' && job.timecardPeriodEndDate === currentWeekEnd ? 'text-bg-success' : 'text-bg-danger']"
                    :title="`Timecards for week ${currentWeekLabel}: ${job.timecardStatus === 'submitted' && job.timecardPeriodEndDate === currentWeekEnd ? 'Submitted' : 'Not submitted'}`"
                  >
                    {{ job.timecardStatus === 'submitted' && job.timecardPeriodEndDate === currentWeekEnd ? 'Submitted this week' : 'Not submitted this week' }}
                  </span>
                </td>
                <td style="padding: 8px;" class="text-center">
                  <button
                    @click="openForemanModal(job)"
                    class="btn btn-sm btn-outline-info me-1"
                    title="Assign foremen to this job"
                  >
                    <i class="bi bi-person-badge me-1"></i>Foremen
                  </button>
                  <button
                    @click="handleEditJob(job)"
                    class="btn btn-sm btn-outline-primary me-1"
                    title="Edit job"
                  >
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button
                    v-if="job.active"
                    @click="toggleArchive(job, false)"
                    class="btn btn-sm btn-outline-secondary me-1"
                    :disabled="togglingJobId === job.id"
                    title="Archive job"
                  >
                    <i class="bi bi-archive"></i>
                  </button>
                  <button
                    v-else
                    @click="toggleArchive(job, true)"
                    class="btn btn-sm btn-outline-success me-1"
                    :disabled="togglingJobId === job.id"
                    title="Restore job"
                  >
                    <i class="bi bi-arrow-counterclockwise"></i>
                  </button>
                  <button
                    @click="handleDeleteJob(job)"
                    class="btn btn-sm btn-outline-danger"
                    title="Delete job permanently"
                  >
                    <i class="bi bi-trash"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </AdminCardWrapper>

  </div>
</template>
