import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  cleanupDeletedLogs,
  createDailyLog,
  deleteDailyLog,
  formatTimestamp,
  getDailyLogById,
  getMyDailyLogByDate,
  subscribeDailyLogRecipients,
  subscribeDailyLogsForDate,
  subscribeToDailyLog,
  submitDailyLog,
  sendDailyLogEmail,
  subscribeEmailSettings,
  toMillis,
  updateDailyLog,
  updateDailyLogRecipients,
  type DailyLog,
  type DailyLogDraftInput,
} from '@/services'
import { normalizeError } from '@/services/serviceUtils'
import { useAuthStore } from '@/stores/auth'
import { useJobsStore } from '@/stores/jobs'
import { logError, logWarn } from '@/utils/logger'
import { createDatePickerConfig, getTodayDateInputValue } from '@/utils/dateInputs'
import { useEmailRecipients } from './useEmailRecipients'
import { useConfirmDialog } from './useConfirmDialog'
import { useSubscriptionRegistry } from './useSubscriptionRegistry'
import { useDailyLogAttachments } from './dailyLog/useDailyLogAttachments'
import { createEmptyDailyLogDraft } from './dailyLog/defaults'
import { useToast, type ToastNotifier } from './useToast'

type ManpowerLineAccess = {
  addedByUserId?: string
}

export function useDailyLog(jobId: Readonly<{ value: string }>, opts?: { toast?: ToastNotifier | null }) {
  const auth = useAuthStore()
  const jobs = useJobsStore()
  const { confirm } = useConfirmDialog()
  const subscriptions = useSubscriptionRegistry()
  const toast = opts?.toast ?? useToast()
  const recipientActions = useEmailRecipients({
    toast,
    onError: (message) => {
      err.value = message
    },
  })

  const job = computed(() => jobs.currentJob)
  const jobName = computed(() => job.value?.name ?? 'Daily Logs')
  const jobCode = computed(() => job.value?.code ?? '')
  const today = computed(() => getTodayDateInputValue())

  const loading = ref(true)
  const saving = ref(false)
  const err = ref('')
  const logDate = ref(getTodayDateInputValue())
  const datePickerConfig = ref(createDatePickerConfig())
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
  const currentSubmittedAt = ref<unknown>(null)
  const jobEmailRecipients = ref<string[]>([])
  const globalDailyLogRecipients = ref<string[]>([])
  const savingRecipients = recipientActions.saving

  const canEditDraft = computed(() => {
    return (
      currentStatus.value === 'draft' &&
      logDate.value === today.value &&
      currentOwnerId.value === auth.user?.uid
    )
  })

  const form = ref<DailyLogDraftInput>(createEmptyDailyLogDraft(jobName.value))

  let autoSaveTimeout: ReturnType<typeof setTimeout> | null = null
  const creatingDraft = ref(false)

  const {
    uploading,
    photoFileName,
    ptpFileName,
    qcFileName,
    resetFileNames,
    handleFileChange,
    deleteAttachment,
  } = useDailyLogAttachments({
    jobId,
    currentId,
    canEditDraft,
    form,
    toast,
    setError: (message) => {
      err.value = message
    },
  })

  const resetForm = () => {
    form.value = createEmptyDailyLogDraft(jobName.value)
    currentOwnerId.value = auth.user?.uid ?? null
    currentSubmittedAt.value = null
    resetFileNames()
  }

  const stopLiveLog = () => {
    subscriptions.clear('liveLog')
  }

  const stopLogsForDate = () => {
    subscriptions.clear('logsForDate')
  }

  const stopRecipientSubscriptions = () => {
    subscriptions.clear('jobRecipients')
    subscriptions.clear('globalRecipients')
  }

  const clearAutoSaveTimer = () => {
    if (!autoSaveTimeout) return
    clearTimeout(autoSaveTimeout)
    autoSaveTimeout = null
  }

  const setError = (errorValue: unknown, fallback: string) => {
    err.value = normalizeError(errorValue, fallback)
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
      qcAssignedTo: log.qcAssignedTo ?? '',
      qcAreasInspected: log.qcAreasInspected ?? '',
      qcIssuesIdentified: log.qcIssuesIdentified ?? '',
      qcIssuesResolved: log.qcIssuesResolved ?? '',
      notesCorrespondence: log.notesCorrespondence,
      actionItems: log.actionItems,
      attachments: log.attachments || [],
    }
  }

  const startLiveLog = (dailyLogId: string) => {
    stopLiveLog()
    subscriptions.replace('liveLog', subscribeToDailyLog(jobId.value, dailyLogId, (log) => {
      if (log.id === currentId.value) {
        currentStatus.value = log.status
        applyDailyLogToForm(log)
      }
    }, () => {}))
  }

  const getMineFromLogs = (logs: DailyLog[], dateStr: string): DailyLog | null => {
    const mine = logs.filter((log) => log.uid === auth.user?.uid && log.logDate === dateStr)
    const drafts = mine
      .filter((log) => log.status === 'draft')
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
    if (drafts[0]) return drafts[0]

    const submitted = mine
      .filter((log) => log.status === 'submitted')
      .sort((a, b) => toMillis(b.submittedAt || b.updatedAt || b.createdAt) - toMillis(a.submittedAt || a.updatedAt || a.createdAt))
    return submitted[0] ?? null
  }

  const subscribeLogsForSelectedDate = (dateStr: string): Promise<DailyLog[]> => {
    stopLogsForDate()
    selectedLogs.value = []

    return new Promise((resolve) => {
      let resolved = false
      subscriptions.replace('logsForDate', subscribeDailyLogsForDate(
        jobId.value,
        dateStr,
        (logs) => {
          selectedLogs.value = logs

          const mine = getMineFromLogs(logs, dateStr)
          if (mine && mine.id === currentId.value) {
            currentStatus.value = mine.status
            applyDailyLogToForm(mine)
          } else if (!currentId.value && mine) {
            currentId.value = mine.id
            currentStatus.value = mine.status
            logDate.value = mine.logDate
            applyDailyLogToForm(mine)
            startLiveLog(mine.id)
          }

          if (!resolved) {
            resolved = true
            resolve(logs)
          }
        },
        (e) => {
          logError('DailyLogs', 'Failed to subscribe logs for date', e)
          selectedLogs.value = []
          if (!resolved) {
            resolved = true
            resolve([])
          }
        }
      ))
    })
  }

  const loadLogsForSelectedDate = async (dateStr: string) => {
    await subscribeLogsForSelectedDate(dateStr)
  }

  const loadLogById = async (logId: string) => {
    clearAutoSaveTimer()
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
        toast.show('Failed to load daily log', 'error')
      }
    } catch (e) {
      setError(e, 'Failed to load daily log')
      toast.show('Failed to load daily log', 'error')
    }
  }

  const loadForDate = async (dateStr: string) => {
    clearAutoSaveTimer()
    err.value = ''
    currentId.value = null
    currentStatus.value = 'draft'
    resetForm()

    try {
      const isToday = dateStr === today.value

      const logsForDate = await subscribeLogsForSelectedDate(dateStr)
      const existingLog = getMineFromLogs(logsForDate, dateStr)

      if (existingLog) {
        currentId.value = existingLog.id
        currentStatus.value = existingLog.status
        logDate.value = existingLog.logDate
        applyDailyLogToForm(existingLog)
        startLiveLog(existingLog.id)
        return
      }

      const existingOwnedLog = await getMyDailyLogByDate(jobId.value, dateStr)
      if (existingOwnedLog) {
        currentId.value = existingOwnedLog.id
        currentStatus.value = existingOwnedLog.status
        logDate.value = existingOwnedLog.logDate
        applyDailyLogToForm(existingOwnedLog)
        startLiveLog(existingOwnedLog.id)
        return
      }

      if (!isToday) {
        toast.show('No daily log exists for this date.', 'warning')
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
    } catch (e) {
      setError(e, 'Failed to create daily log')
      toast.show('Failed to create daily log', 'error')
    } finally {
      creatingDraft.value = false
    }
  }

  const startNewDraftForToday = async () => {
    if (creatingDraft.value) return
    if (logDate.value !== today.value) {
      toast.show('New drafts can only be created for today.', 'warning')
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
      toast.show('New draft created for today.', 'success')
    } catch (e) {
      setError(e, 'Failed to create new draft')
      toast.show('Failed to create new draft', 'error')
    } finally {
      creatingDraft.value = false
    }
  }

  const init = async () => {
    clearAutoSaveTimer()
    loading.value = true
    err.value = ''
    try {
      jobs.subscribeJob(jobId.value)

      try {
        await cleanupDeletedLogs(jobId.value)
      } catch (cleanupError) {
        logWarn('DailyLogs', 'Cleanup deleted logs failed', cleanupError)
      }

      stopRecipientSubscriptions()
      subscriptions.replace('jobRecipients', subscribeDailyLogRecipients(
        jobId.value,
        (recipients) => {
          jobEmailRecipients.value = recipients
        },
        (recipientError) => {
          logWarn('DailyLogs', 'Failed to subscribe to daily log recipients', recipientError)
          jobEmailRecipients.value = []
        }
      ))
      subscriptions.replace('globalRecipients', subscribeEmailSettings(
        (settings) => {
          globalDailyLogRecipients.value = settings.dailyLogSubmitRecipients ?? []
        },
        (globalRecipientError) => {
          logWarn('DailyLogs', 'Failed to subscribe to global daily log recipients', globalRecipientError)
          globalDailyLogRecipients.value = []
        }
      ))

      await loadForDate(logDate.value)
    } catch (e) {
      setError(e, 'Failed to load daily logs')
      toast.show('Failed to load daily logs', 'error')
    } finally {
      loading.value = false
    }
  }

  const autoSave = async () => {
    if (!currentId.value || !canEditDraft.value) return
    clearAutoSaveTimer()
    autoSaveTimeout = setTimeout(async () => {
      try {
        saving.value = true
        await updateDailyLog(jobId.value, currentId.value!, { ...form.value })
      } catch (e) {
        logError('DailyLogs', 'Auto-save failed', e)
      } finally {
        saving.value = false
        autoSaveTimeout = null
      }
    }, 1000)
  }

  const saveDraft = async () => {
    if (!currentId.value || currentStatus.value !== 'draft') return
    saving.value = true
    err.value = ''
    try {
      await updateDailyLog(jobId.value, currentId.value, { ...form.value })
    } catch (e) {
      setError(e, 'Failed to save daily log')
      toast.show('Failed to save daily log', 'error')
    } finally {
      saving.value = false
    }
  }

  const submit = async () => {
    if (!currentId.value || currentStatus.value !== 'draft') {
      toast.show('Cannot submit this daily log', 'error')
      return
    }

    saving.value = true
    err.value = ''
    try {
      await updateDailyLog(jobId.value, currentId.value, { ...form.value })
      await submitDailyLog(jobId.value, currentId.value)
      currentStatus.value = 'submitted'

      const combinedRecipients = Array.from(new Set([
        ...globalDailyLogRecipients.value,
        ...jobEmailRecipients.value,
      ])).filter(Boolean)

      if (combinedRecipients.length > 0) {
        try {
          await sendDailyLogEmail(jobId.value, currentId.value, combinedRecipients)
          toast.show('Daily log submitted and emailed successfully!', 'success')
        } catch {
          toast.show('Daily log submitted, but email failed to send', 'warning')
        }
      } else {
        toast.show('Daily log submitted successfully!', 'success')
      }
    } catch (e) {
      setError(e, 'Failed to submit daily log')
      toast.show('Failed to submit daily log', 'error')
    } finally {
      saving.value = false
    }
  }

  const recipientConfig = {
    getRecipients: () => jobEmailRecipients.value,
    setRecipients: (emails: string[]) => {
      jobEmailRecipients.value = emails
    },
    saveRecipients: (emails: string[]) => updateDailyLogRecipients(jobId.value, emails),
    messages: {
      addSuccess: 'Email recipient added',
      addError: 'Failed to add email recipient',
      removeSuccess: 'Email recipient removed',
      removeError: 'Failed to remove email recipient',
    },
  }

  const addEmailRecipient = async (emailValue: string) => {
    await recipientActions.addRecipient(emailValue, recipientConfig)
  }

  const removeEmailRecipient = async (email: string) => {
    await recipientActions.removeRecipient(email, recipientConfig)
  }

  const deleteDraft = async () => {
    if (!currentId.value || currentStatus.value !== 'draft') {
      toast.show('Can only delete draft logs', 'error')
      return
    }

    const confirmed = await confirm('Are you sure you want to delete this draft?', {
      title: 'Delete Draft',
      confirmText: 'Delete',
      variant: 'danger',
    })
    if (!confirmed) return

    saving.value = true
    try {
      await deleteDailyLog(jobId.value, currentId.value)
      currentId.value = null
      resetForm()
      await loadForDate(today.value)
      toast.show('Daily log deleted', 'success')
    } catch (e) {
      setError(e, 'Failed to delete daily log')
      toast.show('Failed to delete daily log', 'error')
    } finally {
      saving.value = false
    }
  }

  const deleteLogById = async (logId: string) => {
    const confirmed = await confirm('Are you sure you want to delete this draft?', {
      title: 'Delete Draft',
      confirmText: 'Delete',
      variant: 'danger',
    })
    if (!confirmed) return

    saving.value = true
    try {
      await deleteDailyLog(jobId.value, logId)
      if (currentId.value === logId) {
        currentId.value = null
        resetForm()
        await loadForDate(today.value)
      }
      toast.show('Daily log deleted', 'success')
    } catch {
      toast.show('Failed to delete daily log', 'error')
    } finally {
      saving.value = false
    }
  }

  const sendEmail = async () => {
    const combinedRecipients = Array.from(new Set([
      ...globalDailyLogRecipients.value,
      ...jobEmailRecipients.value,
    ])).filter(Boolean)

    if (!currentId.value || !combinedRecipients.length) {
      toast.show('No recipients selected', 'warning')
      return
    }

    saving.value = true
    try {
      await sendDailyLogEmail(jobId.value, currentId.value, combinedRecipients)
      toast.show(`Email sent to ${combinedRecipients.length} recipient(s)`, 'success')
    } catch (e) {
      setError(e, 'Failed to send email')
      toast.show('Failed to send email', 'error')
      logError('DailyLogs', 'Send email failed', e)
    } finally {
      saving.value = false
    }
  }

  const ensureManpowerLines = () => {
    if (!form.value.manpowerLines) form.value.manpowerLines = []
    return form.value.manpowerLines
  }

  const addManpowerLine = () => {
    const lines = ensureManpowerLines()
    lines.push({ trade: '', count: 0, areas: '', addedByUserId: auth.user?.uid })
    autoSave()
  }

  const clampCount = (value: number) => {
    if (Number.isNaN(value)) return 1
    return Math.max(1, Math.round(value))
  }

  const updateManpowerField = ({ index, field, value }: { index: number; field: 'trade' | 'areas'; value: string }) => {
    const lines = ensureManpowerLines()
    const line = lines[index]
    if (!line) return
    line[field] = value
    autoSave()
  }

  const updateManpowerCount = ({ index, value }: { index: number; value: number }) => {
    const lines = ensureManpowerLines()
    const line = lines[index]
    if (!line) return
    line.count = clampCount(value)
    autoSave()
  }

  const removeManpowerLine = (index: number) => {
    const lines = ensureManpowerLines()
    lines.splice(index, 1)
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

  const canDeleteManpowerLine = (line: ManpowerLineAccess): boolean => {
    return !line.addedByUserId || line.addedByUserId === auth.user?.uid
  }

  const isAdminAddedLine = (line: ManpowerLineAccess): boolean => {
    return !!line.addedByUserId && line.addedByUserId !== auth.user?.uid
  }

  onMounted(init)
  watch(
    () => jobId.value,
    (next, prev) => {
      if (!next || next === prev) return
      void init()
    }
  )
  onUnmounted(() => {
    clearAutoSaveTimer()
    subscriptions.clearAll()
    jobs.stopCurrentJobSubscription()
  })

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
    globalDailyLogRecipients,
    savingRecipients,
    canEditDraft,
    photoFileName,
    ptpFileName,
    qcFileName,
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

