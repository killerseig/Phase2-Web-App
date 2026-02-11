<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { isValidEmail } from '../utils/emailValidation'
import Toast from '../components/Toast.vue'
import {
  createDailyLog,
  getMyDailyLogByDate,
  getDailyLogById,
  listAllDailyLogs,
  submitDailyLog,
  updateDailyLog,
  deleteDailyLog,
  cleanupDeletedLogs,
  subscribeToDailyLog,
  type DailyLog,
  type DailyLogDraftInput,
} from '../services/DailyLogs'
import { uploadAttachment as uploadPhotoToStorage, deleteAttachmentFile } from '../services/Storage'
import { useJobService } from '../services/useJobService'
import { EMAIL_UI_ENABLED } from '../config'
import { getDailyLogRecipients, updateDailyLogRecipients } from '../services/Jobs'
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
const recent = ref<DailyLog[]>([])
const currentId = ref<string | null>(null)
const currentStatus = ref<'draft' | 'submitted'>('draft')
const currentOwnerId = ref<string | null>(null)
const currentSubmittedAt = ref<any>(null)
const logDate = ref(new Date().toISOString().slice(0, 10))
const jobEmailRecipients = ref<string[]>([])
const newEmailRecipient = ref('')
const savingRecipients = ref(false)

const HARDCODED_EMAILS: string[] = []

const canEditDraft = computed(() => currentOwnerId.value === auth.user?.uid)

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

const resetForm = () => {
  form.value = { jobSiteNumbers: '', foremanOnSite: '', siteForemanAssistant: '', projectName: jobName.value, manpower: '', weeklySchedule: '', manpowerAssessment: '', manpowerLines: [{ trade: '', count: 0, areas: '' }], safetyConcerns: '', ahaReviewed: '', scheduleConcerns: '', budgetConcerns: '', deliveriesReceived: '', deliveriesNeeded: '', newWorkAuthorizations: '', qcInspection: '', notesCorrespondence: '', actionItems: '', attachments: [] }
  currentOwnerId.value = auth.user?.uid ?? null
  currentSubmittedAt.value = null
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

const loadRecent = async () => {
  try {
    recent.value = await listAllDailyLogs(jobId.value, 25)
    console.log('Recent logs loaded:', recent.value)
  } catch (e: any) {
    console.error('Failed to load recent logs:', e)
    recent.value = []
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
    // First, try to load existing daily log for this date
    const existingLog = await getMyDailyLogByDate(jobId.value, dateStr)
    
    if (existingLog) {
      // Load existing draft
      currentId.value = existingLog.id
      currentStatus.value = existingLog.status
      applyDailyLogToForm(existingLog)
      startLiveLog(existingLog.id)
    } else {
      // Create new draft if none exists
      const id = await createDailyLog(jobId.value, dateStr, { ...form.value })
      currentId.value = id
      currentStatus.value = 'draft'
      currentOwnerId.value = auth.user?.uid ?? null
      startLiveLog(id)
    }
  } catch (e: any) {
    err.value = e?.message ?? 'Failed to create daily log'
    toastRef.value?.show('Failed to create daily log', 'error')
  }
}

const init = async () => {
  loading.value = true
  err.value = ''
  try {
    // Load job details
    await jobs.fetchJob(jobId.value)
    
    // Clean up any old deleted logs
    await cleanupDeletedLogs(jobId.value)
    
    jobEmailRecipients.value = await getDailyLogRecipients(jobId.value)
    await loadRecent()
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
    await loadRecent()
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
    await loadRecent()
    
    const allRecipients = [...HARDCODED_EMAILS, ...jobEmailRecipients.value]
    if (allRecipients.length > 0) {
      try {
        await jobService.sendDailyLogEmail({ jobId: jobId.value, dailyLogId: currentId.value, recipients: allRecipients })
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
    await loadRecent()
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
    await loadRecent()
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
  
  <div class="container-fluid py-4" style="max-width: 1200px;">
    <!-- Header -->
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h2 class="h3 mb-1">{{ jobName }}</h2>
        <div class="text-muted small d-flex align-items-center gap-2">
          <span v-if="jobCode">Job Number: {{ jobCode }}</span>
        </div>
      </div>
    </div>

    <!-- Date & Status Controls -->
    <div class="card mb-4">
      <div class="card-body">
        <div class="row align-items-end g-3">
          <div class="col-auto">
            <label class="form-label mb-0">Date</label>
            <input type="date" class="form-control" v-model="logDate" @change="loadForDate(logDate)" />
          </div>
          <div class="col-auto">
            <span class="text-muted">Status:</span>
            <span class="ms-2">
              <span v-if="currentStatus === 'draft'" class="badge text-bg-warning">Draft (Auto-saved)</span>
              <span v-else class="badge text-bg-success">Submitted</span>
            </span>
          </div>
          <div v-if="currentStatus === 'submitted' && currentSubmittedAt" class="col-auto">
            <span class="text-muted small">Submitted: {{ new Date(currentSubmittedAt.toDate?.() || currentSubmittedAt).toLocaleString() }}</span>
          </div>
          <div v-if="logDate !== today && currentStatus === 'draft'" class="col-auto">
            <span class="badge text-bg-danger"><i class="bi bi-exclamation-triangle me-1"></i>Past Draft (View Only)</span>
          </div>
          <div v-if="logDate !== today && currentStatus === 'submitted'" class="col-auto">
            <span class="badge text-bg-info"><i class="bi bi-eye me-1"></i>View Only</span>
          </div>
          <div v-if="saving" class="col-auto ms-auto">
            <span class="text-muted small"><i class="bi bi-hourglass-split"></i> Saving...</span>
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
                <div class="table-responsive" style="border: 1px solid #dee2e6; border-radius: 4px;">
                  <table class="table table-sm table-striped table-hover mb-0">
                    <thead class="table-light" style="background-color: #f0f0f0;">
                      <tr style="border-bottom: 2px solid #dee2e6;">
                        <th style="width: 40%;" class="small fw-semibold">Trade</th>
                        <th style="width: 20%;" class="small fw-semibold text-center">Count</th>
                        <th style="width: 35%;" class="small fw-semibold">Areas</th>
                        <th style="width: 5%;" class="text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(ln, idx) in form.manpowerLines" :key="idx" style="border-bottom: 1px solid #dee2e6;">
                        <td style="padding: 8px;">
                          <input 
                            type="text"
                            class="form-control form-control-sm" 
                            placeholder="Trade" 
                            v-model="(ln as any).trade" 
                            :disabled="!canEditDraft" 
                          />
                        </td>
                        <td style="padding: 8px;">
                          <input 
                            type="number" 
                            min="0" 
                            class="form-control form-control-sm text-center" 
                            placeholder="0" 
                            v-model.number="(ln as any).count" 

                            :disabled="!canEditDraft"
                          />
                        </td>
                        <td style="padding: 8px;">
                          <div class="d-flex gap-2 align-items-center">
                            <input 
                              type="text"
                              class="form-control form-control-sm" 
                              placeholder="Areas (optional)" 
                              v-model="(ln as any).areas"

                              :disabled="!canEditDraft"
                            />
                            <span v-if="isAdminAddedLine(ln)" class="badge bg-info flex-shrink-0" style="white-space: nowrap; font-size: 0.75rem; padding: 4px 6px;">admin</span>
                          </div>
                        </td>
                        <td style="padding: 8px;" class="text-center">
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
                <input type="file" class="form-control mb-2" accept="image/*" @change="(e) => { const filename = (e.target as HTMLInputElement).files?.[0]?.name; if (filename) { (e.target as HTMLInputElement).nextElementSibling?.setAttribute('data-filename', filename) }; uploadAttachment(e, 'photo'); (e.target as HTMLInputElement).value = '' }" :disabled="!canEditDraft || uploading" />
                <small class="text-muted d-block mb-3" data-filename="">No file selected</small>
                <div v-if="form.attachments?.filter(a => a.type !== 'ptp').length" class="row g-2">
                  <div v-for="att in form.attachments.filter(a => a.type !== 'ptp')" :key="att.path" class="col-6 col-md-4">
                    <div class="card">
                      <img :src="att.url" class="card-img-top" style="height: 150px; object-fit: cover;" />
                      <div class="card-body p-2">
                        <button type="button" class="btn btn-sm btn-outline-danger w-100" @click="deleteAttachment(att.path)" :disabled="uploading"><i class="bi bi-trash me-1"></i>Remove</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="col-12">
                <label class="form-label">PTP Photos</label>
                <input type="file" class="form-control mb-2" accept="image/*" @change="(e) => { const filename = (e.target as HTMLInputElement).files?.[0]?.name; if (filename) { (e.target as HTMLInputElement).nextElementSibling?.setAttribute('data-filename', filename) }; uploadAttachment(e, 'ptp'); (e.target as HTMLInputElement).value = '' }" :disabled="!canEditDraft || uploading" />
                <small class="text-muted d-block mb-3" data-filename="">No file selected</small>
                <div v-if="form.attachments?.filter(a => a.type === 'ptp').length" class="row g-2">
                  <div v-for="att in form.attachments.filter(a => a.type === 'ptp')" :key="att.path" class="col-6 col-md-4">
                    <div class="card">
                      <img :src="att.url" class="card-img-top" style="height: 150px; object-fit: cover;" />
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
          <button v-if="currentStatus === 'draft'" @click="submit" :disabled="saving || recent.some(r => r.logDate === today && r.status === 'submitted')" class="btn btn-success"><i class="bi bi-send me-2"></i>Submit</button>
          <button v-if="currentStatus === 'draft'" @click="deleteDraft" :disabled="saving" class="btn btn-outline-danger"><i class="bi bi-trash me-2"></i>Delete Draft</button>
          <div v-if="recent.some(r => r.logDate === today && r.status === 'submitted')" class="alert alert-info mb-0"><small><i class="bi bi-info-circle me-1"></i>Daily log already submitted for today</small></div>
          <button v-if="currentStatus === 'submitted' && jobEmailRecipients.length" @click="sendEmail" :disabled="saving" class="btn btn-info"><i class="bi bi-envelope me-2"></i>Send Email</button>
        </div>
      </div>

      <!-- Sidebar -->
      <div class="col-lg-4">
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

<style scoped>
/* Make disabled form controls appear more clearly as read-only */
.form-control:disabled,
.form-control[readonly],
textarea:disabled,
textarea[readonly],
input:disabled,
input[readonly] {
  background-color: #f0f0f0;
  color: #666;
  border-color: #ddd;
  cursor: not-allowed;
  opacity: 1;
}

.form-check-input:disabled {
  opacity: 0.5;
}

/* File input feedback */
[data-filename]::after {
  content: attr(data-filename);
  color: #198754;
  font-weight: 500;
}
</style>
