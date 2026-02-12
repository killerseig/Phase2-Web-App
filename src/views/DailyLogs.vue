<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { isValidEmail } from '../utils/emailValidation'
import Toast from '../components/Toast.vue'
import {
  cleanupDeletedLogs,
  createDailyLog,
  deleteAttachmentFile,
  deleteDailyLog,
  formatTimestamp,
  getDailyLogById,
  getDailyLogRecipients,
  getMyDailyLogByDate,
  listDailyLogsForDate,
  subscribeToDailyLog,
  submitDailyLog,
  toMillis,
  updateDailyLog,
  updateDailyLogRecipients,
  uploadAttachment as uploadPhotoToStorage,
  useJobService,
  type DailyLog,
  type DailyLogDraftInput,
} from '@/services'
import { EMAIL_UI_ENABLED } from '../config'
import { useAuthStore } from '../stores/auth'
import { useJobsStore } from '../stores/jobs'

defineProps<{ jobId?: string }>()

const route = useRoute()
const auth = useAuthStore()
const jobs = useJobsStore()
const jobService = useJobService()
const toastRef = ref<InstanceType<typeof Toast> | null>(null)

const jobId = computed(() => String(route.params.jobId))
const job = computed(() => jobs.currentJob)
const jobName = computed(() => job.value?.name ?? 'Daily Logs')
const jobCode = computed(() => job.value?.code ?? '')
const today = computed(() => new Date().toISOString().slice(0, 10))

const loading = ref(true)
const saving = ref(false)
const uploading = ref(false)
const err = ref('')
const logDate = ref(new Date().toISOString().slice(0, 10))
const selectedLogs = ref<DailyLog[]>([])
const logsForSelectedDate = computed(() => {
  return selectedLogs.value
    .slice()
    .sort((a, b) => {
      const rank = (s: DailyLog['status']) => (s === 'submitted' ? 0 : 1)
      const aTs = toMillis(a.submittedAt || a.updatedAt || a.createdAt)
      const bTs = toMillis(b.submittedAt || b.updatedAt || b.createdAt)
      if (rank(a.status) !== rank(b.status)) return rank(a.status) - rank(b.status)
      return bTs - aTs
    })
})
const currentId = ref<string | null>(null)
const currentStatus = ref<'draft' | 'submitted'>('draft')
const currentOwnerId = ref<string | null>(null)
const currentSubmittedAt = ref<any>(null)
const jobEmailRecipients = ref<string[]>([])
const newEmailRecipient = ref('')
const savingRecipients = ref(false)

const canEditDraft = computed(() => {
  return (
    currentStatus.value === 'draft' &&
    logDate.value === today.value &&
    currentOwnerId.value === auth.user?.uid
  )
})

const photoFileName = ref('No file selected')
const ptpFileName = ref('No file selected')

const form = ref<DailyLogDraftInput>({
  jobSiteNumbers: '',
  foremanOnSite: '',
  siteForemanAssistant: '',
  projectName: jobName.value,
  manpower: '',
  weeklySchedule: '',
  manpowerAssessment: '',
  manpowerLines: [{ trade: '', count: 0, areas: '' }],
  safetyConcerns: '',
  ahaReviewed: '',
  scheduleConcerns: '',
  budgetConcerns: '',
  deliveriesReceived: '',
  deliveriesNeeded: '',
  newWorkAuthorizations: '',
  qcInspection: '',
  notesCorrespondence: '',
  actionItems: '',
  attachments: [],
})

let unsubscribeLiveLog: (() => void) | null = null
let autoSaveTimeout: NodeJS.Timeout
const creatingDraft = ref(false)

const resetForm = () => {
  form.value = { jobSiteNumbers: '', foremanOnSite: '', siteForemanAssistant: '', projectName: jobName.value, manpower: '', weeklySchedule: '', manpowerAssessment: '', manpowerLines: [{ trade: '', count: 0, areas: '' }], safetyConcerns: '', ahaReviewed: '', scheduleConcerns: '', budgetConcerns: '', deliveriesReceived: '', deliveriesNeeded: '', newWorkAuthorizations: '', qcInspection: '', notesCorrespondence: '', actionItems: '', attachments: [] }
  currentOwnerId.value = auth.user?.uid ?? null
  currentSubmittedAt.value = null
  photoFileName.value = 'No file selected'
  ptpFileName.value = 'No file selected'
}

const stopLiveLog = () => {
  if (unsubscribeLiveLog) {
    unsubscribeLiveLog()
    unsubscribeLiveLog = null
  }
}

const applyDailyLogToForm = (log: DailyLog) => {
  currentOwnerId.value = log.uid
  currentSubmittedAt.value = log.submittedAt
  form.value = { jobSiteNumbers: log.jobSiteNumbers, foremanOnSite: log.foremanOnSite, siteForemanAssistant: log.siteForemanAssistant, projectName: log.projectName, manpower: log.manpower, weeklySchedule: log.weeklySchedule, manpowerAssessment: log.manpowerAssessment, manpowerLines: (log.manpowerLines?.length ? log.manpowerLines : [{ trade: '', count: 0, areas: '' }]), safetyConcerns: log.safetyConcerns, ahaReviewed: log.ahaReviewed, scheduleConcerns: log.scheduleConcerns, budgetConcerns: log.budgetConcerns, deliveriesReceived: log.deliveriesReceived, deliveriesNeeded: log.deliveriesNeeded, newWorkAuthorizations: log.newWorkAuthorizations, qcInspection: log.qcInspection, notesCorrespondence: log.notesCorrespondence, actionItems: log.actionItems, attachments: log.attachments || [] }
}

const startLiveLog = (dailyLogId: string) => {
  stopLiveLog()
  unsubscribeLiveLog = subscribeToDailyLog(jobId.value, dailyLogId, (log) => {
    if (log.id === currentId.value) {
      currentStatus.value = log.status
      applyDailyLogToForm(log)
    }
  }, () => {})
}

const loadLogsForSelectedDate = async (dateStr: string) => {
  try {
    selectedLogs.value = await listDailyLogsForDate(jobId.value, dateStr)
  } catch (e: any) {
    console.error('Failed to load logs for date:', e)
    selectedLogs.value = []
  }
}

const loadLogById = async (logId: string) => {
  err.value = ''
  resetForm()

  try {
    const log = await getDailyLogById(jobId.value, logId)
    if (log) {
      currentId.value = log.id
      currentStatus.value = log.status
      logDate.value = log.logDate
      applyDailyLogToForm(log)
      startLiveLog(log.id)
    } else {
      err.value = 'Log not found'
      toastRef.value?.show('Failed to load daily log', 'error')
    }
  } catch (e: any) {
    err.value = e?.message ?? 'Failed to load daily log'
    toastRef.value?.show('Failed to load daily log', 'error')
  }
}

const loadForDate = async (dateStr: string) => {
  err.value = ''
  currentId.value = null
  currentStatus.value = 'draft'
  resetForm()

  try {
    const isToday = dateStr === today.value

    await loadLogsForSelectedDate(dateStr)

    // Always try to load an existing log for the selected date
    const existingLog = await getMyDailyLogByDate(jobId.value, dateStr)

    if (existingLog) {
      currentId.value = existingLog.id
      currentStatus.value = existingLog.status
      logDate.value = existingLog.logDate
      applyDailyLogToForm(existingLog)
      startLiveLog(existingLog.id)
      return
    }

    // No existing log found. Only create a new draft for today.
    if (!isToday) {
      toastRef.value?.show('No daily log exists for this date.', 'warning')
      stopLiveLog()
      return
    }

    // Prevent duplicate drafts if multiple create requests overlap
    if (creatingDraft.value) return
    creatingDraft.value = true

    // Create new draft for today
    const id = await createDailyLog(jobId.value, dateStr, { ...form.value })
    currentId.value = id
    currentStatus.value = 'draft'
    currentOwnerId.value = auth.user?.uid ?? null
    startLiveLog(id)
    await loadLogsForSelectedDate(dateStr)
  } catch (e: any) {
    err.value = e?.message ?? 'Failed to create daily log'
    toastRef.value?.show('Failed to create daily log', 'error')
  } finally {
    creatingDraft.value = false
  }
}

const startNewDraftForToday = async () => {
  if (creatingDraft.value) return
  if (logDate.value !== today.value) {
    toastRef.value?.show('New drafts can only be created for today.', 'warning')
    return
  }
  creatingDraft.value = true
  err.value = ''
  try {
    resetForm()
    const id = await createDailyLog(jobId.value, today.value, { ...form.value })
    currentId.value = id
    currentStatus.value = 'draft'
    currentOwnerId.value = auth.user?.uid ?? null
    startLiveLog(id)
    await loadLogsForSelectedDate(today.value)
    toastRef.value?.show('New draft created for today.', 'success')
  } catch (e: any) {
    err.value = e?.message ?? 'Failed to create new draft'
    toastRef.value?.show('Failed to create new draft', 'error')
  } finally {
    creatingDraft.value = false
  }
}

const handleFileChange = async (e: Event, type: 'photo' | 'ptp') => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    if (type === 'photo') {
      photoFileName.value = file.name
    } else {
      ptpFileName.value = file.name
    }
  } else {
    if (type === 'photo') photoFileName.value = 'No file selected'
    else ptpFileName.value = 'No file selected'
  }

  await uploadAttachment(e, type)
  input.value = ''
}

const init = async () => {
  loading.value = true
  err.value = ''
  try {
    // Load job details
    await jobs.fetchJob(jobId.value)
    
    // Clean up any old deleted logs (best-effort)
    try {
      await cleanupDeletedLogs(jobId.value)
    } catch (cleanupError) {
      console.warn('Cleanup deleted logs failed', cleanupError)
    }
    
    // Load email recipients (best-effort)
    try {
      jobEmailRecipients.value = await getDailyLogRecipients(jobId.value)
    } catch (recipientError) {
      console.warn('Failed to load daily log recipients', recipientError)
      jobEmailRecipients.value = []
    }

    await loadLogsForSelectedDate(logDate.value)
    await loadForDate(logDate.value)
  } catch (e: any) {
    err.value = e?.message ?? 'Failed to load daily logs'
    toastRef.value?.show('Failed to load daily logs', 'error')
  } finally {
    loading.value = false
  }
}

const autoSave = async () => {
  if (!currentId.value || !canEditDraft.value) return
  clearTimeout(autoSaveTimeout)
  autoSaveTimeout = setTimeout(async () => {
    try {
      saving.value = true
      await updateDailyLog(jobId.value, currentId.value!, { ...form.value })
    } catch (e: any) {
      console.error('Auto-save failed:', e)
    } finally {
      saving.value = false
    }
  }, 1000)
}

const saveDraft = async () => {
  if (!currentId.value || currentStatus.value !== 'draft') return
  saving.value = true
  err.value = ''
  try {
    await updateDailyLog(jobId.value, currentId.value, { ...form.value })
    await loadLogsForSelectedDate(logDate.value)
  } catch (e: any) {
    err.value = e?.message ?? 'Failed to save daily log'
    toastRef.value?.show('Failed to save daily log', 'error')
  } finally {
    saving.value = false
  }
}

const submit = async () => {
  if (!currentId.value || currentStatus.value !== 'draft') {
    toastRef.value?.show('Cannot submit this daily log', 'error')
    return
  }
  
  saving.value = true
  err.value = ''
  try {
    await updateDailyLog(jobId.value, currentId.value, { ...form.value })
    await submitDailyLog(jobId.value, currentId.value)
    currentStatus.value = 'submitted'
    await loadLogsForSelectedDate(logDate.value)
    
    if (jobEmailRecipients.value.length > 0) {
      try {
        await jobService.sendDailyLogEmail({ jobId: jobId.value, dailyLogId: currentId.value, recipients: jobEmailRecipients.value })
        toastRef.value?.show('Daily log submitted and emailed successfully!', 'success')
      } catch (emailError: any) {
        toastRef.value?.show('Daily log submitted, but email failed to send', 'warning')
      }
    } else {
      toastRef.value?.show('Daily log submitted successfully!', 'success')
    }
  } catch (e: any) {
    err.value = e?.message ?? 'Failed to submit daily log'
    toastRef.value?.show('Failed to submit daily log', 'error')
  } finally {
    saving.value = false
  }
}

const addEmailRecipient = async () => {
  const email = newEmailRecipient.value.trim()
  if (!email || !isValidEmail(email)) {
    toastRef.value?.show('Please enter a valid email address', 'error')
    return
  }
  if (jobEmailRecipients.value.includes(email)) {
    toastRef.value?.show('Email already in the list', 'warning')
    return
  }
  
  savingRecipients.value = true
  try {
    const updated = [...jobEmailRecipients.value, email]
    await updateDailyLogRecipients(jobId.value, updated)
    jobEmailRecipients.value = updated
    newEmailRecipient.value = ''
    toastRef.value?.show('Email recipient added', 'success')
  } catch (e: any) {
    toastRef.value?.show('Failed to add email recipient', 'error')
  } finally {
    savingRecipients.value = false
  }
}

const removeEmailRecipient = async (email: string) => {
  savingRecipients.value = true
  try {
    const updated = jobEmailRecipients.value.filter(e => e !== email)
    await updateDailyLogRecipients(jobId.value, updated)
    jobEmailRecipients.value = updated
    toastRef.value?.show('Email recipient removed', 'success')
  } catch (e: any) {
    toastRef.value?.show('Failed to remove email recipient', 'error')
  } finally {
    savingRecipients.value = false
  }
}

const deleteDraft = async () => {
  if (!currentId.value || currentStatus.value !== 'draft') {
    toastRef.value?.show('Can only delete draft logs', 'error')
    return
  }

  if (!confirm('Are you sure you want to delete this draft?')) return

  saving.value = true
  try {
    await deleteDailyLog(jobId.value, currentId.value)
    currentId.value = null
    resetForm()
    await loadLogsForSelectedDate(logDate.value)
    await loadForDate(today.value)
    toastRef.value?.show('Daily log deleted', 'success')
  } catch (e: any) {
    err.value = e?.message ?? 'Failed to delete daily log'
    toastRef.value?.show('Failed to delete daily log', 'error')
  } finally {
    saving.value = false
  }
}

const deleteLogById = async (logId: string) => {
  if (!confirm('Are you sure you want to delete this draft?')) return

  saving.value = true
  try {
    await deleteDailyLog(jobId.value, logId)
    if (currentId.value === logId) {
      currentId.value = null
      resetForm()
      await loadForDate(today.value)
    }
    await loadLogsForSelectedDate(logDate.value)
    toastRef.value?.show('Daily log deleted', 'success')
  } catch (e: any) {
    toastRef.value?.show('Failed to delete daily log', 'error')
  } finally {
    saving.value = false
  }
}

const uploadAttachment = async (event: Event, type: 'photo' | 'ptp' | 'other') => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || !currentId.value) {
    if (!file) toastRef.value?.show('Please select a file', 'error')
    if (!currentId.value) toastRef.value?.show('Please save the daily log first', 'error')
    return
  }
  
  // Validate file size (max 10MB)
  const maxSize = 10 * 1024 * 1024
  if (file.size > maxSize) {
    toastRef.value?.show('File size must be less than 10MB', 'error')
    return
  }
  
  // Validate file type (images only)
  if (!file.type.startsWith('image/')) {
    toastRef.value?.show('Please select an image file', 'error')
    return
  }
  
  uploading.value = true
  try {
    const att = await uploadPhotoToStorage(file, currentId.value, type)
    if (!form.value.attachments) form.value.attachments = []
    form.value.attachments.push(att)
    await updateDailyLog(jobId.value, currentId.value, { ...form.value })
    toastRef.value?.show(`${type === 'ptp' ? 'PTP Photo' : 'Photo'} uploaded: ${file.name}`, 'success');
    (event.target as HTMLInputElement).value = ''
  } catch (e: any) {
    console.error('[uploadAttachment] Error:', e)
    const errorMsg = e?.message || 'Failed to upload file'
    err.value = errorMsg
    toastRef.value?.show(`Upload failed: ${errorMsg}`, 'error')
  } finally {
    uploading.value = false
  }
}

const deleteAttachment = async (path: string) => {
  uploading.value = true
  try {
    await deleteAttachmentFile(path)
    form.value.attachments = form.value.attachments?.filter(a => a.path !== path) || []
    if (currentId.value) await updateDailyLog(jobId.value, currentId.value, { ...form.value })
    toastRef.value?.show('Photo removed', 'success')
  } catch (e: any) {
    err.value = e?.message || 'Failed to delete photo'
    toastRef.value?.show('Failed to delete photo', 'error')
  } finally {
    uploading.value = false
  }
}

const sendEmail = async () => {
  if (!currentId.value || !jobEmailRecipients.value.length) {
    toastRef.value?.show('No recipients selected', 'warning')
    return
  }

  saving.value = true
  try {
    await jobService.sendDailyLogEmail({
      jobId: jobId.value,
      dailyLogId: currentId.value,
      recipients: jobEmailRecipients.value,
    })
    toastRef.value?.show(`Email sent to ${jobEmailRecipients.value.length} recipient(s)`, 'success')
  } catch (e: any) {
    err.value = e?.message ?? 'Failed to send email'
    toastRef.value?.show('Failed to send email', 'error')
    console.error('[sendEmail] Error:', e)
  } finally {
    saving.value = false
  }
}

const addManpowerLine = () => {
  form.value.manpowerLines.push({ trade: '', count: 0, areas: '', addedByUserId: auth.user?.uid })
  autoSave()
}

const canDeleteManpowerLine = (line: any): boolean => {
  // Can delete if the current user added it (or it has no addedByUserId for backward compatibility)
  return !line.addedByUserId || line.addedByUserId === auth.user?.uid
}

const isAdminAddedLine = (line: any): boolean => {
  // Line was added by admin if it has a different addedByUserId than current user
  return !!line.addedByUserId && line.addedByUserId !== auth.user?.uid
}

onMounted(init)
onUnmounted(stopLiveLog)
</script>

<template>
  <Toast ref="toastRef" />
  
  <div class="container-fluid py-4 wide-container-1200">
    <!-- Header -->
    <div class="d-flex justify-content-between align-items-center mb-4 header-hero">
      <div>
        <div class="text-muted small mb-1">Job Daily Log</div>
        <h2 class="h3 mb-1">{{ jobName }}</h2>
        <div class="text-muted small d-flex align-items-center gap-2">
          <span v-if="jobCode">Job Number: {{ jobCode }}</span>
        </div>
      </div>
      <div class="d-flex align-items-center gap-2">
        <span class="badge rounded-pill text-bg-secondary">{{ logsForSelectedDate.length }} for {{ logDate }}</span>
        <span v-if="currentStatus === 'draft'" class="badge rounded-pill text-bg-warning">Draft</span>
        <span v-else class="badge rounded-pill text-bg-success">Submitted</span>
      </div>
    </div>

    <!-- Date & Status Controls -->
    <div class="card mb-4 status-card">
      <div class="card-body">
        <div class="row align-items-center g-3">
          <div class="col-md-4">
            <label class="form-label small text-muted mb-1">Date</label>
            <div class="input-group input-group-sm">
              <span class="input-group-text bg-light"><i class="bi bi-calendar-date"></i></span>
              <input type="date" class="form-control" v-model="logDate" @change="loadForDate(logDate)" />
            </div>
          </div>
          <div class="col-md-4 d-flex flex-column gap-1">
            <div class="text-muted small">Status</div>
            <div class="d-flex flex-wrap gap-2">
              <span v-if="currentStatus === 'draft'" class="badge rounded-pill text-bg-warning">Draft (auto-saved)</span>
              <span v-else class="badge rounded-pill text-bg-success">Submitted</span>
              <span v-if="logDate !== today && currentStatus === 'draft'" class="badge rounded-pill text-bg-danger"><i class="bi bi-exclamation-triangle me-1"></i>{{ logDate > today ? 'Future' : 'Past' }} draft</span>
              <span v-if="logDate !== today && currentStatus === 'submitted'" class="badge rounded-pill text-bg-info"><i class="bi bi-eye me-1"></i>View only</span>
            </div>
            <div v-if="currentStatus === 'submitted' && currentSubmittedAt" class="text-muted small">Submitted: {{ new Date(currentSubmittedAt.toDate?.() || currentSubmittedAt).toLocaleString() }}</div>
          </div>
          <div class="col-md-4 d-flex justify-content-md-end align-items-center gap-2">
            <button v-if="logDate === today && currentStatus === 'submitted'" type="button" class="btn btn-outline-primary btn-sm" @click="startNewDraftForToday" :disabled="creatingDraft">
              <span v-if="creatingDraft" class="spinner-border spinner-border-sm me-2"></span>
              New draft for today
            </button>
            <span v-if="saving" class="text-muted small d-flex align-items-center gap-1"><i class="bi bi-hourglass-split"></i>Saving…</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Past/Future Draft Warning -->
    <div v-if="logDate !== today && currentStatus === 'draft'" class="alert alert-warning">
      <i class="bi bi-exclamation-triangle-fill me-2"></i><strong>{{ logDate > today ? 'Future' : 'Past' }} Draft:</strong> This daily log is from a {{ logDate > today ? 'future' : 'previous' }} date and cannot be edited.
    </div>

    <!-- Form Grid -->
    <div class="row g-4">
      <!-- Main Form -->
      <div class="col-lg-8">
        <!-- Site Information -->
        <div class="card mb-4">
          <div class="card-header bg-light"><h5 class="mb-0"><i class="bi bi-briefcase me-2"></i>Site Information</h5></div>
          <div class="card-body">
            <div class="row g-3">
              <div class="col-12">
                <label class="form-label">Project Name</label>
                <input type="text" class="form-control" :value="jobName" disabled />
              </div>
              <div class="col-12">
                <label class="form-label">Job Site Numbers / Other Notes</label>
                <input type="text" class="form-control" v-model="form.jobSiteNumbers" @input="autoSave" :disabled="!canEditDraft" />
              </div>
              <div class="col-12">
                <label class="form-label">Foreman on Site</label>
                <input type="text" class="form-control" v-model="form.foremanOnSite" @input="autoSave" :disabled="!canEditDraft" />
              </div>
              <div class="col-12">
                <label class="form-label">Site Foreman Assistant</label>
                <input type="text" class="form-control" v-model="form.siteForemanAssistant" @input="autoSave" :disabled="!canEditDraft" />
              </div>
            </div>
          </div>
        </div>

        <!-- Manpower -->
        <div class="card mb-4">
          <div class="card-header bg-light"><h5 class="mb-0"><i class="bi bi-people me-2"></i>Manpower</h5></div>
          <div class="card-body">
            <div class="row g-3">
              <div class="col-12">
                <label class="form-label">Manpower</label>
                <div class="table-responsive">
                  <table class="table table-sm table-striped table-hover mb-0">
                    <thead>
                      <tr>
                        <th class="small fw-semibold col-trade">Trade</th>
                        <th class="small fw-semibold text-center col-count">Count</th>
                        <th class="small fw-semibold col-areas">Areas</th>
                        <th class="text-center col-actions">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(ln, idx) in form.manpowerLines" :key="idx">
                        <td class="p-2">
                          <input 
                            type="text"
                            class="form-control form-control-sm" 
                            placeholder="Trade" 
                            v-model="(ln as any).trade" 
                            :disabled="!canEditDraft" 
                          />
                        </td>
                        <td class="p-2">
                          <input 
                            type="number" 
                            min="0" 
                            class="form-control form-control-sm text-center" 
                            placeholder="0" 
                            v-model.number="(ln as any).count" 

                            :disabled="!canEditDraft"
                          />
                        </td>
                        <td class="p-2">
                          <div class="d-flex gap-2 align-items-center">
                            <input 
                              type="text"
                              class="form-control form-control-sm" 
                              placeholder="Areas (optional)" 
                              v-model="(ln as any).areas"

                              :disabled="!canEditDraft"
                            />
                            <span v-if="isAdminAddedLine(ln)" class="badge bg-info flex-shrink-0 badge-admin">admin</span>
                          </div>
                        </td>
                        <td class="p-2 text-center">
                          <button 
                            v-if="idx > 0 && canDeleteManpowerLine(ln)" 
                            type="button" 
                            class="btn btn-outline-danger btn-sm" 
                            @click="form.manpowerLines.splice(idx, 1); autoSave();" 
                            :disabled="!canEditDraft"
                            title="Delete row"
                          >
                            <i class="bi bi-trash"></i>
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <button 
                  type="button" 
                  class="btn btn-outline-primary btn-sm mt-2" 
                  @click="addManpowerLine" 
                  :disabled="!canEditDraft"
                >
                  <i class="bi bi-plus-lg me-1"></i>Add Trade
                </button>
              </div>
              <div class="col-12">
                <label class="form-label">Weekly Schedule</label>
                <textarea class="form-control" rows="4" v-model="form.weeklySchedule" @input="autoSave" :disabled="!canEditDraft"></textarea>
              </div>
              <div class="col-12">
                <label class="form-label">Manpower Assessment</label>
                <textarea class="form-control" rows="3" v-model="form.manpowerAssessment" @input="autoSave" :disabled="!canEditDraft"></textarea>
              </div>
            </div>
          </div>
        </div>

        <!-- Safety & Concerns -->
        <div class="card mb-4">
          <div class="card-header bg-light"><h5 class="mb-0"><i class="bi bi-exclamation-triangle me-2"></i>Safety & Concerns</h5></div>
          <div class="card-body">
            <div class="row g-3">
              <div class="col-12">
                <label class="form-label">Safety Concerns</label>
                <textarea class="form-control" rows="3" v-model="form.safetyConcerns" @input="autoSave" :disabled="!canEditDraft"></textarea>
              </div>
              <div class="col-12">
                <label class="form-label">AHA Reviewed</label>
                <textarea class="form-control" rows="2" v-model="form.ahaReviewed" placeholder="Enter AHA review notes" @input="autoSave" :disabled="!canEditDraft"></textarea>
              </div>
              <div class="col-12">
                <label class="form-label">Photos</label>
                <input type="file" class="form-control mb-2" accept="image/*" @change="(e) => handleFileChange(e, 'photo')" :disabled="!canEditDraft || uploading" />
                <small class="text-muted d-block mb-3">{{ photoFileName }}</small>
                <div v-if="form.attachments?.filter(a => a.type !== 'ptp').length" class="row g-2">
                  <div v-for="att in form.attachments.filter(a => a.type !== 'ptp')" :key="att.path" class="col-6 col-md-4">
                    <div class="card">
                      <img :src="att.url" class="card-img-top thumb-image" />
                      <div class="card-body p-2">
                        <button type="button" class="btn btn-sm btn-outline-danger w-100" @click="deleteAttachment(att.path)" :disabled="uploading"><i class="bi bi-trash me-1"></i>Remove</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="col-12">
                <label class="form-label">PTP Photos</label>
                <input type="file" class="form-control mb-2" accept="image/*" @change="(e) => handleFileChange(e, 'ptp')" :disabled="!canEditDraft || uploading" />
                <small class="text-muted d-block mb-3">{{ ptpFileName }}</small>
                <div v-if="form.attachments?.filter(a => a.type === 'ptp').length" class="row g-2">
                  <div v-for="att in form.attachments.filter(a => a.type === 'ptp')" :key="att.path" class="col-6 col-md-4">
                    <div class="card">
                      <img :src="att.url" class="card-img-top thumb-image" />
                      <div class="card-body p-2">
                        <button type="button" class="btn btn-sm btn-outline-danger w-100" @click="deleteAttachment(att.path)" :disabled="uploading"><i class="bi bi-trash me-1"></i>Remove</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="col-12">
                <label class="form-label">Schedule Concerns</label>
                <textarea class="form-control" rows="3" v-model="form.scheduleConcerns" @input="autoSave" :disabled="!canEditDraft"></textarea>
              </div>
              <div class="col-12">
                <label class="form-label">Budget Concerns</label>
                <textarea class="form-control" rows="3" v-model="form.budgetConcerns" @input="autoSave" :disabled="!canEditDraft"></textarea>
              </div>
            </div>
          </div>
        </div>

        <!-- Deliveries -->
        <div class="card mb-4">
          <div class="card-header bg-light"><h5 class="mb-0"><i class="bi bi-box-seam me-2"></i>Deliveries & Materials</h5></div>
          <div class="card-body">
            <div class="row g-3">
              <div class="col-12"><label class="form-label">Deliveries Received</label><textarea class="form-control" rows="3" v-model="form.deliveriesReceived" @input="autoSave" :disabled="!canEditDraft"></textarea></div>
              <div class="col-12"><label class="form-label">Deliveries Needed</label><textarea class="form-control" rows="3" v-model="form.deliveriesNeeded" @input="autoSave" :disabled="!canEditDraft"></textarea></div>
              <div class="col-12"><label class="form-label">New Work Authorizations</label><textarea class="form-control" rows="3" v-model="form.newWorkAuthorizations" @input="autoSave" :disabled="!canEditDraft"></textarea></div>
              <div class="col-12"><label class="form-label">QC Inspection</label><textarea class="form-control" rows="3" v-model="form.qcInspection" @input="autoSave" :disabled="!canEditDraft"></textarea></div>
            </div>
          </div>
        </div>

        <!-- Notes -->
        <div class="card mb-4">
          <div class="card-header bg-light"><h5 class="mb-0"><i class="bi bi-chat-left-text me-2"></i>Notes & Action Items</h5></div>
          <div class="card-body">
            <div class="row g-3">
              <div class="col-12"><label class="form-label">Notes & Correspondence</label><textarea class="form-control" rows="3" v-model="form.notesCorrespondence" @input="autoSave" :disabled="!canEditDraft"></textarea></div>
              <div class="col-12"><label class="form-label">Action Items</label><textarea class="form-control" rows="3" v-model="form.actionItems" @input="autoSave" :disabled="!canEditDraft"></textarea></div>
            </div>
          </div>
        </div>

        <!-- Error Alert -->
        <div v-if="err" class="alert alert-danger"><strong>Error:</strong> {{ err }}</div>

        <!-- Action Buttons -->
        <div class="d-grid gap-2">
          <button v-if="currentStatus === 'draft' && canEditDraft" @click="saveDraft" :disabled="saving" class="btn btn-primary"><i class="bi bi-check-circle me-2"></i>Save Draft</button>
          <button v-if="currentStatus === 'draft'" @click="submit" :disabled="saving" class="btn btn-success"><i class="bi bi-send me-2"></i>Submit</button>
          <button v-if="currentStatus === 'draft'" @click="deleteDraft" :disabled="saving" class="btn btn-outline-danger"><i class="bi bi-trash me-2"></i>Delete Draft</button>
          <div v-if="currentStatus !== 'draft' && logsForSelectedDate.some(r => r.logDate === today && r.status === 'submitted')" class="alert alert-info mb-0"><small><i class="bi bi-info-circle me-1"></i>Daily log already submitted for today</small></div>
          <button v-if="currentStatus === 'submitted' && jobEmailRecipients.length" @click="sendEmail" :disabled="saving" class="btn btn-info"><i class="bi bi-envelope me-2"></i>Send Email</button>
        </div>
      </div>

      <!-- Sidebar -->
      <div class="col-lg-4">
        <!-- Logs for Selected Date -->
        <div class="card mb-4 panel-muted">
          <div class="card-header bg-light d-flex align-items-center justify-content-between">
            <h5 class="mb-0"><i class="bi bi-journal-text me-2"></i>Logs for {{ logDate }}</h5>
            <span class="badge text-bg-secondary">{{ logsForSelectedDate.length }}</span>
          </div>
          <div class="card-body p-0">
            <div v-if="logsForSelectedDate.length" class="list-group list-group-flush">
              <button
                v-for="log in logsForSelectedDate"
                :key="log.id"
                type="button"
                class="list-group-item list-group-item-action d-flex justify-content-between align-items-start"
                @click="loadLogById(log.id)"
              >
                <div class="me-2">
                  <div class="fw-semibold">{{ log.status === 'submitted' ? 'Submitted' : 'Draft' }}</div>
                  <div class="text-muted small">{{ formatTimestamp(log.submittedAt || log.updatedAt || log.createdAt) || 'Time not available' }}</div>
                </div>
                <div class="d-flex flex-column align-items-end">
                  <span :class="['badge', log.status === 'submitted' ? 'text-bg-success' : 'text-bg-warning']">{{ log.status }}</span>
                  <span v-if="log.uid === auth.user?.uid" class="text-muted small mt-1">You</span>
                </div>
              </button>
            </div>
            <div v-else class="text-muted small text-center py-3">No logs for this date yet</div>
          </div>
        </div>

        <!-- Email Recipients -->
        <div class="card mb-4">
          <div class="card-header bg-light"><h5 class="mb-0"><i class="bi bi-envelope me-2"></i>Email Recipients</h5></div>
          <div class="card-body">
            <div class="mb-3">
              <input type="email" class="form-control mb-2" v-model="newEmailRecipient" placeholder="Enter email" :disabled="savingRecipients" />
              <button @click="addEmailRecipient" :disabled="savingRecipients" class="btn btn-primary w-100 btn-sm"><i class="bi bi-plus me-1"></i>Add</button>
            </div>
            <div v-if="jobEmailRecipients.length" class="list-group">
              <div v-for="email in jobEmailRecipients" :key="email" class="list-group-item d-flex justify-content-between align-items-center">
                <small>{{ email }}</small>
                <button @click="removeEmailRecipient(email)" :disabled="savingRecipients" class="btn btn-outline-danger btn-sm"><i class="bi bi-trash"></i></button>
              </div>
            </div>
            <div v-else class="text-muted small text-center py-3">No recipients yet</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;
/* Make disabled form controls appear more clearly as read-only */
.form-control:disabled,
.form-control[readonly],
textarea:disabled,
textarea[readonly],
input:disabled,
input[readonly] {
  background-color: $surface-3;
  color: $text-muted-2;
  border-color: $border-color;
  cursor: not-allowed;
  opacity: 1;
}

.form-check-input:disabled {
  opacity: 0.5;
}

/* Dark theme for file pickers */
input[type='file'].form-control {
  background-color: $surface-2;
  color: $body-color;
  border-color: $border-color;
}

input[type='file'].form-control::file-selector-button {
  background-color: $surface-3;
  color: $body-color;
  border-color: $border-color;
}

input[type='file'].form-control:hover::file-selector-button,
input[type='file'].form-control:focus::file-selector-button {
  background-color: lighten($surface-3, 4%);
}

/* File input feedback */
[data-filename]::after {
  content: attr(data-filename);
  color: $success;
  font-weight: 500;
}

.header-hero {
  background: linear-gradient(140deg, rgba($primary, 0.24) 0%, rgba($primary-200, 0.8) 55%, $surface-2 100%);
  border: 1px solid rgba(230, 237, 247, 0.12);
  border-radius: 12px;
  padding: 16px 20px;
}

.status-card {
  border: 1px solid rgba(230, 237, 247, 0.12);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
  background: linear-gradient(180deg, rgba($primary-50, 0.9) 0%, $surface-2 100%);
}

.panel-muted {
  border: 1px solid rgba(230, 237, 247, 0.12);
  background: $surface;
}

.panel-muted .list-group-item {
  border-color: rgba(230, 237, 247, 0.08);
}

.card-header.bg-light {
  background: $surface-2 !important;
}

.wide-container-1200 {
  max-width: 1200px;
}

.col-trade { width: 40%; }
.col-count { width: 20%; }
.col-areas { width: 35%; }
.col-actions { width: 5%; }

.badge-admin {
  white-space: nowrap;
  font-size: 0.75rem;
  padding: 4px 6px;
}

.thumb-image {
  height: 150px;
  object-fit: cover;
}
</style>
