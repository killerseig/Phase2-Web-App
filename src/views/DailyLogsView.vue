<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useToastMessages } from '@/composables/useToastMessages'
import { useRoute } from 'vue-router'
import ImageUploadPicker from '@/components/ImageUploadPicker.vue'
import AppShell from '@/layouts/AppShell.vue'
import {
  DAILY_LOG_INDOOR_CLIMATE_COLUMNS,
  DAILY_LOG_MANPOWER_COLUMNS,
  DAILY_LOG_SITE_INFO_FIELDS,
  DAILY_LOG_SUBMIT_REQUIRED_TEXT_FIELDS,
  cloneDailyLogPayload,
  createEmptyDailyLogPayload,
  createEmptyIndoorClimateReading,
  createEmptyManpowerLine,
  getDailyLogTextSection,
} from '@/features/dailyLogs/schema'
import {
  createDailyLogRecord,
  deleteDailyLogAttachment,
  deleteDailyLogRecord,
  subscribeDailyLogsForDate,
  updateDailyLogRecord,
  uploadDailyLogAttachment,
} from '@/services/dailyLogs'
import { subscribeGlobalNotificationRecipients } from '@/services/jobs'
import { useAuthStore } from '@/stores/auth'
import { useJobsStore } from '@/stores/jobs'
import type {
  DailyLogAttachmentRecord,
  DailyLogAttachmentType,
  DailyLogPayload,
  DailyLogRecord,
  JobRecord,
  NotificationRecipients,
} from '@/types/domain'
import { normalizeError } from '@/utils/normalizeError'

interface SiteInfoDisplay {
  projectName: string
  jobNumber: string
  projectManager: string
  foreman: string
  generalContractor: string
  address: string
}

type AttachmentSectionKey = 'photo' | 'ptp' | 'qc'

const route = useRoute()
const auth = useAuthStore()
const jobsStore = useJobsStore()

const selectedDate = ref(getTodayDateString())
const logs = ref<DailyLogRecord[]>([])
const selectedLogId = ref<string | null>(null)
const form = ref<DailyLogPayload>(createEmptyDailyLogPayload())
const logsLoading = ref(true)
const logsError = ref('')
const actionError = ref('')
const actionInfo = ref('')
const creatingDraft = ref(false)
const savingDraft = ref(false)
const deletingDraft = ref(false)
const submittingLog = ref(false)
const recipientSaving = ref(false)
const activeAttachmentSection = ref<AttachmentSectionKey | null>(null)
const hydratingForm = ref(false)
const lastSavedSignature = ref('')
const lastHydratedLogId = ref<string | null>(null)
const recipientInput = ref('')
const globalNotificationRecipients = ref<NotificationRecipients>({
  dailyLogs: [],
  timecards: [],
  shopOrders: [],
})

let unsubscribeLogs: (() => void) | null = null
let unsubscribeGlobalNotificationRecipients: (() => void) | null = null
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
let ensuringTodayDraft = false

const scheduleSection = getDailyLogTextSection('schedule-assessment')
const safetySection = getDailyLogTextSection('safety-concerns')
const deliveriesSection = getDailyLogTextSection('deliveries-materials')
const qualityControlSection = getDailyLogTextSection('quality-control')
const notesSection = getDailyLogTextSection('notes-actions')

const jobId = computed(() => String(route.params.jobId ?? ''))
const job = computed<JobRecord | null>(() => {
  if (jobsStore.currentJob?.id === jobId.value) return jobsStore.currentJob
  return jobsStore.jobs.find((entry) => entry.id === jobId.value) ?? null
})

const currentUserId = computed(() => auth.currentUser?.uid ?? null)
const selectedDateIsToday = computed(() => selectedDate.value === getTodayDateString())
const visibleLogs = computed(() => {
  return logs.value.filter((log) => {
    if (auth.isAdmin) return true
    return log.status === 'submitted' || log.foremanUserId === currentUserId.value
  })
})
const selectedLog = computed(() => visibleLogs.value.find((log) => log.id === selectedLogId.value) ?? null)
const canEditSelectedLog = computed(() => {
  return (
    selectedLog.value?.status === 'draft'
    && selectedLog.value.logDate === getTodayDateString()
    && selectedLog.value.foremanUserId === currentUserId.value
  )
})
const canCreateAnotherLogForToday = computed(() => {
  if (!selectedDateIsToday.value || !currentUserId.value) return false

  const hasOwnDraftForToday = visibleLogs.value.some((log) =>
    log.status === 'draft' && log.foremanUserId === currentUserId.value,
  )
  if (hasOwnDraftForToday) return false

  return visibleLogs.value.some((log) =>
    log.status === 'submitted' && log.foremanUserId === currentUserId.value,
  )
})
const siteInfo = computed<SiteInfoDisplay>(() => ({
  projectName: String(job.value?.name ?? form.value.projectName ?? '').trim(),
  jobNumber: String(job.value?.code ?? form.value.jobSiteNumbers ?? '').trim(),
  projectManager: String(job.value?.projectManager ?? form.value.siteForemanAssistant ?? '').trim(),
  foreman: String(selectedLog.value?.foremanName ?? auth.displayName ?? form.value.foremanOnSite ?? '').trim(),
  generalContractor: String(job.value?.gc ?? '').trim(),
  address: String(job.value?.jobAddress ?? '').trim(),
}))
const photoAttachments = computed(() => getAttachmentsByType(form.value.attachments, ['photo', 'other']))
const ptpAttachments = computed(() => getAttachmentsByType(form.value.attachments, ['ptp']))
const qcAttachments = computed(() => getAttachmentsByType(form.value.attachments, ['qc']))
const photoAttachmentBusy = computed(() => activeAttachmentSection.value === 'photo')
const ptpAttachmentBusy = computed(() => activeAttachmentSection.value === 'ptp')
const qcAttachmentBusy = computed(() => activeAttachmentSection.value === 'qc')
const adminDailyLogRecipients = computed(() => {
  const jobRecipients = job.value?.notificationRecipients?.dailyLogs ?? job.value?.dailyLogRecipients ?? []
  const legacyOfficeRecipients = job.value?.adminDailyLogRecipients ?? []

  return Array.from(
    new Set(
      [...globalNotificationRecipients.value.dailyLogs, ...jobRecipients, ...legacyOfficeRecipients]
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean),
    ),
  )
})
const additionalDailyLogRecipients = computed(() => {
  const adminRecipients = new Set(adminDailyLogRecipients.value)
  return (selectedLog.value?.additionalRecipients ?? []).filter((email) => !adminRecipients.has(email))
})

useToastMessages([
  { source: logsError, severity: 'error', summary: 'Daily Logs' },
  { source: actionError, severity: 'error', summary: 'Daily Logs' },
  { source: actionInfo, severity: 'success', summary: 'Daily Logs' },
])

function getTodayDateString() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toMillis(value: unknown): number {
  if (typeof (value as { toMillis?: () => number })?.toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis()
  }

  if (typeof (value as { toDate?: () => Date })?.toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().getTime()
  }

  if (value instanceof Date) return value.getTime()

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value).getTime()
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function formatTimestamp(value: unknown) {
  const millis = toMillis(value)
  if (!millis) return 'Unknown time'

  return new Date(millis).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function getSelectedLogLabel(log: DailyLogRecord | null) {
  if (!log) return 'No log selected'
  return `${log.status === 'submitted' ? 'Submitted' : 'Draft'} #${log.sequenceNumber}`
}

function getLogTimestampLabel(log: DailyLogRecord) {
  return formatTimestamp(log.submittedAt || log.updatedAt || log.createdAt)
}

function setSelectedDateToToday() {
  selectedDate.value = getTodayDateString()
}

function getPreferredLog(logList: DailyLogRecord[]) {
  const ownedDraft = logList.find(
    (log) => log.status === 'draft' && log.foremanUserId === currentUserId.value,
  )
  if (ownedDraft) return ownedDraft

  const ownedSubmitted = logList.find(
    (log) => log.status === 'submitted' && log.foremanUserId === currentUserId.value,
  )
  if (ownedSubmitted) return ownedSubmitted

  return logList[0] ?? null
}

function clonePreparedPayload(payload: DailyLogPayload = form.value) {
  const nextPayload = cloneDailyLogPayload(payload)
  nextPayload.projectName = siteInfo.value.projectName
  nextPayload.jobSiteNumbers = siteInfo.value.jobNumber
  nextPayload.foremanOnSite = siteInfo.value.foreman
  nextPayload.siteForemanAssistant = siteInfo.value.projectManager
  nextPayload.manpower = nextPayload.manpowerLines
    .filter((line) => line.trade.trim().length > 0 && Number(line.count) > 0)
    .map((line) => {
      const count = Math.max(0, Math.round(Number(line.count) || 0))
      const areas = line.areas.trim()
      return areas ? `${line.trade.trim()}: ${count} (${areas})` : `${line.trade.trim()}: ${count}`
    })
    .join('; ')
  nextPayload.qcInspection = nextPayload.qcAreasInspected.trim()
  return nextPayload
}

function serializePayload(payload: DailyLogPayload = form.value) {
  const prepared = clonePreparedPayload(payload)
  return JSON.stringify(prepared)
}

function resetForm(log: DailyLogRecord | null = null) {
  hydratingForm.value = true
  form.value = log ? cloneDailyLogPayload(log.payload) : createEmptyDailyLogPayload()
  lastSavedSignature.value = serializePayload(form.value)
  lastHydratedLogId.value = log?.id ?? null
  hydratingForm.value = false
}

function clearAutoSaveTimer() {
  if (!autoSaveTimer) return
  clearTimeout(autoSaveTimer)
  autoSaveTimer = null
}

function applyJobSnapshotFieldsToDraft() {
  if (!canEditSelectedLog.value) return

  form.value.projectName = siteInfo.value.projectName
  form.value.jobSiteNumbers = siteInfo.value.jobNumber
  form.value.foremanOnSite = siteInfo.value.foreman
  form.value.siteForemanAssistant = siteInfo.value.projectManager
}

function stopLogsSubscription() {
  unsubscribeLogs?.()
  unsubscribeLogs = null
}

function setActionError(message: string) {
  actionError.value = message
  actionInfo.value = ''
}

function setActionInfo(message: string) {
  actionInfo.value = message
  actionError.value = ''
}

function normalizeRecipientEmail(value: string) {
  return value.trim().toLowerCase()
}

function updateSelectedLogRecipients(nextRecipients: string[]) {
  if (!selectedLog.value) return

  logs.value = logs.value.map((log) => (
    log.id === selectedLog.value?.id
      ? { ...log, additionalRecipients: nextRecipients }
      : log
  ))
}

function getAttachmentsByType(attachments: DailyLogAttachmentRecord[], types: DailyLogAttachmentType[]) {
  return attachments.filter((attachment) => types.includes(attachment.type))
}

function toAttachmentSection(type: DailyLogAttachmentType): AttachmentSectionKey {
  if (type === 'ptp') return 'ptp'
  if (type === 'qc') return 'qc'
  return 'photo'
}

function updateAttachmentDescription(path: string, description: string) {
  const target = form.value.attachments.find((attachment) => attachment.path === path)
  if (!target) return
  target.description = description
}

async function handleAttachmentDescriptionBlur() {
  if (!canEditSelectedLog.value || activeAttachmentSection.value) return
  clearAutoSaveTimer()
  await saveDraftImmediately()
}

async function uploadAttachmentFiles(
  entries: Array<{ file: File; description: string }>,
  type: DailyLogAttachmentType,
) {
  if (!selectedLog.value || !canEditSelectedLog.value) {
    throw new Error('Select your current draft before uploading attachments.')
  }

  if (!entries.length) return

  activeAttachmentSection.value = toAttachmentSection(type)

  try {
    const nextAttachments = [...form.value.attachments]

    for (const entry of entries) {
      if (entry.file.size > 10 * 1024 * 1024) {
        throw new Error('Attachments must be smaller than 10 MB.')
      }

      if (!entry.file.type.startsWith('image/')) {
        throw new Error('Only image attachments are supported.')
      }

      nextAttachments.push(
        await uploadDailyLogAttachment(
          entry.file,
          jobId.value,
          selectedLog.value.id,
          type,
          entry.description.trim(),
        ),
      )
    }

    form.value.attachments = nextAttachments
    await updateDailyLogRecord(selectedLog.value.id, { payload: clonePreparedPayload(form.value) }, getActor())
    lastSavedSignature.value = serializePayload(form.value)
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to upload the attachment.'))
  } finally {
    activeAttachmentSection.value = null
  }
}

function handleAttachmentDescriptionUpdate(payload: { path: string; description: string }) {
  updateAttachmentDescription(payload.path, payload.description)
}

async function uploadPhotoAttachments(entries: Array<{ file: File; description: string }>) {
  await uploadAttachmentFiles(entries, 'photo')
}

async function uploadPtpAttachments(entries: Array<{ file: File; description: string }>) {
  await uploadAttachmentFiles(entries, 'ptp')
}

async function uploadQcAttachments(entries: Array<{ file: File; description: string }>) {
  await uploadAttachmentFiles(entries, 'qc')
}

async function subscribeLogsForSelectedDate() {
  if (!jobId.value) return

  stopLogsSubscription()
  logsLoading.value = true
  logsError.value = ''

  unsubscribeLogs = subscribeDailyLogsForDate(
    jobId.value,
    selectedDate.value,
    (nextLogs) => {
      logs.value = nextLogs
      logsLoading.value = false

      const nextVisibleLogs = nextLogs.filter((log) => {
        if (auth.isAdmin) return true
        return log.status === 'submitted' || log.foremanUserId === currentUserId.value
      })

      const selectedStillExists = selectedLogId.value
        ? nextVisibleLogs.some((log) => log.id === selectedLogId.value)
        : false

      if (!selectedStillExists) {
        selectedLogId.value = getPreferredLog(nextVisibleLogs)?.id ?? null
      }

      if (
        !ensuringTodayDraft
        && selectedDateIsToday.value
        && currentUserId.value
        && !nextVisibleLogs.some((log) => log.foremanUserId === currentUserId.value)
      ) {
        ensuringTodayDraft = true
        void handleCreateDraft(true).finally(() => {
          ensuringTodayDraft = false
        })
      }
    },
    (error) => {
      logsError.value = normalizeError(error, 'Failed to load daily logs.')
      logsLoading.value = false
    },
  )
}

function getActor() {
  return {
    userId: currentUserId.value,
    displayName: auth.displayName || auth.currentUser?.email || null,
  }
}

async function handleCreateDraft(silent = false) {
  if (!jobId.value || !job.value || !currentUserId.value) {
    setActionError('Load the job before creating a daily log.')
    return
  }

  if (!selectedDateIsToday.value) {
    setActionError('New daily log drafts can only be created for today.')
    return
  }

  const existingDraft = visibleLogs.value.find(
    (log) => log.status === 'draft' && log.foremanUserId === currentUserId.value,
  )
  if (existingDraft) {
    selectedLogId.value = existingDraft.id
    if (!silent) setActionInfo('Your current daily log draft is already open.')
    return
  }

  creatingDraft.value = true
  actionError.value = ''

  try {
    const draftPayload = clonePreparedPayload(createEmptyDailyLogPayload())
    const createdId = await createDailyLogRecord({
      jobId: jobId.value,
      jobCode: job.value.code ?? null,
      jobName: job.value.name,
      logDate: selectedDate.value,
      foremanUserId: currentUserId.value,
      foremanName: auth.displayName || auth.currentUser?.email || null,
      payload: draftPayload,
    })

    selectedLogId.value = createdId
    resetForm()
    form.value = draftPayload
    lastSavedSignature.value = serializePayload(draftPayload)

    if (!silent) {
      setActionInfo('Daily log draft created.')
    }
  } catch (error) {
    setActionError(normalizeError(error, 'Failed to create a daily log draft.'))
  } finally {
    creatingDraft.value = false
  }
}

async function saveDraftImmediately() {
  if (!selectedLog.value || !canEditSelectedLog.value) return true

  const nextSignature = serializePayload(form.value)
  if (nextSignature === lastSavedSignature.value) return true

  savingDraft.value = true
  actionError.value = ''

  try {
    await updateDailyLogRecord(selectedLog.value.id, { payload: clonePreparedPayload(form.value) }, getActor())
    lastSavedSignature.value = nextSignature
    return true
  } catch (error) {
    setActionError(normalizeError(error, 'Failed to save the daily log draft.'))
    return false
  } finally {
    savingDraft.value = false
  }
}

function queueAutoSave() {
  if (!canEditSelectedLog.value || hydratingForm.value) return

  const nextSignature = serializePayload(form.value)
  if (nextSignature === lastSavedSignature.value) return

  clearAutoSaveTimer()
  autoSaveTimer = setTimeout(() => {
    void saveDraftImmediately()
  }, 700)
}

function validateForSubmit(payload: DailyLogPayload) {
  for (const field of DAILY_LOG_SUBMIT_REQUIRED_TEXT_FIELDS) {
    if (!(payload[field.key] ?? '').trim().length) {
      return `Complete "${field.label}" before submitting.`
    }
  }

  const invalidManpowerIndex = payload.manpowerLines.findIndex(
    (line) => !line.trade.trim().length || Math.round(Number(line.count) || 0) < 1,
  )
  if (invalidManpowerIndex !== -1) {
    return `Complete manpower row ${invalidManpowerIndex + 1} before submitting.`
  }

  const invalidClimateIndex = payload.indoorClimateReadings.findIndex(
    (reading) => !reading.area.trim() || !reading.high.trim() || !reading.low.trim() || !reading.humidity.trim(),
  )
  if (invalidClimateIndex !== -1) {
    return `Complete indoor climate row ${invalidClimateIndex + 1} before submitting.`
  }

  return ''
}

async function handleSubmit() {
  if (!selectedLog.value || !canEditSelectedLog.value) {
    setActionError('Only your current draft for today can be submitted.')
    return
  }

  clearAutoSaveTimer()

  const preparedPayload = clonePreparedPayload(form.value)
  const validationMessage = validateForSubmit(preparedPayload)
  if (validationMessage) {
    setActionError(validationMessage)
    return
  }

  submittingLog.value = true
  actionError.value = ''

  try {
    await updateDailyLogRecord(
      selectedLog.value.id,
      {
        payload: preparedPayload,
        status: 'submitted',
      },
      getActor(),
    )
    lastSavedSignature.value = JSON.stringify(preparedPayload)
    setActionInfo('Daily log submitted.')
  } catch (error) {
    setActionError(normalizeError(error, 'Failed to submit the daily log.'))
  } finally {
    submittingLog.value = false
  }
}

async function handleDeleteSelectedLog() {
  if (!selectedLog.value || !canEditSelectedLog.value) return

  const confirmed = window.confirm('Delete this daily log draft?')
  if (!confirmed) return

  deletingDraft.value = true
  actionError.value = ''

  try {
    const attachmentPaths = selectedLog.value.payload.attachments.map((attachment) => attachment.path)
    await Promise.allSettled(attachmentPaths.map((path) => deleteDailyLogAttachment(path)))
    await deleteDailyLogRecord(selectedLog.value.id)
    selectedLogId.value = null
    setActionInfo('Daily log draft deleted.')
  } catch (error) {
    setActionError(normalizeError(error, 'Failed to delete the daily log draft.'))
  } finally {
    deletingDraft.value = false
  }
}

async function handleAddRecipient() {
  if (!selectedLog.value || !canEditSelectedLog.value) return

  const email = normalizeRecipientEmail(recipientInput.value)
  if (!email) {
    setActionError('Enter an email address before adding a recipient.')
    return
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailPattern.test(email)) {
    setActionError('Enter a valid email address.')
    return
  }

  if (adminDailyLogRecipients.value.includes(email) || additionalDailyLogRecipients.value.includes(email)) {
    setActionInfo('That recipient is already on the list.')
    recipientInput.value = ''
    return
  }

  recipientSaving.value = true
  actionError.value = ''

  try {
    const nextRecipients = [...additionalDailyLogRecipients.value, email]
    await updateDailyLogRecord(selectedLog.value.id, { additionalRecipients: nextRecipients }, getActor())
    updateSelectedLogRecipients(nextRecipients)
    recipientInput.value = ''
    setActionInfo('Recipient added.')
  } catch (error) {
    setActionError(normalizeError(error, 'Failed to add the recipient.'))
  } finally {
    recipientSaving.value = false
  }
}

async function handleRemoveRecipient(email: string) {
  if (!selectedLog.value || !canEditSelectedLog.value) return

  recipientSaving.value = true
  actionError.value = ''

  try {
    const nextRecipients = additionalDailyLogRecipients.value.filter((entry) => entry !== email)
    await updateDailyLogRecord(selectedLog.value.id, { additionalRecipients: nextRecipients }, getActor())
    updateSelectedLogRecipients(nextRecipients)
    setActionInfo('Recipient removed.')
  } catch (error) {
    setActionError(normalizeError(error, 'Failed to remove the recipient.'))
  } finally {
    recipientSaving.value = false
  }
}

function addManpowerLine() {
  if (!canEditSelectedLog.value) return
  form.value.manpowerLines.push({
    ...createEmptyManpowerLine(),
    addedByUserId: currentUserId.value,
  })
}

function removeManpowerLine(index: number) {
  if (!canEditSelectedLog.value) return
  if (form.value.manpowerLines.length <= 1) {
    form.value.manpowerLines = [createEmptyManpowerLine()]
    return
  }

  form.value.manpowerLines.splice(index, 1)
}

function addIndoorClimateReading() {
  if (!canEditSelectedLog.value) return
  form.value.indoorClimateReadings.push(createEmptyIndoorClimateReading())
}

function removeIndoorClimateReading(index: number) {
  if (!canEditSelectedLog.value) return
  if (form.value.indoorClimateReadings.length <= 1) {
    form.value.indoorClimateReadings = [createEmptyIndoorClimateReading()]
    return
  }

  form.value.indoorClimateReadings.splice(index, 1)
}

async function handleDeleteAttachment(path: string) {
  if (!selectedLog.value || !canEditSelectedLog.value) return

  const targetAttachment = form.value.attachments.find((attachment) => attachment.path === path)
  activeAttachmentSection.value = targetAttachment ? toAttachmentSection(targetAttachment.type) : null
  actionError.value = ''

  try {
    await deleteDailyLogAttachment(path)
    form.value.attachments = form.value.attachments.filter((attachment) => attachment.path !== path)
    await updateDailyLogRecord(selectedLog.value.id, { payload: clonePreparedPayload(form.value) }, getActor())
    lastSavedSignature.value = serializePayload(form.value)
    setActionInfo('Attachment removed.')
  } catch (error) {
    setActionError(normalizeError(error, 'Failed to delete the attachment.'))
  } finally {
    activeAttachmentSection.value = null
  }
}

onMounted(() => {
  unsubscribeGlobalNotificationRecipients = subscribeGlobalNotificationRecipients(
    (nextRecipients) => {
      globalNotificationRecipients.value = nextRecipients
    },
    (error) => {
      setActionError(normalizeError(error, 'Failed to load daily log recipient defaults.'))
    },
  )

  if (jobId.value) {
    jobsStore.subscribeJob(jobId.value)
    void subscribeLogsForSelectedDate()
  }
})

watch(
  () => jobId.value,
  (nextJobId, previousJobId) => {
    if (!nextJobId || nextJobId === previousJobId) return
    clearAutoSaveTimer()
    stopLogsSubscription()
    jobsStore.subscribeJob(nextJobId)
    selectedDate.value = getTodayDateString()
    selectedLogId.value = null
    logs.value = []
    resetForm()
    void subscribeLogsForSelectedDate()
  },
)

watch(
  () => selectedDate.value,
  (nextDate, previousDate) => {
    if (nextDate === previousDate) return
    clearAutoSaveTimer()
    selectedLogId.value = null
    logs.value = []
    resetForm()
    void subscribeLogsForSelectedDate()
  },
)

watch(
  selectedLog,
  (log, previousLog) => {
    if (!log) {
      recipientInput.value = ''
      resetForm(null)
      return
    }

    const nextLogId = log.id
    const previousLogId = previousLog?.id ?? null
    const selectionChanged = nextLogId !== previousLogId || nextLogId !== lastHydratedLogId.value

    if (selectionChanged) {
      clearAutoSaveTimer()
      recipientInput.value = ''
      resetForm(log)
      return
    }

    const localSignature = serializePayload(form.value)
    const incomingSignature = serializePayload(log.payload)
    const hasUnsavedLocalChanges = canEditSelectedLog.value && localSignature !== lastSavedSignature.value

    if (hasUnsavedLocalChanges) return
    if (incomingSignature === lastSavedSignature.value) return

    resetForm(log)
  },
  { immediate: true },
)

watch(
  () => [
    job.value?.name,
    job.value?.code,
    job.value?.projectManager,
    job.value?.gc,
    job.value?.jobAddress,
    auth.displayName,
  ],
  () => {
    applyJobSnapshotFieldsToDraft()
  },
)

watch(
  form,
  () => {
    queueAutoSave()
  },
  { deep: true },
)

onBeforeUnmount(() => {
  clearAutoSaveTimer()
  stopLogsSubscription()
  unsubscribeGlobalNotificationRecipients?.()
  unsubscribeGlobalNotificationRecipients = null
  jobsStore.stopCurrentJobSubscription()
})
</script>

<template>
  <AppShell>
    <div class="daily-logs-page">
      <header class="daily-logs-header">
        <div>
          <span class="daily-logs-eyebrow">Daily Logs</span>
          <h1 class="daily-logs-title">{{ job ? `${job.code || 'No Job #'} - ${job.name}` : 'Daily Logs' }}</h1>
        </div>

        <div class="daily-logs-header__actions">
          <button
            v-if="canCreateAnotherLogForToday"
            type="button"
            class="app-button app-button--primary"
            :disabled="creatingDraft"
            @click="handleCreateDraft()"
          >
            {{ creatingDraft ? 'Creating...' : 'Another Daily Log' }}
          </button>
        </div>
      </header>

      <div class="daily-logs-toolbar">
        <span class="daily-logs-badge">{{ getSelectedLogLabel(selectedLog) }}</span>
        <span class="daily-logs-badge">{{ visibleLogs.length }} logs for {{ selectedDate }}</span>
        <span v-if="savingDraft" class="daily-logs-badge">Saving draft...</span>
      </div>

      <div
        v-if="!selectedDateIsToday"
        class="daily-logs-message daily-logs-message--info"
      >
        Logs from past or future dates are view only. New drafts can only be created for today.
      </div>

      <div class="daily-logs-layout">
        <section class="daily-logs-main">
          <article class="daily-logs-card">
            <header class="daily-logs-card__header">
              <div>
                <span class="daily-logs-card__eyebrow">Job Information</span>
                <h2 class="daily-logs-card__title">Site Info</h2>
              </div>
            </header>

            <div class="daily-logs-site-info">
              <label
                v-for="field in DAILY_LOG_SITE_INFO_FIELDS"
                :key="field.key"
                class="daily-logs-field"
              >
                <span>{{ field.label }}</span>
                <div class="daily-logs-display-field">{{ siteInfo[field.key] || '-' }}</div>
              </label>
            </div>
          </article>

          <article class="daily-logs-card">
            <header class="daily-logs-card__header">
              <div>
                <span class="daily-logs-card__eyebrow">Manpower</span>
                <h2 class="daily-logs-card__title">Crew On Site</h2>
              </div>
            </header>

            <div class="daily-logs-table-wrapper">
              <table class="daily-logs-table">
                <thead>
                  <tr>
                    <th v-for="column in DAILY_LOG_MANPOWER_COLUMNS" :key="column.key">{{ column.label }}</th>
                    <th class="daily-logs-table__actions">
                      <button
                        type="button"
                        class="daily-logs-table-icon-button"
                        :disabled="!canEditSelectedLog"
                        @click="addManpowerLine"
                      >
                        <span aria-hidden="true" class="daily-logs-table-icon-button__glyph">+</span>
                        <span class="sr-only">Add manpower row</span>
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(line, index) in form.manpowerLines"
                    :key="`manpower-${index}`"
                  >
                    <td>
                      <input
                        v-model="line.trade"
                        type="text"
                        :disabled="!canEditSelectedLog"
                        :placeholder="DAILY_LOG_MANPOWER_COLUMNS[0]?.placeholder || ''"
                      />
                    </td>
                    <td class="daily-logs-table__count">
                      <input
                        v-model.number="line.count"
                        type="number"
                        min="1"
                        step="1"
                        inputmode="numeric"
                        :disabled="!canEditSelectedLog"
                        :placeholder="DAILY_LOG_MANPOWER_COLUMNS[1]?.placeholder || ''"
                      />
                    </td>
                    <td>
                      <input
                        v-model="line.areas"
                        type="text"
                        :disabled="!canEditSelectedLog"
                        :placeholder="DAILY_LOG_MANPOWER_COLUMNS[2]?.placeholder || ''"
                      />
                    </td>
                    <td class="daily-logs-table__actions">
                      <button
                        type="button"
                        class="daily-logs-inline-remove"
                        :disabled="!canEditSelectedLog"
                        @click="removeManpowerLine(index)"
                      >
                        <i class="pi pi-times" aria-hidden="true"></i>
                        <span class="sr-only">Remove manpower row {{ index + 1 }}</span>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>

          <article class="daily-logs-card">
            <header class="daily-logs-card__header">
              <div>
                <span class="daily-logs-card__eyebrow">Schedule</span>
                <h2 class="daily-logs-card__title">{{ scheduleSection.title }}</h2>
              </div>
            </header>

            <div class="daily-logs-stack">
              <label
                v-for="field in scheduleSection.fields"
                :key="field.key"
                class="daily-logs-field"
              >
                <span>{{ field.label }}</span>
                <textarea
                  v-model="form[field.key]"
                  :rows="field.rows"
                  :disabled="!canEditSelectedLog"
                  :placeholder="field.placeholder || ''"
                ></textarea>
              </label>
            </div>
          </article>

          <article class="daily-logs-card">
            <header class="daily-logs-card__header">
              <div>
                <span class="daily-logs-card__eyebrow">Indoor Climate</span>
                <h2 class="daily-logs-card__title">Indoor Temperature Readings</h2>
              </div>
            </header>

            <div class="daily-logs-table-wrapper">
              <table class="daily-logs-table">
                <thead>
                  <tr>
                    <th v-for="column in DAILY_LOG_INDOOR_CLIMATE_COLUMNS" :key="column.key">{{ column.label }}</th>
                    <th class="daily-logs-table__actions">
                      <button
                        type="button"
                        class="daily-logs-table-icon-button"
                        :disabled="!canEditSelectedLog"
                        @click="addIndoorClimateReading"
                      >
                        <span aria-hidden="true" class="daily-logs-table-icon-button__glyph">+</span>
                        <span class="sr-only">Add indoor climate row</span>
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(reading, index) in form.indoorClimateReadings"
                    :key="`climate-${index}`"
                  >
                    <td v-for="column in DAILY_LOG_INDOOR_CLIMATE_COLUMNS" :key="column.key">
                      <input
                        v-model="reading[column.key]"
                        type="text"
                        :disabled="!canEditSelectedLog"
                        :placeholder="column.placeholder"
                      />
                    </td>
                    <td class="daily-logs-table__actions">
                      <button
                        type="button"
                        class="daily-logs-inline-remove"
                        :disabled="!canEditSelectedLog"
                        @click="removeIndoorClimateReading(index)"
                      >
                        <i class="pi pi-times" aria-hidden="true"></i>
                        <span class="sr-only">Remove indoor climate row {{ index + 1 }}</span>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>

          <article class="daily-logs-card">
            <header class="daily-logs-card__header">
              <div>
                <span class="daily-logs-card__eyebrow">Safety</span>
                <h2 class="daily-logs-card__title">{{ safetySection.title }}</h2>
              </div>
            </header>

            <div class="daily-logs-stack">
              <label
                v-for="field in safetySection.fields"
                :key="field.key"
                class="daily-logs-field"
              >
                <span>{{ field.label }}</span>
                <textarea
                  v-model="form[field.key]"
                  :rows="field.rows"
                  :disabled="!canEditSelectedLog"
                  :placeholder="field.placeholder || ''"
                ></textarea>
              </label>
            </div>
          </article>

          <article class="daily-logs-card">
            <header class="daily-logs-card__header">
              <div>
                <span class="daily-logs-card__eyebrow">Attachments</span>
                <h2 class="daily-logs-card__title">Photos</h2>
              </div>
            </header>

            <ImageUploadPicker
              choose-label="Choose Photos"
              description-label="Description"
              empty-label="Drag and drop photos here to upload."
              helper-text="Choose one or more photos. They save to the draft right away, and you can use the image button again anytime to add more."
              :attachments="photoAttachments"
              :disabled="!canEditSelectedLog"
              :busy="photoAttachmentBusy"
              :upload-handler="uploadPhotoAttachments"
              @update-description="handleAttachmentDescriptionUpdate"
              @commit-description="handleAttachmentDescriptionBlur"
              @remove="handleDeleteAttachment"
            />
          </article>

          <article class="daily-logs-card">
            <header class="daily-logs-card__header">
              <div>
                <span class="daily-logs-card__eyebrow">Attachments</span>
                <h2 class="daily-logs-card__title">PTP Photos</h2>
              </div>
            </header>

            <ImageUploadPicker
              choose-label="Choose PTP Photos"
              description-label="Note"
              empty-label="Drag and drop PTP photos here to upload."
              helper-text="Choose one or more PTP photos. They save to the draft right away, and you can use the image button again anytime to add more."
              :attachments="ptpAttachments"
              :disabled="!canEditSelectedLog"
              :busy="ptpAttachmentBusy"
              :upload-handler="uploadPtpAttachments"
              @update-description="handleAttachmentDescriptionUpdate"
              @commit-description="handleAttachmentDescriptionBlur"
              @remove="handleDeleteAttachment"
            />
          </article>

          <article class="daily-logs-card">
            <header class="daily-logs-card__header">
              <div>
                <span class="daily-logs-card__eyebrow">Deliveries</span>
                <h2 class="daily-logs-card__title">{{ deliveriesSection.title }}</h2>
              </div>
            </header>

            <div class="daily-logs-stack">
              <label
                v-for="field in deliveriesSection.fields"
                :key="field.key"
                class="daily-logs-field"
              >
                <span>{{ field.label }}</span>
                <textarea
                  v-model="form[field.key]"
                  :rows="field.rows"
                  :disabled="!canEditSelectedLog"
                  :placeholder="field.placeholder || ''"
                ></textarea>
              </label>
            </div>
          </article>

          <article class="daily-logs-card">
            <header class="daily-logs-card__header">
              <div>
                <span class="daily-logs-card__eyebrow">QC</span>
                <h2 class="daily-logs-card__title">{{ qualityControlSection.title }}</h2>
              </div>
            </header>

            <div class="daily-logs-stack">
              <label
                v-for="field in qualityControlSection.fields"
                :key="field.key"
                class="daily-logs-field"
              >
                <span>{{ field.label }}</span>
                <textarea
                  v-model="form[field.key]"
                  :rows="field.rows"
                  :disabled="!canEditSelectedLog"
                  :placeholder="field.placeholder || ''"
                ></textarea>
              </label>
            </div>
          </article>

          <article class="daily-logs-card">
            <header class="daily-logs-card__header">
              <div>
                <span class="daily-logs-card__eyebrow">Attachments</span>
                <h2 class="daily-logs-card__title">QC Photos</h2>
              </div>
            </header>

            <ImageUploadPicker
              choose-label="Choose QC Photos"
              description-label="Description"
              empty-label="Drag and drop QC photos here to upload."
              helper-text="Choose one or more QC photos. They save to the draft right away, and you can use the image button again anytime to add more."
              :attachments="qcAttachments"
              :disabled="!canEditSelectedLog"
              :busy="qcAttachmentBusy"
              :upload-handler="uploadQcAttachments"
              @update-description="handleAttachmentDescriptionUpdate"
              @commit-description="handleAttachmentDescriptionBlur"
              @remove="handleDeleteAttachment"
            />
          </article>

          <article class="daily-logs-card">
            <header class="daily-logs-card__header">
              <div>
                <span class="daily-logs-card__eyebrow">Notes</span>
                <h2 class="daily-logs-card__title">{{ notesSection.title }}</h2>
              </div>
            </header>

            <div class="daily-logs-stack">
              <label
                v-for="field in notesSection.fields"
                :key="field.key"
                class="daily-logs-field"
              >
                <span>{{ field.label }}</span>
                <textarea
                  v-model="form[field.key]"
                  :rows="field.rows"
                  :disabled="!canEditSelectedLog"
                  :placeholder="field.placeholder || ''"
                ></textarea>
              </label>
            </div>
          </article>

          <div class="daily-logs-submit-row">
            <button
              type="button"
              class="app-button app-button--success daily-logs-submit-button"
              :disabled="!canEditSelectedLog || submittingLog || savingDraft"
              @click="handleSubmit"
            >
              {{ submittingLog ? 'Submitting...' : 'Submit Daily Log' }}
            </button>
          </div>
        </section>

        <aside class="daily-logs-sidebar">
          <article class="daily-logs-card">
            <header class="daily-logs-card__header">
              <div>
                <span class="daily-logs-card__eyebrow">Selected Log</span>
                <h2 class="daily-logs-card__title">{{ getSelectedLogLabel(selectedLog) }}</h2>
              </div>

              <div class="daily-logs-card__actions">
                <button
                  v-if="canEditSelectedLog"
                  type="button"
                  class="app-button daily-logs-danger-button"
                  :disabled="deletingDraft"
                  @click="handleDeleteSelectedLog"
                >
                  {{ deletingDraft ? 'Deleting...' : 'Delete Draft' }}
                </button>
              </div>
            </header>

            <div v-if="selectedLog" class="daily-logs-summary">
              <span>Status: {{ selectedLog.status === 'submitted' ? 'Submitted' : 'Draft' }}</span>
              <span>Sequence: #{{ selectedLog.sequenceNumber }}</span>
              <span>Owner: {{ selectedLog.foremanName || 'Unknown foreman' }}</span>
              <span>{{ getLogTimestampLabel(selectedLog) }}</span>
            </div>

            <div v-else class="daily-logs-empty">
              No daily log is selected for this date.
            </div>
          </article>

          <article class="daily-logs-card" v-if="selectedLog">
            <header class="daily-logs-card__header">
              <div>
                <span class="daily-logs-card__eyebrow">Recipients</span>
                <h2 class="daily-logs-card__title">Email List</h2>
              </div>
            </header>

            <div class="daily-logs-recipient-groups">
              <div class="daily-logs-recipient-group">
                <div class="daily-logs-recipient-group__header">
                  <span class="daily-logs-recipient-group__label">Admin Defaults</span>
                  <span class="daily-logs-recipient-group__hint">Read only</span>
                </div>

                <div v-if="adminDailyLogRecipients.length === 0" class="daily-logs-empty daily-logs-empty--compact">
                  No default recipients yet.
                </div>

                <div v-else class="daily-logs-recipient-list">
                  <div
                    v-for="email in adminDailyLogRecipients"
                    :key="`admin-${email}`"
                    class="daily-logs-recipient-row"
                  >
                    <span>{{ email }}</span>
                    <span class="daily-logs-recipient-lock">Default</span>
                  </div>
                </div>
              </div>

              <div class="daily-logs-recipient-group">
                <div class="daily-logs-recipient-group__header">
                  <span class="daily-logs-recipient-group__label">Additional Recipients</span>
                  <span class="daily-logs-recipient-group__hint">Added for this log only</span>
                </div>

                <div class="daily-logs-inline-input">
                  <input
                    v-model="recipientInput"
                    type="email"
                    placeholder="name@example.com"
                    :disabled="!canEditSelectedLog || recipientSaving"
                    @keydown.enter.prevent="handleAddRecipient"
                  />
                  <button
                    type="button"
                    class="app-button"
                    :disabled="!canEditSelectedLog || recipientSaving"
                    @click="handleAddRecipient"
                  >
                    Add
                  </button>
                </div>

                <div v-if="additionalDailyLogRecipients.length === 0" class="daily-logs-empty daily-logs-empty--compact">
                  No extra recipients yet.
                </div>

                <div v-else class="daily-logs-recipient-list">
                  <div
                    v-for="email in additionalDailyLogRecipients"
                    :key="`extra-${email}`"
                    class="daily-logs-recipient-row"
                  >
                    <span>{{ email }}</span>
                    <button
                      type="button"
                      class="daily-logs-inline-remove"
                      :disabled="!canEditSelectedLog || recipientSaving"
                      aria-label="Remove recipient"
                      title="Remove recipient"
                      @click="handleRemoveRecipient(email)"
                    >
                      <i class="pi pi-times" aria-hidden="true"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </article>

          <article class="daily-logs-card daily-logs-card--history">
            <header class="daily-logs-card__header">
              <div>
                <span class="daily-logs-card__eyebrow">History</span>
                <h2 class="daily-logs-card__title">Logs for {{ selectedDate }}</h2>
              </div>
            </header>

            <div class="daily-logs-history-tools">
              <label class="daily-logs-field">
                <span>Calendar Search</span>
                <input v-model="selectedDate" type="date" />
              </label>

              <button
                type="button"
                class="app-button"
                :disabled="selectedDateIsToday"
                @click="setSelectedDateToToday"
              >
                Today
              </button>
            </div>

            <div v-if="logsLoading" class="daily-logs-empty">
              Loading daily logs...
            </div>

            <div v-else-if="visibleLogs.length === 0" class="daily-logs-empty">
              No daily logs exist for this date yet.
            </div>

            <div v-else class="daily-logs-history-list">
              <button
                v-for="log in visibleLogs"
                :key="log.id"
                type="button"
                class="daily-logs-history-row"
                :class="{ 'daily-logs-history-row--active': selectedLogId === log.id }"
                @click="selectedLogId = log.id"
              >
                <div class="daily-logs-history-row__main">
                  <strong>{{ getSelectedLogLabel(log) }}</strong>
                  <span>{{ log.foremanName || 'Unknown foreman' }}</span>
                  <span>{{ getLogTimestampLabel(log) }}</span>
                </div>
                <span class="daily-logs-badge">{{ log.status === 'submitted' ? 'Submitted' : 'Draft' }}</span>
              </button>
            </div>
          </article>

        </aside>
      </div>
    </div>
  </AppShell>
</template>

<style scoped>
.daily-logs-page {
  display: grid;
  gap: 1rem;
  min-height: 0;
}

.daily-logs-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.018), rgba(255, 255, 255, 0)),
    rgba(29, 38, 49, 0.92);
  box-shadow: var(--shadow);
}

.daily-logs-eyebrow,
.daily-logs-card__eyebrow {
  color: var(--accent-strong);
  font-size: 0.68rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.daily-logs-title {
  margin: 0.35rem 0 0;
  font-size: 1.5rem;
}

.daily-logs-header__actions,
.daily-logs-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  justify-content: flex-end;
}

.daily-logs-date-field,
.daily-logs-field {
  display: grid;
  gap: 0.45rem;
  color: var(--text-muted);
}

.daily-logs-date-field input,
.daily-logs-field input,
.daily-logs-field textarea,
.daily-logs-table input,
.daily-logs-inline-input input {
  width: 100%;
  min-height: 2.55rem;
  padding: 0 0.85rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.045);
  color: var(--text);
}

.daily-logs-display-field {
  display: block;
  width: 100%;
  min-height: auto;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--text);
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.35;
}

.daily-logs-field textarea {
  min-height: 7rem;
  padding: 0.75rem 0.85rem;
  resize: vertical;
}

.daily-logs-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.daily-logs-badge {
  display: inline-flex;
  align-items: center;
  min-height: 1.8rem;
  padding: 0 0.7rem;
  border: 1px solid rgba(88, 186, 233, 0.22);
  border-radius: 999px;
  background: rgba(38, 74, 96, 0.28);
  color: var(--accent);
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.daily-logs-message {
  padding: 0.95rem 1rem;
  border: 1px dashed var(--border);
  border-radius: 12px;
}

.daily-logs-message--info {
  color: var(--text-soft);
}

.daily-logs-message--error {
  border-color: rgba(255, 125, 107, 0.24);
  color: var(--danger);
}

.daily-logs-message--success {
  border-color: rgba(103, 213, 157, 0.24);
  color: var(--success);
}

.daily-logs-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(320px, 0.85fr);
  gap: 1rem;
  min-height: 0;
}

.daily-logs-main,
.daily-logs-sidebar {
  display: grid;
  gap: 1rem;
  align-content: start;
  min-height: 0;
}

.daily-logs-card {
  display: grid;
  gap: 0.85rem;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.018), rgba(255, 255, 255, 0)),
    rgba(29, 38, 49, 0.92);
  box-shadow: var(--shadow);
}

.daily-logs-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.85rem;
}

.daily-logs-card__title {
  margin: 0.2rem 0 0;
  font-size: 1.05rem;
}

.daily-logs-site-info {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
}

.daily-logs-stack {
  display: grid;
  gap: 0.85rem;
}

.daily-logs-submit-row {
  display: block;
}

.daily-logs-submit-button {
  width: 100%;
  min-height: 3.4rem;
  border-radius: 16px;
  font-weight: 700;
  font-size: 1rem;
}

.daily-logs-table-wrapper {
  overflow: auto;
}

.daily-logs-table {
  width: 100%;
  border-collapse: collapse;
}

.daily-logs-table th,
.daily-logs-table td {
  padding: 0.45rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  text-align: left;
}

.daily-logs-table th {
  color: var(--text-soft);
  font-size: 0.74rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.daily-logs-table__count {
  width: 8rem;
}

.daily-logs-table__actions {
  width: 3.5rem;
  text-align: right;
}

.daily-logs-table-icon-button {
  display: inline-grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 1px solid rgba(103, 213, 157, 0.32);
  border-radius: 999px;
  background: rgba(103, 213, 157, 0.12);
  color: var(--success);
  cursor: pointer;
  font-size: 1.45rem;
  font-weight: 700;
  line-height: 1;
}

.daily-logs-table-icon-button__glyph {
  display: block;
  line-height: 1;
  transform: translateY(-0.08em);
}

.daily-logs-table-icon-button:disabled {
  cursor: default;
  opacity: 0.6;
}

.daily-logs-history-list,
.daily-logs-recipient-list {
  display: grid;
  gap: 0.65rem;
}

.daily-logs-recipient-groups {
  display: grid;
  gap: 0.9rem;
}

.daily-logs-recipient-group {
  display: grid;
  gap: 0.55rem;
}

.daily-logs-recipient-group__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.daily-logs-recipient-group__label {
  color: var(--text-soft);
  font-size: 0.74rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.daily-logs-recipient-group__hint,
.daily-logs-recipient-lock {
  color: var(--text-muted);
  font-size: 0.8rem;
}

.daily-logs-history-tools {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.75rem;
  align-items: end;
}

.daily-logs-history-list {
  max-height: 22rem;
  overflow: auto;
  padding-right: 0.2rem;
  align-content: start;
}

.daily-logs-recipient-row,
.daily-logs-history-row {
  display: grid;
  gap: 0.45rem;
  width: 100%;
  padding: 0.8rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  color: var(--text);
  text-align: left;
}

.daily-logs-recipient-row {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.6rem;
  padding: 0.65rem 0.8rem;
}

.daily-logs-inline-input {
  display: flex;
  gap: 0.6rem;
}

.daily-logs-inline-input input {
  flex: 1 1 auto;
}

.daily-logs-inline-input .app-button {
  flex: 0 0 auto;
  min-width: 4.5rem;
}

.daily-logs-history-row {
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    transform 0.18s ease;
}

.daily-logs-history-row:hover,
.daily-logs-history-row--active {
  border-color: rgba(88, 186, 233, 0.24);
  background:
    linear-gradient(180deg, rgba(49, 83, 105, 0.35), rgba(33, 49, 62, 0.28)),
    rgba(255, 255, 255, 0.04);
  transform: translateY(-1px);
}

.daily-logs-history-row__main,
.daily-logs-summary {
  display: grid;
  gap: 0.25rem;
}

.daily-logs-history-row__main span,
.daily-logs-summary span,
.daily-logs-recipient-row span,
.daily-logs-empty {
  color: var(--text-muted);
}

.daily-logs-danger-button {
  border-color: rgba(255, 125, 107, 0.24);
  color: var(--danger);
}

.daily-logs-inline-remove {
  display: inline-grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 1px solid rgba(255, 125, 107, 0.24);
  border-radius: 999px;
  background: transparent;
  color: var(--danger);
  cursor: pointer;
}

.daily-logs-inline-remove:disabled {
  cursor: default;
  opacity: 0.6;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.daily-logs-empty {
  display: grid;
  place-content: center;
  min-height: 8rem;
  padding: 1rem;
  border: 1px dashed var(--border);
  border-radius: 12px;
  text-align: center;
}

.daily-logs-empty--compact {
  min-height: 5rem;
}

@media (max-width: 1360px) {
  .daily-logs-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 920px) {
  .daily-logs-header,
  .daily-logs-card__header {
    flex-direction: column;
    align-items: flex-start;
  }

  .daily-logs-site-info {
    grid-template-columns: 1fr;
  }

  .daily-logs-history-tools {
    grid-template-columns: 1fr;
  }

  .daily-logs-submit-button,
  .daily-logs-inline-input .app-button {
    width: 100%;
  }

  .daily-logs-inline-input {
    flex-direction: column;
  }
}
</style>
