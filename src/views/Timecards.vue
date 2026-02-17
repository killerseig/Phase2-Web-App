<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import flatPickr from 'vue-flatpickr-component'
import 'flatpickr/dist/flatpickr.css'
import { useRoute, useRouter } from 'vue-router'
import Toast from '@/components/Toast.vue'
import BaseAccordionCard from '@/components/common/BaseAccordionCard.vue'
import { useAuthStore } from '@/stores/auth'
import { useJobsStore } from '@/stores/jobs'
import { usePermissions } from '@/composables/usePermissions'
import { markTimecardsSent } from '@/services/Jobs'
import { getEmailSettings, sendTimecardEmail } from '@/services/Email'
import {
  autoGenerateTimecards,
  createTimecard,
  deleteTimecard,
  listTimecardsByJobAndWeek,
  submitAllWeekTimecards,
  submitTimecard,
  updateTimecard,
} from '@/services/Timecards'
import { formatWeekRange, getSaturdayFromSunday, snapToSunday } from '@/utils/modelValidation'
import type { Timecard, TimecardDay, TimecardJobEntry, TimecardTotals } from '@/types/models'

type ToastInstance = ComponentPublicInstance<{ show: (message: string, type?: 'success' | 'error' | 'info' | 'warning', duration?: number) => string; remove: (id: string) => void }>

type TimecardJobUi = TimecardJobEntry & { difH?: string; difP?: string; difC?: string }

interface TimecardModel extends Timecard {
  jobs?: TimecardJobUi[]
  totals: TimecardTotals
}

const props = defineProps<{ jobId?: string }>()

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const jobsStore = useJobsStore()
const permissions = usePermissions()
const isAdmin = computed(() => auth.role === 'admin')

const toastRef = ref<ToastInstance | null>(null)
const datePickerRef = ref<any>(null)

const jobId = computed(() => String(props.jobId ?? route.params.jobId))
const jobName = computed(() => jobsStore.currentJob?.name ?? 'Timecards')
const selectedDate = ref<string>('')
const weekStartDate = computed(() => snapToSunday(selectedDate.value || new Date()))
const weekEndingDate = computed(() => getSaturdayFromSunday(weekStartDate.value))
const weekRange = computed(() => formatWeekRange(weekStartDate.value, weekEndingDate.value))

const timecards = ref<TimecardModel[]>([])
const draftTimecards = ref<Map<string, TimecardModel>>(new Map())
const autoSaveTimers = ref<Map<string, ReturnType<typeof setTimeout>>>(new Map())

const showSummaryModal = ref(false)
const printing = ref(false)

const loading = ref(true)
const saving = ref(false)
const submittingAll = ref(false)
const autoGenerating = ref(false)
const err = ref('')

const editingTimecardId = ref<string | null>(null)
const expandedId = ref<string | null>(null)
const editForm = ref({ employeeNumber: '', firstName: '', lastName: '', occupation: '' })

const showCreateForm = ref(false)
const newTimecardForm = ref({ employeeNumber: '', firstName: '', lastName: '', occupation: '' })

const flatpickrConfig = ref<any>({
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

function buildWeekDates(start: string): string[] {
  const dates: string[] = []
  const base = new Date(start + 'T00:00:00Z')
  for (let i = 0; i < 7; i++) {
    const d = new Date(base)
    d.setUTCDate(base.getUTCDate() + i)
    const yyyy = d.getUTCFullYear()
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(d.getUTCDate()).padStart(2, '0')
    dates.push(`${yyyy}-${mm}-${dd}`)
  }
  return dates
}

function makeDaysArray(start: string): TimecardDay[] {
  return buildWeekDates(start).map((date, idx) => ({
    date,
    dayOfWeek: idx,
    hours: 0,
    production: 0,
    unitCost: 0,
    lineTotal: 0,
    notes: '',
  }))
}

function createDraft(): TimecardModel {
  const days = makeDaysArray(weekStartDate.value)
  return {
    id: `temp-${Date.now()}`,
    jobId: jobId.value,
    weekStartDate: weekStartDate.value,
    weekEndingDate: weekEndingDate.value,
    status: 'draft',
    createdByUid: auth.user?.uid ?? '',
    submittedAt: null as any,
    employeeRosterId: '',
    employeeNumber: newTimecardForm.value.employeeNumber,
    employeeName: `${newTimecardForm.value.firstName} ${newTimecardForm.value.lastName}`.trim(),
    occupation: newTimecardForm.value.occupation,
    jobs: [
      {
        jobNumber: '',
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
    archivedAt: null as any,
  }
}

function recalcTotals(timecard: TimecardModel) {
  const hours: number[] = Array(7).fill(0)
  const production: number[] = Array(7).fill(0)
  const lineTotals: number[] = Array(7).fill(0)

  timecard.jobs?.forEach(job => {
    job.days?.forEach((day, idx) => {
      hours[idx] += day.hours || 0
      production[idx] += day.production || 0
      lineTotals[idx] += (day.production || 0) * (day.unitCost || 0)
    })
  })

  const dates = buildWeekDates(weekStartDate.value)
  timecard.days = dates.map((date, idx) => ({
    date,
    dayOfWeek: idx,
    hours: hours[idx],
    production: production[idx],
    unitCost: 0,
    lineTotal: lineTotals[idx],
    notes: timecard.days?.[idx]?.notes ?? '',
  }))

  timecard.totals = {
    hours,
    production,
    hoursTotal: hours.reduce((sum, h) => sum + h, 0),
    productionTotal: production.reduce((sum, p) => sum + p, 0),
    lineTotal: lineTotals.reduce((sum, v) => sum + v, 0),
  }
}

async function ensureAccess(): Promise<boolean> {
  try {
    if (!auth.ready) await auth.init()
    if (!permissions.canAccessJob.value) {
      await router.push({ name: 'unauthorized' })
      return false
    }
    await jobsStore.fetchJob(jobId.value)
    return true
  } catch (e: any) {
    err.value = e?.message ?? 'Failed to load job'
    toastRef.value?.show(err.value, 'error')
    return false
  }
}

async function loadTimecards() {
  loading.value = true
  err.value = ''
  try {
    timecards.value = await listTimecardsByJobAndWeek(jobId.value, weekEndingDate.value)
  } catch (e: any) {
    err.value = e?.message ?? 'Failed to load timecards'
    toastRef.value?.show(err.value, 'error')
  } finally {
    loading.value = false
  }
}

async function init() {
  loading.value = true
  err.value = ''
  try {
    const today = new Date().toISOString().split('T')[0]
    selectedDate.value = today
    if (!await ensureAccess()) return
    try {
      const settings = await getEmailSettings()
      timecardRecipients.value = settings.timecardSubmitRecipients ?? []
    } catch (recipientErr) {
      console.warn('Failed to load timecard email recipients', recipientErr)
      timecardRecipients.value = []
    }
    await loadTimecards()
  } catch (e: any) {
    err.value = e?.message ?? 'Failed to initialize'
    toastRef.value?.show(err.value, 'error')
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
        console.error('Failed to save draft before switching weeks', e)
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
  if (dateStr) refreshWeek(dateStr)
}

function onDateInputFocus() {
  openDatePicker()
}

function startCreateTimecard() {
  newTimecardForm.value = { employeeNumber: '', firstName: '', lastName: '', occupation: '' }
  showCreateForm.value = true
}

function cancelCreateTimecard() {
  showCreateForm.value = false
}

function confirmCreateTimecard() {
  if (!newTimecardForm.value.firstName.trim()) {
    toastRef.value?.show('First name is required', 'error')
    return
  }
  if (!newTimecardForm.value.lastName.trim()) {
    toastRef.value?.show('Last name is required', 'error')
    return
  }
  if (!newTimecardForm.value.employeeNumber.trim()) {
    toastRef.value?.show('Employee number is required', 'error')
    return
  }
  const draft = createDraft()
  draftTimecards.value.set(draft.id, draft)
  editingTimecardId.value = null
  editForm.value = { employeeNumber: '', firstName: '', lastName: '', occupation: '' }
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
        employeeNumber: timecard.employeeNumber,
        employeeName: timecard.employeeName,
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
        employeeName: timecard.employeeName,
        employeeNumber: timecard.employeeNumber,
        occupation: timecard.occupation,
      })
      if (showToast) toastRef.value?.show(`Updated timecard for ${timecard.employeeName}`, 'success')
    } else {
      const id = await createTimecard(jobId.value, {
        weekEndingDate: timecard.weekEndingDate,
        employeeRosterId: '',
        employeeNumber: timecard.employeeNumber,
        employeeName: timecard.employeeName,
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
  } catch (e: any) {
    err.value = e?.message ?? 'Failed to save timecard'
    if (showToast) toastRef.value?.show(err.value, 'error')
  } finally {
    saving.value = false
  }
}

async function handleDeleteTimecard(timecardId: string, employeeName: string) {
  if (!confirm(`Delete timecard for ${employeeName}?`)) return
  saving.value = true
  err.value = ''
  try {
    await deleteTimecard(jobId.value, timecardId)
    draftTimecards.value.delete(timecardId)
    toastRef.value?.show(`Deleted timecard for ${employeeName}`, 'success')
    await loadTimecards()
  } catch (e: any) {
    err.value = e?.message ?? 'Failed to delete timecard'
    toastRef.value?.show(err.value, 'error')
  } finally {
    saving.value = false
  }
}

async function handleSubmitTimecard(timecard: TimecardModel) {
  if (!confirm(`Submit timecard for ${timecard.employeeName}?`)) return
  saving.value = true
  err.value = ''
  try {
    await submitTimecard(jobId.value, timecard.id)
    timecard.status = 'submitted'
    toastRef.value?.show(`Submitted timecard for ${timecard.employeeName}`, 'success')
    await loadTimecards()
  } catch (e: any) {
    err.value = e?.message ?? 'Failed to submit timecard'
    toastRef.value?.show(err.value, 'error')
  } finally {
    saving.value = false
  }
}

async function submitAllTimecards() {
  if (!confirm(`Submit all timecards for the week of ${weekRange.value}?`)) return
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
          await sendTimecardEmail(jobId.value, submittedIds, weekStartDate.value as any, timecardRecipients.value)
          toastRef.value?.show(`Timecards emailed to ${timecardRecipients.value.length} recipient(s)`, 'success')
        } else {
          toastRef.value?.show('No submitted timecards to email', 'info')
        }
      } catch (emailErr: any) {
        console.error('Failed to send timecard email', emailErr)
        toastRef.value?.show('Timecards submitted, but email failed to send', 'warning')
      }
    }
    if (isAdmin.value) {
      await markTimecardsSent(jobId.value, weekEndingDate.value)
    }
    await loadTimecards()
    draftTimecards.value.clear()
  } catch (e: any) {
    err.value = e?.message ?? 'Failed to submit timecards'
    toastRef.value?.show(err.value, 'error')
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

function printSummary() {
  if (printing.value) return
  printing.value = true
  // Use a timeout to allow modal render before print
  requestAnimationFrame(() => {
    window.print()
    printing.value = false
  })
}

async function generateFromPreviousWeek() {
  autoGenerating.value = true
  err.value = ''
  try {
    const newIds = await autoGenerateTimecards(jobId.value, weekEndingDate.value)
    if (newIds.length > 0) {
      toastRef.value?.show(`Generated ${newIds.length} timecard(s) from previous week`, 'success')
      await loadTimecards()
    } else {
      toastRef.value?.show('No timecards in previous week to copy', 'info')
    }
  } catch (e: any) {
    err.value = e?.message ?? 'Failed to generate timecards'
    toastRef.value?.show(err.value, 'error')
  } finally {
    autoGenerating.value = false
  }
}

function startEditingEmployee(timecard: TimecardModel) {
  editingTimecardId.value = timecard.id
  const [firstName, ...rest] = timecard.employeeName.split(' ')
  editForm.value = {
    employeeNumber: timecard.employeeNumber,
    firstName,
    lastName: rest.join(' '),
    occupation: timecard.occupation,
  }
}

function cancelEditingEmployee() {
  editingTimecardId.value = null
  editForm.value = { employeeNumber: '', firstName: '', lastName: '', occupation: '' }
}

function toggleEditingEmployee(timecard: TimecardModel) {
  if (editingTimecardId.value === timecard.id) {
    confirmEditingEmployee(timecard)
  } else {
    startEditingEmployee(timecard)
  }
}

function confirmEditingEmployee(timecard: TimecardModel) {
  if (!editForm.value.firstName.trim()) {
    toastRef.value?.show('First name is required', 'error')
    return
  }
  if (!editForm.value.lastName.trim()) {
    toastRef.value?.show('Last name is required', 'error')
    return
  }
  if (!editForm.value.employeeNumber.trim()) {
    toastRef.value?.show('Employee number is required', 'error')
    return
  }
  timecard.employeeNumber = editForm.value.employeeNumber
  timecard.employeeName = `${editForm.value.firstName} ${editForm.value.lastName}`
  timecard.occupation = editForm.value.occupation
  autoSave(timecard)
  editingTimecardId.value = null
}

function handleNotesInput(timecard: TimecardModel, value: string) {
  timecard.notes = value
  autoSave(timecard)
}

function addJobRow(timecard: TimecardModel) {
  if (!timecard.jobs) timecard.jobs = []
  timecard.jobs.push({ jobNumber: '', acct: '', difH: '', difP: '', difC: '', days: makeDaysArray(weekStartDate.value) })
  recalcTotals(timecard)
  autoSave(timecard)
}

function removeJobRow(timecard: TimecardModel, index: number) {
  if (timecard.jobs && timecard.jobs.length > 1) {
    timecard.jobs.splice(index, 1)
    recalcTotals(timecard)
    autoSave(timecard)
  }
}

function updateJobNumber(timecard: TimecardModel, index: number, value: string) {
  if (!timecard.jobs) return
  timecard.jobs[index].jobNumber = value
  autoSave(timecard)
}

function updateAccount(timecard: TimecardModel, index: number, value: string) {
  if (!timecard.jobs) return
  timecard.jobs[index].acct = value
  autoSave(timecard)
}

type TimecardDayNumberField = 'hours' | 'production' | 'unitCost' | 'lineTotal'

function updateDayValue(timecard: TimecardModel, jobIndex: number, dayIndex: number, field: TimecardDayNumberField, raw: number) {
  if (!timecard.jobs || !timecard.jobs[jobIndex] || !timecard.jobs[jobIndex].days) return
  timecard.jobs[jobIndex].days![dayIndex][field] = raw
  recalcTotals(timecard)
  autoSave(timecard)
}

function clampHours(value: number) {
  if (Number.isNaN(value)) return 0
  return Math.min(24, Math.max(0, value))
}

function handleHoursInput(timecard: TimecardModel, jobIndex: number, dayIndex: number, rawValue: number) {
  if (!timecard.jobs || !timecard.jobs[jobIndex] || !timecard.jobs[jobIndex].days) return
  const clamped = clampHours(rawValue)
  timecard.jobs[jobIndex].days![dayIndex].hours = clamped
  recalcTotals(timecard)
  autoSave(timecard)
}

onMounted(() => init())
onUnmounted(() => {
  autoSaveTimers.value.forEach(timer => clearTimeout(timer))
  autoSaveTimers.value.clear()
})
</script>

<template>
  <div class="timecards-page">
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
        <button type="button" class="btn-close" @click="err = ''"></button>
      </div>

      <div v-if="loading" class="text-center py-5">
        <div class="spinner-border text-primary mb-3"></div>
        <p class="text-muted">Loading timecardsΓÇª</p>
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
                  />
                  <button type="button" class="btn btn-outline-secondary" @click="openDatePicker" title="Open date picker">
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
                  Summary / Print
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
          <BaseAccordionCard
            v-for="timecard in allTimecards"
            :key="timecard.id"
            :title="timecard.employeeName"
            :open="expandedId === timecard.id"
            body-class="p-0"
            @update:open="(open) => handleTimecardToggle(timecard.id, open)"
          >
            <template #header>
              <div class="row g-2 align-items-center w-100 timecard-header-row">
                <div class="col-6 col-md-3">
                  <div
                    v-if="editingTimecardId === timecard.id"
                    class="d-flex align-items-center gap-2 flex-nowrap w-100"
                    @click.stop
                  >
                    <input
                      v-model="editForm.firstName"
                      type="text"
                      class="form-control form-control-sm flex-fill shrink-input"
                      placeholder="First name"
                    />
                    <input
                      v-model="editForm.lastName"
                      type="text"
                      class="form-control form-control-sm flex-fill shrink-input"
                      placeholder="Last name"
                    />
                  </div>
                  <div v-else class="fw-semibold">{{ timecard.employeeName }}</div>
                </div>

                <div class="col-3 col-md-2">
                  <div v-if="editingTimecardId === timecard.id" class="d-flex align-items-center gap-2 w-100" @click.stop>
                    <input
                      v-model="editForm.employeeNumber"
                      type="text"
                      class="form-control form-control-sm"
                      placeholder="Employee #"
                    />
                  </div>
                  <div v-else class="fw-semibold">#{{ timecard.employeeNumber }}</div>
                </div>

                <div class="col-6 col-md-3">
                  <div v-if="editingTimecardId === timecard.id" class="d-flex align-items-center gap-2 w-100" @click.stop>
                    <input
                      v-model="editForm.occupation"
                      type="text"
                      class="form-control form-control-sm"
                      placeholder="Occupation"
                    />
                  </div>
                  <div v-else class="text-muted">{{ timecard.occupation }}</div>
                </div>

                <div class="col-12 col-md-4 order-first order-md-last text-start text-md-end d-flex align-items-center justify-content-between justify-content-md-end gap-2 tc-header-actions">
                  <div class="d-flex align-items-center justify-content-end gap-2 flex-nowrap">
                    <div v-if="editingTimecardId === timecard.id" class="btn-group btn-group-sm flex-nowrap" role="group">
                      <button
                        class="btn btn-outline-danger"
                        :disabled="timecard.status === 'submitted'"
                        @click.stop="handleDeleteTimecard(timecard.id, timecard.employeeName)"
                        title="Delete timecard"
                      >
                        <i class="bi bi-trash text-danger"></i>
                      </button>
                    </div>

                    <button
                      class="btn btn-sm btn-outline-secondary"
                      @click.stop="toggleEditingEmployee(timecard)"
                      :aria-pressed="editingTimecardId === timecard.id"
                      :disabled="timecard.status === 'submitted'"
                      title="Toggle edit mode"
                    >
                      <i class="bi bi-pencil"></i>
                    </button>
                  </div>
                  <span :class="timecard.status === 'submitted' ? 'badge bg-success' : 'badge bg-warning text-dark'">
                    {{ timecard.status }}
                  </span>
                </div>
              </div>
            </template>

            <div class="table-responsive">
              <table class="table table-sm table-striped mb-0 timecard-table">
                <thead>
                  <tr>
                    <th class="text-center small fw-semibold col-job">Job #</th>
                    <th class="text-center small fw-semibold col-acct">Acct</th>
                    <th class="text-center small fw-semibold col-blank"></th>
                    <th class="text-center small fw-semibold col-div">Dif</th>
                    <th v-for="dayIdx in 7" :key="dayIdx" class="text-center col-day">
                      <div class="fw-semibold small">{{ ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dayIdx - 1] }}</div>
                    </th>
                    <th class="text-center small fw-semibold col-total">Total</th>
                    <th class="col-actions"></th>
                  </tr>
                </thead>
                <tbody>
                  <template v-for="(job, jobIdx) in (timecard.jobs || [])" :key="`job-${jobIdx}`">
                    <tr :class="['align-middle', 'timecard-job-row', jobIdx % 2 === 1 ? 'timecard-job-alt' : '']">
                      <td :rowspan="3" class="bg-soft text-center px-2 py-0 align-middle">
                        <input
                          type="text"
                          :value="job.jobNumber || ''"
                          :disabled="timecard.status === 'submitted'"
                          class="form-control form-control-sm text-center"
                          placeholder="Job #"
                          @input="(e) => updateJobNumber(timecard, jobIdx, (e.target as HTMLInputElement).value)"
                        />
                      </td>
                      <td :rowspan="3" class="bg-soft text-center px-2 py-0 align-middle">
                        <input
                          type="text"
                          :value="job.acct || ''"
                          :disabled="timecard.status === 'submitted'"
                          class="form-control form-control-sm text-center"
                          placeholder="Acct"
                          @input="(e) => updateAccount(timecard, jobIdx, (e.target as HTMLInputElement).value)"
                        />
                      </td>
                      <td class="bg-soft small fw-semibold text-center">H</td>
                      <td class="bg-soft text-center px-2 py-0">
                        <input
                          type="text"
                          :value="job.difH || ''"
                          :disabled="timecard.status === 'submitted'"
                          class="form-control form-control-sm text-center"
                          placeholder="Dif"
                          @input="(e) => { if (timecard.jobs) timecard.jobs[jobIdx].difH = (e.target as HTMLInputElement).value }"
                        />
                      </td>
                      <td v-for="dayIdx in 7" :key="`h-${jobIdx}-${dayIdx}`" class="text-center px-2 py-0 day-cell">
                        <template v-if="job.days && job.days[dayIdx - 1]">
                          <input
                            v-model.number="job.days[dayIdx - 1].hours"
                            type="number"
                            inputmode="decimal"
                            min="0"
                            max="24"
                            step="0.25"
                            :disabled="timecard.status === 'submitted'"
                            class="form-control form-control-sm text-center w-100 day-input"
                            placeholder="0"
                            @input="(e) => handleHoursInput(timecard, jobIdx, dayIdx - 1, Number((e.target as HTMLInputElement).value))"
                            @focus="($event.target as HTMLInputElement).select()"
                            @click.stop
                          />
                        </template>
                      </td>
                      <td class="text-center fw-semibold small">{{ (timecard.totals.hoursTotal ?? 0).toFixed(2) }}</td>
                      <td :rowspan="3" class="text-center align-middle">
                        <button
                          v-if="(timecard.jobs?.length || 0) > 1"
                          class="btn btn-sm btn-danger btn-icon"
                          title="Remove job"
                          :disabled="timecard.status === 'submitted'"
                          @click="removeJobRow(timecard, jobIdx)"
                        >
                          <i class="bi bi-x"></i>
                        </button>
                      </td>
                    </tr>

                    <tr :class="['align-middle', 'bg-soft', 'timecard-job-row', jobIdx % 2 === 1 ? 'timecard-job-alt' : '']">
                      <td class="bg-soft small fw-semibold text-center">P</td>
                      <td class="bg-soft text-center px-2 py-0">
                        <input
                          type="text"
                          :value="job.difP || ''"
                          :disabled="timecard.status === 'submitted'"
                          class="form-control form-control-sm text-center"
                          placeholder="Dif"
                          @input="(e) => { if (timecard.jobs) timecard.jobs[jobIdx].difP = (e.target as HTMLInputElement).value }"
                        />
                      </td>
                      <td v-for="dayIdx in 7" :key="`p-${jobIdx}-${dayIdx}`" class="text-center px-2 py-0 day-cell">
                        <template v-if="job.days && job.days[dayIdx - 1]">
                          <input
                            v-model.number="job.days[dayIdx - 1].production"
                            type="number"
                            inputmode="decimal"
                            min="0"
                            step="0.1"
                            :disabled="timecard.status === 'submitted'"
                            class="form-control form-control-sm text-center w-100 day-input"
                            title="Production units"
                            placeholder="0"
                            @input="recalcTotals(timecard); autoSave(timecard)"
                            @focus="($event.target as HTMLInputElement).select()"
                            @click.stop
                          />
                        </template>
                      </td>
                      <td class="text-center fw-semibold small">{{ (timecard.totals.productionTotal ?? 0).toFixed(2) }}</td>
                    </tr>

                    <tr :class="['align-middle', 'timecard-job-row', jobIdx % 2 === 1 ? 'timecard-job-alt' : '']">
                      <td class="bg-soft small fw-semibold text-center">C</td>
                      <td class="bg-soft text-center px-2 py-0">
                        <input
                          type="text"
                          :value="job.difC || ''"
                          :disabled="timecard.status === 'submitted'"
                          class="form-control form-control-sm text-center"
                          placeholder="Dif"
                          @input="(e) => { if (timecard.jobs) timecard.jobs[jobIdx].difC = (e.target as HTMLInputElement).value }"
                        />
                      </td>
                      <td v-for="dayIdx in 7" :key="`c-${jobIdx}-${dayIdx}`" class="text-center px-2 py-0 day-cell">
                        <template v-if="job.days && job.days[dayIdx - 1]">
                          <input
                            v-model.number="job.days[dayIdx - 1].unitCost"
                            type="number"
                            inputmode="decimal"
                            min="0"
                            step="0.01"
                            :disabled="timecard.status === 'submitted'"
                            class="form-control form-control-sm text-center text-xs day-input"
                            title="Cost per unit"
                            placeholder="0"
                            @input="recalcTotals(timecard); autoSave(timecard)"
                            @focus="($event.target as HTMLInputElement).select()"
                            @click.stop
                          />
                        </template>
                      </td>
                      <td class="text-center fw-semibold small">${{ (timecard.totals.lineTotal ?? 0).toFixed(2) }}</td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>

            <div class="py-2 px-3 border-top d-flex justify-content-between align-items-center">
              <small class="text-muted">
                Showing {{ timecard.jobs?.length || 1 }} job{{ (timecard.jobs?.length || 1) !== 1 ? 's' : '' }}
              </small>
              <button
                class="btn btn-sm btn-outline-primary"
                title="Add another job row"
                :disabled="timecard.status === 'submitted'"
                @click="addJobRow(timecard)"
              >
                <i class="bi bi-plus-circle me-1"></i>
                Add Job Row
              </button>
            </div>

            <div class="pt-3 px-3 pb-3 border-top">
              <div class="row g-3 mb-3">
                <div class="col-md-2">
                  <label class="form-label small text-muted">Overtime</label>
                  <input
                    type="number"
                    min="0"
                    step="0.25"
                    :value="Math.max((timecard.totals.hoursTotal ?? 0) - 40, 0).toFixed(2)"
                    class="form-control form-control-sm"
                    :disabled="true"
                  />
                </div>
                <div class="col-md-2">
                  <label class="form-label small text-muted">Regular</label>
                  <input
                    type="number"
                    min="0"
                    step="0.25"
                    :value="Math.min((timecard.totals.hoursTotal ?? 0), 40).toFixed(2)"
                    class="form-control form-control-sm"
                    :disabled="true"
                  />
                </div>
                <div class="col-md-8">
                  <label class="form-label small text-muted">Notes</label>
                  <textarea
                    :value="timecard.notes"
                    rows="2"
                    class="form-control form-control-sm"
                    placeholder="Additional notes"
                    :disabled="timecard.status === 'submitted'"
                    @input="(e) => handleNotesInput(timecard, (e.target as HTMLTextAreaElement).value)"
                  ></textarea>
                </div>
              </div>

              <div class="d-flex gap-2 flex-wrap timecard-actions">
                <!-- Auto-saves on change; no manual save button needed. -->
              </div>
            </div>
          </BaseAccordionCard>
        </div>
      </div>
    </div>

    <div
      v-if="showCreateForm"
      class="position-fixed top-0 start-0 end-0 bottom-0 d-flex align-items-center justify-content-center bg-dark bg-opacity-50"
    >
      <div class="card border-0 shadow-lg modal-card">
        <div class="card-header bg-primary text-white">
          <h5 class="mb-0">Create New Timecard</h5>
        </div>
        <div class="card-body">
          <div class="mb-3">
            <label class="form-label">Employee Number *</label>
            <input
              v-model="newTimecardForm.employeeNumber"
              type="text"
              class="form-control"
              placeholder="e.g., 1234"
              autofocus
            />
          </div>
          <div class="row g-2 mb-3">
            <div class="col-6">
              <label class="form-label">First Name *</label>
              <input v-model="newTimecardForm.firstName" type="text" class="form-control" placeholder="First" />
            </div>
            <div class="col-6">
              <label class="form-label">Last Name *</label>
              <input v-model="newTimecardForm.lastName" type="text" class="form-control" placeholder="Last" />
            </div>
          </div>
          <div class="mb-4">
            <label class="form-label">Occupation</label>
            <input v-model="newTimecardForm.occupation" type="text" class="form-control" placeholder="e.g., Carpenter" />
          </div>
          <div class="d-flex gap-2">
            <button class="btn btn-primary" @click="confirmCreateTimecard">Create</button>
            <button class="btn btn-secondary" @click="cancelCreateTimecard">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Timecard Summary Modal (Printable) -->
  <div v-if="showSummaryModal" class="modal d-block bg-dark bg-opacity-50">
    <div class="modal-dialog modal-lg">
      <div class="modal-content" id="timecard-summary">
        <div class="modal-header">
          <h5 class="modal-title">Timecard Summary ΓÇô Week ending {{ weekEndingDate }}</h5>
          <button type="button" class="btn-close" @click="closeSummary" :disabled="printing"></button>
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
  padding: 0.25rem 0.5rem !important;
}

.form-control:focus {
  border-radius: 0;
}

textarea.form-control {
  border-radius: 0;
}

.accordion-button {
  background-color: $surface-2;
  border: 1px solid rgba($border-color, 0.4);
  border-bottom: 2px solid rgba($border-color, 0.4);
  padding: 0.75rem 1.25rem;
  transition: all 0.2s ease-in-out;
  color: $body-color;
}

.accordion-button:hover {
  background-color: rgba($primary, 0.12);
}

// Tighter rows for timecard tables
.timecard-table th,
.timecard-table td {
  padding: 0.4rem 0.45rem;
}

.summary-table th,
.summary-table td {
  padding: 0.5rem 0.55rem;
}

.accordion-button:not(.collapsed) {
  background: linear-gradient(180deg, rgba($primary, 0.16) 0%, rgba($primary-200, 0.55) 60%, $surface-2 100%);
  border-color: rgba($primary, 0.4);
  box-shadow: inset 0 -1px rgba(0, 0, 0, 0.25);
  color: $body-color;
}

.accordion-button:focus {
  border-color: rgba($primary, 0.5);
  box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
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
}

.accordion-body {
  padding-bottom: 1.25rem;
}

.tc-collapse {
  overflow: hidden;
  max-height: 0;
  opacity: 0;
  transition: max-height 0.3s ease, opacity 0.2s ease;
}

.tc-collapse.show {
  opacity: 1;
}

.timecard-actions {
  padding-bottom: 0.75rem;
}

.timecards-accordion .card {
  margin-bottom: 0 !important;
}

.timecards-accordion .card:last-child {
  margin-bottom: 0 !important;
}

.timecards-page {
  padding-bottom: 1.5rem;
}

.timecards-accordion .card {
  border-radius: 0;
}

.timecards-accordion .card:first-child {
  border-top-left-radius: var(--bs-border-radius);
  border-top-right-radius: var(--bs-border-radius);
}

.timecards-accordion .card:last-child {
  border-bottom-left-radius: var(--bs-border-radius);
  border-bottom-right-radius: var(--bs-border-radius);
}

.date-input-group {
  max-width: 210px;
}

.col-job {
  width: 110px;
  min-width: 110px;
}

.col-acct {
  width: 110px;
  min-width: 110px;
}

.col-blank {
  width: 60px;
}

.col-div {
  width: 100px;
  min-width: 100px;
}

.col-day {
  width: 90px;
}

.col-total {
  width: 80px;
}

.col-actions {
  width: 40px;
}

.text-xs {
  font-size: 0.875rem;
}

.shrink-input {
  min-width: 0;
}

.timecard-table {
  --bs-table-border-color: transparent;
  border-color: transparent;
}

.timecard-table > :not(caption) > * > * {
  border-color: transparent;
}

.timecard-table input {
  background: transparent;
  border: 0;
  box-shadow: none;
  padding: 0.25rem 0.35rem;
}

.timecard-table input:focus {
  background: transparent;
  border: 0;
  box-shadow: none;
  outline: none;
}

.timecard-job-row td {
  transition: background-color 0.12s ease;
}

.timecard-job-row .day-cell {
  background-color: mix($primary, $surface, 10%);
}

.timecard-job-row:hover .day-cell {
  background-color: mix($primary, $surface, 16%);
}

.timecard-job-alt .day-cell {
  background-color: mix($primary, $surface, 18%);
}

.timecard-job-alt:hover .day-cell {
  background-color: mix($primary, $surface, 24%);
}

.day-input {
  background: transparent;
  color: $body-color;
  min-width: 78px;
  font-size: 0.95rem;
}


.tc-header-actions {
  padding-top: 0.25rem;
}

@media (max-width: 768px) {
  .day-input {
    min-width: 68px;
    font-size: 0.9rem;
  }

  .timecard-header-row {
    row-gap: 0.35rem;
  }

  .tc-header-actions {
    padding-top: 0.15rem;
  }

  .timecard-table th,
  .timecard-table td {
    padding: 0.35rem 0.35rem;
  }

  .accordion-body {
    padding: 0.75rem;
  }

  .accordion-button {
    padding: 0.65rem 0.95rem;
  }

  .col-job,
  .col-acct,
  .col-div {
    min-width: 130px;
  }
}

.modal-card {
  max-width: 500px;
  width: 100%;
  margin: 0 20px;
}

.bg-soft {
  background-color: rgba($secondary, 0.08);
}

/* Neutral left columns; tint only day cells with subtle base and stronger alt */
.timecard-job-row td,
.timecard-job-row td.bg-soft {
  background-color: transparent !important;
}
</style>

<style lang="scss">
/* Summary modal print isolation (global) */
@media print {
  body * {
    visibility: hidden;
  }
  #timecard-summary, #timecard-summary * {
    visibility: visible;
  }
  #timecard-summary {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    background: white;
  }
}
</style>

