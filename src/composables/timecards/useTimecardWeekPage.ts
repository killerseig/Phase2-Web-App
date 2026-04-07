import { computed, ref, type ComputedRef } from 'vue'
import { useRouter } from 'vue-router'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { usePermissions } from '@/composables/usePermissions'
import { useSubscriptionRegistry } from '@/composables/useSubscriptionRegistry'
import { useToast } from '@/composables/useToast'
import { sendTimecardEmail, subscribeEmailSettings } from '@/services/Email'
import { markTimecardsSent } from '@/services/Jobs'
import {
  listWorkspaceTimecardsByJobAndWeek,
  submitWorkspaceWeekTimecards,
  updateTimecard,
} from '@/services/Timecards'
import { normalizeError } from '@/services/serviceUtils'
import { useAuthStore } from '@/stores/auth'
import { useJobsStore } from '@/stores/jobs'
import { ROLES, ROUTE_NAMES } from '@/constants/app'
import { createDatePickerConfig, getTodayDateInputValue } from '@/utils/dateInputs'
import { formatWeekRange, getSaturdayFromSunday, snapToSunday } from '@/utils/modelValidation'
import { ensureWorkbookTimecardLines } from '@/utils/timecardWorkbook'
import {
  recalcTotalsForTimecard,
  type TimecardModel,
} from '@/utils/timecardUtils'
import { buildTimecardAccountsSummary } from '@/utils/timecardAccounts'
import { logError, logWarn } from '@/utils'
import { useTimecardJobEditing } from '@/composables/timecards/useTimecardJobEditing'
import { useTimecardWeekWorkspace } from '@/composables/timecards/useTimecardWeekWorkspace'
import type { WorkbookFooterField } from '@/types/timecards'

function buildTimecardWritePayload(timecard: TimecardModel) {
  return {
    weekEndingDate: timecard.weekEndingDate,
    employeeRosterId: timecard.employeeRosterId ?? '',
    firstName: timecard.firstName ?? '',
    lastName: timecard.lastName ?? '',
    employeeNumber: timecard.employeeNumber,
    employeeName: timecard.employeeName,
    employeeWage: timecard.employeeWage ?? null,
    subcontractedEmployee: timecard.subcontractedEmployee ?? false,
    regularHoursOverride: timecard.regularHoursOverride ?? null,
    overtimeHoursOverride: timecard.overtimeHoursOverride ?? null,
    mileage: timecard.mileage ?? null,
    footerJobOrGl: timecard.footerJobOrGl ?? '',
    footerAccount: timecard.footerAccount ?? '',
    footerOffice: timecard.footerOffice ?? '',
    footerAmount: timecard.footerAmount ?? '',
    occupation: timecard.occupation,
    jobs: timecard.jobs ?? [],
    days: timecard.days,
    notes: timecard.notes,
  }
}

function parseMileageInput(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed < 0) return null
  return parsed
}

export function useTimecardWeekPage(jobId: ComputedRef<string>) {
  const router = useRouter()
  const auth = useAuthStore()
  const jobsStore = useJobsStore()
  const permissions = usePermissions()
  const { confirm } = useConfirmDialog()
  const toast = useToast()
  const subscriptions = useSubscriptionRegistry()

  const initializing = ref(true)
  const saving = ref(false)
  const submittingAll = ref(false)
  const localError = ref('')
  const timecardRecipients = ref<string[]>([])
  const autoSaveTimers = ref<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const isAdmin = computed(() => auth.role === ROLES.ADMIN)
  const jobName = computed(() => jobsStore.currentJob?.name ?? 'Timecards')
  const selectedDate = ref<string>(getTodayDateInputValue())
  const weekStartDate = computed(() => snapToSunday(selectedDate.value || getTodayDateInputValue()))
  const weekEndingDate = computed(() => getSaturdayFromSunday(weekStartDate.value))
  const weekRange = computed(() => formatWeekRange(weekStartDate.value, weekEndingDate.value))
  const flatpickrConfig = ref(createDatePickerConfig())

  function recalcTotals(timecard: TimecardModel) {
    ensureWorkbookTimecardLines(timecard)
    recalcTotalsForTimecard(timecard, timecard.weekStartDate || weekStartDate.value)
  }

  const workspace = useTimecardWeekWorkspace({
    jobId,
    weekEndingDate,
    subscriptions,
    recalcTotals,
  })

  const loading = computed(() => initializing.value || workspace.loading.value)
  const err = computed(() => localError.value || workspace.error.value)
  const employeeCount = computed(() => workspace.employeeItems.value.length)
  const accountsSummary = computed(() => buildTimecardAccountsSummary(workspace.timecards.value))

  function setError(error: unknown, fallback: string, showToast = true) {
    localError.value = normalizeError(error, fallback)
    if (showToast) {
      toast.show(localError.value, 'error')
    }
  }

  function clearAutoSaveTimer(id: string) {
    const existing = autoSaveTimers.value.get(id)
    if (!existing) return
    clearTimeout(existing)
    autoSaveTimers.value.delete(id)
  }

  async function persistTimecard(timecard: TimecardModel, showToast = false) {
    if (!timecard?.id) return
    clearAutoSaveTimer(timecard.id)
    saving.value = true
    localError.value = ''

    try {
      recalcTotals(timecard)
      await updateTimecard(jobId.value, timecard.id, buildTimecardWritePayload(timecard))
      if (showToast) {
        toast.show(`Saved ${timecard.employeeName}`, 'success')
      }
    } catch (error) {
      setError(error, 'Failed to save timecard', showToast)
    } finally {
      saving.value = false
    }
  }

  function autoSave(timecard: TimecardModel) {
    clearAutoSaveTimer(timecard.id)
    const timer = setTimeout(() => {
      void persistTimecard(timecard, false)
      autoSaveTimers.value.delete(timecard.id)
    }, 450)
    autoSaveTimers.value.set(timecard.id, timer)
  }

  async function flushPendingAutoSaves() {
    const pendingIds = Array.from(autoSaveTimers.value.keys())
    for (const id of pendingIds) {
      clearAutoSaveTimer(id)
      const timecard = workspace.timecards.value.find((entry) => entry.id === id)
      if (timecard) {
        await persistTimecard(timecard, false)
      }
    }
  }

  async function ensureAccess(): Promise<boolean> {
    try {
      if (!auth.ready) await auth.init()
      if (!permissions.canAccessJob.value) {
        await router.push({ name: ROUTE_NAMES.UNAUTHORIZED })
        return false
      }

      jobsStore.stopCurrentJobSubscription()
      jobsStore.subscribeJob(jobId.value)
      return true
    } catch (error) {
      setError(error, 'Failed to load job')
      return false
    }
  }

  async function init() {
    if (!jobId.value) {
      initializing.value = false
      return
    }

    initializing.value = true
    localError.value = ''

    try {
      if (!await ensureAccess()) {
        initializing.value = false
        return
      }

      subscriptions.replace(
        'timecard-week-email-settings',
        subscribeEmailSettings(
          (settings) => {
            timecardRecipients.value = settings.timecardSubmitRecipients ?? []
          },
          (error) => {
            logWarn('Timecards', 'Failed to subscribe to timecard email recipients', error)
            timecardRecipients.value = []
          },
        ),
      )

      await workspace.init()
    } catch (error) {
      setError(error, 'Failed to initialize timecards')
    } finally {
      initializing.value = false
    }
  }

  async function changeWeek(dateStr: string) {
    selectedDate.value = dateStr
    await flushPendingAutoSaves()
    await workspace.refreshWorkspace()
  }

  function handleNotesInput(timecard: TimecardModel, value: string) {
    timecard.notes = value
    autoSave(timecard)
  }

  function updateMileage(timecard: TimecardModel, rawValue: string) {
    timecard.mileage = parseMileageInput(rawValue)
    autoSave(timecard)
  }

  function updateFooterField(timecard: TimecardModel, field: WorkbookFooterField, value: string) {
    timecard[field] = value
    autoSave(timecard)
  }

  const jobEditing = useTimecardJobEditing({
    getWeekStartDate: (timecard) => timecard.weekStartDate || weekStartDate.value,
    recalcTotals,
    autoSave,
  })

  async function submitWeek() {
    const confirmed = await confirm(`Submit all timecards for the week of ${weekRange.value}?`, {
      title: 'Submit Timecards',
      confirmText: 'Submit',
      variant: 'warning',
    })
    if (!confirmed) return

    submittingAll.value = true
    localError.value = ''

    try {
      await flushPendingAutoSaves()

      const count = await submitWorkspaceWeekTimecards(jobId.value, weekEndingDate.value)
      toast.show(`Submitted ${count} timecard(s)`, 'success')

      try {
        await markTimecardsSent(jobId.value, weekEndingDate.value)
      } catch (statusError) {
        logWarn('Timecards', 'Failed to update job-level timecard status', statusError)
        toast.show('Timecards submitted, but the job status badge did not update', 'warning')
      }

      if (timecardRecipients.value.length) {
        try {
          const submitted = await listWorkspaceTimecardsByJobAndWeek(jobId.value, weekEndingDate.value)
          const submittedIds = submitted
            .filter((timecard) => timecard.status === 'submitted')
            .map((timecard) => timecard.id)

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
    } catch (error) {
      setError(error, 'Failed to submit timecards')
    } finally {
      submittingAll.value = false
    }
  }

  function cleanup() {
    autoSaveTimers.value.forEach((timer) => clearTimeout(timer))
    autoSaveTimers.value.clear()
    subscriptions.clearAll()
    jobsStore.stopCurrentJobSubscription()
  }

  return {
    accountsSummary,
    changeWeek,
    cleanup,
    employeeCount,
    err,
    flatpickrConfig,
    handleNotesInput,
    init,
    isAdmin,
    jobEditing,
    jobName,
    loading,
    saving,
    searchTerm: workspace.searchTerm,
    selectEmployee: workspace.selectEmployee,
    selectedDate,
    selectedEmployeeId: workspace.selectedEmployeeId,
    selectedTimecard: workspace.selectedTimecard,
    submitWeek,
    submittingAll,
    submittedCount: workspace.submittedCount,
    updateFooterField,
    updateMileage,
    weekEndingDate,
    weekRange,
    workspaceEmployeeItems: workspace.filteredEmployeeItems,
    draftCount: workspace.draftCount,
  }
}
