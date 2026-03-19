import { ref, type ComputedRef, type Ref } from 'vue'
import type { ToastNotifier } from '@/composables/useToast'
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
import { normalizeError } from '@/services/serviceUtils'
import { getTodayDateInputValue } from '@/utils/dateInputs'
import { logError, logWarn } from '@/utils'
import type { TimecardModel } from './timecardUtils'

type ConfirmFn = (
  message: string,
  options?: Record<string, unknown>,
) => Promise<boolean>

type SubscriptionRegistry = {
  replace: (key: string, unsubscribe: (() => void) | null | undefined) => void
  clear: (key: string) => void
  clearAll: () => void
}

type UseTimecardWorkflowOptions = {
  jobId: ComputedRef<string>
  selectedDate: Ref<string>
  weekStartDate: ComputedRef<string>
  weekEndingDate: ComputedRef<string>
  weekRange: ComputedRef<string>
  editingTimecardId: Ref<string | null>
  expandedId: Ref<string | null>
  showCreateForm: Ref<boolean>
  canAccessJob: ComputedRef<boolean>
  authReady: () => boolean
  initAuth: () => Promise<void>
  subscribeJob: (jobId: string) => void
  stopCurrentJobSubscription: () => void
  navigateUnauthorized: () => Promise<unknown>
  subscriptions: SubscriptionRegistry
  toast: ToastNotifier
  confirm: ConfirmFn
  recalcTotals: (timecard: TimecardModel) => void
}

function buildTimecardWritePayload(timecard: TimecardModel) {
  return {
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
  }
}

export function useTimecardWorkflow(options: UseTimecardWorkflowOptions) {
  const {
    jobId,
    selectedDate,
    weekStartDate,
    weekEndingDate,
    weekRange,
    editingTimecardId,
    expandedId,
    showCreateForm,
    canAccessJob,
    authReady,
    initAuth,
    subscribeJob,
    stopCurrentJobSubscription,
    navigateUnauthorized,
    subscriptions,
    toast,
    confirm,
    recalcTotals,
  } = options

  const timecards = ref<TimecardModel[]>([])
  const draftTimecards = ref<Map<string, TimecardModel>>(new Map())
  const autoSaveTimers = ref<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const timecardRecipients = ref<string[]>([])
  const loading = ref(true)
  const saving = ref(false)
  const submittingAll = ref(false)
  const autoGenerating = ref(false)
  const err = ref('')

  const getAllTimecards = () => [
    ...timecards.value,
    ...Array.from(draftTimecards.value.values()),
  ]

  function setError(error: unknown, fallback: string, showToast = true) {
    err.value = normalizeError(error, fallback)
    if (showToast) {
      toast.show(err.value, 'error')
    }
  }

  async function ensureAccess(): Promise<boolean> {
    try {
      if (!authReady()) await initAuth()
      if (!canAccessJob.value) {
        await navigateUnauthorized()
        return false
      }
      subscribeJob(jobId.value)
      return true
    } catch (error) {
      setError(error, 'Failed to load job')
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
        },
      ))
    } catch (error) {
      setError(error, 'Failed to load timecards')
      loading.value = false
    }
  }

  async function init() {
    loading.value = true
    err.value = ''
    try {
      selectedDate.value = getTodayDateInputValue()
      if (!await ensureAccess()) {
        loading.value = false
        return
      }

      subscriptions.replace('email-settings', subscribeEmailSettings(
        (settings) => {
          timecardRecipients.value = settings.timecardSubmitRecipients ?? []
        },
        (recipientErr) => {
          logWarn('Timecards', 'Failed to subscribe to timecard email recipients', recipientErr)
          timecardRecipients.value = []
        },
      ))

      await loadTimecards()
    } catch (error) {
      setError(error, 'Failed to initialize')
      loading.value = false
    }
  }

  async function refreshWeek(dateStr: string) {
    selectedDate.value = dateStr
    const drafts = Array.from(draftTimecards.value.values())
    for (const draft of drafts) {
      if (!draft.id.startsWith('temp-')) continue
      try {
        await saveTimecard(draft, false)
      } catch (error) {
        logError('Timecards', 'Failed to save draft before switching weeks', error)
      }
    }
    draftTimecards.value.clear()
    editingTimecardId.value = null
    showCreateForm.value = false
    err.value = ''
    await loadTimecards()
  }

  function clearAutoSaveTimer(id: string) {
    const existing = autoSaveTimers.value.get(id)
    if (!existing) return
    clearTimeout(existing)
    autoSaveTimers.value.delete(id)
  }

  function clearAutoSaveTimers() {
    autoSaveTimers.value.forEach((timer) => clearTimeout(timer))
    autoSaveTimers.value.clear()
  }

  function autoSave(timecard: TimecardModel) {
    clearAutoSaveTimer(timecard.id)
    const timer = setTimeout(() => {
      void saveTimecard(timecard, false)
      autoSaveTimers.value.delete(timecard.id)
    }, 500)
    autoSaveTimers.value.set(timecard.id, timer)
  }

  async function saveTimecard(timecard: TimecardModel, showToast = true) {
    clearAutoSaveTimer(timecard.id)
    saving.value = true
    err.value = ''
    try {
      recalcTotals(timecard)
      const previousId = timecard.id
      const payload = buildTimecardWritePayload(timecard)

      if (timecard.id.startsWith('temp-')) {
        const id = await createTimecard(jobId.value, payload)
        draftTimecards.value.delete(previousId)
        timecard.id = id
        expandedId.value = expandedId.value === previousId ? id : expandedId.value
        editingTimecardId.value = editingTimecardId.value === previousId ? id : editingTimecardId.value
        draftTimecards.value.delete(id)
        if (!timecards.value.find((entry) => entry.id === id)) timecards.value.push(timecard)
        if (showToast) toast.show(`Created timecard for ${timecard.employeeName}`, 'success')
      } else if (timecards.value.find((entry) => entry.id === timecard.id)) {
        await updateTimecard(jobId.value, timecard.id, payload)
        if (showToast) toast.show(`Updated timecard for ${timecard.employeeName}`, 'success')
      } else {
        const id = await createTimecard(jobId.value, payload)
        timecard.id = id
        expandedId.value = expandedId.value === previousId ? id : expandedId.value
        editingTimecardId.value = editingTimecardId.value === previousId ? id : editingTimecardId.value
        draftTimecards.value.delete(id)
        if (!timecards.value.find((entry) => entry.id === id)) timecards.value.push(timecard)
        if (showToast) toast.show(`Created timecard for ${timecard.employeeName}`, 'success')
      }
    } catch (error) {
      setError(error, 'Failed to save timecard', showToast)
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
      toast.show(`Deleted timecard for ${employeeName}`, 'success')
    } catch (error) {
      setError(error, 'Failed to delete timecard')
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
      const drafts = getAllTimecards().filter((timecard) => timecard.status === 'draft')
      for (const draft of drafts) {
        if (draft.id.startsWith('temp-')) {
          await saveTimecard(draft, false)
        }
      }

      const count = await submitAllWeekTimecards(jobId.value, weekEndingDate.value)
      toast.show(`Submitted ${count} timecard(s)`, 'success')

      try {
        await markTimecardsSent(jobId.value, weekEndingDate.value)
      } catch (statusError) {
        logWarn('Timecards', 'Failed to update job-level timecard status', statusError)
        toast.show('Timecards submitted, but the job status badge did not update', 'warning')
      }

      if (timecardRecipients.value.length) {
        try {
          const submitted = await listTimecardsByJobAndWeek(jobId.value, weekEndingDate.value)
          const submittedIds = submitted.filter((timecard) => timecard.status === 'submitted').map((timecard) => timecard.id)
          if (submittedIds.length) {
            await sendTimecardEmail(jobId.value, submittedIds, weekStartDate.value, timecardRecipients.value)
            toast.show(`Timecards emailed to ${timecardRecipients.value.length} recipient(s)`, 'success')
          } else {
            toast.show('No submitted timecards to email', 'info')
          }
        } catch (emailError) {
          logError('Timecards', 'Failed to send timecard email', emailError)
          toast.show('Timecards submitted, but email failed to send', 'warning')
        }
      }

      draftTimecards.value.clear()
    } catch (error) {
      setError(error, 'Failed to submit timecards')
    } finally {
      submittingAll.value = false
    }
  }

  async function generateFromPreviousWeek() {
    autoGenerating.value = true
    err.value = ''
    try {
      const newIds = await autoGenerateTimecards(jobId.value, weekEndingDate.value)
      if (newIds.length > 0) {
        toast.show(`Generated ${newIds.length} timecard(s) from previous week`, 'success')
      } else {
        toast.show('No timecards in previous week to copy', 'info')
      }
    } catch (error) {
      setError(error, 'Failed to generate timecards')
    } finally {
      autoGenerating.value = false
    }
  }

  function cleanupWorkflow() {
    subscriptions.clearAll()
    stopCurrentJobSubscription()
    clearAutoSaveTimers()
  }

  return {
    autoGenerating,
    autoSave,
    cleanupWorkflow,
    draftTimecards,
    err,
    generateFromPreviousWeek,
    handleDeleteTimecard,
    init,
    loading,
    refreshWeek,
    saveTimecard,
    saving,
    submittingAll,
    submitAllTimecards,
    timecardRecipients,
    timecards,
  }
}
