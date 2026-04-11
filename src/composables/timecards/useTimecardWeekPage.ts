import { computed, ref, type ComputedRef } from 'vue'
import { useRouter } from 'vue-router'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { usePermissions } from '@/composables/usePermissions'
import { useSubscriptionRegistry } from '@/composables/useSubscriptionRegistry'
import { useToast } from '@/composables/useToast'
import { sendTimecardEmail, subscribeEmailSettings } from '@/services/Email'
import {
  saveForemanTimecard,
  submitForemanTimecardsForWeek,
} from '@/services/ForemanTimecards'
import { markTimecardsSent } from '@/services/Jobs'
import {
  addEmployeeToTimecardRoster,
  listTimecardStaffingEmployees,
  type TimecardStaffingEmployee,
} from '@/services/TimecardStaffing'
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
  recalcVisibleTotalsForTimecard,
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
    productionBurden: timecard.productionBurden ?? null,
    subcontractedEmployee: timecard.subcontractedEmployee ?? false,
    regularHoursOverride: timecard.regularHoursOverride ?? null,
    overtimeHoursOverride: timecard.overtimeHoursOverride ?? null,
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
  const staffingEmployees = ref<TimecardStaffingEmployee[]>([])
  const staffingLoading = ref(false)
  const staffingError = ref('')
  const staffingSelectedEmployeeId = ref('')
  const addingStaffingEmployee = ref(false)

  const isAdmin = computed(() => auth.role === ROLES.ADMIN)
  const jobName = computed(() => jobsStore.currentJob?.name ?? 'Timecards')
  const selectedDate = ref<string>(getTodayDateInputValue())
  const weekStartDate = computed(() => snapToSunday(selectedDate.value || getTodayDateInputValue()))
  const weekEndingDate = computed(() => getSaturdayFromSunday(weekStartDate.value))
  const weekRange = computed(() => formatWeekRange(weekStartDate.value, weekEndingDate.value))
  const flatpickrConfig = ref(createDatePickerConfig())

  function recalcTotals(timecard: TimecardModel) {
    ensureWorkbookTimecardLines(timecard)
    if (isAdmin.value) {
      recalcTotalsForTimecard(timecard, timecard.weekStartDate || weekStartDate.value)
      return
    }

    recalcVisibleTotalsForTimecard(timecard, timecard.weekStartDate || weekStartDate.value)
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
  const rosterEmployeeNumbers = computed(() => new Set(
    workspace.rosterEmployees.value
      .map((employee) => String(employee.employeeNumber || '').trim())
      .filter(Boolean),
  ))
  const staffingOptions = computed(() => (
    staffingEmployees.value
      .filter((employee) => !rosterEmployeeNumbers.value.has(employee.employeeNumber))
      .map((employee) => ({
        id: employee.id,
        label: [
          `${employee.firstName} ${employee.lastName}`.trim(),
          employee.employeeNumber ? `#${employee.employeeNumber}` : '',
          employee.occupation || 'No occupation',
        ].filter(Boolean).join(' | '),
      }))
  ))
  const selectedStaffingEmployee = computed(() => (
    staffingEmployees.value.find((employee) => employee.id === staffingSelectedEmployeeId.value) ?? null
  ))

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

  async function loadStaffingEmployees() {
    if (!jobId.value) {
      staffingEmployees.value = []
      staffingError.value = ''
      staffingSelectedEmployeeId.value = ''
      return
    }

    staffingLoading.value = true
    staffingError.value = ''
    try {
      staffingEmployees.value = await listTimecardStaffingEmployees(jobId.value)
    } catch (error) {
      staffingEmployees.value = []
      staffingError.value = normalizeError(error, 'Failed to load employees for timecards')
    } finally {
      staffingLoading.value = false
    }
  }

  async function addStaffingEmployeeToRoster() {
    if (!jobId.value || !staffingSelectedEmployeeId.value) return

    addingStaffingEmployee.value = true
    try {
      const result = await addEmployeeToTimecardRoster(jobId.value, staffingSelectedEmployeeId.value)
      staffingSelectedEmployeeId.value = ''
      toast.show(
        result.action === 'reactivated'
          ? `Reactivated ${result.employee.firstName} ${result.employee.lastName} for this job`
          : `Added ${result.employee.firstName} ${result.employee.lastName} to this job`,
        'success',
      )
      await Promise.all([
        workspace.refreshWorkspace(),
        loadStaffingEmployees(),
      ])
    } catch (error) {
      toast.show(normalizeError(error, 'Failed to add employee to timecards'), 'error')
    } finally {
      addingStaffingEmployee.value = false
    }
  }

  async function persistTimecard(timecard: TimecardModel, showToast = false) {
    if (!timecard?.id) return
    clearAutoSaveTimer(timecard.id)
    saving.value = true
    localError.value = ''

    try {
      recalcTotals(timecard)
      if (isAdmin.value) {
        await updateTimecard(jobId.value, timecard.id, buildTimecardWritePayload(timecard))
      } else {
        const updatedTimecard = await saveForemanTimecard({
          jobId: jobId.value,
          timecardId: timecard.id,
          jobs: timecard.jobs ?? [],
          notes: timecard.notes ?? '',
          footerJobOrGl: timecard.footerJobOrGl ?? '',
          footerAccount: timecard.footerAccount ?? '',
          footerOffice: timecard.footerOffice ?? '',
          footerAmount: timecard.footerAmount ?? '',
        })
        workspace.upsertTimecard(updatedTimecard)
      }
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

      await Promise.all([
        workspace.init(),
        loadStaffingEmployees(),
      ])
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

      const { count, submittedIds } = isAdmin.value
        ? {
            count: await submitWorkspaceWeekTimecards(jobId.value, weekEndingDate.value),
            submittedIds: [] as string[],
          }
        : await submitForemanTimecardsForWeek(jobId.value, weekEndingDate.value)
      toast.show(`Submitted ${count} timecard(s)`, 'success')
      await workspace.refreshWorkspace()

      try {
        await markTimecardsSent(jobId.value, weekEndingDate.value)
      } catch (statusError) {
        logWarn('Timecards', 'Failed to update job-level timecard status', statusError)
        toast.show('Timecards submitted, but the job status badge did not update', 'warning')
      }

      if (timecardRecipients.value.length) {
        try {
          const resolvedSubmittedIds = submittedIds.length
            ? submittedIds
            : (await listWorkspaceTimecardsByJobAndWeek(jobId.value, weekEndingDate.value))
              .filter((timecard) => timecard.status === 'submitted')
              .map((timecard) => timecard.id)

          if (resolvedSubmittedIds.length) {
            await sendTimecardEmail(jobId.value, resolvedSubmittedIds, weekStartDate.value, timecardRecipients.value)
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
    staffingEmployees.value = []
    staffingError.value = ''
    staffingSelectedEmployeeId.value = ''
    staffingLoading.value = false
    addingStaffingEmployee.value = false
  }

  return {
    addStaffingEmployeeToRoster,
    addingStaffingEmployee,
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
    selectedStaffingEmployee,
    saving,
    searchTerm: workspace.searchTerm,
    selectEmployee: workspace.selectEmployee,
    selectedDate,
    staffingError,
    staffingLoading,
    staffingOptions,
    staffingSelectedEmployeeId,
    selectedEmployeeId: workspace.selectedEmployeeId,
    selectedTimecard: workspace.selectedTimecard,
    submitWeek,
    submittingAll,
    submittedCount: workspace.submittedCount,
    updateFooterField,
    weekEndingDate,
    weekRange,
    workspaceEmployeeItems: workspace.filteredEmployeeItems,
    draftCount: workspace.draftCount,
  }
}
