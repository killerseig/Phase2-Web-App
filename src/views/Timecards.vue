<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import Toast from '../components/Toast.vue'
import * as TimecardService from '../services/Timecards'
import { useJobsStore } from '../stores/jobs'
import { useAuthStore } from '../stores/auth'
import type { TimecardDay, Timecard as TimecardModel } from '@/types/models'
import { DAY_NAMES_SHORT } from '@/config/constants'
import { formatWeekRange, snapToSunday, getSaturdayFromSunday } from '@/utils/modelValidation'

defineProps<{ jobId?: string }>()

const route = useRoute()
const auth = useAuthStore()
const jobs = useJobsStore()
const toastRef = ref<InstanceType<typeof Toast> | null>(null)

const jobId = computed(() => String(route.params.jobId))
const jobName = computed(() => jobs.currentJob?.name ?? 'Timecards')
const jobCode = computed(() => jobs.currentJob?.code ?? '')

const loading = ref(true)
const saving = ref(false)
const submitting = ref(false)
const autoGenerating = ref(false)
const err = ref('')
const timecards = ref<TimecardModel[]>([])
const autoSaveTimers = ref<Map<string, NodeJS.Timeout>>(new Map())
const expandedTimecardId = ref<string | null>(null)
const editingTimecardId = ref<string | null>(null)
const editForm = ref({
  employeeNumber: '',
  firstName: '',
  lastName: '',
  occupation: '',
})
const selectedDate = ref('')
const showCreateForm = ref(false)
const draftTimecards = ref<Map<string, TimecardModel>>(new Map())

// Form for creating new timecard
const newTimecardForm = ref({
  employeeNumber: '',
  firstName: '',
  lastName: '',
  occupation: '',
})

// Computed
const weekStartDate = computed(() => snapToSunday(selectedDate.value || new Date()))
const weekEndingDate = computed(() => getSaturdayFromSunday(weekStartDate.value))
const weekRange = computed(() => formatWeekRange(weekStartDate.value, weekEndingDate.value))

const allTimecards = computed(() => {
  const existing = timecards.value
  const drafts = Array.from(draftTimecards.value.values())
  return [...existing, ...drafts].sort((a, b) => 
    a.employeeName.localeCompare(b.employeeName)
  )
})

const draftCount = computed(() => 
  allTimecards.value.filter(t => t.status === 'draft').length
)

const submittedCount = computed(() => 
  allTimecards.value.filter(t => t.status === 'submitted').length
)

// Helpers
function getDaysArray(startDate: string): TimecardDay[] {
  const days: TimecardDay[] = []
  const d = new Date(startDate + 'T00:00:00')
  
  for (let i = 0; i < 7; i++) {
    const dateStr = d.toISOString().split('T')[0]
    days.push({
      date: dateStr,
      dayOfWeek: i,
      hours: 0,
      production: 0,
      unitCost: 0,
      lineTotal: 0,
      notes: ''
    })
    d.setDate(d.getDate() + 1)
  }
  return days
}

function createNewBlankTimecard(): TimecardModel {
  const tempId = 'temp-' + Date.now()
  return {
    id: tempId,
    jobId: jobId.value,
    weekStartDate: weekStartDate.value,
    weekEndingDate: weekEndingDate.value,
    status: 'draft',
    createdByUid: auth.user?.uid ?? '',
    employeeRosterId: '',
    employeeNumber: newTimecardForm.value.employeeNumber,
    employeeName: `${newTimecardForm.value.firstName} ${newTimecardForm.value.lastName}`,
    occupation: newTimecardForm.value.occupation,
    jobs: [{ jobNumber: '', acct: '', div: '', days: getDaysArray(weekStartDate.value) }],
    days: getDaysArray(weekStartDate.value),
    totals: {
      hours: [0, 0, 0, 0, 0, 0, 0],
      production: [0, 0, 0, 0, 0, 0, 0],
      hoursTotal: 0,
      productionTotal: 0,
      lineTotal: 0
    },
    notes: ''
  }
}

// Load functions
async function loadCurrentJob() {
  try {
    await jobs.fetchJob(jobId.value)
  } catch (e: any) {
    err.value = e?.message ?? 'Failed to load job'
    toastRef.value?.show('Failed to load job', 'error')
  }
}

async function loadTimecards() {
  try {
    timecards.value = await TimecardService.listTimecardsByJobAndWeek(
      jobId.value,
      weekEndingDate.value
    )
  } catch (e: any) {
    err.value = e?.message ?? 'Failed to load timecards'
    toastRef.value?.show('Failed to load timecards', 'error')
  }
}

async function init() {
  loading.value = true
  err.value = ''
  
  try {
    const today = new Date()
    selectedDate.value = today.toISOString().split('T')[0]
    
    await Promise.all([loadCurrentJob(), loadTimecards()])
  } catch (e: any) {
    err.value = e?.message ?? 'Failed to initialize'
  } finally {
    loading.value = false
  }
}

async function onChangeWeek() {
  // Save any unsaved drafts before switching weeks
  const drafts = Array.from(draftTimecards.value.values())
  for (const draft of drafts) {
    if (draft.id.startsWith('temp-')) {
      try {
        await saveTimecard(draft)
      } catch (e) {
        console.error('Failed to save draft before switching weeks:', e)
      }
    }
  }
  
  // Clear UI state
  draftTimecards.value.clear()
  expandedTimecardId.value = null
  showCreateForm.value = false
  err.value = ''
  
  // Load timecards for new week
  await loadTimecards()
}

async function onDateSelected(date: string) {
  selectedDate.value = date
  await onChangeWeek()
}

// Create timecard
function startCreateTimecard() {
  newTimecardForm.value = { employeeNumber: '', firstName: '', lastName: '', occupation: '' }
  showCreateForm.value = true
}

function cancelCreateTimecard() {
  showCreateForm.value = false
  newTimecardForm.value = { employeeNumber: '', firstName: '', lastName: '', occupation: '' }
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

  const timecard = createNewBlankTimecard()
  draftTimecards.value.set(timecard.id, timecard)
  expandedTimecardId.value = timecard.id
  showCreateForm.value = false
}

// Update timecard
function updateDayValue(timecard: TimecardModel, dayIndex: number, field: keyof TimecardDay, value: any) {
  timecard.days[dayIndex] = { ...timecard.days[dayIndex], [field]: value }
  
  const day = timecard.days[dayIndex]
  day.lineTotal = (day.production || 0) * (day.unitCost || 0)
  
  const hours = timecard.days.map(d => d.hours || 0)
  const production = timecard.days.map(d => d.production || 0)
  const hoursTotal = hours.reduce((a, b) => a + b, 0)
  const productionTotal = production.reduce((a, b) => a + b, 0)
  const lineTotal = timecard.days.reduce((sum, d) => sum + (d.lineTotal || 0), 0)
  
  timecard.totals = { hours, production, hoursTotal, productionTotal, lineTotal }
}

function recalculateTotals(timecard: TimecardModel) {
  // Sum totals across all jobs
  const hours = [0, 0, 0, 0, 0, 0, 0]
  const production = [0, 0, 0, 0, 0, 0, 0]
  let hoursTotal = 0
  let productionTotal = 0
  let lineTotal = 0
  
  if (timecard.jobs && timecard.jobs.length > 0) {
    for (const job of timecard.jobs) {
      if (job.days && job.days.length === 7) {
        for (let i = 0; i < 7; i++) {
          const jobDay = job.days[i]
          hours[i] = (hours[i] || 0) + (jobDay.hours || 0)
          production[i] = (production[i] || 0) + (jobDay.production || 0)
          const lineTotalForDay = (jobDay.production || 0) * (jobDay.unitCost || 0)
          lineTotal += lineTotalForDay
        }
      }
    }
  }
  
  hoursTotal = hours.reduce((a, b) => a + b, 0)
  productionTotal = production.reduce((a, b) => a + b, 0)
  
  timecard.totals = { hours, production, hoursTotal, productionTotal, lineTotal }
  autoSave(timecard)
}

async function saveTimecard(timecard: TimecardModel, showToast = true) {
  saving.value = true
  err.value = ''
  
  try {
    if (timecard.id.startsWith('temp-')) {
      // New timecard - create it
      const id = await TimecardService.createTimecard(jobId.value, {
        weekEndingDate: timecard.weekEndingDate,
        employeeRosterId: '',
        employeeNumber: timecard.employeeNumber,
        employeeName: timecard.employeeName,
        occupation: timecard.occupation,
        jobs: timecard.jobs || [],
        days: timecard.days,
        notes: timecard.notes
      })
      
      // Update draft map with real ID
      draftTimecards.value.delete(timecard.id)
      timecard.id = id
      draftTimecards.value.set(id, timecard)
      
      if (showToast) toastRef.value?.show(`Created timecard for ${timecard.employeeName}`, 'success')
    } else if (!timecards.value.find(t => t.id === timecard.id)) {
      // Draft that hasn't been saved yet
      const id = await TimecardService.createTimecard(jobId.value, {
        weekEndingDate: timecard.weekEndingDate,
        employeeRosterId: '',
        employeeNumber: timecard.employeeNumber,
        employeeName: timecard.employeeName,
        occupation: timecard.occupation,
        jobs: timecard.jobs || [],
        days: timecard.days,
        notes: timecard.notes
      })
      
      timecard.id = id
      if (showToast) toastRef.value?.show(`Created timecard for ${timecard.employeeName}`, 'success')
    } else {
      // Update existing
      await TimecardService.updateTimecard(jobId.value, timecard.id, {
        days: timecard.days,
        jobs: timecard.jobs,
        notes: timecard.notes
      })
      if (showToast) toastRef.value?.show(`Updated timecard for ${timecard.employeeName}`, 'success')
    }
  } catch (e: any) {
    err.value = e?.message ?? 'Failed to save timecard'
    if (showToast) toastRef.value?.show(err.value, 'error')
  } finally {
    saving.value = false
  }
}

async function deleteTimecard(timecardId: string, employeeName: string) {
  if (!confirm(`Delete timecard for ${employeeName}?`)) return
  
  saving.value = true
  err.value = ''
  
  try {
    await TimecardService.deleteTimecard(jobId.value, timecardId)
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

async function submitTimecard(timecard: TimecardModel) {
  if (!confirm(`Submit timecard for ${timecard.employeeName}?`)) return
  
  saving.value = true
  err.value = ''
  
  try {
    await TimecardService.submitTimecard(jobId.value, timecard.id)
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
  
  submitting.value = true
  err.value = ''
  
  try {
    // Save all drafts first
    const drafts = allTimecards.value.filter(t => t.status === 'draft')
    for (const draft of drafts) {
      if (draft.id.startsWith('temp-')) {
        await saveTimecard(draft)
      }
    }
    
    // Now submit all
    const count = await TimecardService.submitAllWeekTimecards(
      jobId.value,
      weekEndingDate.value
    )
    
    toastRef.value?.show(`Submitted ${count} timecard(s)`, 'success')
    await loadTimecards()
    draftTimecards.value.clear()
  } catch (e: any) {
    err.value = e?.message ?? 'Failed to submit timecards'
    toastRef.value?.show(err.value, 'error')
  } finally {
    submitting.value = false
  }
}

async function generateFromPreviousWeek() {
  autoGenerating.value = true
  err.value = ''
  
  try {
    const newIds = await TimecardService.autoGenerateTimecards(
      jobId.value,
      weekEndingDate.value
    )
    
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

function autoSave(timecard: TimecardModel) {
  const existingTimer = autoSaveTimers.value.get(timecard.id)
  if (existingTimer) clearTimeout(existingTimer)
  
  const timer = setTimeout(() => {
    saveTimecard(timecard, false)  // Don't show toast for auto-save
    autoSaveTimers.value.delete(timecard.id)
  }, 500)
  
  autoSaveTimers.value.set(timecard.id, timer)
}

function startEditingEmployee(timecard: TimecardModel) {
  editingTimecardId.value = timecard.id
  editForm.value = {
    employeeNumber: timecard.employeeNumber,
    firstName: timecard.employeeName.split(' ')[0],
    lastName: timecard.employeeName.split(' ').slice(1).join(' '),
    occupation: timecard.occupation,
  }
}

function cancelEditingEmployee() {
  editingTimecardId.value = null
  editForm.value = { employeeNumber: '', firstName: '', lastName: '', occupation: '' }
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

function handleDayInput(timecard: TimecardModel, dayIndex: number, field: keyof TimecardDay, value: any) {
  updateDayValue(timecard, dayIndex, field, value)
  autoSave(timecard)
}

function handleNotesInput(timecard: TimecardModel, value: string) {
  timecard.notes = value
  autoSave(timecard)
}

function addJobRow(timecard: TimecardModel) {
  if (!timecard.jobs) {
    timecard.jobs = []
  }
  timecard.jobs.push({ jobNumber: '', acct: '', div: '', days: getDaysArray(weekStartDate.value) })
  autoSave(timecard)
}

function removeJobRow(timecard: TimecardModel, jobIndex: number) {
  if (timecard.jobs && timecard.jobs.length > 1) {
    timecard.jobs.splice(jobIndex, 1)
    autoSave(timecard)
  }
}

onMounted(() => init())

onUnmounted(() => {
  autoSaveTimers.value.forEach(timer => clearTimeout(timer))
  autoSaveTimers.value.clear()
})
</script>

<template>
  <Toast ref="toastRef" />
  
  <div class="container-fluid py-4" style="max-width: 1600px;">
    <!-- Header Navigation -->
    <div class="mb-4 d-flex justify-content-between align-items-center">
      <div>
        <h2 class="h4 mb-1">{{ jobName }}</h2>
        <small class="text-muted">{{ weekRange }}</small>
      </div>
      <div class="d-flex gap-2">
        <button 
          @click="generateFromPreviousWeek"
          :disabled="autoGenerating || loading"
          class="btn btn-outline-secondary btn-sm"
          title="Copy timecards from previous week"
        >
          <i class="bi bi-arrow-repeat me-1"></i>
          {{ autoGenerating ? 'Generating...' : 'Previous Week' }}
        </button>
      </div>
    </div>

    <!-- Error Alert -->
    <div v-if="err" class="alert alert-danger alert-dismissible fade show mb-4">
      <strong>Error:</strong> {{ err }}
      <button type="button" class="btn-close" @click="err = ''"></button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border text-primary mb-3"></div>
      <p class="text-muted">Loading timecards…</p>
    </div>

    <!-- No Timecards -->
    <div v-else-if="allTimecards.length === 0" class="alert alert-info text-center">
      <i class="bi bi-inbox me-2"></i>No timecards yet.
      <button @click="startCreateTimecard" class="btn btn-link btn-sm">Create one</button>
    </div>

    <!-- Timecards List (Bootstrap Accordion) -->
    <div v-else class="accordion accordion-flush" id="timecardsAccordion">
      <div v-for="timecard in allTimecards" :key="timecard.id" class="accordion-item">
        
        <!-- HEADER SECTION -->
        <h2 class="accordion-header" :id="`heading-${timecard.id}`">
          <button 
            class="accordion-button collapsed"
            type="button" 
            data-bs-toggle="collapse"
            :data-bs-target="`#collapse-${timecard.id}`"
            aria-expanded="false"
            :aria-controls="`collapse-${timecard.id}`"
          >
            <div class="row g-3 align-items-center w-100">
              <div class="col-md-3">
                <div v-if="editingTimecardId === timecard.id" class="input-group input-group-sm">
                  <input 
                    v-model="editForm.firstName"
                    type="text" 
                    class="form-control" 
                    placeholder="First"
                    @click.stop
                  />
                  <input 
                    v-model="editForm.lastName"
                    type="text" 
                    class="form-control" 
                    placeholder="Last"
                    @click.stop
                  />
                </div>
                <div v-else class="fw-semibold">{{ timecard.employeeName }}</div>
              </div>
              
              <div class="col-md-2">
                <div v-if="editingTimecardId === timecard.id">
                  <input 
                    v-model="editForm.employeeNumber"
                    type="text" 
                    class="form-control form-control-sm" 
                    @click.stop
                  />
                </div>
                <div v-else class="fw-semibold">#{{ timecard.employeeNumber }}</div>
              </div>

              <div class="col-md-3">
                <div v-if="editingTimecardId === timecard.id">
                  <input 
                    v-model="editForm.occupation"
                    type="text" 
                    class="form-control form-control-sm" 
                    @click.stop
                  />
                </div>
                <div v-else class="text-muted">{{ timecard.occupation }}</div>
              </div>

              <div class="col-md-4 text-end d-flex align-items-center justify-content-end gap-2" @click.stop>
                <span v-if="editingTimecardId === timecard.id" class="d-flex gap-1">
                  <button 
                    @click="confirmEditingEmployee(timecard)"
                    class="btn btn-primary btn-sm"
                  >
                    <i class="bi bi-check"></i>
                  </button>
                  <button 
                    @click="cancelEditingEmployee"
                    class="btn btn-secondary btn-sm"
                  >
                    <i class="bi bi-x"></i>
                  </button>
                </span>
                <span v-else class="d-flex gap-2 align-items-center">
                  <button 
                    @click="startEditingEmployee(timecard)"
                    class="btn btn-outline-secondary btn-sm"
                    :disabled="timecard.status === 'submitted'"
                  >
                    <i class="bi bi-pencil"></i>
                  </button>
                  <span :class="timecard.status === 'submitted' ? 'badge bg-success' : 'badge bg-warning text-dark'">
                    {{ timecard.status }}
                  </span>
                </span>
              </div>
            </div>
          </button>
        </h2>

        <!-- DAILY GRID SECTION -->
        <div 
          :id="`collapse-${timecard.id}`"
          class="accordion-collapse collapse"
          :aria-labelledby="`heading-${timecard.id}`"
          data-bs-parent="#timecardsAccordion"
        >
          <div class="accordion-body p-0">
            <div class="table-responsive">
            <table class="table table-sm mb-0 border-bottom">
              <thead class="table-light">
                <tr>
                  <th style="width: 80px;" class="text-center small fw-semibold">Job #</th>
                  <th style="width: 70px;" class="text-center small fw-semibold">Acct</th>
                  <th style="width: 50px;" class="text-center small fw-semibold"></th>
                  <th style="width: 70px;" class="text-center small fw-semibold">Div</th>
                  <th v-for="dayIdx in 7" :key=dayIdx style="width: 90px;" class="text-center">
                    <div class="fw-semibold small">{{ DAY_NAMES_SHORT[dayIdx - 1] }}</div>
                  </th>
                  <th style="width: 80px;" class="text-center small fw-semibold">Total</th>
                  <th style="width: 40px;"></th>
                </tr>
              </thead>
              <tbody>
                <!-- Loop through each job entry -->
                <template v-for="(job, jobIdx) in (timecard.jobs || [])" :key="`job-${jobIdx}`">
                  <!-- Hours Row -->
                  <tr class="align-middle">
                    <!-- Job # (rowspan=3) -->
                    <td v-if="true" :rowspan="3" class="bg-light text-center px-2 py-0 align-middle">
                      <input 
                        type="text" 
                        :value="job.jobNumber || ''"
                        @input="(e) => { if (timecard.jobs) timecard.jobs[jobIdx].jobNumber = (e.target as HTMLInputElement).value; handleDayInput(timecard, 0, 'hours', timecard.days[0]?.hours ?? 0) }"
                        :disabled="timecard.status === 'submitted'"
                        class="form-control form-control-sm text-center"
                        placeholder="Job #"
                      />
                    </td>
                    <!-- Acct (rowspan=3) -->
                    <td v-if="true" :rowspan="3" class="bg-light text-center px-2 py-0 align-middle">
                      <input 
                        type="text" 
                        :value="job.acct || ''"
                        @input="(e) => { if (timecard.jobs) timecard.jobs[jobIdx].acct = (e.target as HTMLInputElement).value; handleDayInput(timecard, 0, 'hours', timecard.days[0]?.hours ?? 0) }"
                        :disabled="timecard.status === 'submitted'"
                        class="form-control form-control-sm text-center"
                        placeholder="Acct"
                      />
                    </td>
                    <td class="bg-light small fw-semibold text-center">H</td>
                    <!-- Div (repeats each row) -->
                    <td class="bg-light text-center px-2 py-0">
                      <input 
                        type="text" 
                        :value="job.div || ''"
                        @input="(e) => { if (timecard.jobs) timecard.jobs[jobIdx].div = (e.target as HTMLInputElement).value }"
                        :disabled="timecard.status === 'submitted'"
                        class="form-control form-control-sm text-center"
                        placeholder="Div"
                      />
                    </td>
                    <td v-for="dayIdx in 7" :key="`h-${jobIdx}-${dayIdx}`" class="text-center px-2 py-0">
                      <input 
                        v-if="job.days && job.days[dayIdx - 1]"
                        type="number" 
                        min="0" 
                        step="0.25"
                        v-model.number="job.days[dayIdx - 1].hours"
                        @input="recalculateTotals(timecard)"
                        @focus="($event.target as HTMLInputElement).select()"
                        @click.stop
                        :disabled="timecard.status === 'submitted'"
                        class="form-control form-control-sm text-center"
                        style="width: 100%;"
                      />
                    </td>
                    <td class="text-center fw-semibold small">{{ timecard.totals.hoursTotal ?? 0 }}</td>
                    <td :rowspan="3" class="text-center align-middle">
                      <button 
                        v-if="(timecard.jobs?.length || 0) > 1"
                        @click="removeJobRow(timecard, jobIdx)"
                        :disabled="timecard.status === 'submitted'"
                        class="btn btn-sm btn-danger btn-icon"
                        title="Remove job"
                      >
                        <i class="bi bi-x"></i>
                      </button>
                    </td>
                  </tr>

                  <!-- Production Row -->
                  <tr class="align-middle bg-light">
                    <td class="bg-light small fw-semibold text-center">P</td>
                    <!-- Div (repeats each row) -->
                    <td class="bg-light text-center px-2 py-0">
                      <input 
                        type="text" 
                        :value="job.div || ''"
                        @input="(e) => { if (timecard.jobs) timecard.jobs[jobIdx].div = (e.target as HTMLInputElement).value }"
                        :disabled="timecard.status === 'submitted'"
                        class="form-control form-control-sm text-center"
                        placeholder="Div"
                      />
                    </td>
                    <td v-for="dayIdx in 7" :key="`p-${jobIdx}-${dayIdx}`" class="text-center px-2 py-0">
                      <input 
                        v-if="job.days && job.days[dayIdx - 1]"
                        type="number" 
                        min="0" 
                        step="0.1"
                        v-model.number="job.days[dayIdx - 1].production"
                        @input="recalculateTotals(timecard)"
                        @focus="($event.target as HTMLInputElement).select()"
                        @click.stop
                        :disabled="timecard.status === 'submitted'"
                        class="form-control form-control-sm text-center"
                        style="width: 100%;"
                        title="Production units"
                      />
                    </td>
                    <td class="text-center fw-semibold small">{{ timecard.totals.productionTotal ?? 0 }}</td>
                  </tr>

                  <!-- Unit Cost Row -->
                  <tr class="align-middle">
                    <td class="bg-light small fw-semibold text-center">C</td>
                    <!-- Div (repeats each row) -->
                    <td class="bg-light text-center px-2 py-0">
                      <input 
                        type="text" 
                        :value="job.div || ''"
                        @input="(e) => { if (timecard.jobs) timecard.jobs[jobIdx].div = (e.target as HTMLInputElement).value }"
                        :disabled="timecard.status === 'submitted'"
                        class="form-control form-control-sm text-center"
                        placeholder="Div"
                      />
                    </td>
                    <td v-for="dayIdx in 7" :key="`c-${jobIdx}-${dayIdx}`" class="text-center px-2 py-0">
                      <input 
                        v-if="job.days && job.days[dayIdx - 1]"
                        type="number" 
                        min="0" 
                        step="0.01"
                        v-model.number="job.days[dayIdx - 1].unitCost"
                        @input="recalculateTotals(timecard)"
                        @focus="($event.target as HTMLInputElement).select()"
                        @click.stop
                        :disabled="timecard.status === 'submitted'"
                        class="form-control form-control-sm text-center"
                        style="width: 100%; font-size: 0.875rem;"
                        title="Cost per unit"
                      />
                    </td>
                    <td class="text-center fw-semibold small">
                      ${{ (timecard.totals.lineTotal ?? 0).toFixed(2) }}
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
            </div>

          <!-- Add Job Row Button -->
          <div class="p-2 border-top d-flex justify-content-between align-items-center">
            <small class="text-muted">
              Showing {{ timecard.jobs?.length || 1 }} job{{ (timecard.jobs?.length || 1) !== 1 ? 's' : '' }}
            </small>
            <button 
              @click="addJobRow(timecard)"
              :disabled="timecard.status === 'submitted'"
              class="btn btn-sm btn-outline-primary"
              title="Add another job row"
            >
              <i class="bi bi-plus-circle me-1"></i>Add Job Row
            </button>
          </div>

          <!-- FOOTER SECTION (Within Same Collapse) -->
          <div class="pt-3 border-top">
            <div class="row g-3 mb-3">
            <div class="col-md-2">
              <label class="form-label small text-muted">OT (Overtime)</label>
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
              <label class="form-label small text-muted">REG (Regular)</label>
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
                @input="(e) => handleNotesInput(timecard, (e.target as HTMLTextAreaElement).value)"
                rows="2" 
                class="form-control form-control-sm"
                placeholder="Additional notes"
                :disabled="timecard.status === 'submitted'"
              ></textarea>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="d-flex gap-2 flex-wrap">
            <button 
              @click="saveTimecard(timecard)"
              :disabled="saving || timecard.status === 'submitted'"
              class="btn btn-primary btn-sm"
            >
              <i class="bi bi-save me-1"></i>Save
            </button>
            
            <button 
              @click="deleteTimecard(timecard.id, timecard.employeeName)"
              :disabled="saving || timecard.status === 'submitted'"
              class="btn btn-danger btn-sm"
            >
              <i class="bi bi-trash me-1"></i>Delete
            </button>

            <button 
              @click="submitTimecard(timecard)"
              :disabled="saving || timecard.status === 'submitted'"
              class="btn btn-success btn-sm ms-auto"
            >
              <i class="bi bi-check-circle me-1"></i>Submit
            </button>
          </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Fixed Action Bar at Bottom -->
    <div v-if="allTimecards.length > 0" class="position-fixed bottom-0 start-0 end-0 bg-white border-top p-3" style="z-index: 1000;">
      <div class="container-fluid" style="max-width: 1600px;">
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div class="d-flex gap-2 flex-wrap">
            <button 
              @click="startCreateTimecard"
              :disabled="loading || showCreateForm"
              class="btn btn-primary btn-sm"
            >
              <i class="bi bi-plus-circle me-1"></i>Create New
            </button>

            <input 
              type="date" 
              :value="selectedDate" 
              @change="onDateSelected(($event.target as HTMLInputElement).value)"
              class="form-control form-control-sm" 
              style="max-width: 150px;"
            />
          </div>

          <div class="d-flex gap-2 align-items-center">
            <span class="small text-muted">
              <span class="badge bg-warning text-dark">{{ draftCount }} Draft</span>
              <span class="badge bg-success ms-2">{{ submittedCount }} Submitted</span>
            </span>

            <button 
              @click="submitAllTimecards"
              :disabled="submitting || loading || draftCount === 0"
              class="btn btn-success btn-sm"
            >
              <i class="bi bi-send me-1"></i>
              {{ submitting ? 'Submitting...' : `Submit All (${draftCount})` }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Timecard Modal -->
    <div v-if="showCreateForm" class="position-fixed top-0 start-0 end-0 bottom-0 d-flex align-items-center justify-content-center" style="background: rgba(0, 0, 0, 0.5); z-index: 2000;">
      <div class="card border-0 shadow-lg" style="max-width: 500px; width: 100%; margin: 0 20px;">
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
              <input 
                v-model="newTimecardForm.firstName"
                type="text" 
                class="form-control" 
                placeholder="First"
              />
            </div>
            <div class="col-6">
              <label class="form-label">Last Name *</label>
              <input 
                v-model="newTimecardForm.lastName"
                type="text" 
                class="form-control" 
                placeholder="Last"
              />
            </div>
          </div>
          <div class="mb-4">
            <label class="form-label">Occupation</label>
            <input 
              v-model="newTimecardForm.occupation"
              type="text" 
              class="form-control" 
              placeholder="e.g., Carpenter"
            />
          </div>
          <div class="d-flex gap-2">
            <button 
              @click="confirmCreateTimecard"
              class="btn btn-primary"
            >
              Create
            </button>
            <button 
              @click="cancelCreateTimecard"
              class="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
input[type="number"] {
  -moz-appearance: textfield;
}

input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.display-6 {
  font-size: 2rem;
  font-weight: 600;
}

/* Compact form controls - remove border radius and reduce padding */
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

/* Make accordion header visually distinct and clickable */
.accordion-button {
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-bottom: 2px solid #dee2e6;
  padding: 0.75rem 1.25rem;
  transition: all 0.2s ease-in-out;
}

.accordion-button:hover {
  background-color: #e9ecef;
}

.accordion-button:not(.collapsed) {
  background-color: #e7f1ff;
  border-color: #0d6efd;
  box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.125);
}

.accordion-button:focus {
  border-color: #0d6efd;
  box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
}
</style>
