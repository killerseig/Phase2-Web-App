<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import flatPickr from 'vue-flatpickr-component'
import 'flatpickr/dist/flatpickr.css'
import Toast from '@/components/Toast.vue'
import TimecardEditorCard from '@/components/timecards/TimecardEditorCard.vue'
import { ROLES } from '@/constants/app'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useAuthStore } from '@/stores/auth'
import { useJobsStore } from '@/stores/jobs'
import {
  downloadTimecardsForWeek,
  listTimecardsForWeek,
  type ControllerSubcontractedFilter,
  type ControllerTimecardFilters,
  type ControllerTimecardStatusFilter,
  type ControllerTimecardWeekItem,
} from '@/services/Email'
import {
  deleteTimecard,
  listTimecardsByJobAndWeek,
  updateTimecard,
} from '@/services/Timecards'
import {
  formatWeekRange,
  getSaturdayFromSunday,
  snapToSunday,
} from '@/utils/modelValidation'
import { validateRequired } from '@/utils/validation'
import {
  buildTimecardEmployeeEditorForm,
  createEmptyTimecardEmployeeEditorForm,
  parseSubcontractedEmployee,
  parseWage,
  recalcTotalsForTimecard,
  type TimecardEmployeeEditorForm,
  type TimecardModel,
} from './timecards/timecardUtils'
import { useTimecardJobEditing } from './timecards/useTimecardJobEditing'

type SortDir = 'asc' | 'desc'
type ControllerSortKey =
  | 'weekEnding'
  | 'jobName'
  | 'jobCode'
  | 'employeeNumber'
  | 'employeeName'
  | 'occupation'
  | 'status'
  | 'totalHours'
  | 'totalProduction'
  | 'totalLine'
  | 'submittedAt'

type ControllerSortOption = {
  key: ControllerSortKey
  label: string
}

type ControllerGroupedTimecard = {
  key: string
  row: ControllerTimecardWeekItem
  timecard: TimecardModel
}

type ControllerCreatorGroup = {
  creatorKey: string
  creatorName: string
  totalCount: number
  draftCount: number
  submittedCount: number
  totalHours: number
  totalProduction: number
  totalLine: number
  timecards: ControllerGroupedTimecard[]
}

type ControllerJobGroup = {
  jobId: string
  jobName: string
  jobCode: string
  totalCount: number
  draftCount: number
  submittedCount: number
  totalHours: number
  totalProduction: number
  totalLine: number
  creatorGroups: ControllerCreatorGroup[]
}

const auth = useAuthStore()
const jobsStore = useJobsStore()
const { confirm } = useConfirmDialog()
const toastRef = ref<InstanceType<typeof Toast> | null>(null)

const isAdmin = computed(() => auth.role === ROLES.ADMIN)
const displayName = computed(() => auth.user?.displayName || auth.user?.email || 'Controller')

const sortOptions: ControllerSortOption[] = [
  { key: 'weekEnding', label: 'Week Ending' },
  { key: 'jobName', label: 'Job' },
  { key: 'jobCode', label: 'Code' },
  { key: 'employeeNumber', label: 'Employee #' },
  { key: 'employeeName', label: 'Employee' },
  { key: 'occupation', label: 'Trade' },
  { key: 'status', label: 'Status' },
  { key: 'totalHours', label: 'Hours' },
  { key: 'totalProduction', label: 'Production' },
  { key: 'totalLine', label: 'Line Total' },
  { key: 'submittedAt', label: 'Submitted' },
]

const downloadingCsv = ref(false)
const downloadingPdf = ref(false)
const isDownloading = computed(() => downloadingCsv.value || downloadingPdf.value)
const loadingTimecards = ref(false)
const refreshingTimecards = ref(false)
const reviewTimecards = ref<ControllerTimecardWeekItem[]>([])
const loadedTimecardMap = ref<Record<string, TimecardModel>>({})
const reviewSummary = ref({
  totalCount: 0,
  submittedCount: 0,
  draftCount: 0,
  totalHours: 0,
  totalProduction: 0,
  totalLine: 0,
})
const timecardSortKey = ref<ControllerSortKey>('weekEnding')
const timecardSortDir = ref<SortDir>('asc')
const timecardsLoadError = ref('')
let timecardLoadToken = 0

const editingTimecardId = ref<string | null>(null)
const expandedId = ref<string | null>(null)
const editForm = ref<TimecardEmployeeEditorForm>(createEmptyTimecardEmployeeEditorForm())
const autoSaveTimers = ref<Map<string, ReturnType<typeof setTimeout>>>(new Map())

const lastCompletedSaturday = getLastCompletedSaturday()
const lastCompletedWeekStart = snapToSunday(lastCompletedSaturday)

const useWeekRange = ref(false)
const selectedSingleDate = ref(lastCompletedSaturday)
const selectedRangeStartDate = ref(lastCompletedSaturday)
const selectedRangeEndDate = ref(lastCompletedSaturday)
const selectedJobId = ref('')
const jobSearchQuery = ref('')
const jobMenuOpen = ref(false)
const tradeFilter = ref('')
const firstNameFilter = ref('')
const lastNameFilter = ref('')
const subcontractedFilter = ref<ControllerSubcontractedFilter>('all')
const statusFilter = ref<ControllerTimecardStatusFilter>('all')

const appliedFilters = ref<ControllerTimecardFilters | null>(null)
const loadedPeriod = ref({
  startWeek: lastCompletedWeekStart,
  endWeek: lastCompletedWeekStart,
  startWeekEnding: getSaturdayFromSunday(lastCompletedWeekStart),
  endWeekEnding: getSaturdayFromSunday(lastCompletedWeekStart),
})

const weekPickerConfig = computed(() => ({
  dateFormat: 'Y-m-d',
  disableMobile: true,
  prevArrow: '<i class="bi bi-chevron-left"></i>',
  nextArrow: '<i class="bi bi-chevron-right"></i>',
  maxDate: getLastCompletedSaturday(),
}))

const currentStartWeek = computed(() => {
  const source = useWeekRange.value ? selectedRangeStartDate.value : selectedSingleDate.value
  return isValidDateValue(source) ? snapToSunday(source) : ''
})

const currentEndWeek = computed(() => {
  const source = useWeekRange.value ? selectedRangeEndDate.value : selectedSingleDate.value
  return isValidDateValue(source) ? snapToSunday(source) : ''
})

const currentWeekLabel = computed(() => formatSearchRange(currentStartWeek.value, currentEndWeek.value))
const loadedWeekLabel = computed(() => formatSearchRange(loadedPeriod.value.startWeek, loadedPeriod.value.endWeek))
const currentSortLabel = computed(() => (
  sortOptions.find((option) => option.key === timecardSortKey.value)?.label || 'Week Ending'
))

const filterValidationError = computed(() => {
  if (!currentStartWeek.value || !currentEndWeek.value) {
    return 'Choose a valid week before searching.'
  }

  const start = new Date(`${currentStartWeek.value}T00:00:00Z`)
  const end = new Date(`${currentEndWeek.value}T00:00:00Z`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Choose a valid week before searching.'
  }
  if (end.getTime() < start.getTime()) {
    return 'End week must be on or after the start week.'
  }

  return ''
})

const jobOptions = computed(() => {
  const jobs = [...jobsStore.jobs]
  jobs.sort((left, right) => {
    const leftLabel = `${left.code || ''} ${left.name}`.trim().toLowerCase()
    const rightLabel = `${right.code || ''} ${right.name}`.trim().toLowerCase()
    return leftLabel.localeCompare(rightLabel)
  })

  return jobs.map((job) => ({
    id: job.id,
    label: [job.code, job.name].filter(Boolean).join(' - ') || job.name,
  }))
})

const selectedJobOption = computed(() => (
  jobOptions.value.find((job) => job.id === selectedJobId.value) || null
))

const filteredJobOptions = computed(() => {
  const query = jobSearchQuery.value.trim().toLowerCase()
  if (!query) return jobOptions.value

  return jobOptions.value.filter((job) => job.label.toLowerCase().includes(query))
})

const currentFilterSummary = computed(() => summarizeFilters(buildFilterPayload()))
const activeFilterSummary = computed(() => summarizeFilters(appliedFilters.value))
const autoFilterSignature = computed(() => JSON.stringify({
  useWeekRange: useWeekRange.value,
  selectedSingleDate: selectedSingleDate.value,
  selectedRangeStartDate: selectedRangeStartDate.value,
  selectedRangeEndDate: selectedRangeEndDate.value,
  selectedJobId: selectedJobId.value,
  trade: tradeFilter.value.trim(),
  firstName: firstNameFilter.value.trim(),
  lastName: lastNameFilter.value.trim(),
  subcontracted: subcontractedFilter.value,
  status: statusFilter.value,
}))
const pendingFilterChanges = computed(() => {
  const current = buildFilterPayload()
  if (!current || !appliedFilters.value) return false
  return filterSignature(current) !== filterSignature(appliedFilters.value)
})

const sortedTimecards = computed(() => {
  const rows = [...reviewTimecards.value]
  const direction = timecardSortDir.value === 'asc' ? 1 : -1

  const statusRank = (status: ControllerTimecardWeekItem['status']) => (status === 'submitted' ? 0 : 1)

  const valueForSort = (row: ControllerTimecardWeekItem, key: ControllerSortKey): string | number => {
    switch (key) {
      case 'status':
        return statusRank(row.status)
      case 'totalHours':
        return row.totalHours
      case 'totalProduction':
        return row.totalProduction
      case 'totalLine':
        return row.totalLine
      case 'submittedAt':
        return row.submittedAtMs ?? -1
      default:
        return String(row[key] ?? '').toLowerCase()
    }
  }

  rows.sort((a, b) => {
    const left = valueForSort(a, timecardSortKey.value)
    const right = valueForSort(b, timecardSortKey.value)

    if (left === right) {
      return (
        String(a.weekEnding || '').localeCompare(String(b.weekEnding || ''))
        || a.jobName.localeCompare(b.jobName)
        || a.employeeName.localeCompare(b.employeeName)
      )
    }

    if (typeof left === 'number' && typeof right === 'number') {
      return (left - right) * direction
    }

    return String(left).localeCompare(String(right)) * direction
  })

  return rows
})

const groupedTimecards = computed<ControllerJobGroup[]>(() => {
  const groups = new Map<string, ControllerJobGroup>()

  for (const row of sortedTimecards.value) {
    const key = buildTimecardKey(row.jobId, row.timecardId)
    const timecard = loadedTimecardMap.value[key]
    if (!timecard) continue
    const creatorKey = row.createdByUid || 'unknown'

    let group = groups.get(row.jobId)
    if (!group) {
      group = {
        jobId: row.jobId,
        jobName: row.jobName,
        jobCode: row.jobCode,
        totalCount: 0,
        draftCount: 0,
        submittedCount: 0,
        totalHours: 0,
        totalProduction: 0,
        totalLine: 0,
        creatorGroups: [],
      }
      groups.set(row.jobId, group)
    }

    let creatorGroup = group.creatorGroups.find((entry) => entry.creatorKey === creatorKey)
    if (!creatorGroup) {
      creatorGroup = {
        creatorKey,
        creatorName: row.createdByName || 'Unknown Creator',
        totalCount: 0,
        draftCount: 0,
        submittedCount: 0,
        totalHours: 0,
        totalProduction: 0,
        totalLine: 0,
        timecards: [],
      }
      group.creatorGroups.push(creatorGroup)
    }

    const groupedTimecard = { key, row, timecard }
    creatorGroup.timecards.push(groupedTimecard)
    creatorGroup.totalCount += 1
    creatorGroup.totalHours += timecard.totals?.hoursTotal ?? 0
    creatorGroup.totalProduction += timecard.totals?.productionTotal ?? 0
    creatorGroup.totalLine += timecard.totals?.lineTotal ?? 0

    group.totalCount += 1
    group.totalHours += timecard.totals?.hoursTotal ?? 0
    group.totalProduction += timecard.totals?.productionTotal ?? 0
    group.totalLine += timecard.totals?.lineTotal ?? 0
    if (timecard.status === 'submitted') {
      creatorGroup.submittedCount += 1
      group.submittedCount += 1
    } else {
      creatorGroup.draftCount += 1
      group.draftCount += 1
    }
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    creatorGroups: group.creatorGroups
      .map((creatorGroup) => ({
        ...creatorGroup,
        timecards: creatorGroup.timecards,
      }))
      .sort((left, right) => left.creatorName.localeCompare(right.creatorName)),
  }))
})

let queuedReloadTimer: ReturnType<typeof setTimeout> | null = null
let queuedJobMenuCloseTimer: ReturnType<typeof setTimeout> | null = null

function buildTimecardKey(jobId: string, timecardId: string): string {
  return `${jobId}::${timecardId}`
}

function formatErr(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message?: unknown }).message || err)
  }
  return String(err || 'Unknown error')
}

function formatDateValue(value: Date): string {
  const year = value.getUTCFullYear()
  const month = String(value.getUTCMonth() + 1).padStart(2, '0')
  const day = String(value.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isValidDateValue(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return false
  return formatDateValue(parsed) === value
}

function getLastCompletedSaturday(): string {
  const today = new Date()
  const utcDay = today.getUTCDay()
  const daysToSubtract = utcDay === 6 ? 0 : utcDay + 1
  const lastSaturday = new Date(today)
  lastSaturday.setUTCDate(lastSaturday.getUTCDate() - daysToSubtract)
  return formatDateValue(lastSaturday)
}

function onSingleWeekChange(selectedDates: Date[]) {
  const selected = Array.isArray(selectedDates) && selectedDates.length ? selectedDates[0] : null
  if (!selected) return
  selectedSingleDate.value = formatDateValue(selected)
}

function onRangeStartChange(selectedDates: Date[]) {
  const selected = Array.isArray(selectedDates) && selectedDates.length ? selectedDates[0] : null
  if (!selected) return
  selectedRangeStartDate.value = formatDateValue(selected)
}

function onRangeEndChange(selectedDates: Date[]) {
  const selected = Array.isArray(selectedDates) && selectedDates.length ? selectedDates[0] : null
  if (!selected) return
  selectedRangeEndDate.value = formatDateValue(selected)
}

function clearQueuedJobMenuClose() {
  if (!queuedJobMenuCloseTimer) return
  clearTimeout(queuedJobMenuCloseTimer)
  queuedJobMenuCloseTimer = null
}

function openJobMenu() {
  clearQueuedJobMenuClose()
  jobMenuOpen.value = true
}

function scheduleJobMenuClose() {
  clearQueuedJobMenuClose()
  queuedJobMenuCloseTimer = setTimeout(() => {
    jobMenuOpen.value = false
    queuedJobMenuCloseTimer = null
  }, 120)
}

function handleJobSearchInput(event: Event) {
  const nextValue = String((event.target as HTMLInputElement)?.value || '')
  jobSearchQuery.value = nextValue
  openJobMenu()

  if (!nextValue.trim()) {
    selectedJobId.value = ''
    return
  }

  if (selectedJobOption.value && nextValue.trim() !== selectedJobOption.value.label) {
    selectedJobId.value = ''
  }
}

function selectJobOption(jobId: string) {
  const selected = jobOptions.value.find((job) => job.id === jobId) || null
  selectedJobId.value = jobId
  jobSearchQuery.value = selected?.label || ''
  jobMenuOpen.value = false
}

function clearJobSelection() {
  selectedJobId.value = ''
  jobSearchQuery.value = ''
  jobMenuOpen.value = false
}

function handleJobSearchKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    jobMenuOpen.value = false
    return
  }

  if (event.key === 'Enter' && filteredJobOptions.value.length) {
    event.preventDefault()
    const [firstMatch] = filteredJobOptions.value
    if (firstMatch) selectJobOption(firstMatch.id)
  }
}

function formatMetric(value: number): string {
  const numeric = Number(value ?? 0)
  if (!Number.isFinite(numeric) || Number.isNaN(numeric)) return '0'
  return numeric.toFixed(2).replace(/\.00$/, '')
}

function formatCurrency(value: number): string {
  return `$${Number(value ?? 0).toFixed(2)}`
}

function formatSearchRange(startWeek: string, endWeek: string): string {
  if (!startWeek) return 'No week selected'

  const startLabel = formatWeekRange(startWeek, getSaturdayFromSunday(startWeek))
  if (!endWeek || startWeek === endWeek) return startLabel

  const endLabel = formatWeekRange(endWeek, getSaturdayFromSunday(endWeek))
  return `${startLabel} to ${endLabel}`
}

function formatTimecardWeek(timecard: TimecardModel): string {
  return `Week ending ${timecard.weekEndingDate}`
}

function buildFilterPayload(): ControllerTimecardFilters | null {
  if (filterValidationError.value) return null

  return {
    startWeek: currentStartWeek.value,
    endWeek: currentEndWeek.value || currentStartWeek.value,
    jobId: selectedJobId.value || '',
    trade: tradeFilter.value.trim(),
    firstName: firstNameFilter.value.trim(),
    lastName: lastNameFilter.value.trim(),
    subcontracted: subcontractedFilter.value,
    status: statusFilter.value,
  }
}

function filterSignature(filters: ControllerTimecardFilters | null): string {
  if (!filters) return ''
  return JSON.stringify({
    startWeek: filters.startWeek,
    endWeek: filters.endWeek || filters.startWeek,
    jobId: filters.jobId || '',
    trade: filters.trade || '',
    firstName: filters.firstName || '',
    lastName: filters.lastName || '',
    subcontracted: filters.subcontracted || 'all',
    status: filters.status || 'all',
  })
}

function summarizeFilters(filters: ControllerTimecardFilters | null): string {
  if (!filters) return 'No filters applied.'

  const parts: string[] = []
  const jobLabel = filters.jobId
    ? jobOptions.value.find((job) => job.id === filters.jobId)?.label || 'Selected job'
    : ''

  if (jobLabel) parts.push(`Job: ${jobLabel}`)
  if (filters.trade) parts.push(`Trade: ${filters.trade}`)
  if (filters.firstName) parts.push(`First: ${filters.firstName}`)
  if (filters.lastName) parts.push(`Last: ${filters.lastName}`)
  if (filters.subcontracted === 'subcontracted') parts.push('Subcontracted only')
  if (filters.subcontracted === 'direct') parts.push('Direct labor only')
  if (filters.status !== 'all') parts.push(`Status: ${filters.status}`)

  return parts.length ? parts.join(' | ') : 'All jobs, trades, and employees.'
}

function toggleSortDirection() {
  timecardSortDir.value = timecardSortDir.value === 'asc' ? 'desc' : 'asc'
}

function recalcTotals(timecard: TimecardModel) {
  recalcTotalsForTimecard(timecard, timecard.weekStartDate)
}

function recalculateReviewSummary(rows = reviewTimecards.value) {
  reviewSummary.value = rows.reduce(
    (summary, row) => {
      summary.totalCount += 1
      if (row.status === 'submitted') summary.submittedCount += 1
      else summary.draftCount += 1
      summary.totalHours += Number(row.totalHours ?? 0)
      summary.totalProduction += Number(row.totalProduction ?? 0)
      summary.totalLine += Number(row.totalLine ?? 0)
      return summary
    },
    {
      totalCount: 0,
      submittedCount: 0,
      draftCount: 0,
      totalHours: 0,
      totalProduction: 0,
      totalLine: 0,
    },
  )
}

async function hydrateDetailedTimecards(
  rows: ControllerTimecardWeekItem[],
  currentToken: number,
): Promise<Record<string, TimecardModel>> {
  if (!rows.length) return {}

  const groupedRequests = new Map<string, { jobId: string; weekEnding: string; ids: Set<string> }>()
  for (const row of rows) {
    const requestKey = `${row.jobId}::${row.weekEnding}`
    const existing = groupedRequests.get(requestKey)
    if (existing) {
      existing.ids.add(row.timecardId)
    } else {
      groupedRequests.set(requestKey, {
        jobId: row.jobId,
        weekEnding: row.weekEnding,
        ids: new Set([row.timecardId]),
      })
    }
  }

  const responses = await Promise.all(
    Array.from(groupedRequests.values()).map(async (request) => {
      const timecards = await listTimecardsByJobAndWeek(request.jobId, request.weekEnding)
      return { request, timecards: timecards as TimecardModel[] }
    }),
  )

  if (currentToken !== timecardLoadToken) return {}

  const nextMap: Record<string, TimecardModel> = {}
  for (const response of responses) {
    for (const timecard of response.timecards) {
      if (!response.request.ids.has(timecard.id)) continue
      recalcTotals(timecard)
      nextMap[buildTimecardKey(response.request.jobId, timecard.id)] = timecard
    }
  }

  return nextMap
}

async function loadTimecards(filters: ControllerTimecardFilters): Promise<boolean> {
  const currentToken = ++timecardLoadToken
  const useBackgroundRefresh = reviewTimecards.value.length > 0 || !!appliedFilters.value

  if (useBackgroundRefresh) refreshingTimecards.value = true
  else loadingTimecards.value = true
  timecardsLoadError.value = ''

  try {
    const result = await listTimecardsForWeek(filters)
    if (currentToken !== timecardLoadToken) return false

    const detailedTimecards = await hydrateDetailedTimecards(result.timecards, currentToken)
    if (currentToken !== timecardLoadToken) return false

    reviewTimecards.value = result.timecards
    loadedTimecardMap.value = detailedTimecards
    reviewSummary.value = {
      totalCount: result.totalCount,
      submittedCount: result.submittedCount,
      draftCount: result.draftCount,
      totalHours: result.totalHours,
      totalProduction: result.totalProduction,
      totalLine: result.totalLine,
    }
    appliedFilters.value = {
      startWeek: result.startWeek,
      endWeek: result.endWeek,
      jobId: result.filters.jobId,
      trade: result.filters.trade,
      firstName: result.filters.firstName,
      lastName: result.filters.lastName,
      subcontracted: result.filters.subcontracted,
      status: result.filters.status,
    }
    loadedPeriod.value = {
      startWeek: result.startWeek,
      endWeek: result.endWeek,
      startWeekEnding: result.startWeekEnding,
      endWeekEnding: result.endWeekEnding,
    }
    return true
  } catch (err) {
    if (currentToken !== timecardLoadToken) return false

    reviewTimecards.value = []
    loadedTimecardMap.value = {}
    reviewSummary.value = {
      totalCount: 0,
      submittedCount: 0,
      draftCount: 0,
      totalHours: 0,
      totalProduction: 0,
      totalLine: 0,
    }
    timecardsLoadError.value = formatErr(err)
    return false
  } finally {
    if (currentToken === timecardLoadToken) {
      if (useBackgroundRefresh) refreshingTimecards.value = false
      else loadingTimecards.value = false
    }
  }
}

async function applyFilters() {
  if (filterValidationError.value) {
    toastRef.value?.show(filterValidationError.value, 'error')
    return
  }

  const filters = buildFilterPayload()
  if (!filters) return
  await loadTimecards(filters)
}

function clearQueuedReload() {
  if (!queuedReloadTimer) return
  clearTimeout(queuedReloadTimer)
  queuedReloadTimer = null
}

function queueAutoReload(delayMs = 300) {
  clearQueuedReload()
  if (filterValidationError.value) return

  const filters = buildFilterPayload()
  if (!filters) return

  queuedReloadTimer = setTimeout(() => {
    queuedReloadTimer = null
    void loadTimecards(filters)
  }, delayMs)
}

function resetFilters() {
  useWeekRange.value = false
  selectedSingleDate.value = lastCompletedSaturday
  selectedRangeStartDate.value = lastCompletedSaturday
  selectedRangeEndDate.value = lastCompletedSaturday
  selectedJobId.value = ''
  jobSearchQuery.value = ''
  jobMenuOpen.value = false
  tradeFilter.value = ''
  firstNameFilter.value = ''
  lastNameFilter.value = ''
  subcontractedFilter.value = 'all'
  statusFilter.value = 'all'
  timecardSortKey.value = 'weekEnding'
  timecardSortDir.value = 'asc'
}

function base64ToBlob(contentBase64: string, contentType: string): Blob {
  const binary = atob(contentBase64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes.buffer], { type: contentType || 'application/octet-stream' })
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

async function handleDownload(format: 'csv' | 'pdf') {
  if (isDownloading.value) return
  if (filterValidationError.value) {
    toastRef.value?.show(filterValidationError.value, 'error')
    return
  }

  const filters = buildFilterPayload()
  if (!filters) return

  if (!appliedFilters.value || pendingFilterChanges.value) {
    const loaded = await loadTimecards(filters)
    if (!loaded) return
  }

  if (format === 'csv') downloadingCsv.value = true
  if (format === 'pdf') downloadingPdf.value = true

  try {
    const result = await downloadTimecardsForWeek(filters, format)
    if (!result.contentBase64) throw new Error('No file content returned')

    const blob = base64ToBlob(result.contentBase64, result.contentType)
    triggerDownload(blob, result.fileName)
    toastRef.value?.show(
      `Downloaded ${result.timecardCount} timecard(s) for ${formatSearchRange(result.startWeek, result.endWeek)}`,
      'success',
    )
  } catch (err) {
    toastRef.value?.show(formatErr(err), 'error')
  } finally {
    downloadingCsv.value = false
    downloadingPdf.value = false
  }
}

function isTimecardLocked(timecard: TimecardModel): boolean {
  return timecard.status === 'submitted' && !isAdmin.value
}

function handleTimecardToggle(key: string, open: boolean) {
  expandedId.value = open ? key : null
}

function parseMileageInput(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed < 0) return null
  return parsed
}

function syncReviewRowFromTimecard(timecard: TimecardModel) {
  const employeeForm = buildTimecardEmployeeEditorForm(timecard)
  const rowIndex = reviewTimecards.value.findIndex((row) => (
    row.jobId === timecard.jobId && row.timecardId === timecard.id
  ))
  if (rowIndex === -1) return

  const currentRow = reviewTimecards.value[rowIndex]
  if (!currentRow) return
  reviewTimecards.value[rowIndex] = {
    ...currentRow,
    employeeNumber: timecard.employeeNumber,
    employeeName: timecard.employeeName,
    firstName: employeeForm.firstName,
    lastName: employeeForm.lastName,
    occupation: timecard.occupation,
    status: timecard.status,
    weekStart: timecard.weekStartDate,
    weekEnding: timecard.weekEndingDate,
    totalHours: timecard.totals?.hoursTotal ?? 0,
    totalProduction: timecard.totals?.productionTotal ?? 0,
    totalLine: timecard.totals?.lineTotal ?? 0,
    mileage: Number(timecard.mileage ?? 0),
    subcontractedEmployee: !!timecard.subcontractedEmployee,
  }
  recalculateReviewSummary()
}

function updateLoadedTimecard(timecard: TimecardModel) {
  loadedTimecardMap.value = {
    ...loadedTimecardMap.value,
    [buildTimecardKey(timecard.jobId, timecard.id)]: timecard,
  }
}

function startEditingEmployee(entry: ControllerGroupedTimecard) {
  editingTimecardId.value = entry.key
  editForm.value = buildTimecardEmployeeEditorForm(entry.timecard)
}

function confirmEditingEmployee(entry: ControllerGroupedTimecard) {
  const validationMessage = [
    ...validateRequired(editForm.value.firstName, 'First name'),
    ...validateRequired(editForm.value.lastName, 'Last name'),
    ...validateRequired(editForm.value.employeeNumber, 'Employee number'),
  ][0]?.message ?? null

  if (validationMessage) {
    toastRef.value?.show(validationMessage, 'error')
    return
  }

  const timecard = entry.timecard
  timecard.employeeNumber = editForm.value.employeeNumber.trim()
  timecard.firstName = editForm.value.firstName.trim()
  timecard.lastName = editForm.value.lastName.trim()
  timecard.employeeName = `${timecard.firstName} ${timecard.lastName}`.trim()
  timecard.employeeWage = parseWage(editForm.value.employeeWage)
  timecard.subcontractedEmployee = parseSubcontractedEmployee(editForm.value.subcontractedEmployee)
  timecard.occupation = editForm.value.occupation.trim()
  recalcTotals(timecard)
  updateLoadedTimecard(timecard)
  syncReviewRowFromTimecard(timecard)
  autoSave(timecard)
  editingTimecardId.value = null
}

function toggleEditingEmployee(entry: ControllerGroupedTimecard) {
  if (editingTimecardId.value === entry.key) confirmEditingEmployee(entry)
  else startEditingEmployee(entry)
}

function handleNotesInput(timecard: TimecardModel, value: string) {
  timecard.notes = value
  updateLoadedTimecard(timecard)
  autoSave(timecard)
}

async function saveTimecard(timecard: TimecardModel, showToast = true) {
  try {
    recalcTotals(timecard)
    await updateTimecard(timecard.jobId, timecard.id, {
      days: timecard.days,
      jobs: timecard.jobs,
      notes: timecard.notes,
      firstName: timecard.firstName,
      lastName: timecard.lastName,
      employeeName: timecard.employeeName,
      employeeNumber: timecard.employeeNumber,
      employeeWage: timecard.employeeWage,
      subcontractedEmployee: timecard.subcontractedEmployee ?? false,
      regularHoursOverride: timecard.regularHoursOverride ?? null,
      overtimeHoursOverride: timecard.overtimeHoursOverride ?? null,
      mileage: timecard.mileage ?? null,
      occupation: timecard.occupation,
    })

    updateLoadedTimecard(timecard)
    syncReviewRowFromTimecard(timecard)
    queueAutoReload(700)

    if (showToast) {
      toastRef.value?.show(`Updated timecard for ${timecard.employeeName}`, 'success')
    }
  } catch (err) {
    toastRef.value?.show(formatErr(err), 'error')
  }
}

function autoSave(timecard: TimecardModel) {
  const key = buildTimecardKey(timecard.jobId, timecard.id)
  const existing = autoSaveTimers.value.get(key)
  if (existing) clearTimeout(existing)

  const timer = setTimeout(() => {
    void saveTimecard(timecard, false)
    autoSaveTimers.value.delete(key)
  }, 500)

  autoSaveTimers.value.set(key, timer)
}

async function handleDeleteTimecard(entry: ControllerGroupedTimecard) {
  const confirmed = await confirm(`Delete timecard for ${entry.timecard.employeeName}?`, {
    title: 'Delete Timecard',
    confirmText: 'Delete',
    variant: 'danger',
  })
  if (!confirmed) return

  try {
    await deleteTimecard(entry.timecard.jobId, entry.timecard.id)

    const nextMap = { ...loadedTimecardMap.value }
    delete nextMap[entry.key]
    loadedTimecardMap.value = nextMap
    reviewTimecards.value = reviewTimecards.value.filter((row) => (
      !(row.jobId === entry.row.jobId && row.timecardId === entry.row.timecardId)
    ))
    recalculateReviewSummary()

    const timer = autoSaveTimers.value.get(entry.key)
    if (timer) {
      clearTimeout(timer)
      autoSaveTimers.value.delete(entry.key)
    }

    if (editingTimecardId.value === entry.key) editingTimecardId.value = null
    if (expandedId.value === entry.key) expandedId.value = null

    queueAutoReload(250)
    toastRef.value?.show(`Deleted timecard for ${entry.timecard.employeeName}`, 'success')
  } catch (err) {
    toastRef.value?.show(formatErr(err), 'error')
  }
}

function updateMileage(timecard: TimecardModel, rawValue: string) {
  timecard.mileage = parseMileageInput(rawValue)
  updateLoadedTimecard(timecard)
  autoSave(timecard)
}

const {
  addJobRow,
  removeJobRow,
  updateJobNumber,
  updateSubsectionArea,
  updateAccount,
  updateDiffValue,
  handleHoursInput,
  handleProductionInput,
} = useTimecardJobEditing({
  getWeekStartDate: (timecard) => timecard.weekStartDate,
  recalcTotals: (timecard) => {
    recalcTotals(timecard)
    updateLoadedTimecard(timecard)
    syncReviewRowFromTimecard(timecard)
  },
  autoSave: (timecard) => {
    updateLoadedTimecard(timecard)
    syncReviewRowFromTimecard(timecard)
    autoSave(timecard)
  },
})

onMounted(async () => {
  await Promise.all([
    jobsStore.fetchAllJobs(true),
    applyFilters(),
  ])
})

watch(autoFilterSignature, () => {
  queueAutoReload()
})

onBeforeUnmount(() => {
  clearQueuedReload()
  clearQueuedJobMenuClose()
  autoSaveTimers.value.forEach((timer) => clearTimeout(timer))
  autoSaveTimers.value.clear()
})
</script>

<template>
  <Toast ref="toastRef" />

  <div class="container-fluid py-4 wide-container">
    <div class="controller-hero mb-4">
      <div class="text-muted small mb-1">Controller Workspace</div>
      <h2 class="h3 mb-1">Timecard Search, Review & Edits</h2>
      <p class="mb-0 text-muted small">Signed in as {{ displayName }}</p>
    </div>

    <div class="card controller-card controller-filter-card mb-4">
      <div class="card-header panel-header d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <div class="text-muted small mb-1">Search Filters</div>
          <h3 class="h5 mb-0">Find Timecards And Export The Same Results</h3>
        </div>

        <div class="small text-muted">
          Downloads use the active search filters.
        </div>
      </div>

      <div class="card-body controller-filter-card__body">
        <div class="row g-2 align-items-end controller-filter-grid">
          <div class="col-xl-3 col-lg-4">
            <div class="form-check form-switch controller-filter-switch">
              <input id="tc-use-range" v-model="useWeekRange" class="form-check-input" type="checkbox" />
              <label class="form-check-label" for="tc-use-range">Use week range</label>
            </div>

            <div v-if="!useWeekRange">
              <label class="form-label small text-muted mb-1 controller-filter-label">Select Any Date In Week</label>
              <div class="input-group input-group-sm">
                <span class="input-group-text"><i class="bi bi-calendar-date"></i></span>
                <flat-pickr
                  v-model="selectedSingleDate"
                  :config="weekPickerConfig"
                  @on-change="onSingleWeekChange"
                  class="form-control form-control-sm"
                  aria-label="Select week for controller search"
                />
              </div>
            </div>

            <div v-else class="row g-2">
              <div class="col-12">
                <label class="form-label small text-muted mb-1 controller-filter-label">Start Week</label>
                <div class="input-group input-group-sm">
                  <span class="input-group-text"><i class="bi bi-calendar-range"></i></span>
                  <flat-pickr
                    v-model="selectedRangeStartDate"
                    :config="weekPickerConfig"
                    @on-change="onRangeStartChange"
                    class="form-control form-control-sm"
                    aria-label="Select start week"
                  />
                </div>
              </div>

              <div class="col-12">
                <label class="form-label small text-muted mb-1 controller-filter-label">End Week</label>
                <div class="input-group input-group-sm">
                  <span class="input-group-text"><i class="bi bi-calendar-range"></i></span>
                  <flat-pickr
                    v-model="selectedRangeEndDate"
                    :config="weekPickerConfig"
                    @on-change="onRangeEndChange"
                    class="form-control form-control-sm"
                    aria-label="Select end week"
                  />
                </div>
              </div>
            </div>
          </div>

          <div class="col-xl-3 col-lg-4">
            <label class="form-label small text-muted mb-1 controller-filter-label">Job</label>
            <div class="job-search">
              <div class="input-group input-group-sm">
                <span class="input-group-text"><i class="bi bi-building"></i></span>
                <input
                  :value="jobSearchQuery"
                  type="search"
                  class="form-control form-control-sm"
                  placeholder="Search jobs..."
                  autocomplete="off"
                  @input="handleJobSearchInput"
                  @focus="openJobMenu"
                  @blur="scheduleJobMenuClose"
                  @keydown="handleJobSearchKeydown"
                />
                <button
                  v-if="selectedJobId || jobSearchQuery"
                  type="button"
                  class="btn btn-outline-secondary btn-sm"
                  aria-label="Clear job filter"
                  @mousedown.prevent="clearJobSelection"
                >
                  <i class="bi bi-x-lg"></i>
                </button>
              </div>

              <div v-if="jobMenuOpen" class="job-search__menu">
                <button
                  type="button"
                  class="job-search__option"
                  :class="{ 'is-selected': !selectedJobId }"
                  @mousedown.prevent="clearJobSelection"
                >
                  <span class="fw-semibold">All jobs</span>
                </button>

                <button
                  v-for="job in filteredJobOptions"
                  :key="job.id"
                  type="button"
                  class="job-search__option"
                  :class="{ 'is-selected': selectedJobId === job.id }"
                  @mousedown.prevent="selectJobOption(job.id)"
                >
                  {{ job.label }}
                </button>

                <div v-if="!filteredJobOptions.length" class="job-search__empty">
                  No jobs match "{{ jobSearchQuery.trim() }}".
                </div>
              </div>
            </div>
          </div>

          <div class="col-xl-2 col-md-4">
            <label class="form-label small text-muted mb-1 controller-filter-label">Trade</label>
            <input v-model="tradeFilter" type="text" class="form-control form-control-sm" placeholder="e.g. Carpenter" />
          </div>

          <div class="col-xl-2 col-md-4">
            <label class="form-label small text-muted mb-1 controller-filter-label">First Name</label>
            <input v-model="firstNameFilter" type="text" class="form-control form-control-sm" placeholder="First name" />
          </div>

          <div class="col-xl-2 col-md-4">
            <label class="form-label small text-muted mb-1 controller-filter-label">Last Name</label>
            <input v-model="lastNameFilter" type="text" class="form-control form-control-sm" placeholder="Last name" />
          </div>

          <div class="col-xl-2 col-md-4">
            <label class="form-label small text-muted mb-1 controller-filter-label">Subcontracted</label>
            <select v-model="subcontractedFilter" class="form-select form-select-sm">
              <option value="all">All</option>
              <option value="subcontracted">Sub only</option>
              <option value="direct">Non-sub only</option>
            </select>
          </div>

          <div class="col-xl-2 col-md-4">
            <label class="form-label small text-muted mb-1 controller-filter-label">Status</label>
            <select v-model="statusFilter" class="form-select form-select-sm">
              <option value="all">All statuses</option>
              <option value="submitted">Submitted</option>
              <option value="draft">Draft</option>
            </select>
          </div>

          <div class="col-12">
            <div class="controller-filter-footer">
              <div class="controller-search-summary controller-search-summary--compact">
                <div class="controller-search-summary__line">
                  <span class="controller-search-summary__kicker">Weeks</span>
                  <span class="fw-semibold">{{ currentWeekLabel }}</span>
                </div>
                <div class="controller-search-summary__line text-muted">
                  <span>{{ currentFilterSummary }}</span>
                  <span v-if="pendingFilterChanges" class="text-warning">Updating results...</span>
                  <span v-else-if="refreshingTimecards">Refreshing current results...</span>
                </div>
              </div>

              <div class="controller-actions-grid">
                <button type="button" class="btn btn-outline-primary btn-sm" :disabled="isDownloading || !!filterValidationError" @click="handleDownload('pdf')">
                  <span v-if="downloadingPdf" class="spinner-border spinner-border-sm me-2"></span>
                  <i v-else class="bi bi-file-earmark-pdf me-2"></i>
                  Download PDF
                </button>

                <button type="button" class="btn btn-outline-primary btn-sm" :disabled="isDownloading || !!filterValidationError" @click="handleDownload('csv')">
                  <span v-if="downloadingCsv" class="spinner-border spinner-border-sm me-2"></span>
                  <i v-else class="bi bi-filetype-csv me-2"></i>
                  Download CSV
                </button>

                <button type="button" class="btn btn-outline-secondary btn-sm controller-actions-grid__full" :disabled="loadingTimecards || isDownloading" @click="resetFilters">
                  Reset Filters
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="filterValidationError" class="alert alert-warning mt-3 mb-0">
          {{ filterValidationError }}
        </div>
      </div>
    </div>

    <div class="row g-3 mb-4">
      <div class="col-6 col-xl-3">
        <div class="card controller-stat-card h-100">
          <div class="card-body">
            <div class="text-muted small text-uppercase fw-semibold">Timecards</div>
            <div class="stat-value">{{ reviewSummary.totalCount }}</div>
            <div class="small text-muted">{{ loadedWeekLabel }}</div>
          </div>
        </div>
      </div>

      <div class="col-6 col-xl-3">
        <div class="card controller-stat-card h-100">
          <div class="card-body">
            <div class="text-muted small text-uppercase fw-semibold">Submitted</div>
            <div class="stat-value text-success">{{ reviewSummary.submittedCount }}</div>
            <div class="small text-muted">Matching results</div>
          </div>
        </div>
      </div>

      <div class="col-6 col-xl-3">
        <div class="card controller-stat-card h-100">
          <div class="card-body">
            <div class="text-muted small text-uppercase fw-semibold">Drafts</div>
            <div class="stat-value text-warning">{{ reviewSummary.draftCount }}</div>
            <div class="small text-muted">Matching results</div>
          </div>
        </div>
      </div>

      <div class="col-6 col-xl-3">
        <div class="card controller-stat-card h-100">
          <div class="card-body">
            <div class="text-muted small text-uppercase fw-semibold">Total Hours</div>
            <div class="stat-value">{{ formatMetric(reviewSummary.totalHours) }}</div>
            <div class="small text-muted">Across current search</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card controller-card">
      <div class="card-header panel-header d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <div class="text-muted small mb-1">Controller Review</div>
          <h3 class="h5 mb-0">Grouped Timecards</h3>
        </div>

        <div class="text-end">
          <div class="small text-muted">Loaded range</div>
          <div class="fw-semibold">{{ loadedWeekLabel }}</div>
        </div>
      </div>

      <div class="card-body">
        <div class="controller-results-meta mb-3">
          <div>
            <div class="small text-muted">Active filters</div>
            <div class="fw-semibold">{{ activeFilterSummary }}</div>
            <div class="small text-muted">
              Sorted by {{ currentSortLabel }}
              <span v-if="refreshingTimecards"> | Updating...</span>
            </div>
          </div>

          <div class="controller-sort-controls">
            <div class="controller-sort-controls__field">
              <label class="form-label small text-muted mb-1">Sort by</label>
              <select v-model="timecardSortKey" class="form-select form-select-sm">
                <option v-for="option in sortOptions" :key="option.key" :value="option.key">
                  {{ option.label }}
                </option>
              </select>
            </div>

            <button type="button" class="btn btn-outline-secondary btn-sm controller-sort-controls__toggle" @click="toggleSortDirection">
              <i :class="timecardSortDir === 'asc' ? 'bi bi-sort-down me-2' : 'bi bi-sort-down-alt me-2'"></i>
              {{ timecardSortDir === 'asc' ? 'Ascending' : 'Descending' }}
            </button>
          </div>
        </div>

        <div v-if="loadingTimecards" class="controller-loading-state text-center py-5">
          <div class="spinner-border text-primary mb-3" role="status" aria-hidden="true"></div>
          <div class="text-muted">Loading timecards...</div>
        </div>

        <div v-else-if="timecardsLoadError" class="alert alert-danger mb-0">
          <strong>Unable to load timecards.</strong> {{ timecardsLoadError }}
        </div>

        <div v-else-if="!groupedTimecards.length" class="alert alert-info mb-0">
          No timecards found for the current search.
        </div>

        <div v-else class="controller-job-groups">
          <section v-for="group in groupedTimecards" :key="group.jobId" class="card controller-job-group">
            <div class="card-header controller-job-group__header">
              <div>
                <div class="small text-muted text-uppercase fw-semibold">Job</div>
                <h4 class="h6 mb-1">{{ group.jobName }}</h4>
                <div class="small text-muted">
                  <span v-if="group.jobCode">{{ group.jobCode }}</span>
                  <span v-if="group.jobCode"> | </span>
                  {{ group.totalCount }} matching timecard{{ group.totalCount === 1 ? '' : 's' }} | {{ group.creatorGroups.length }} creator{{ group.creatorGroups.length === 1 ? '' : 's' }}
                </div>
              </div>

              <div class="controller-job-group__summary">
                <div class="small text-muted">
                  <span class="badge bg-warning text-dark">{{ group.draftCount }} Draft</span>
                  <span class="badge bg-success ms-2">{{ group.submittedCount }} Submitted</span>
                </div>
                <div class="small text-muted mt-2">
                  {{ formatMetric(group.totalHours) }} hrs | {{ formatMetric(group.totalProduction) }} prod | {{ formatCurrency(group.totalLine) }}
                </div>
              </div>
            </div>

            <div class="card-body p-0">
              <div class="timecards-accordion controller-timecards-accordion">
                <section v-for="creatorGroup in group.creatorGroups" :key="`${group.jobId}-${creatorGroup.creatorKey}`" class="controller-creator-group">
                  <div class="controller-creator-group__header">
                    <div>
                      <div class="small text-muted text-uppercase fw-semibold">Created By</div>
                      <div class="fw-semibold">{{ creatorGroup.creatorName }}</div>
                    </div>

                    <div class="small text-muted text-end">
                      <div>
                        <span class="badge bg-warning text-dark">{{ creatorGroup.draftCount }} Draft</span>
                        <span class="badge bg-success ms-2">{{ creatorGroup.submittedCount }} Submitted</span>
                      </div>
                      <div class="mt-1">
                        {{ creatorGroup.totalCount }} timecard{{ creatorGroup.totalCount === 1 ? '' : 's' }}
                      </div>
                    </div>
                  </div>

                  <TimecardEditorCard
                    v-for="entry in creatorGroup.timecards"
                    :key="entry.key"
                    v-model:edit-form="editForm"
                    :item-key="entry.key"
                    :timecard="entry.timecard"
                    :open="expandedId === entry.key"
                    :is-editing="editingTimecardId === entry.key"
                    :is-admin="isAdmin"
                    :job-fields-locked="isTimecardLocked(entry.timecard)"
                    :notes-locked="isTimecardLocked(entry.timecard)"
                    :edit-disabled="isTimecardLocked(entry.timecard)"
                    :delete-disabled="isTimecardLocked(entry.timecard)"
                    :mileage-disabled="isTimecardLocked(entry.timecard)"
                    @update:open="(open) => handleTimecardToggle(entry.key, open)"
                    @toggle-edit="toggleEditingEmployee(entry)"
                    @delete="handleDeleteTimecard(entry)"
                    @add-job-row="addJobRow(entry.timecard)"
                    @remove-job-row="(jobIndex) => removeJobRow(entry.timecard, jobIndex)"
                    @update-job-number="({ jobIndex, value }) => updateJobNumber(entry.timecard, jobIndex, value)"
                    @update-subsection-area="({ jobIndex, value }) => updateSubsectionArea(entry.timecard, jobIndex, value)"
                    @update-account="({ jobIndex, value }) => updateAccount(entry.timecard, jobIndex, value)"
                    @update-diff-value="({ jobIndex, field, value }) => updateDiffValue(entry.timecard, jobIndex, field, value)"
                    @update-hours="({ jobIndex, dayIndex, value }) => handleHoursInput(entry.timecard, jobIndex, dayIndex, value)"
                    @update-production="({ jobIndex, dayIndex, value }) => handleProductionInput(entry.timecard, jobIndex, dayIndex, value)"
                    @update-mileage="(value) => updateMileage(entry.timecard, value)"
                    @update-notes="(value) => handleNotesInput(entry.timecard, value)"
                  >
                    <template #badges>
                      <span class="badge text-bg-secondary controller-week-badge">{{ formatTimecardWeek(entry.timecard) }}</span>
                    </template>
                  </TimecardEditorCard>
                </section>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;

$controller-group-border: mix($surface-3, $primary, 82%);
$controller-divider: rgba($primary, 0.18);

.wide-container {
  max-width: 1400px;
}

.controller-hero {
  border-bottom: 1px solid $border-color;
  padding-bottom: 0.75rem;
}

.controller-card {
  background: $surface-2;
  border: 1px solid $border-color;
  color: $body-color;
}

.controller-filter-card .panel-header {
  padding: 0.8rem 1rem 0.75rem;
}

.controller-filter-card__body {
  padding: 0.9rem 1rem 1rem;
}

.controller-filter-grid {
  --bs-gutter-x: 0.75rem;
  --bs-gutter-y: 0.7rem;
}

.controller-filter-label {
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.controller-filter-switch {
  margin-bottom: 0.45rem;
  min-height: 1.25rem;
}

.controller-search-summary {
  background: rgba($primary, 0.07);
  border: 1px solid rgba($primary, 0.14);
  border-radius: 0.75rem;
  min-height: 100%;
  padding: 0.85rem 1rem;
}

.controller-search-summary--compact {
  min-height: auto;
  padding: 0.6rem 0.8rem;
}

.controller-search-summary__line {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.6rem;
}

.controller-search-summary__line + .controller-search-summary__line {
  margin-top: 0.2rem;
}

.controller-search-summary__kicker {
  color: rgba($body-color, 0.7);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.controller-filter-footer {
  align-items: stretch;
  display: grid;
  gap: 0.75rem;
  grid-template-columns: minmax(0, 1fr) auto;
  margin-top: 0.15rem;
}

.job-search {
  position: relative;
}

.job-search__menu {
  background: $surface-2;
  border: 1px solid $border-color;
  border-radius: 0.75rem;
  box-shadow: 0 14px 28px rgba(0, 0, 0, 0.28);
  left: 0;
  margin-top: 0.35rem;
  max-height: 280px;
  overflow-y: auto;
  position: absolute;
  right: 0;
  top: 100%;
  z-index: 20;
}

.job-search__option {
  background: transparent;
  border: 0;
  color: $body-color;
  display: block;
  padding: 0.55rem 0.75rem;
  text-align: left;
  width: 100%;
}

.job-search__option:hover,
.job-search__option.is-selected {
  background: rgba($primary, 0.14);
}

.job-search__empty {
  color: rgba($body-color, 0.72);
  padding: 0.65rem 0.75rem;
}

.controller-actions-grid {
  display: grid;
  gap: 0.5rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.controller-actions-grid__full {
  grid-column: 1 / -1;
}

.controller-stat-card {
  background: linear-gradient(180deg, rgba($primary, 0.1) 0%, rgba($primary, 0.04) 100%);
  border: 1px solid rgba($primary, 0.18);
  color: $body-color;
}

.stat-value {
  font-size: clamp(1.55rem, 3vw, 2rem);
  font-weight: 700;
  line-height: 1.1;
  margin: 0.35rem 0 0.15rem;
}

.controller-results-meta {
  align-items: end;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.5rem;
  justify-content: space-between;
}

.controller-sort-controls {
  align-items: end;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.controller-sort-controls__field {
  min-width: 190px;
}

.controller-sort-controls__toggle {
  min-width: 124px;
}

.controller-filter-card :deep(.input-group-text) {
  padding: 0.35rem 0.55rem;
}

.controller-filter-card :deep(.form-control),
.controller-filter-card :deep(.form-select) {
  min-height: calc(1.5em + 0.55rem + 2px);
}

.controller-loading-state {
  align-items: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 220px;
}

.controller-job-groups {
  display: grid;
  gap: 1rem;
}

.controller-job-group {
  background: $surface;
  border: 1px solid $controller-group-border;
  overflow: hidden;
}

.controller-job-group__header {
  align-items: center;
  background: linear-gradient(180deg, rgba($primary, 0.08) 0%, rgba($primary, 0.02) 100%);
  border-bottom: 1px solid $controller-divider;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.5rem;
  justify-content: space-between;
}

.controller-job-group__summary {
  text-align: right;
}

.controller-timecards-accordion :deep(.timecard-editor-card) {
  border-radius: 0;
  margin-bottom: 0 !important;
}

.controller-creator-group + .controller-creator-group {
  border-top: 1px solid $controller-divider;
}

.controller-creator-group__header {
  align-items: center;
  background: rgba($primary, 0.04);
  border-bottom: 1px solid $controller-divider;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  justify-content: space-between;
  padding: 0.9rem 1rem;
}

.controller-week-badge {
  letter-spacing: 0.01em;
}

@media (max-width: 1199px) {
  .controller-filter-footer {
    grid-template-columns: 1fr;
  }

  .controller-actions-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 991px) {
  .controller-job-group__summary {
    text-align: left;
  }

  .controller-creator-group__header {
    align-items: flex-start;
  }
}

@media (max-width: 575px) {
  .controller-filter-card .panel-header,
  .controller-filter-card__body {
    padding-left: 0.8rem;
    padding-right: 0.8rem;
  }

  .controller-actions-grid {
    grid-template-columns: 1fr;
  }

  .controller-actions-grid__full {
    grid-column: auto;
  }

  .controller-sort-controls {
    width: 100%;
  }

  .controller-sort-controls__field,
  .controller-sort-controls__toggle {
    width: 100%;
  }
}
</style>
