<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import AppAlert from '@/components/common/AppAlert.vue'
import AdminAccordionFormCard from '@/components/admin/AdminAccordionFormCard.vue'
import ActionToggleGroup from '@/components/common/ActionToggleGroup.vue'
import DatePickerField from '@/components/common/DatePickerField.vue'
import AppToolbarCard from '@/components/common/AppToolbarCard.vue'
import AppPageHeader from '@/components/layout/AppPageHeader.vue'
import AdminCardWrapper from '@/components/admin/AdminCardWrapper.vue'
import InlineField from '@/components/common/InlineField.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import TimecardWeekStatusBadge from '@/components/common/TimecardWeekStatusBadge.vue'
import BaseTable from '@/components/common/BaseTable.vue'
import { useJobsStore } from '@/stores/jobs'
import { useUsersStore } from '@/stores/users'
import type { Job, UserProfile } from '@/services'
import {
  createDatePickerConfig,
  getTodayDateInputValue,
  isValidDateInputValue,
  toDateInputValue,
} from '@/utils/dateInputs'
import { formatWeekRange, getSaturdayFromSunday, snapToSunday } from '@/utils/modelValidation'
import { listTimecardsByJobAndWeek } from '@/services/Timecards'
import { downloadCsv } from '@/utils/plexisIntegration'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useToast } from '@/composables/useToast'
import { ROLES } from '@/constants/app'

type Align = 'start' | 'center' | 'end'
type Column = { key: string; label: string; sortable?: boolean; width?: string; align?: Align; slot?: string }

type SortDir = 'asc' | 'desc'
type JobSortKey = 'code' | 'name' | 'projectManager' | 'foreman' | 'gc' | 'jobAddress' | 'startDate' | 'finishDate' | 'status' | 'taxExempt' | 'certified' | 'cip' | 'kjic'
type JobFormInput = {
  name: string
  code: string
  projectManager: string
  foreman: string
  gc: string
  jobAddress: string
  startDate: string
  finishDate: string
  taxExempt: string
  certified: string
  cip: string
  kjic: string
  accountNumber: string
  type: 'general' | 'subcontractor'
}

const createJobForm = (): JobFormInput => ({
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
})

const jobsStore = useJobsStore()
const usersStore = useUsersStore()
const { confirm } = useConfirmDialog()
const toast = useToast()
const { jobs, loading: loadingJobs, error: jobsError } = storeToRefs(jobsStore)
const { users: allUsers } = storeToRefs(usersStore)

// Jobs state from store
const err = computed(() => jobsError.value || '')

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
type NonStatusSortKey = Exclude<JobSortKey, 'status'>

const orderedJobs = computed(() =>
  [...jobs.value].sort((a, b) => {
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
    const sortKey = key as NonStatusSortKey
    const aVal = normalize(a[sortKey])
    const bVal = normalize(b[sortKey])
    if (aVal === bVal) return 0
    return aVal > bVal ? dir : -dir
  })
})

// Job form
const showJobForm = ref(false)
const jobForm = ref(createJobForm())
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
const foremanUsers = computed(() => allUsers.value.filter(u => u.role === ROLES.FOREMAN && u.active))
const foremanOptions = computed(() => foremanUsers.value.map((foreman) => {
  const label = foremanDisplayName(foreman)
  return {
    value: label,
    label,
  }
}))

const foremanDisplayName = (user: UserProfile) => `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || ''

const currentWeekStart = computed(() => snapToSunday(getTodayDateInputValue()))
const currentWeekEnd = computed(() => getSaturdayFromSunday(currentWeekStart.value))
const currentWeekLabel = computed(() => formatWeekRange(currentWeekStart.value, currentWeekEnd.value))
const exportDateInWeek = ref<string>(currentWeekEnd.value)
const exportWeekStart = computed(() => {
  if (!isValidDateInputValue(exportDateInWeek.value)) return ''
  return snapToSunday(exportDateInWeek.value)
})
const exportWeekEnding = computed(() => {
  if (!exportWeekStart.value) return ''
  return getSaturdayFromSunday(exportWeekStart.value)
})
const exportWeekLabel = computed(() => {
  if (!exportWeekStart.value || !exportWeekEnding.value) return 'Invalid date'
  return formatWeekRange(exportWeekStart.value, exportWeekEnding.value)
})
const activeJobActionsId = ref('')

const exportDateConfig = computed(() => createDatePickerConfig({
  maxDate: currentWeekEnd.value,
}))

function toCsv(headers: string[], rows: (string | number)[][]): string {
  const escape = (value: string | number) => {
    const text = String(value ?? '')
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return [headers.map(escape).join(','), ...rows.map((row) => row.map(escape).join(','))].join('\n')
}

async function exportAllSubmittedAllJobs() {
  try {
    const weekEnding = toDateInputValue(exportWeekEnding.value)
    if (!weekEnding) {
      toast.show('Please select a valid date.', 'error')
      return
    }
    const rows: (string | number)[][] = []

    for (const job of jobs.value) {
      const timecards = (await listTimecardsByJobAndWeek(job.id, weekEnding)).filter((card) => card.status === 'submitted')

      for (const card of timecards) {
        rows.push([
          job.name,
          job.code || '',
          card.weekEndingDate,
          card.employeeNumber,
          card.employeeName,
          card.occupation,
          card.days[0]?.hours ?? '',
          card.days[1]?.hours ?? '',
          card.days[2]?.hours ?? '',
          card.days[3]?.hours ?? '',
          card.days[4]?.hours ?? '',
          card.days[5]?.hours ?? '',
          card.days[6]?.hours ?? '',
          card.totals.hoursTotal ?? '',
          card.totals.productionTotal ?? '',
        ])
      }
    }

    if (rows.length === 0) {
      toast.show('No submitted timecards to export', 'info')
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

    const filename = `timecards-submitted-all-jobs-${weekEnding}.csv`

    downloadCsv(toCsv(headers, rows), filename)
    toast.show(`Exported ${rows.length} submitted timecard row(s)`, 'success')
  } catch (e) {
    toast.show(formatErr(e), 'error')
  }
}

function formatErr(e: unknown) {
  const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message?: unknown }).message ?? e) : String(e)
  return msg
}

function asText(value: unknown, fallback = '--'): string {
  if (value === null || value === undefined) return fallback
  const text = String(value).trim()
  return text ? text : fallback
}

function loadJobs() {
  jobsStore.subscribeAllJobs(true)
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
    toast.show('Job updated', 'success')
  } catch (e) {
    toast.show(formatErr(e), 'error')
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
    toast.show('Job created successfully', 'success')
    showJobForm.value = false
    jobForm.value = createJobForm()
    loadJobs()
  } catch (e) {
    toast.show(formatErr(e), 'error')
  } finally {
    creatingJob.value = false
  }
}

function cancelJobForm() {
  jobForm.value = createJobForm()
  showJobForm.value = false
}

async function handleDeleteJob(job: Job) {
  const confirmed = await confirm(
    `Delete "${job.name}"? This action cannot be undone and will remove all associated data (daily logs, timecards, orders, etc.).`,
    {
      title: 'Delete Job',
      confirmText: 'Delete',
      variant: 'danger',
    }
  )
  if (!confirmed) return

  try {
    await jobsStore.deleteJob(job.id)
    toast.show('Job deleted', 'success')
    loadJobs()
  } catch (e) {
    toast.show('Failed to delete job', 'error')
  }
}

async function toggleArchive(job: Job, active: boolean) {
  togglingJobId.value = job.id
  try {
    await jobsStore.setJobActive(job.id, active)
    toast.show(active ? 'Job restored' : 'Job archived', 'success')
    loadJobs()
  } catch (e) {
    toast.show(formatErr(e), 'error')
  } finally {
    togglingJobId.value = ''
  }
}

function handleJobSort({ sortKey, sortDir }: { sortKey: string; sortDir: SortDir }) {
  jobSortKey.value = sortKey as JobSortKey
  jobSortDir.value = sortDir
}

onMounted(() => {
  loadJobs()
  usersStore.subscribeAllUsers()
})

onUnmounted(() => {
  jobsStore.stopJobsSubscription()
  usersStore.stopUsersSubscription()
})

</script>

<template>
  
  
  <div class="app-page">
    <!-- Header -->
    <AppPageHeader eyebrow="Admin Panel" title="Jobs" subtitle="Create, edit, archive, and export job records." />

    <AdminAccordionFormCard
      v-model:open="showJobForm"
      title="Create Job"
      subtitle="Add a new job with code for tracking"
      :loading="creatingJob"
      :submit-disabled="!jobForm.name"
      submit-label="Create Job"
      @submit="submitJobForm"
      @cancel="cancelJobForm"
    >
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
    </AdminAccordionFormCard>

    <!-- Office Exports -->
    <AppToolbarCard
      class="mb-4"
      body-class="d-flex flex-column flex-md-row align-items-start align-items-md-center gap-3"
    >
      <div>
        <h5 class="mb-1">Office Export</h5>
        <div class="text-muted small">Select any date in the week to export submitted timecards across all jobs.</div>
      </div>
      <div class="ms-md-auto d-flex flex-wrap gap-2 align-items-center">
        <DatePickerField
          v-model="exportDateInWeek"
          :config="exportDateConfig"
          label="Select date in week"
          label-class="small text-muted mb-0"
          wrapper-class="d-flex align-items-center gap-2 flex-wrap"
          size="sm"
          placeholder="Select any date"
          input-aria-label="Week ending date"
        />
        <div class="small text-muted">Week range: {{ exportWeekLabel }} | Week ending Saturday: {{ exportWeekEnding }}</div>
        <button class="btn btn-outline-success btn-sm" @click="exportAllSubmittedAllJobs">
          <i class="bi bi-download me-1"></i>Export Submitted (all jobs)
        </button>
      </div>
    </AppToolbarCard>
    <!-- Jobs List -->
    <AdminCardWrapper
      title="Jobs"
      icon="briefcase"
      :loading="loadingJobs"
      :error="err"
    >
      <template #default>
        <AppAlert v-if="sortedJobs.length === 0" variant="info" class="text-center mb-0" message="No jobs found. Create your first job above." />

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
              <InlineField
                :editing="editingJobId === row.id"
                v-model="editingJobName"
                :disabled="editingJobSaving"
              >
                <span class="cell-ellipsis" :title="asText(row.name, '')">{{ asText(row.name) }}</span>
              </InlineField>
            </template>

            <template #code="{ row }">
              <InlineField
                :editing="editingJobId === row.id"
                v-model="editingJobCode"
                placeholder="Job #"
                :disabled="editingJobSaving"
              >
                {{ row.code || '--' }}
              </InlineField>
            </template>

            <template #projectManager="{ row }">
              <InlineField
                :editing="editingJobId === row.id"
                v-model="editingJobProjectManager"
                placeholder="Project Manager"
                :disabled="editingJobSaving"
              >
                <span class="cell-ellipsis" :title="asText(row.projectManager)">{{ asText(row.projectManager) }}</span>
              </InlineField>
            </template>

            <template #foreman="{ row }">
              <InlineField
                :editing="editingJobId === row.id"
                v-model="editingJobForeman"
                type="select"
                :options="[{ value: '', label: '-- Select Foreman --' }, ...foremanOptions]"
                :disabled="editingJobSaving"
              >
                <span class="cell-ellipsis" :title="asText(row.foreman)">{{ asText(row.foreman) }}</span>
              </InlineField>
            </template>

            <template #gc="{ row }">
              <InlineField
                :editing="editingJobId === row.id"
                v-model="editingJobGc"
                placeholder="GC"
                :disabled="editingJobSaving"
              >
                <span class="cell-ellipsis" :title="asText(row.gc)">{{ asText(row.gc) }}</span>
              </InlineField>
            </template>

            <template #jobAddress="{ row }">
              <InlineField
                :editing="editingJobId === row.id"
                v-model="editingJobAddress"
                placeholder="Job Address"
                :disabled="editingJobSaving"
              >
                <span class="cell-ellipsis" :title="asText(row.jobAddress)">{{ asText(row.jobAddress) }}</span>
              </InlineField>
            </template>

            <template #startDate="{ row }">
              <InlineField
                :editing="editingJobId === row.id"
                v-model="editingJobStartDate"
                type="date"
                :disabled="editingJobSaving"
              >
                <span class="cell-nowrap">{{ row.startDate || '--' }}</span>
              </InlineField>
            </template>

            <template #finishDate="{ row }">
              <InlineField
                :editing="editingJobId === row.id"
                v-model="editingJobFinishDate"
                type="date"
                :disabled="editingJobSaving"
              >
                <span class="cell-nowrap">{{ row.finishDate || '--' }}</span>
              </InlineField>
            </template>

            <template #status="{ row }">
              <StatusBadge :status="row.active ? 'active' : 'archived'" />
            </template>

            <template #taxExempt="{ row }">
              <InlineField
                :editing="editingJobId === row.id"
                v-model="editingJobTaxExempt"
                placeholder="Tax Exempt"
                :disabled="editingJobSaving"
              >
                {{ row.taxExempt || '--' }}
              </InlineField>
            </template>

            <template #certified="{ row }">
              <InlineField
                :editing="editingJobId === row.id"
                v-model="editingJobCertified"
                placeholder="Certified"
                :disabled="editingJobSaving"
              >
                {{ row.certified || '--' }}
              </InlineField>
            </template>

            <template #cip="{ row }">
              <InlineField
                :editing="editingJobId === row.id"
                v-model="editingJobCip"
                placeholder="CIP"
                :disabled="editingJobSaving"
              >
                {{ row.cip || '--' }}
              </InlineField>
            </template>

            <template #kjic="{ row }">
              <InlineField
                :editing="editingJobId === row.id"
                v-model="editingJobKjic"
                placeholder="KJIC"
                :disabled="editingJobSaving"
              >
                {{ row.kjic || '--' }}
              </InlineField>
            </template>

            <template #timecards="{ row }">
              <TimecardWeekStatusBadge
                :status="row.timecardStatus"
                :period-end-date="row.timecardPeriodEndDate"
                :current-week-end="currentWeekEnd"
                :current-week-label="currentWeekLabel"
              />
            </template>

            <template #actions="{ row }">
              <ActionToggleGroup
                :open="activeJobActionsId === row.id"
                wrapper-class="d-flex align-items-center justify-content-end gap-1 flex-nowrap"
                @toggle="toggleJobActions(row)"
              >
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
              </ActionToggleGroup>
            </template>
          </BaseTable>
        </div>
      </template>
    </AdminCardWrapper>

  </div>
</template>

<style scoped lang="scss">
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

