<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import flatPickr from 'vue-flatpickr-component'
import 'flatpickr/dist/flatpickr.css'
import { useRouter } from 'vue-router'
import Toast from '@/components/Toast.vue'
import TimecardEditorCard from '@/components/timecards/TimecardEditorCard.vue'
import { useAuthStore } from '@/stores/auth'
import { useJobsStore } from '@/stores/jobs'
import { usePermissions } from '@/composables/usePermissions'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useSubscriptionRegistry } from '@/composables/useSubscriptionRegistry'
import { markTimecardsSent } from '@/services/Jobs'
import { sendTimecardEmail, subscribeEmailSettings } from '@/services/Email'
import {
  autoGenerateTimecards,
  createTimecard,
  deleteTimecard,
  listTimecardsByJobAndWeek,
  submitAllWeekTimecards,
  updateTimecard,
  watchTimecardsByWeek,
} from '@/services/Timecards'
import { formatWeekRange, getSaturdayFromSunday, snapToSunday } from '@/utils/modelValidation'
import { normalizeError } from '@/services/serviceUtils'
import { validateRequired } from '@/utils/validation'
import { logError, logWarn } from '@/utils'
import { downloadCsv } from '@/utils/plexisIntegration'
import { ROLES, ROUTE_NAMES } from '@/constants/app'
import {
  buildTimecardEmployeeEditorForm,
  calculateRegularAndOvertimeHours,
  createEmptyTimecardEmployeeEditorForm,
  getTimecardDisplayName,
  getTimecardFirstName,
  getTimecardLastName,
  makeDaysArray,
  parseSubcontractedEmployee,
  parseWage,
  recalcTotalsForTimecard,
  type TimecardEmployeeEditorForm,
  type TimecardModel,
} from './timecards/timecardUtils'
import { useTimecardJobEditing } from './timecards/useTimecardJobEditing'

type ToastInstance = ComponentPublicInstance<{ show: (message: string, type?: 'success' | 'error' | 'info' | 'warning', duration?: number) => string; remove: (id: string) => void }>
type FlatpickrOpenHandle = {
  open?: () => void
}
type FlatpickrRefHandle = {
  fp?: FlatpickrOpenHandle
  flatpickr?: FlatpickrOpenHandle
}

const props = defineProps<{ jobId?: string }>()

const router = useRouter()
const auth = useAuthStore()
const jobsStore = useJobsStore()
const permissions = usePermissions()
const { confirm } = useConfirmDialog()
const isAdmin = computed(() => auth.role === ROLES.ADMIN)

const toastRef = ref<ToastInstance | null>(null)
const datePickerRef = ref<FlatpickrRefHandle | null>(null)

const jobId = computed(() => String(props.jobId ?? ''))
const jobName = computed(() => jobsStore.currentJob?.name ?? 'Timecards')
const jobCode = computed(() => jobsStore.currentJob?.code?.trim() ?? '')
const selectedDate = ref<string>('')
const weekStartDate = computed(() => snapToSunday(selectedDate.value || new Date()))
const weekEndingDate = computed(() => getSaturdayFromSunday(weekStartDate.value))
const weekRange = computed(() => formatWeekRange(weekStartDate.value, weekEndingDate.value))

const timecards = ref<TimecardModel[]>([])
const draftTimecards = ref<Map<string, TimecardModel>>(new Map())
const autoSaveTimers = ref<Map<string, ReturnType<typeof setTimeout>>>(new Map())

const showSummaryModal = ref(false)
const printMode = ref<'summary' | 'timecards'>('summary')
const printing = ref(false)
const exportingPlexxis = ref(false)

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

const loading = ref(true)
const saving = ref(false)
const submittingAll = ref(false)
const autoGenerating = ref(false)
const err = ref('')

function setError(error: unknown, fallback: string, showToast = true) {
  err.value = normalizeError(error, fallback)
  if (showToast) {
    toastRef.value?.show(err.value, 'error')
  }
}

const editingTimecardId = ref<string | null>(null)
const expandedId = ref<string | null>(null)
const editForm = ref<TimecardEmployeeEditorForm>(createEmptyTimecardEmployeeEditorForm())

const showCreateForm = ref(false)
const newTimecardForm = ref({ employeeNumber: '', firstName: '', lastName: '', occupation: '', employeeWage: '', subcontractedEmployee: 'no' })

const flatpickrConfig = ref({
  dateFormat: 'Y-m-d',
  disableMobile: true,
  // Use Bootstrap icons instead of default inline SVG path strings
  prevArrow: '<i class="bi bi-chevron-left"></i>',
  nextArrow: '<i class="bi bi-chevron-right"></i>',
})

const allTimecards = computed(() => {
  const drafts = Array.from(draftTimecards.value.values())
  return [...timecards.value, ...drafts].sort((a, b) => a.employeeName.localeCompare(b.employeeName))
})

const summaryRows = computed(() => allTimecards.value.map(tc => ({
  id: tc.id,
  employeeName: tc.employeeName,
  employeeNumber: tc.employeeNumber,
  status: tc.status,
  hours: tc.totals?.hoursTotal ?? 0,
  production: tc.totals?.productionTotal ?? 0,
  lineTotal: tc.totals?.lineTotal ?? 0,
})))

const draftCount = computed(() => allTimecards.value.filter(tc => tc.status === 'draft').length)
const submittedCount = computed(() => allTimecards.value.filter(tc => tc.status === 'submitted').length)
const timecardRecipients = ref<string[]>([])
const subscriptions = useSubscriptionRegistry()

type TimecardIdentityInput = {
  firstName: string
  lastName: string
  employeeNumber: string
}

function validateTimecardIdentity(input: TimecardIdentityInput): string | null {
  const errors = [
    ...validateRequired(input.firstName, 'First name'),
    ...validateRequired(input.lastName, 'Last name'),
    ...validateRequired(input.employeeNumber, 'Employee number'),
  ]
  return errors[0]?.message ?? null
}

function createDraft(): TimecardModel {
  const days = makeDaysArray(weekStartDate.value)
  const firstName = newTimecardForm.value.firstName.trim()
  const lastName = newTimecardForm.value.lastName.trim()
  return {
    id: `temp-${Date.now()}`,
    jobId: jobId.value,
    weekStartDate: weekStartDate.value,
    weekEndingDate: weekEndingDate.value,
    status: 'draft',
    createdByUid: auth.user?.uid ?? '',
    submittedAt: undefined,
    employeeRosterId: '',
    employeeNumber: newTimecardForm.value.employeeNumber,
    employeeName: `${firstName} ${lastName}`.trim(),
    firstName,
    lastName,
    employeeWage: parseWage(newTimecardForm.value.employeeWage),
    subcontractedEmployee: parseSubcontractedEmployee(newTimecardForm.value.subcontractedEmployee),
    regularHoursOverride: null,
    overtimeHoursOverride: null,
    mileage: null,
    occupation: newTimecardForm.value.occupation,
    jobs: [
      {
        jobNumber: '',
        subsectionArea: '',
        area: '',
        account: '',
        acct: '',
        difH: '',
        difP: '',
        difC: '',
        days: makeDaysArray(weekStartDate.value),
      },
    ],
    days,
    totals: {
      hours: Array(7).fill(0),
      production: Array(7).fill(0),
      hoursTotal: 0,
      productionTotal: 0,
      lineTotal: 0,
    },
    notes: '',
    archived: false,
    archivedAt: undefined,
  }
}

function recalcTotals(timecard: TimecardModel) {
  recalcTotalsForTimecard(timecard, weekStartDate.value)
}

async function ensureAccess(): Promise<boolean> {
  try {
    if (!auth.ready) await auth.init()
    if (!permissions.canAccessJob.value) {
      await router.push({ name: ROUTE_NAMES.UNAUTHORIZED })
      return false
    }
    jobsStore.subscribeJob(jobId.value)
    return true
  } catch (e) {
    setError(e, 'Failed to load job')
    return false
  }
}

async function loadTimecards() {
  subscriptions.clear('timecards')
  loading.value = true
  err.value = ''
  try {
    subscriptions.replace('timecards', watchTimecardsByWeek(
      jobId.value,
      weekEndingDate.value,
      (snapshotTimecards) => {
        const normalized = (snapshotTimecards as TimecardModel[]).map((timecard) => {
          recalcTotals(timecard)
          return timecard
        })
        timecards.value = normalized
        loading.value = false
      },
      (listenerError) => {
        setError(listenerError, 'Failed to subscribe to timecards')
        loading.value = false
      }
    ))
  } catch (e) {
    setError(e, 'Failed to load timecards')
    loading.value = false
  }
}

async function init() {
  loading.value = true
  err.value = ''
  try {
    const today = new Date().toISOString().slice(0, 10)
    selectedDate.value = today
    if (!await ensureAccess()) return

    subscriptions.replace('email-settings', subscribeEmailSettings(
      (settings) => {
        timecardRecipients.value = settings.timecardSubmitRecipients ?? []
      },
      (recipientErr) => {
        logWarn('Timecards', 'Failed to subscribe to timecard email recipients', recipientErr)
        timecardRecipients.value = []
      }
    ))

    await loadTimecards()
  } catch (e) {
    setError(e, 'Failed to initialize')
  } finally {
    loading.value = false
  }
}

async function refreshWeek(dateStr: string) {
  selectedDate.value = dateStr
  const drafts = Array.from(draftTimecards.value.values())
  for (const draft of drafts) {
    if (draft.id.startsWith('temp-')) {
      try {
        await saveTimecard(draft, false)
      } catch (e) {
        logError('Timecards', 'Failed to save draft before switching weeks', e)
      }
    }
  }
  draftTimecards.value.clear()
  editingTimecardId.value = null
  showCreateForm.value = false
  err.value = ''
  await loadTimecards()
}

function openDatePicker() {
  const picker = datePickerRef.value?.fp || datePickerRef.value?.flatpickr
  if (picker?.open) picker.open()
}

function handleTimecardToggle(id: string, open: boolean) {
  expandedId.value = open ? id : null
}

function onDateChange(_dates: Date[], dateStr: string) {
  if (dateStr) {
    void refreshWeek(dateStr)
  }
}

function onDateInputFocus() {
  openDatePicker()
}

function startCreateTimecard() {
  newTimecardForm.value = { employeeNumber: '', firstName: '', lastName: '', occupation: '', employeeWage: '', subcontractedEmployee: 'no' }
  showCreateForm.value = true
}

function cancelCreateTimecard() {
  showCreateForm.value = false
}

function confirmCreateTimecard() {
  const validationMessage = validateTimecardIdentity({
    firstName: newTimecardForm.value.firstName,
    lastName: newTimecardForm.value.lastName,
    employeeNumber: newTimecardForm.value.employeeNumber,
  })
  if (validationMessage) {
    toastRef.value?.show(validationMessage, 'error')
    return
  }
  newTimecardForm.value.firstName = newTimecardForm.value.firstName.trim()
  newTimecardForm.value.lastName = newTimecardForm.value.lastName.trim()
  newTimecardForm.value.employeeNumber = newTimecardForm.value.employeeNumber.trim()
  newTimecardForm.value.occupation = newTimecardForm.value.occupation.trim()
  const draft = createDraft()
  draftTimecards.value.set(draft.id, draft)
  editingTimecardId.value = null
  editForm.value = createEmptyTimecardEmployeeEditorForm()
  expandedId.value = draft.id
  showCreateForm.value = false
}

function autoSave(timecard: TimecardModel) {
  const existing = autoSaveTimers.value.get(timecard.id)
  if (existing) clearTimeout(existing)
  const timer = setTimeout(() => {
    saveTimecard(timecard, false)
    autoSaveTimers.value.delete(timecard.id)
  }, 500)
  autoSaveTimers.value.set(timecard.id, timer)
}

async function saveTimecard(timecard: TimecardModel, showToast = true) {
  saving.value = true
  err.value = ''
  try {
    recalcTotals(timecard)
    const previousId = timecard.id
    if (timecard.id.startsWith('temp-')) {
      const id = await createTimecard(jobId.value, {
        weekEndingDate: timecard.weekEndingDate,
        employeeRosterId: '',
        firstName: timecard.firstName,
        lastName: timecard.lastName,
        employeeNumber: timecard.employeeNumber,
        employeeName: timecard.employeeName,
        employeeWage: timecard.employeeWage,
        subcontractedEmployee: timecard.subcontractedEmployee ?? false,
        regularHoursOverride: timecard.regularHoursOverride ?? null,
        overtimeHoursOverride: timecard.overtimeHoursOverride ?? null,
        mileage: timecard.mileage ?? null,
        occupation: timecard.occupation,
        jobs: timecard.jobs || [],
        days: timecard.days,
        notes: timecard.notes,
      })
      draftTimecards.value.delete(timecard.id)
      timecard.id = id
      expandedId.value = expandedId.value === previousId ? id : expandedId.value
      editingTimecardId.value = editingTimecardId.value === previousId ? id : editingTimecardId.value
      draftTimecards.value.delete(id)
      if (!timecards.value.find(t => t.id === id)) timecards.value.push(timecard)
      if (showToast) toastRef.value?.show(`Created timecard for ${timecard.employeeName}`, 'success')
    } else if (timecards.value.find(t => t.id === timecard.id)) {
      await updateTimecard(jobId.value, timecard.id, {
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
      if (showToast) toastRef.value?.show(`Updated timecard for ${timecard.employeeName}`, 'success')
    } else {
      const id = await createTimecard(jobId.value, {
        weekEndingDate: timecard.weekEndingDate,
        employeeRosterId: '',
        firstName: timecard.firstName,
        lastName: timecard.lastName,
        employeeNumber: timecard.employeeNumber,
        employeeName: timecard.employeeName,
        employeeWage: timecard.employeeWage,
        subcontractedEmployee: timecard.subcontractedEmployee ?? false,
        regularHoursOverride: timecard.regularHoursOverride ?? null,
        overtimeHoursOverride: timecard.overtimeHoursOverride ?? null,
        mileage: timecard.mileage ?? null,
        occupation: timecard.occupation,
        jobs: timecard.jobs || [],
        days: timecard.days,
        notes: timecard.notes,
      })
      timecard.id = id
      expandedId.value = expandedId.value === previousId ? id : expandedId.value
      editingTimecardId.value = editingTimecardId.value === previousId ? id : editingTimecardId.value
      draftTimecards.value.delete(id)
      if (!timecards.value.find(t => t.id === id)) timecards.value.push(timecard)
      if (showToast) toastRef.value?.show(`Created timecard for ${timecard.employeeName}`, 'success')
    }
  } catch (e) {
    setError(e, 'Failed to save timecard', showToast)
  } finally {
    saving.value = false
  }
}

async function handleDeleteTimecard(timecardId: string, employeeName: string) {
  const confirmed = await confirm(`Delete timecard for ${employeeName}?`, {
    title: 'Delete Timecard',
    confirmText: 'Delete',
    variant: 'danger',
  })
  if (!confirmed) return
  saving.value = true
  err.value = ''
  try {
    await deleteTimecard(jobId.value, timecardId)
    draftTimecards.value.delete(timecardId)
    toastRef.value?.show(`Deleted timecard for ${employeeName}`, 'success')
  } catch (e) {
    setError(e, 'Failed to delete timecard')
  } finally {
    saving.value = false
  }
}

async function submitAllTimecards() {
  const confirmed = await confirm(`Submit all timecards for the week of ${weekRange.value}?`, {
    title: 'Submit Timecards',
    confirmText: 'Submit',
    variant: 'warning',
  })
  if (!confirmed) return
  submittingAll.value = true
  err.value = ''
  try {
    const drafts = allTimecards.value.filter(tc => tc.status === 'draft')
    for (const draft of drafts) {
      if (draft.id.startsWith('temp-')) await saveTimecard(draft, false)
    }
    const count = await submitAllWeekTimecards(jobId.value, weekEndingDate.value)
    toastRef.value?.show(`Submitted ${count} timecard(s)`, 'success')
    if (timecardRecipients.value.length) {
      try {
        const submitted = await listTimecardsByJobAndWeek(jobId.value, weekEndingDate.value)
        const submittedIds = submitted.filter(tc => tc.status === 'submitted').map(tc => tc.id)
        if (submittedIds.length) {
          await sendTimecardEmail(jobId.value, submittedIds, weekStartDate.value, timecardRecipients.value)
          toastRef.value?.show(`Timecards emailed to ${timecardRecipients.value.length} recipient(s)`, 'success')
        } else {
          toastRef.value?.show('No submitted timecards to email', 'info')
        }
      } catch (emailErr) {
        logError('Timecards', 'Failed to send timecard email', emailErr)
        toastRef.value?.show('Timecards submitted, but email failed to send', 'warning')
      }
    }
    if (isAdmin.value) {
      await markTimecardsSent(jobId.value, weekEndingDate.value)
    }
    draftTimecards.value.clear()
  } catch (e) {
    setError(e, 'Failed to submit timecards')
  } finally {
    submittingAll.value = false
  }
}

function openSummary() {
  showSummaryModal.value = true
}

function closeSummary() {
  if (printing.value) return
  showSummaryModal.value = false
}

function startPrint(mode: 'summary' | 'timecards') {
  if (printing.value) return
  printMode.value = mode
  printing.value = true
  requestAnimationFrame(() => {
    window.print()
  })
}

function printSummary() {
  startPrint('summary')
}

function printTimecardsTwoPerPage() {
  showSummaryModal.value = false
  startPrint('timecards')
}

function onAfterPrint() {
  printing.value = false
}

async function generateFromPreviousWeek() {
  autoGenerating.value = true
  err.value = ''
  try {
    const newIds = await autoGenerateTimecards(jobId.value, weekEndingDate.value)
    if (newIds.length > 0) {
      toastRef.value?.show(`Generated ${newIds.length} timecard(s) from previous week`, 'success')
    } else {
      toastRef.value?.show('No timecards in previous week to copy', 'info')
    }
  } catch (e) {
    setError(e, 'Failed to generate timecards')
  } finally {
    autoGenerating.value = false
  }
}

function getHoursBreakdown(timecard: TimecardModel): { regularHours: number; overtimeHours: number } {
  return calculateRegularAndOvertimeHours(
    timecard.totals?.hoursTotal ?? 0,
    null,
    null
  )
}

function formatHours(value: number | null | undefined): string {
  const numeric = Number(value ?? 0)
  if (!Number.isFinite(numeric) || Number.isNaN(numeric)) return '0.00'
  return numeric.toFixed(2)
}

function parseMileageInput(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed < 0) return null
  return parsed
}

function updateMileage(timecard: TimecardModel, rawValue: string) {
  timecard.mileage = parseMileageInput(rawValue)
  autoSave(timecard)
}

function formatPlexxisDate(dateString: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((dateString || '').trim())
  if (!match) return dateString
  const [, year, month, day] = match
  return `${Number(month)}/${Number(day)}/${year}`
}

function formatPlexxisEmployeeName(timecard: TimecardModel): string {
  const firstName = getTimecardFirstName(timecard).trim()
  const lastName = getTimecardLastName(timecard).trim()

  if (lastName && firstName) return `${lastName}, ${firstName}`
  if (lastName) return lastName
  if (firstName) return firstName

  const displayName = (timecard.employeeName || '').trim()
  return displayName
}

function formatPlexxisNumber(value: number | null | undefined, blankWhenZero = false): string {
  const numeric = Number(value ?? 0)
  if (!Number.isFinite(numeric) || Number.isNaN(numeric)) return ''
  if (blankWhenZero && numeric === 0) return ''
  return numeric.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')
}

function shouldCopyActivityToCostCode(activityCode: string): boolean {
  return /[A-Za-z-]/.test(activityCode)
}

function formatCsvValue(value: string | number | null | undefined): string {
  const text = String(value ?? '')
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function toCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const header = headers.map(formatCsvValue).join(',')
  const body = rows.map((row) => row.map(formatCsvValue).join(','))
  return [header, ...body].join('\r\n')
}

function sumJobDayMetric(timecard: TimecardModel, jobIndex: number, field: 'hours' | 'production' | 'lineTotal'): number {
  const job = timecard.jobs?.[jobIndex]
  if (!job?.days?.length) return 0
  return job.days.reduce((sum, day) => sum + Number(day?.[field] ?? 0), 0)
}

function buildPlexxisRows(timecard: TimecardModel): string[][] {
  const jobRows = timecard.jobs?.length ? timecard.jobs : [null]

  return jobRows
    .map((job) => {
      const totalHours = job
        ? job.days?.reduce((sum, day) => sum + Number(day?.hours ?? 0), 0) ?? 0
        : Number(timecard.totals?.hoursTotal ?? 0)
      const totalProduction = job
        ? job.days?.reduce((sum, day) => sum + Number(day?.production ?? 0), 0) ?? 0
        : Number(timecard.totals?.productionTotal ?? 0)
      const subSection = (job?.subsectionArea ?? job?.area ?? job?.jobNumber ?? '').trim()
      const activityCode = (job?.account ?? job?.acct ?? '').trim()
      const hasData = totalHours > 0 || totalProduction > 0 || !!subSection || !!activityCode

      if (!hasData) return null

      const costCode = shouldCopyActivityToCostCode(activityCode) ? activityCode : ''
      const rowJobCode = (jobCode.value || job?.jobNumber || '').trim()

      return [
        formatPlexxisEmployeeName(timecard),
        (timecard.employeeNumber || '').trim(),
        rowJobCode,
        formatPlexxisDate(timecard.weekEndingDate),
        subSection,
        activityCode,
        costCode,
        formatPlexxisNumber(totalHours, true),
        formatPlexxisNumber(totalProduction, true),
        '',
        '',
      ]
    })
    .filter((row): row is string[] => row !== null)
}

async function exportPlexxisCsv() {
  if (exportingPlexxis.value) return
  exportingPlexxis.value = true
  err.value = ''
  try {
    const weekTimecards = (await listTimecardsByJobAndWeek(jobId.value, weekEndingDate.value)) as TimecardModel[]
    const submitted = weekTimecards.filter(tc => tc.status === 'submitted')

    if (!submitted.length) {
      toastRef.value?.show('No submitted timecards to export for this week', 'info')
      return
    }

    const headers = [
      'Employee Name',
      'Employee Code',
      'Job Code',
      'DETAIL_DATE',
      'Sub-Section',
      'Activity Code',
      'Cost Code',
      'H_Hours',
      'P_HOURS',
      '',
      '',
    ]

    const rows = submitted.flatMap(buildPlexxisRows)
    const filename = `plexxis-timecards-${jobId.value}-${weekEndingDate.value}.csv`
    const spacerRow = Array(headers.length).fill('')
    downloadCsv(toCsv(headers, [spacerRow, ...rows]), filename)
    toastRef.value?.show(`Exported ${rows.length} Plexxis row(s)`, 'success')
  } catch (e) {
    setError(e, 'Failed to export Plexxis CSV')
  } finally {
    exportingPlexxis.value = false
  }
}

function startEditingEmployee(timecard: TimecardModel) {
  editingTimecardId.value = timecard.id
  editForm.value = buildTimecardEmployeeEditorForm(timecard)
}

function toggleEditingEmployee(timecard: TimecardModel) {
  if (editingTimecardId.value === timecard.id) {
    confirmEditingEmployee(timecard)
  } else {
    startEditingEmployee(timecard)
  }
}

function confirmEditingEmployee(timecard: TimecardModel) {
  const validationMessage = validateTimecardIdentity({
    firstName: editForm.value.firstName,
    lastName: editForm.value.lastName,
    employeeNumber: editForm.value.employeeNumber,
  })
  if (validationMessage) {
    toastRef.value?.show(validationMessage, 'error')
    return
  }
  timecard.employeeNumber = editForm.value.employeeNumber.trim()
  timecard.firstName = editForm.value.firstName.trim()
  timecard.lastName = editForm.value.lastName.trim()
  timecard.employeeName = `${timecard.firstName} ${timecard.lastName}`
  timecard.employeeWage = parseWage(editForm.value.employeeWage)
  timecard.subcontractedEmployee = parseSubcontractedEmployee(editForm.value.subcontractedEmployee)
  timecard.occupation = editForm.value.occupation.trim()
  recalcTotals(timecard)
  autoSave(timecard)
  editingTimecardId.value = null
}

function handleNotesInput(timecard: TimecardModel, value: string) {
  timecard.notes = value
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
  getWeekStartDate: () => weekStartDate.value,
  recalcTotals,
  autoSave,
})

onMounted(() => {
  window.addEventListener('afterprint', onAfterPrint)
  void init()
})
watch(
  () => jobId.value,
  (next, prev) => {
    if (!next || next === prev) return
    void init()
  }
)
onUnmounted(() => {
  window.removeEventListener('afterprint', onAfterPrint)
  subscriptions.clearAll()
  jobsStore.stopCurrentJobSubscription()
  autoSaveTimers.value.forEach(timer => clearTimeout(timer))
  autoSaveTimers.value.clear()
})
</script>

<template>
  <div :class="['timecards-page', `print-mode-${printMode}`]">
    <Toast ref="toastRef" />

    <div class="container-fluid py-4 wide-container-1200">
      <div class="mb-4 d-flex justify-content-between align-items-center">
        <div>
          <h2 class="h4 mb-1">{{ jobName }}</h2>
          <small class="text-muted">{{ weekRange }}</small>
        </div>
        <div class="d-flex gap-2">
          <button
            class="btn btn-outline-secondary btn-sm"
            title="Copy timecards from previous week"
            :disabled="autoGenerating || loading"
            @click="generateFromPreviousWeek"
          >
            <i class="bi bi-arrow-repeat me-1"></i>
            {{ autoGenerating ? 'Generating...' : 'Previous Week' }}
          </button>
        </div>
      </div>

      <div v-if="err" class="alert alert-danger alert-dismissible fade show mb-4">
        <strong>Error:</strong> {{ err }}
        <button type="button" class="btn-close" aria-label="Dismiss error" @click="err = ''"></button>
      </div>

      <div v-if="loading" class="text-center py-5">
        <div class="spinner-border text-primary mb-3" role="status" aria-live="polite">
          <span class="visually-hidden">Loading timecards</span>
        </div>
        <p class="text-muted">Loading timecards...</p>
      </div>

      <div v-else>
        <div class="timecards-toolbar mb-3">
          <div class="container-fluid wide-container-1200">
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div class="d-flex gap-2 flex-wrap">
                <button class="btn btn-primary btn-sm" :disabled="loading || showCreateForm" @click="startCreateTimecard">
                  <i class="bi bi-plus-circle me-1"></i>
                  Create New
                </button>
                <div class="input-group input-group-sm date-input-group">
                  <flat-pickr
                    ref="datePickerRef"
                    v-model="selectedDate"
                    :config="flatpickrConfig"
                    @on-change="onDateChange"
                    @focus="onDateInputFocus"
                    class="form-control date-input"
                    aria-label="Select week date"
                  />
                  <button
                    type="button"
                    class="btn btn-outline-secondary"
                    @click="openDatePicker"
                    title="Open date picker"
                    aria-label="Open date picker"
                  >
                    <i class="bi bi-calendar3"></i>
                  </button>
                </div>
                <div class="text-muted small ms-1 align-self-center">
                  Week ending Saturday: {{ weekEndingDate }}
                </div>
              </div>

              <div class="d-flex gap-2 align-items-center">
                <button
                  class="btn btn-outline-secondary btn-sm"
                  :disabled="loading || allTimecards.length === 0"
                  @click="openSummary"
                >
                  <i class="bi bi-clipboard-data me-1"></i>
                  Summary
                </button>
                <button
                  class="btn btn-outline-primary btn-sm"
                  :disabled="loading || allTimecards.length === 0 || printing"
                  @click="printTimecardsTwoPerPage"
                >
                  <i class="bi bi-printer me-1"></i>
                  Print Timecards (2/Page)
                </button>
                <button
                  class="btn btn-outline-success btn-sm"
                  :disabled="loading || exportingPlexxis"
                  @click="exportPlexxisCsv"
                >
                  <i class="bi bi-download me-1"></i>
                  {{ exportingPlexxis ? 'Exporting...' : 'Plexxis CSV' }}
                </button>
                <span class="small text-muted">
                  <span class="badge bg-warning text-dark">{{ draftCount }} Draft</span>
                  <span class="badge bg-success ms-2">{{ submittedCount }} Submitted</span>
                </span>
                <button
                  class="btn btn-success btn-sm"
                  :disabled="submittingAll || loading || draftCount === 0"
                  @click="submitAllTimecards"
                >
                  <i class="bi bi-send me-1"></i>
                  {{ submittingAll ? 'Submitting...' : `Submit All (${draftCount})` }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="allTimecards.length === 0" class="alert alert-info text-center">
          <i class="bi bi-inbox me-2"></i>No timecards yet.
        </div>

        <div v-else class="timecards-accordion">
          <TimecardEditorCard
            v-for="timecard in allTimecards"
            :key="timecard.id"
            v-model:edit-form="editForm"
            :item-key="timecard.id"
            :timecard="timecard"
            :open="expandedId === timecard.id"
            :is-editing="editingTimecardId === timecard.id"
            :is-admin="isAdmin"
            :job-fields-locked="timecard.status === 'submitted'"
            :notes-locked="timecard.status === 'submitted'"
            :edit-disabled="timecard.status === 'submitted' && !isAdmin"
            :delete-disabled="timecard.status === 'submitted'"
            :mileage-disabled="timecard.status === 'submitted' && !isAdmin"
            @update:open="(open) => handleTimecardToggle(timecard.id, open)"
            @toggle-edit="toggleEditingEmployee(timecard)"
            @delete="handleDeleteTimecard(timecard.id, timecard.employeeName)"
            @add-job-row="addJobRow(timecard)"
            @remove-job-row="(jobIndex) => removeJobRow(timecard, jobIndex)"
            @update-job-number="({ jobIndex, value }) => updateJobNumber(timecard, jobIndex, value)"
            @update-subsection-area="({ jobIndex, value }) => updateSubsectionArea(timecard, jobIndex, value)"
            @update-account="({ jobIndex, value }) => updateAccount(timecard, jobIndex, value)"
            @update-diff-value="({ jobIndex, field, value }) => updateDiffValue(timecard, jobIndex, field, value)"
            @update-hours="({ jobIndex, dayIndex, value }) => handleHoursInput(timecard, jobIndex, dayIndex, value)"
            @update-production="({ jobIndex, dayIndex, value }) => handleProductionInput(timecard, jobIndex, dayIndex, value)"
            @update-mileage="(value) => updateMileage(timecard, value)"
            @update-notes="(value) => handleNotesInput(timecard, value)"
          />
        </div>
      </div>
    </div>

    <div
      v-if="showCreateForm"
      class="position-fixed top-0 start-0 end-0 bottom-0 d-flex align-items-center justify-content-center bg-dark bg-opacity-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-timecard-title"
      tabindex="-1"
      @keydown.esc="cancelCreateTimecard"
    >
      <div class="card border-0 shadow-lg modal-card">
        <div class="card-header bg-primary text-white">
          <h5 id="create-timecard-title" class="mb-0">Create New Timecard</h5>
        </div>
        <form class="card-body" @submit.prevent="confirmCreateTimecard">
          <div class="mb-3">
            <label class="form-label" for="tc-create-employee-number">Employee Number *</label>
            <input
              id="tc-create-employee-number"
              v-model="newTimecardForm.employeeNumber"
              type="text"
              class="form-control"
              placeholder="e.g., 1234"
              autocomplete="off"
              autofocus
            />
          </div>
          <div class="row g-2 mb-3">
            <div class="col-6">
              <label class="form-label" for="tc-create-first-name">First Name *</label>
              <input id="tc-create-first-name" v-model="newTimecardForm.firstName" type="text" class="form-control" placeholder="First" autocomplete="given-name" />
            </div>
            <div class="col-6">
              <label class="form-label" for="tc-create-last-name">Last Name *</label>
              <input id="tc-create-last-name" v-model="newTimecardForm.lastName" type="text" class="form-control" placeholder="Last" autocomplete="family-name" />
            </div>
          </div>
          <div class="mb-4">
            <label class="form-label" for="tc-create-occupation">Occupation</label>
            <input id="tc-create-occupation" v-model="newTimecardForm.occupation" type="text" class="form-control" placeholder="e.g., Carpenter" />
          </div>
          <div class="mb-4">
            <label class="form-label" for="tc-create-wage">Wage</label>
            <input id="tc-create-wage" v-model="newTimecardForm.employeeWage" type="number" min="0" step="0.01" class="form-control" placeholder="e.g., 28.50" />
          </div>
          <div class="mb-4">
            <label class="form-label" for="tc-create-subcontracted">Subcontracted Employee</label>
            <select id="tc-create-subcontracted" v-model="newTimecardForm.subcontractedEmployee" class="form-select">
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
          <div class="d-flex gap-2">
            <button type="submit" class="btn btn-primary">Create</button>
            <button type="button" class="btn btn-secondary" @click="cancelCreateTimecard">Cancel</button>
          </div>
        </form>
      </div>
    </div>

    <section class="print-output print-output--summary" aria-hidden="true">
      <h2 class="print-title">{{ jobName }} - Timecard Summary</h2>
      <div class="print-subtitle">Week Ending {{ weekEndingDate }}</div>
      <table class="print-summary-table">
        <thead>
          <tr>
            <th>Employee</th>
            <th>Employee #</th>
            <th>Status</th>
            <th class="text-end">Hours</th>
            <th class="text-end">Production</th>
            <th class="text-end">Line Total</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in summaryRows" :key="`print-summary-${row.id}`">
            <td>{{ row.employeeName }}</td>
            <td>{{ row.employeeNumber }}</td>
            <td>{{ row.status }}</td>
            <td class="text-end">{{ formatHours(row.hours) }}</td>
            <td class="text-end">{{ formatHours(row.production) }}</td>
            <td class="text-end">${{ formatHours(row.lineTotal) }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="print-output print-output--timecards" aria-hidden="true">
      <article v-for="timecard in allTimecards" :key="`print-card-${timecard.id}`" class="print-timecard-card">
        <header class="print-card-header">
          <h3>{{ getTimecardDisplayName(timecard) }}</h3>
          <div class="print-card-meta">
            <span>Employee #: {{ timecard.employeeNumber || '-' }}</span>
            <span>Week Ending: {{ timecard.weekEndingDate }}</span>
          </div>
          <div class="print-card-meta">
            <span>Occupation: {{ timecard.occupation || '-' }}</span>
            <span>Wage: ${{ formatHours(timecard.employeeWage ?? 0) }}</span>
          </div>
        </header>

        <table class="print-day-table">
          <thead>
            <tr>
              <th>Day</th>
              <th class="text-end">Hours</th>
              <th class="text-end">Production</th>
              <th class="text-end">Unit Cost</th>
              <th class="text-end">Line Total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(dayName, dayIdx) in DAY_NAMES" :key="`print-day-${timecard.id}-${dayIdx}`">
              <td>{{ dayName }}</td>
              <td class="text-end">{{ formatHours(timecard.days?.[dayIdx]?.hours ?? 0) }}</td>
              <td class="text-end">{{ formatHours(timecard.days?.[dayIdx]?.production ?? 0) }}</td>
              <td class="text-end">${{ formatHours(timecard.days?.[dayIdx]?.unitCost ?? 0) }}</td>
              <td class="text-end">${{ formatHours(timecard.days?.[dayIdx]?.lineTotal ?? 0) }}</td>
            </tr>
          </tbody>
        </table>

        <table v-if="timecard.jobs?.length" class="print-job-table">
          <thead>
            <tr>
              <th>Job #</th>
              <th>Subsection/Area</th>
              <th>Account</th>
              <th class="text-end">Hours</th>
              <th class="text-end">Production</th>
              <th class="text-end">Line Total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(job, jobIdx) in timecard.jobs" :key="`print-job-${timecard.id}-${jobIdx}`">
              <td>{{ job.jobNumber || '-' }}</td>
              <td>{{ job.subsectionArea || job.area || '-' }}</td>
              <td>{{ job.account || job.acct || '-' }}</td>
              <td class="text-end">{{ formatHours(sumJobDayMetric(timecard, jobIdx, 'hours')) }}</td>
              <td class="text-end">{{ formatHours(sumJobDayMetric(timecard, jobIdx, 'production')) }}</td>
              <td class="text-end">${{ formatHours(sumJobDayMetric(timecard, jobIdx, 'lineTotal')) }}</td>
            </tr>
          </tbody>
        </table>

        <div class="print-card-footer">
          <div>Total Hours: {{ formatHours(timecard.totals.hoursTotal ?? 0) }}</div>
          <div>Regular: {{ formatHours(getHoursBreakdown(timecard).regularHours) }}</div>
          <div>OT: {{ formatHours(getHoursBreakdown(timecard).overtimeHours) }}</div>
          <div>Mileage: {{ formatHours(timecard.mileage ?? 0) }}</div>
          <div>Total Production: {{ formatHours(timecard.totals.productionTotal ?? 0) }}</div>
          <div>Line Total: ${{ formatHours(timecard.totals.lineTotal ?? 0) }}</div>
        </div>
      </article>
    </section>
  </div>

  <!-- Timecard Summary Modal (Printable) -->
  <div
    v-if="showSummaryModal"
    class="modal d-block bg-dark bg-opacity-50"
    role="dialog"
    aria-modal="true"
    aria-labelledby="timecard-summary-title"
    tabindex="-1"
    @keydown.esc="closeSummary"
  >
    <div class="modal-dialog modal-lg">
      <div class="modal-content" id="timecard-summary">
        <div class="modal-header">
          <h5 id="timecard-summary-title" class="modal-title">Timecard Summary - Week ending {{ weekEndingDate }}</h5>
          <button type="button" class="btn-close" aria-label="Close summary" @click="closeSummary" :disabled="printing"></button>
        </div>
        <div class="modal-body">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <div class="text-muted small">{{ weekRange }}</div>
            <button class="btn btn-outline-primary btn-sm" @click="printSummary" :disabled="printing">
              <i class="bi bi-printer me-1"></i>Print
            </button>
          </div>
          <div class="table-responsive">
            <table class="table table-sm table-striped align-middle summary-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>#</th>
                  <th class="text-center">Status</th>
                  <th class="text-end">Hours</th>
                  <th class="text-end">Production</th>
                  <th class="text-end">Line Total</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in summaryRows" :key="row.id">
                  <td>{{ row.employeeName }}</td>
                  <td class="text-muted">{{ row.employeeNumber }}</td>
                  <td class="text-center">
                    <span :class="['badge', row.status === 'submitted' ? 'text-bg-success' : 'text-bg-warning text-dark']">
                      {{ row.status }}
                    </span>
                  </td>
                  <td class="text-end">{{ row.hours.toFixed(2) }}</td>
                  <td class="text-end">{{ row.production.toFixed(2) }}</td>
                  <td class="text-end">{{ row.lineTotal.toFixed(2) }}</td>
                </tr>
              </tbody>
              <tfoot v-if="summaryRows.length">
                <tr class="fw-semibold">
                  <td colspan="3" class="text-end">Totals</td>
                  <td class="text-end">{{ summaryRows.reduce((s, r) => s + r.hours, 0).toFixed(2) }}</td>
                  <td class="text-end">{{ summaryRows.reduce((s, r) => s + r.production, 0).toFixed(2) }}</td>
                  <td class="text-end">{{ summaryRows.reduce((s, r) => s + r.lineTotal, 0).toFixed(2) }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="closeSummary" :disabled="printing">Close</button>
          <button type="button" class="btn btn-primary" @click="printSummary" :disabled="printing">
            <i class="bi bi-printer me-1"></i>Print
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;

input[type='number'] {
  appearance: textfield;
  -moz-appearance: textfield;
}

input[type='number']::-webkit-outer-spin-button,
input[type='number']::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.date-input::-webkit-calendar-picker-indicator {
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;
}

.date-input {
  -webkit-appearance: none;
  appearance: none;
}

.form-control {
  border-radius: 0;
  padding: 0.25rem 0.5rem;
}

.form-control:focus {
  border-radius: 0;
}

textarea.form-control {
  border-radius: 0;
}

.summary-table th,
.summary-table td {
  padding: 0.5rem 0.55rem;
}

.timecards-toolbar {
  background: $surface;
  border: 1px solid $border-color;
  padding: 0.75rem 0.5rem;
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.1);
}

.timecards-page {
  background: $body-bg;
  min-height: 100vh;
  padding-bottom: 1.5rem;
}

.timecards-accordion :deep(.timecard-editor-card) {
  margin-bottom: 0 !important;
  border-radius: 0;
}

.timecards-accordion :deep(.timecard-editor-card:first-child) {
  border-top-left-radius: var(--bs-border-radius);
  border-top-right-radius: var(--bs-border-radius);
}

.timecards-accordion :deep(.timecard-editor-card:last-child) {
  border-bottom-left-radius: var(--bs-border-radius);
  border-bottom-right-radius: var(--bs-border-radius);
}

.date-input-group {
  max-width: 210px;
}

.print-output {
  display: none;
}

@media (max-width: 768px) {
  .timecards-accordion :deep(.timecard-editor-card) {
    border-radius: 0;
  }
}

.modal-card {
  max-width: 500px;
  width: 100%;
  margin: 0 20px;
}

@media print {
  @page {
    margin: 0.35in;
  }

  .timecards-page {
    background: #fff;
    min-height: auto;
    padding: 0;
  }

  .timecards-page > .container-fluid,
  .timecards-page > .modal,
  .timecards-page > .position-fixed {
    display: none !important;
  }

  .print-output {
    display: none !important;
    color: #000;
  }

  .print-mode-summary .print-output--summary {
    display: block !important;
    font-size: 11px;
  }

  .print-mode-timecards .print-output--timecards {
    display: flex !important;
    flex-wrap: wrap;
    gap: 0.2in;
    align-content: flex-start;
  }

  .print-title {
    font-size: 16px;
    margin: 0 0 0.05in;
  }

  .print-subtitle {
    font-size: 11px;
    margin-bottom: 0.15in;
  }

  .print-summary-table,
  .print-day-table,
  .print-job-table {
    width: 100%;
    border-collapse: collapse;
  }

  .print-summary-table th,
  .print-summary-table td,
  .print-day-table th,
  .print-day-table td,
  .print-job-table th,
  .print-job-table td {
    border: 1px solid #000;
    padding: 3px 4px;
    vertical-align: middle;
  }

  .print-timecard-card {
    width: calc(50% - 0.1in);
    border: 1px solid #000;
    padding: 0.12in;
    break-inside: avoid;
    page-break-inside: avoid;
    font-size: 10px;
  }

  .print-timecard-card:nth-child(2n) {
    break-after: page;
    page-break-after: always;
  }

  .print-timecard-card:last-child {
    break-after: auto;
    page-break-after: auto;
  }

  .print-card-header h3 {
    font-size: 12px;
    margin: 0 0 0.03in;
  }

  .print-card-meta {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    margin-bottom: 0.03in;
    gap: 0.08in;
  }

  .print-job-table {
    margin-top: 0.08in;
  }

  .print-card-footer {
    margin-top: 0.08in;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2px 8px;
    font-size: 10px;
  }
}
</style>

