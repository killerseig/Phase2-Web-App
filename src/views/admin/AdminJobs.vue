<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import flatPickr from 'vue-flatpickr-component'
import 'flatpickr/dist/flatpickr.css'
import Toast from '../../components/Toast.vue'
import AdminCardWrapper from '../../components/admin/AdminCardWrapper.vue'
import StatusBadge from '../../components/admin/StatusBadge.vue'
import BaseAccordionCard from '../../components/common/BaseAccordionCard.vue'
import BaseTable from '../../components/common/BaseTable.vue'
import { useJobsStore } from '../../stores/jobs'
import { useUsersStore } from '../../stores/users'
import type { Job } from '@/services'
import { formatWeekRange, getSaturdayFromSunday, snapToSunday } from '@/utils/modelValidation'
import { listSubmittedTimecards, listTimecardsByJobAndWeek } from '@/services/Timecards'
import { downloadCsv } from '@/utils/plexisIntegration'

type Align = 'start' | 'center' | 'end'
type Column = { key: string; label: string; sortable?: boolean; width?: string; align?: Align; slot?: string }

type SortDir = 'asc' | 'desc'
type JobSortKey = 'code' | 'name' | 'projectManager' | 'foreman' | 'gc' | 'jobAddress' | 'startDate' | 'finishDate' | 'status' | 'taxExempt' | 'certified' | 'cip' | 'kjic'

const toastRef = ref<InstanceType<typeof Toast> | null>(null)
const jobsStore = useJobsStore()
const usersStore = useUsersStore()

// Jobs state from store
const jobs = computed(() => jobsStore.allJobs)
const loadingJobs = computed(() => jobsStore.isLoading)
const err = computed(() => jobsStore.error || '')

const jobColumns: Column[] = [
  { key: 'code', label: 'Job #', sortable: true, width: '8%', slot: 'code' },
  { key: 'name', label: 'Job Name', sortable: true, width: '14%' },
  { key: 'projectManager', label: 'Project Manager', sortable: true, width: '10%', slot: 'projectManager' },
  { key: 'foreman', label: 'Foreman', sortable: true, width: '10%', slot: 'foreman' },
  { key: 'gc', label: 'GC', sortable: true, width: '8%', slot: 'gc' },
  { key: 'jobAddress', label: 'Job Address', sortable: true, width: '16%', slot: 'jobAddress' },
  { key: 'startDate', label: 'Start', sortable: true, width: '8%', slot: 'startDate' },
  { key: 'finishDate', label: 'Finish', sortable: true, width: '8%', slot: 'finishDate' },
  { key: 'status', label: 'Status', sortable: true, width: '8%', slot: 'status' },
  { key: 'taxExempt', label: 'Tax Exempt', sortable: true, width: '8%', slot: 'taxExempt' },
  { key: 'certified', label: 'Certified', sortable: true, width: '8%', slot: 'certified' },
  { key: 'cip', label: '?CIP', sortable: true, width: '8%', slot: 'cip' },
  { key: 'kjic', label: 'KJIC', sortable: true, width: '8%', slot: 'kjic' },
  { key: 'timecards', label: 'Timecards This Week', width: '12%', slot: 'timecards' },
  { key: 'actions', label: 'Actions', width: '16%', align: 'end', slot: 'actions' },
]

const jobSortKey = ref<JobSortKey>('name')
const jobSortDir = ref<SortDir>('asc')

const orderedJobs = computed(() =>
  [...jobsStore.allJobs].sort((a, b) => {
    if (a.active !== b.active) return Number(b.active) - Number(a.active)
    return (a.name || '').localeCompare(b.name || '')
  })
)

const sortedJobs = computed(() => {
  const key = jobSortKey.value
  const dir = jobSortDir.value === 'asc' ? 1 : -1
  const normalize = (val: unknown) => {
    if (val === undefined || val === null) return ''
    if (typeof val === 'string') return val.toLowerCase()
    return String(val).toLowerCase()
  }

  return [...orderedJobs.value].sort((a, b) => {
    if (key === 'status') {
      if (a.active === b.active) return 0
      return a.active ? -dir : dir
    }
    const aVal = normalize((a as any)[key])
    const bVal = normalize((b as any)[key])
    if (aVal === bVal) return 0
    return aVal > bVal ? dir : -dir
  })
})

// Job form
const showJobForm = ref(false)
const jobForm = ref({
  name: '',
  code: '',
  projectManager: '',
  foreman: '',
  gc: '',
  jobAddress: '',
  startDate: '',
  finishDate: '',
  taxExempt: '',
  certified: '',
  cip: '',
  kjic: '',
  accountNumber: '',
  type: 'general' as 'general' | 'subcontractor',
})
const creatingJob = ref(false)
const togglingJobId = ref('')
const editingJobId = ref('')
const editingJobName = ref('')
const editingJobCode = ref('')
const editingJobProjectManager = ref('')
const editingJobForeman = ref('')
const editingJobGc = ref('')
const editingJobAddress = ref('')
const editingJobStartDate = ref('')
const editingJobFinishDate = ref('')
const editingJobTaxExempt = ref('')
const editingJobCertified = ref('')
const editingJobCip = ref('')
const editingJobKjic = ref('')
const editingJobAccountNumber = ref('')
const editingJobType = ref<'general' | 'subcontractor'>('general')
const editingJobSaving = ref(false)

// Computed foreman users
const foremanUsers = computed(() => usersStore.allUsers.filter(u => u.role === 'foreman' && u.active))

const foremanDisplayName = (user: any) => `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || ''

const currentWeekStart = computed(() => snapToSunday(new Date()))
const currentWeekEnd = computed(() => getSaturdayFromSunday(currentWeekStart.value))
const currentWeekLabel = computed(() => formatWeekRange(currentWeekStart.value, currentWeekEnd.value))
const exportWeekEnding = ref<string>(currentWeekEnd.value)
const activeJobActionsId = ref('')

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

function formatErr(e: any) {
  const msg = e?.message ? String(e.message) : String(e)
  return msg
}

async function loadJobs() {
  await jobsStore.fetchAllJobs(true)
}

function setInlineJob(job: Job) {
  editingJobId.value = job.id
  editingJobName.value = job.name || ''
  editingJobCode.value = job.code || ''
  editingJobProjectManager.value = job.projectManager || ''
  editingJobForeman.value = job.foreman || ''
  editingJobGc.value = job.gc || ''
  editingJobAddress.value = job.jobAddress || ''
  editingJobStartDate.value = job.startDate || ''
  editingJobFinishDate.value = job.finishDate || ''
  editingJobTaxExempt.value = job.taxExempt || ''
  editingJobCertified.value = job.certified || ''
  editingJobCip.value = job.cip || ''
  editingJobKjic.value = job.kjic || ''
  editingJobAccountNumber.value = job.accountNumber || ''
  editingJobType.value = (job.type || 'general') as 'general' | 'subcontractor'
}

function clearInlineJob() {
  editingJobId.value = ''
  editingJobName.value = ''
  editingJobCode.value = ''
  editingJobProjectManager.value = ''
  editingJobForeman.value = ''
  editingJobGc.value = ''
  editingJobAddress.value = ''
  editingJobStartDate.value = ''
  editingJobFinishDate.value = ''
  editingJobTaxExempt.value = ''
  editingJobCertified.value = ''
  editingJobCip.value = ''
  editingJobKjic.value = ''
  editingJobAccountNumber.value = ''
  editingJobType.value = 'general'
}

function isJobDirty(job: Job) {
  return (
    editingJobName.value.trim() !== (job.name || '') ||
    editingJobCode.value.trim() !== (job.code || '') ||
    editingJobProjectManager.value.trim() !== (job.projectManager || '') ||
    editingJobForeman.value.trim() !== (job.foreman || '') ||
    editingJobGc.value.trim() !== (job.gc || '') ||
    editingJobAddress.value.trim() !== (job.jobAddress || '') ||
    editingJobStartDate.value.trim() !== (job.startDate || '') ||
    editingJobFinishDate.value.trim() !== (job.finishDate || '') ||
    editingJobTaxExempt.value.trim() !== (job.taxExempt || '') ||
    editingJobCertified.value.trim() !== (job.certified || '') ||
    editingJobCip.value.trim() !== (job.cip || '') ||
    editingJobKjic.value.trim() !== (job.kjic || '') ||
    editingJobAccountNumber.value.trim() !== (job.accountNumber || '') ||
    editingJobType.value !== (job.type || 'general')
  )
}

async function saveInlineJob(job: Job) {
  if (editingJobId.value !== job.id) return
  const trimmedName = editingJobName.value.trim()
  const trimmedCode = editingJobCode.value.trim()
  const trimmedAccountNumber = editingJobAccountNumber.value.trim()
  if (!isJobDirty(job)) return
  editingJobSaving.value = true
  try {
    await jobsStore.updateJob(job.id, {
      name: trimmedName,
      code: trimmedCode || null,
      projectManager: editingJobProjectManager.value.trim() || null,
      foreman: editingJobForeman.value.trim() || null,
      gc: editingJobGc.value.trim() || null,
      jobAddress: editingJobAddress.value.trim() || null,
      startDate: editingJobStartDate.value.trim() || null,
      finishDate: editingJobFinishDate.value.trim() || null,
      taxExempt: editingJobTaxExempt.value.trim() || null,
      certified: editingJobCertified.value.trim() || null,
      cip: editingJobCip.value.trim() || null,
      kjic: editingJobKjic.value.trim() || null,
      accountNumber: trimmedAccountNumber || null,
      type: editingJobType.value,
    })
    toastRef.value?.show('Job updated', 'success')
  } catch (e: any) {
    toastRef.value?.show(e?.message ?? 'Failed to update job', 'error')
  } finally {
    editingJobSaving.value = false
  }
}

async function toggleJobActions(job: Job) {
  const isOpen = activeJobActionsId.value === job.id
  if (isOpen) {
    await saveInlineJob(job)
    clearInlineJob()
    activeJobActionsId.value = ''
    return
  }

  clearInlineJob()
  setInlineJob(job)
  activeJobActionsId.value = job.id
}

async function submitJobForm() {
  creatingJob.value = true
  try {
    await jobsStore.createJob(jobForm.value.name, {
      code: jobForm.value.code,
      projectManager: jobForm.value.projectManager,
      foreman: jobForm.value.foreman,
      gc: jobForm.value.gc,
      jobAddress: jobForm.value.jobAddress,
      startDate: jobForm.value.startDate,
      finishDate: jobForm.value.finishDate,
      taxExempt: jobForm.value.taxExempt,
      certified: jobForm.value.certified,
      cip: jobForm.value.cip,
      kjic: jobForm.value.kjic,
      accountNumber: jobForm.value.accountNumber,
      type: jobForm.value.type,
    })
    toastRef.value?.show('Job created successfully', 'success')
    showJobForm.value = false
    jobForm.value = {
      name: '',
      code: '',
      projectManager: '',
      foreman: '',
      gc: '',
      jobAddress: '',
      startDate: '',
      finishDate: '',
      taxExempt: '',
      certified: '',
      cip: '',
      kjic: '',
      accountNumber: '',
      type: 'general',
    }
    await loadJobs()
  } catch (e: any) {
    toastRef.value?.show(formatErr(e), 'error')
  } finally {
    creatingJob.value = false
  }
}

function cancelJobForm() {
  jobForm.value = {
    name: '',
    code: '',
    projectManager: '',
    foreman: '',
    gc: '',
    jobAddress: '',
    startDate: '',
    finishDate: '',
    taxExempt: '',
    certified: '',
    cip: '',
    kjic: '',
    accountNumber: '',
    type: 'general',
  }
  showJobForm.value = false
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

function handleJobSort({ sortKey, sortDir }: { sortKey: string; sortDir: SortDir }) {
  jobSortKey.value = sortKey as JobSortKey
  jobSortDir.value = sortDir
}

onMounted(async () => {
  loadJobs()
  await usersStore.fetchAllUsers()
})

</script>

<template>
  <Toast ref="toastRef" />
  
  <div class="container-fluid py-4 wide-container-1200">
    <!-- Header -->
    <div class="mb-4">
      <h2 class="h3 mb-1">Jobs</h2>
      <p class="text-muted small mb-0">Create and manage jobs</p>
    </div>

    <BaseAccordionCard
      v-model:open="showJobForm"
      title="Create Job"
      subtitle="Add a new job with code for tracking"
    >
      <form class="row g-3" @submit.prevent="submitJobForm">
        <div class="col-md-2">
          <label class="form-label small">Job #</label>
          <input v-model="jobForm.code" type="text" class="form-control" placeholder="4197" />
        </div>
        <div class="col-md-4">
          <label class="form-label small">Job Name</label>
          <input v-model="jobForm.name" type="text" class="form-control" placeholder="Project Name" required />
        </div>
        <div class="col-md-4">
          <label class="form-label small">Project Manager</label>
          <input v-model="jobForm.projectManager" type="text" class="form-control" placeholder="Brian" />
        </div>
        <div class="col-md-4">
          <label class="form-label small">Foreman</label>
          <select v-model="jobForm.foreman" class="form-select">
            <option value="">-- Select Foreman --</option>
            <option v-for="foreman in foremanUsers" :key="foreman.id" :value="foremanDisplayName(foreman)">
              {{ foremanDisplayName(foreman) }}
            </option>
          </select>
        </div>
        <div class="col-md-3">
          <label class="form-label small">GC</label>
          <input v-model="jobForm.gc" type="text" class="form-control" placeholder="Turner" />
        </div>
        <div class="col-md-9">
          <label class="form-label small">Job Address</label>
          <input v-model="jobForm.jobAddress" type="text" class="form-control" placeholder="12605 E 16th ave aurora" />
        </div>
        <div class="col-md-2">
          <label class="form-label small">Start</label>
          <input v-model="jobForm.startDate" type="date" class="form-control" />
        </div>
        <div class="col-md-2">
          <label class="form-label small">Finish</label>
          <input v-model="jobForm.finishDate" type="date" class="form-control" />
        </div>
        <div class="col-md-2">
          <label class="form-label small">Tax Exempt</label>
          <input v-model="jobForm.taxExempt" type="text" class="form-control" placeholder="no / TE" />
        </div>
        <div class="col-md-2">
          <label class="form-label small">Certified</label>
          <input v-model="jobForm.certified" type="text" class="form-control" placeholder="no" />
        </div>
        <div class="col-md-2">
          <label class="form-label small">CIP</label>
          <input v-model="jobForm.cip" type="text" class="form-control" placeholder="2445" />
        </div>
        <div class="col-md-2">
          <label class="form-label small">KJIC</label>
          <input v-model="jobForm.kjic" type="text" class="form-control" placeholder="Yes/No" />
        </div>
        <div class="col-12 d-flex gap-2 justify-content-end pt-2">
          <button type="button" class="btn btn-outline-secondary" @click.stop="cancelJobForm" :disabled="creatingJob">
            Cancel
          </button>
          <button type="submit" class="btn btn-primary" :disabled="creatingJob || !jobForm.name">
            <span v-if="creatingJob" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            Create Job
          </button>
        </div>
      </form>
    </BaseAccordionCard>

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

        <div v-else-if="sortedJobs.length === 0" class="alert alert-info text-center mb-0">
          No jobs found. Create your first job above.
        </div>

        <div v-else>
          <BaseTable
            :rows="sortedJobs"
            :columns="jobColumns"
            row-key="id"
            :sort-key="jobSortKey"
            :sort-dir="jobSortDir"
            table-class="jobs-sheet-table"
            @sort-change="handleJobSort"
          >
            <template #cell-name="{ row }">
              <template v-if="editingJobId === row.id">
                <input
                  v-model="editingJobName"
                  type="text"
                  class="form-control form-control-sm"
                  @click.stop
                  @mousedown.stop
                  :disabled="editingJobSaving"
                />
              </template>
              <template v-else>
                <span class="cell-ellipsis" :title="row.name">{{ row.name }}</span>
              </template>
            </template>

            <template #code="{ row }">
              <template v-if="editingJobId === row.id">
                <input
                  v-model="editingJobCode"
                  type="text"
                  class="form-control form-control-sm"
                  placeholder="Job #"
                  @click.stop
                  @mousedown.stop
                  :disabled="editingJobSaving"
                />
              </template>
              <template v-else>
                {{ row.code || '—' }}
              </template>
            </template>

            <template #projectManager="{ row }">
              <template v-if="editingJobId === row.id">
                <input
                  v-model="editingJobProjectManager"
                  type="text"
                  class="form-control form-control-sm"
                  placeholder="Project Manager"
                  @click.stop
                  @mousedown.stop
                  :disabled="editingJobSaving"
                />
              </template>
              <template v-else>
                <span class="cell-ellipsis" :title="row.projectManager || '—'">{{ row.projectManager || '—' }}</span>
              </template>
            </template>

            <template #foreman="{ row }">
              <template v-if="editingJobId === row.id">
                <select
                  v-model="editingJobForeman"
                  class="form-control form-control-sm"
                  @click.stop
                  @mousedown.stop
                  :disabled="editingJobSaving"
                >
                  <option value="">-- Select Foreman --</option>
                  <option v-for="foreman in foremanUsers" :key="foreman.id" :value="foremanDisplayName(foreman)">
                    {{ foremanDisplayName(foreman) }}
                  </option>
                </select>
              </template>
              <template v-else>
                <span class="cell-ellipsis" :title="row.foreman || '—'">{{ row.foreman || '—' }}</span>
              </template>
            </template>

            <template #gc="{ row }">
              <template v-if="editingJobId === row.id">
                <input
                  v-model="editingJobGc"
                  type="text"
                  class="form-control form-control-sm"
                  placeholder="GC"
                  @click.stop
                  @mousedown.stop
                  :disabled="editingJobSaving"
                />
              </template>
              <template v-else>
                <span class="cell-ellipsis" :title="row.gc || '—'">{{ row.gc || '—' }}</span>
              </template>
            </template>

            <template #jobAddress="{ row }">
              <template v-if="editingJobId === row.id">
                <input
                  v-model="editingJobAddress"
                  type="text"
                  class="form-control form-control-sm"
                  placeholder="Job Address"
                  @click.stop
                  @mousedown.stop
                  :disabled="editingJobSaving"
                />
              </template>
              <template v-else>
                <span class="cell-ellipsis" :title="row.jobAddress || '—'">{{ row.jobAddress || '—' }}</span>
              </template>
            </template>

            <template #startDate="{ row }">
              <template v-if="editingJobId === row.id">
                <input
                  v-model="editingJobStartDate"
                  type="date"
                  class="form-control form-control-sm"
                  @click.stop
                  @mousedown.stop
                  :disabled="editingJobSaving"
                />
              </template>
              <template v-else>
                <span class="cell-nowrap">{{ row.startDate || '—' }}</span>
              </template>
            </template>

            <template #finishDate="{ row }">
              <template v-if="editingJobId === row.id">
                <input
                  v-model="editingJobFinishDate"
                  type="date"
                  class="form-control form-control-sm"
                  @click.stop
                  @mousedown.stop
                  :disabled="editingJobSaving"
                />
              </template>
              <template v-else>
                <span class="cell-nowrap">{{ row.finishDate || '—' }}</span>
              </template>
            </template>

            <template #status="{ row }">
              <StatusBadge :status="row.active ? 'active' : 'archived'" />
            </template>

            <template #taxExempt="{ row }">
              <template v-if="editingJobId === row.id">
                <input
                  v-model="editingJobTaxExempt"
                  type="text"
                  class="form-control form-control-sm"
                  placeholder="Tax Exempt"
                  @click.stop
                  @mousedown.stop
                  :disabled="editingJobSaving"
                />
              </template>
              <template v-else>
                {{ row.taxExempt || '—' }}
              </template>
            </template>

            <template #certified="{ row }">
              <template v-if="editingJobId === row.id">
                <input
                  v-model="editingJobCertified"
                  type="text"
                  class="form-control form-control-sm"
                  placeholder="Certified"
                  @click.stop
                  @mousedown.stop
                  :disabled="editingJobSaving"
                />
              </template>
              <template v-else>
                {{ row.certified || '—' }}
              </template>
            </template>

            <template #cip="{ row }">
              <template v-if="editingJobId === row.id">
                <input
                  v-model="editingJobCip"
                  type="text"
                  class="form-control form-control-sm"
                  placeholder="CIP"
                  @click.stop
                  @mousedown.stop
                  :disabled="editingJobSaving"
                />
              </template>
              <template v-else>
                {{ row.cip || '—' }}
              </template>
            </template>

            <template #kjic="{ row }">
              <template v-if="editingJobId === row.id">
                <input
                  v-model="editingJobKjic"
                  type="text"
                  class="form-control form-control-sm"
                  placeholder="KJIC"
                  @click.stop
                  @mousedown.stop
                  :disabled="editingJobSaving"
                />
              </template>
              <template v-else>
                {{ row.kjic || '—' }}
              </template>
            </template>

            <template #timecards="{ row }">
              <span
                :class="['badge', row.timecardStatus === 'submitted' && row.timecardPeriodEndDate === currentWeekEnd ? 'text-bg-success' : 'text-bg-danger']"
                :title="`Timecards for week ${currentWeekLabel}: ${row.timecardStatus === 'submitted' && row.timecardPeriodEndDate === currentWeekEnd ? 'Submitted' : 'Not submitted'}`"
              >
                {{ row.timecardStatus === 'submitted' && row.timecardPeriodEndDate === currentWeekEnd ? 'Submitted this week' : 'Not submitted this week' }}
              </span>
            </template>

            <template #actions="{ row }">
              <div class="d-flex align-items-center justify-content-end gap-1 flex-nowrap">
                <div v-if="activeJobActionsId === row.id" class="btn-group btn-group-sm flex-nowrap" role="group">
                  <button
                    class="btn btn-outline-danger"
                    @click.stop="handleDeleteJob(row)"
                    title="Delete job permanently"
                  >
                    <i class="bi bi-trash text-danger"></i>
                  </button>
                  <button
                    v-if="row.active"
                    @click.stop="toggleArchive(row, false)"
                    class="btn btn-outline-warning"
                    :disabled="togglingJobId === row.id"
                    title="Archive job"
                  >
                    <i class="bi bi-archive text-warning"></i>
                  </button>
                  <button
                    v-else
                    @click.stop="toggleArchive(row, true)"
                    class="btn btn-outline-success"
                    :disabled="togglingJobId === row.id"
                    title="Restore job"
                  >
                    <i class="bi bi-arrow-counterclockwise text-success"></i>
                  </button>
                </div>

                <button
                  class="btn btn-sm btn-outline-secondary"
                  @click.stop="toggleJobActions(row)"
                  :aria-pressed="activeJobActionsId === row.id"
                  title="Toggle edit mode"
                >
                  <i class="bi bi-pencil"></i>
                </button>
              </div>
            </template>
          </BaseTable>
        </div>
      </template>
    </AdminCardWrapper>

  </div>
</template>

<style scoped lang="scss">
.wide-container-1200 {
  max-width: 1200px;
}

:deep(.jobs-sheet-table thead th) {
  white-space: nowrap;
  font-size: 0.75rem;
}

:deep(.jobs-sheet-table .table-sort-trigger) {
  white-space: nowrap;
}

:deep(.jobs-sheet-table td) {
  vertical-align: middle;
}

.cell-ellipsis {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell-nowrap {
  white-space: nowrap;
}
</style>
