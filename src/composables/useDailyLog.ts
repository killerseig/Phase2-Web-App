import { computed, onMounted, onUnmounted, ref } from 'vue'
import { isValidEmail } from '@/utils/emailValidation'
import {
  cleanupDeletedLogs,
  createDailyLog,
  deleteAttachmentFile,
  deleteDailyLog,
  formatTimestamp,
  getDailyLogById,
  getDailyLogRecipients,
  getEmailSettings,
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
import { useAuthStore } from '@/stores/auth'
import { useJobsStore } from '@/stores/jobs'

export type ToastHandle = {
  show: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void
}

export function useDailyLog(jobId: Readonly<{ value: string }>, opts?: { toastRef?: { value: ToastHandle | null } }) {
  const auth = useAuthStore()
  const jobs = useJobsStore()
  const jobService = useJobService()
  const toastRef = opts?.toastRef

  const job = computed(() => jobs.currentJob)
  const jobName = computed(() => job.value?.name ?? 'Daily Logs')
  const jobCode = computed(() => job.value?.code ?? '')
  const today = computed(() => new Date().toISOString().slice(0, 10))

  const loading = ref(true)
  const saving = ref(false)
  const uploading = ref(false)
  const err = ref('')
  const logDate = ref(new Date().toISOString().slice(0, 10))
  const datePickerConfig = ref<any>({
    dateFormat: 'Y-m-d',
    disableMobile: true,
    prevArrow: '<i class="bi bi-chevron-left"></i>',
    nextArrow: '<i class="bi bi-chevron-right"></i>',
  })
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
  const globalDailyLogRecipients = ref<string[]>([])
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
    indoorClimateReadings: [{ area: '', high: '', low: '', humidity: '' }],
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
  let autoSaveTimeout: ReturnType<typeof setTimeout>
  const creatingDraft = ref(false)

  const resetForm = () => {
    form.value = {
      jobSiteNumbers: '',
      foremanOnSite: '',
      siteForemanAssistant: '',
      projectName: jobName.value,
      manpower: '',
      weeklySchedule: '',
      manpowerAssessment: '',
      indoorClimateReadings: [{ area: '', high: '', low: '', humidity: '' }],
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
    }
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
    form.value = {
      jobSiteNumbers: log.jobSiteNumbers,
      foremanOnSite: log.foremanOnSite,
      siteForemanAssistant: log.siteForemanAssistant,
      projectName: log.projectName,
      manpower: log.manpower,
      weeklySchedule: log.weeklySchedule,
      manpowerAssessment: log.manpowerAssessment,
      indoorClimateReadings: log.indoorClimateReadings?.length
        ? log.indoorClimateReadings
        : [{ area: '', high: '', low: '', humidity: '' }],
      manpowerLines: log.manpowerLines?.length ? log.manpowerLines : [{ trade: '', count: 0, areas: '' }],
      safetyConcerns: log.safetyConcerns,
      ahaReviewed: log.ahaReviewed,
      scheduleConcerns: log.scheduleConcerns,
      budgetConcerns: log.budgetConcerns,
      deliveriesReceived: log.deliveriesReceived,
      deliveriesNeeded: log.deliveriesNeeded,
      newWorkAuthorizations: log.newWorkAuthorizations,
      qcInspection: log.qcInspection,
      notesCorrespondence: log.notesCorrespondence,
      actionItems: log.actionItems,
      attachments: log.attachments || [],
    }
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
        toastRef?.value?.show('Failed to load daily log', 'error')
      }
    } catch (e: any) {
      err.value = e?.message ?? 'Failed to load daily log'
      toastRef?.value?.show('Failed to load daily log', 'error')
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

      const existingLog = await getMyDailyLogByDate(jobId.value, dateStr)

      if (existingLog) {
        currentId.value = existingLog.id
        currentStatus.value = existingLog.status
        logDate.value = existingLog.logDate
        applyDailyLogToForm(existingLog)
        startLiveLog(existingLog.id)
        return
      }

      if (!isToday) {
        toastRef?.value?.show('No daily log exists for this date.', 'warning')
        stopLiveLog()
        return
      }

      if (creatingDraft.value) return
      creatingDraft.value = true

      const id = await createDailyLog(jobId.value, dateStr, { ...form.value })
      currentId.value = id
      currentStatus.value = 'draft'
      currentOwnerId.value = auth.user?.uid ?? null
      startLiveLog(id)
      await loadLogsForSelectedDate(dateStr)
    } catch (e: any) {
      err.value = e?.message ?? 'Failed to create daily log'
      toastRef?.value?.show('Failed to create daily log', 'error')
    } finally {
      creatingDraft.value = false
    }
  }

  const startNewDraftForToday = async () => {
    if (creatingDraft.value) return
    if (logDate.value !== today.value) {
      toastRef?.value?.show('New drafts can only be created for today.', 'warning')
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
      toastRef?.value?.show('New draft created for today.', 'success')
    } catch (e: any) {
      err.value = e?.message ?? 'Failed to create new draft'
      toastRef?.value?.show('Failed to create new draft', 'error')
    } finally {
      creatingDraft.value = false
    }
  }

  const handleFileChange = async (e: Event, type: 'photo' | 'ptp') => {
    const input = e.target as HTMLInputElement
    const files = Array.from(input.files || [])

    if (!files.length) {
      if (type === 'photo') photoFileName.value = 'No file selected'
      else ptpFileName.value = 'No file selected'
      return
    }

    const label = files.length === 1 ? files[0].name : `${files.length} files selected`
    if (type === 'photo') photoFileName.value = label
    else ptpFileName.value = label

    await uploadAttachment(files, type)
    input.value = ''
  }

  const init = async () => {
    loading.value = true
    err.value = ''
    try {
      await jobs.fetchJob(jobId.value)

      try {
        await cleanupDeletedLogs(jobId.value)
      } catch (cleanupError) {
        console.warn('Cleanup deleted logs failed', cleanupError)
      }

      try {
        jobEmailRecipients.value = await getDailyLogRecipients(jobId.value)
      } catch (recipientError) {
        console.warn('Failed to load daily log recipients', recipientError)
        jobEmailRecipients.value = []
      }

      try {
        const settings = await getEmailSettings()
        globalDailyLogRecipients.value = settings.dailyLogSubmitRecipients ?? []
      } catch (globalRecipientError) {
        console.warn('Failed to load global daily log recipients', globalRecipientError)
        globalDailyLogRecipients.value = []
      }

      await loadLogsForSelectedDate(logDate.value)
      await loadForDate(logDate.value)
    } catch (e: any) {
      err.value = e?.message ?? 'Failed to load daily logs'
      toastRef?.value?.show('Failed to load daily logs', 'error')
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
      toastRef?.value?.show('Failed to save daily log', 'error')
    } finally {
      saving.value = false
    }
  }

  const submit = async () => {
    if (!currentId.value || currentStatus.value !== 'draft') {
      toastRef?.value?.show('Cannot submit this daily log', 'error')
      return
    }

    saving.value = true
    err.value = ''
    try {
      await updateDailyLog(jobId.value, currentId.value, { ...form.value })
      await submitDailyLog(jobId.value, currentId.value)
      currentStatus.value = 'submitted'
      await loadLogsForSelectedDate(logDate.value)

      const combinedRecipients = Array.from(new Set([
        ...globalDailyLogRecipients.value,
        ...jobEmailRecipients.value,
      ])).filter(Boolean)

      if (combinedRecipients.length > 0) {
        try {
          await jobService.sendDailyLogEmail({ jobId: jobId.value, dailyLogId: currentId.value, recipients: combinedRecipients })
          toastRef?.value?.show('Daily log submitted and emailed successfully!', 'success')
        } catch (emailError: any) {
          toastRef?.value?.show('Daily log submitted, but email failed to send', 'warning')
        }
      } else {
        toastRef?.value?.show('Daily log submitted successfully!', 'success')
      }
    } catch (e: any) {
      err.value = e?.message ?? 'Failed to submit daily log'
      toastRef?.value?.show('Failed to submit daily log', 'error')
    } finally {
      saving.value = false
    }
  }

  const addEmailRecipient = async () => {
    const email = newEmailRecipient.value.trim()
    if (!email || !isValidEmail(email)) {
      toastRef?.value?.show('Please enter a valid email address', 'error')
      return
    }
    if (jobEmailRecipients.value.includes(email)) {
      toastRef?.value?.show('Email already in the list', 'warning')
      return
    }

    savingRecipients.value = true
    try {
      const updated = [...jobEmailRecipients.value, email]
      await updateDailyLogRecipients(jobId.value, updated)
      jobEmailRecipients.value = updated
      newEmailRecipient.value = ''
      toastRef?.value?.show('Email recipient added', 'success')
    } catch (e: any) {
      toastRef?.value?.show('Failed to add email recipient', 'error')
    } finally {
      savingRecipients.value = false
    }
  }

  const removeEmailRecipient = async (email: string) => {
    savingRecipients.value = true
    try {
      const updated = jobEmailRecipients.value.filter((e) => e !== email)
      await updateDailyLogRecipients(jobId.value, updated)
      jobEmailRecipients.value = updated
      toastRef?.value?.show('Email recipient removed', 'success')
    } catch (e: any) {
      toastRef?.value?.show('Failed to remove email recipient', 'error')
    } finally {
      savingRecipients.value = false
    }
  }

  const deleteDraft = async () => {
    if (!currentId.value || currentStatus.value !== 'draft') {
      toastRef?.value?.show('Can only delete draft logs', 'error')
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
      toastRef?.value?.show('Daily log deleted', 'success')
    } catch (e: any) {
      err.value = e?.message ?? 'Failed to delete daily log'
      toastRef?.value?.show('Failed to delete daily log', 'error')
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
      toastRef?.value?.show('Daily log deleted', 'success')
    } catch (e: any) {
      toastRef?.value?.show('Failed to delete daily log', 'error')
    } finally {
      saving.value = false
    }
  }

  const uploadAttachment = async (files: File[], type: 'photo' | 'ptp' | 'other') => {
    if (!files.length || !currentId.value) {
      if (!files.length) toastRef?.value?.show('Please select a file', 'error')
      if (!currentId.value) toastRef?.value?.show('Please save the daily log first', 'error')
      return
    }

    const maxSize = 10 * 1024 * 1024

    uploading.value = true
    try {
      for (const file of files) {
        if (file.size > maxSize) {
          toastRef?.value?.show('File size must be less than 10MB', 'error')
          continue
        }
        if (!file.type.startsWith('image/')) {
          toastRef?.value?.show('Please select an image file', 'error')
          continue
        }

        const att = await uploadPhotoToStorage(file, currentId.value, type)
        if (!form.value.attachments) form.value.attachments = []
        form.value.attachments.push(att)
        await updateDailyLog(jobId.value, currentId.value, { ...form.value })
        toastRef?.value?.show(`${type === 'ptp' ? 'PTP Photo' : 'Photo'} uploaded: ${file.name}`, 'success')
      }
    } catch (e: any) {
      console.error('[uploadAttachment] Error:', e)
      const errorMsg = e?.message || 'Failed to upload file'
      err.value = errorMsg
      toastRef?.value?.show(`Upload failed: ${errorMsg}`, 'error')
    } finally {
      uploading.value = false
    }
  }

  const deleteAttachment = async (path: string) => {
    uploading.value = true
    try {
      await deleteAttachmentFile(path)
      form.value.attachments = form.value.attachments?.filter((a) => a.path !== path) || []
      if (currentId.value) await updateDailyLog(jobId.value, currentId.value, { ...form.value })
      toastRef?.value?.show('Photo removed', 'success')
    } catch (e: any) {
      err.value = e?.message || 'Failed to delete photo'
      toastRef?.value?.show('Failed to delete photo', 'error')
    } finally {
      uploading.value = false
    }
  }

  const sendEmail = async () => {
    const combinedRecipients = Array.from(new Set([
      ...globalDailyLogRecipients.value,
      ...jobEmailRecipients.value,
    ])).filter(Boolean)

    if (!currentId.value || !combinedRecipients.length) {
      toastRef?.value?.show('No recipients selected', 'warning')
      return
    }

    saving.value = true
    try {
      await jobService.sendDailyLogEmail({
        jobId: jobId.value,
        dailyLogId: currentId.value,
        recipients: combinedRecipients,
      })
      toastRef?.value?.show(`Email sent to ${combinedRecipients.length} recipient(s)`, 'success')
    } catch (e: any) {
      err.value = e?.message ?? 'Failed to send email'
      toastRef?.value?.show('Failed to send email', 'error')
      console.error('[sendEmail] Error:', e)
    } finally {
      saving.value = false
    }
  }

  const addManpowerLine = () => {
    form.value.manpowerLines.push({ trade: '', count: 0, areas: '', addedByUserId: auth.user?.uid })
    autoSave()
  }

  const clampCount = (value: number) => {
    if (Number.isNaN(value)) return 1
    return Math.max(1, Math.round(value))
  }

  const updateManpowerField = ({ index, field, value }: { index: number; field: 'trade' | 'areas'; value: string }) => {
    if (!form.value.manpowerLines[index]) return
    form.value.manpowerLines[index][field] = value
    autoSave()
  }

  const updateManpowerCount = ({ index, value }: { index: number; value: number }) => {
    if (!form.value.manpowerLines[index]) return
    form.value.manpowerLines[index].count = clampCount(value)
    autoSave()
  }

  const removeManpowerLine = (index: number) => {
    form.value.manpowerLines.splice(index, 1)
    autoSave()
  }

  const addIndoorClimateReading = () => {
    form.value.indoorClimateReadings = form.value.indoorClimateReadings || []
    form.value.indoorClimateReadings.push({ area: '', high: '', low: '', humidity: '' })
    autoSave()
  }

  const updateIndoorClimateField = ({
    index,
    field,
    value,
  }: {
    index: number
    field: 'area' | 'high' | 'low' | 'humidity'
    value: string
  }) => {
    if (!form.value.indoorClimateReadings?.[index]) return
    form.value.indoorClimateReadings[index][field] = value
    autoSave()
  }

  const removeIndoorClimateReading = (index: number) => {
    if (!form.value.indoorClimateReadings) return
    if (form.value.indoorClimateReadings.length <= 1) {
      form.value.indoorClimateReadings = [{ area: '', high: '', low: '', humidity: '' }]
    } else {
      form.value.indoorClimateReadings.splice(index, 1)
    }
    autoSave()
  }

  const canDeleteManpowerLine = (line: any): boolean => {
    return !line.addedByUserId || line.addedByUserId === auth.user?.uid
  }

  const isAdminAddedLine = (line: any): boolean => {
    return !!line.addedByUserId && line.addedByUserId !== auth.user?.uid
  }

  onMounted(init)
  onUnmounted(stopLiveLog)

  return {
    // state
    auth,
    job,
    jobName,
    jobCode,
    today,
    loading,
    saving,
    uploading,
    err,
    logDate,
    datePickerConfig,
    selectedLogs,
    logsForSelectedDate,
    currentId,
    currentStatus,
    currentOwnerId,
    currentSubmittedAt,
    jobEmailRecipients,
    newEmailRecipient,
    savingRecipients,
    canEditDraft,
    photoFileName,
    ptpFileName,
    form,
    creatingDraft,
    // methods
    formatTimestamp,
    loadLogById,
    loadForDate,
    loadLogsForSelectedDate,
    startNewDraftForToday,
    saveDraft,
    submit,
    deleteDraft,
    deleteLogById,
    handleFileChange,
    addEmailRecipient,
    removeEmailRecipient,
    sendEmail,
    addManpowerLine,
    updateManpowerField,
    updateManpowerCount,
    removeManpowerLine,
    addIndoorClimateReading,
    updateIndoorClimateField,
    removeIndoorClimateReading,
    canDeleteManpowerLine,
    isAdminAddedLine,
    deleteAttachment,
    autoSave,
  }
}
