import { ref, type ComputedRef, type Ref } from 'vue'
import { ROLES } from '@/constants/app'
import type { ControllerGroupedTimecard } from '@/types/controller'
import type { ControllerTimecardWeekItem } from '@/services/Email'
import { deleteTimecard, updateTimecard } from '@/services/Timecards'
import type { ToastNotifier } from '@/composables/useToast'
import type { WorkbookFooterField, WorkbookOffField } from '@/types/timecards'
import { validateRequired } from '@/utils/validation'
import {
  buildTimecardEmployeeEditorForm,
  createEmptyTimecardEmployeeEditorForm,
  parseSubcontractedEmployee,
  parseWage,
  recalcTotalsForTimecard,
  type TimecardEmployeeEditorForm,
  type TimecardModel,
} from '@/utils/timecardUtils'
import { useTimecardJobEditing } from '@/composables/timecards/useTimecardJobEditing'

type DiffField = 'difH' | 'difP' | 'difC'

type ConfirmFn = (
  message: string,
  options?: Record<string, unknown>,
) => Promise<boolean>

type UseControllerTimecardEditingOptions = {
  authRole: () => string | null | undefined
  isAdmin: ComputedRef<boolean>
  reviewTimecards: Ref<ControllerTimecardWeekItem[]>
  loadedTimecardMap: Ref<Record<string, TimecardModel>>
  buildTimecardKey: (jobId: string, timecardId: string) => string
  queueAutoReload: (delayMs?: number) => void
  recalculateReviewSummary: (rows?: ControllerTimecardWeekItem[]) => void
  confirm: ConfirmFn
  toast: ToastNotifier
}

export function useControllerTimecardEditing(options: UseControllerTimecardEditingOptions) {
  const {
    authRole,
    isAdmin,
    reviewTimecards,
    loadedTimecardMap,
    buildTimecardKey,
    queueAutoReload,
    recalculateReviewSummary,
    confirm,
    toast,
  } = options

  const editingTimecardId = ref<string | null>(null)
  const expandedId = ref<string | null>(null)
  const editForm = ref<TimecardEmployeeEditorForm>(createEmptyTimecardEmployeeEditorForm())
  const autoSaveTimers = new Map<string, ReturnType<typeof setTimeout>>()

  function formatErr(err: unknown): string {
    if (err && typeof err === 'object' && 'message' in err) {
      return String((err as { message?: unknown }).message || err)
    }
    return String(err || 'Unknown error')
  }

  function recalcTotals(timecard: TimecardModel) {
    recalcTotalsForTimecard(timecard, timecard.weekStartDate)
  }

  function isTimecardLocked(timecard: TimecardModel): boolean {
    return timecard.status === 'submitted' && !isAdmin.value && authRole() !== ROLES.CONTROLLER
  }

  function isTimecardDeleteDisabled(timecard: TimecardModel): boolean {
    return timecard.status === 'submitted' && !isAdmin.value
  }

  function handleTimecardToggle(key: string, open: boolean) {
    expandedId.value = open ? key : null
  }

  function updateLoadedTimecard(timecard: TimecardModel) {
    loadedTimecardMap.value = {
      ...loadedTimecardMap.value,
      [buildTimecardKey(timecard.jobId, timecard.id)]: timecard,
    }
  }

  function syncReviewRowFromTimecard(timecard: TimecardModel) {
    const employeeForm = buildTimecardEmployeeEditorForm(timecard)
    const rowIndex = reviewTimecards.value.findIndex((row) => (
      row.jobId === timecard.jobId && row.timecardId === timecard.id
    ))
    if (rowIndex === -1) return

    const currentRow = reviewTimecards.value[rowIndex]
    if (!currentRow) return

    reviewTimecards.value[rowIndex] = {
      ...currentRow,
      employeeNumber: timecard.employeeNumber,
      employeeName: timecard.employeeName,
      firstName: employeeForm.firstName,
      lastName: employeeForm.lastName,
      occupation: timecard.occupation,
      status: timecard.status,
      weekStart: timecard.weekStartDate,
      weekEnding: timecard.weekEndingDate,
      totalHours: timecard.totals?.hoursTotal ?? 0,
      totalProduction: timecard.totals?.productionTotal ?? 0,
      totalLine: timecard.totals?.lineTotal ?? 0,
      subcontractedEmployee: !!timecard.subcontractedEmployee,
    }
    recalculateReviewSummary()
  }

  function startEditingEmployee(entry: ControllerGroupedTimecard) {
    editingTimecardId.value = entry.key
    editForm.value = buildTimecardEmployeeEditorForm(entry.timecard)
  }

  function confirmEditingEmployee(entry: ControllerGroupedTimecard) {
    const validationMessage = [
      ...validateRequired(editForm.value.firstName, 'First name'),
      ...validateRequired(editForm.value.lastName, 'Last name'),
      ...validateRequired(editForm.value.employeeNumber, 'Employee number'),
    ][0]?.message ?? null

    if (validationMessage) {
      toast.show(validationMessage, 'error')
      return
    }

    const timecard = entry.timecard
    timecard.employeeNumber = editForm.value.employeeNumber.trim()
    timecard.firstName = editForm.value.firstName.trim()
    timecard.lastName = editForm.value.lastName.trim()
    timecard.employeeName = `${timecard.firstName} ${timecard.lastName}`.trim()
    timecard.employeeWage = parseWage(editForm.value.employeeWage)
    timecard.subcontractedEmployee = parseSubcontractedEmployee(editForm.value.subcontractedEmployee)
    timecard.occupation = editForm.value.occupation.trim()
    recalcTotals(timecard)
    updateLoadedTimecard(timecard)
    syncReviewRowFromTimecard(timecard)
    autoSave(timecard)
    editingTimecardId.value = null
  }

  function toggleEditingEmployee(entry: ControllerGroupedTimecard) {
    if (editingTimecardId.value === entry.key) confirmEditingEmployee(entry)
    else startEditingEmployee(entry)
  }

  function handleNotesInput(timecard: TimecardModel, value: string) {
    timecard.notes = value
    updateLoadedTimecard(timecard)
    autoSave(timecard)
  }

  async function saveTimecard(timecard: TimecardModel, showToast = true) {
    try {
      recalcTotals(timecard)
      await updateTimecard(timecard.jobId, timecard.id, {
        days: timecard.days,
        jobs: timecard.jobs,
        notes: timecard.notes,
        firstName: timecard.firstName,
        lastName: timecard.lastName,
        employeeName: timecard.employeeName,
        employeeNumber: timecard.employeeNumber,
        employeeWage: timecard.employeeWage,
        productionBurden: timecard.productionBurden ?? null,
        subcontractedEmployee: timecard.subcontractedEmployee ?? false,
        regularHoursOverride: timecard.regularHoursOverride ?? null,
        overtimeHoursOverride: timecard.overtimeHoursOverride ?? null,
        footerJobOrGl: timecard.footerJobOrGl ?? '',
        footerAccount: timecard.footerAccount ?? '',
        footerOffice: timecard.footerOffice ?? '',
        footerAmount: timecard.footerAmount ?? '',
        occupation: timecard.occupation,
      })

      updateLoadedTimecard(timecard)
      syncReviewRowFromTimecard(timecard)
      queueAutoReload(700)

      if (showToast) {
        toast.show(`Updated timecard for ${timecard.employeeName}`, 'success')
      }
    } catch (err) {
      toast.show(formatErr(err), 'error')
    }
  }

  function autoSave(timecard: TimecardModel) {
    const key = buildTimecardKey(timecard.jobId, timecard.id)
    const existing = autoSaveTimers.get(key)
    if (existing) clearTimeout(existing)

    const timer = setTimeout(() => {
      void saveTimecard(timecard, false)
      autoSaveTimers.delete(key)
    }, 500)

    autoSaveTimers.set(key, timer)
  }

  async function handleDeleteTimecard(entry: ControllerGroupedTimecard) {
    const confirmed = await confirm(`Delete timecard for ${entry.timecard.employeeName}?`, {
      title: 'Delete Timecard',
      confirmText: 'Delete',
      variant: 'danger',
    })
    if (!confirmed) return

    try {
      await deleteTimecard(entry.timecard.jobId, entry.timecard.id)

      const nextMap = { ...loadedTimecardMap.value }
      delete nextMap[entry.key]
      loadedTimecardMap.value = nextMap
      reviewTimecards.value = reviewTimecards.value.filter((row) => (
        !(row.jobId === entry.row.jobId && row.timecardId === entry.row.timecardId)
      ))
      recalculateReviewSummary()

      const timer = autoSaveTimers.get(entry.key)
      if (timer) {
        clearTimeout(timer)
        autoSaveTimers.delete(entry.key)
      }

      if (editingTimecardId.value === entry.key) editingTimecardId.value = null
      if (expandedId.value === entry.key) expandedId.value = null

      queueAutoReload(250)
      toast.show(`Deleted timecard for ${entry.timecard.employeeName}`, 'success')
    } catch (err) {
      toast.show(formatErr(err), 'error')
    }
  }

  function cleanupAutoSaveTimers() {
    autoSaveTimers.forEach((timer) => clearTimeout(timer))
    autoSaveTimers.clear()
  }

  const {
    addJobRow,
    removeJobRow,
    updateJobNumber,
    updateSubsectionArea,
    updateAccount,
    updateDiffValue,
    updateOffValue,
    handleHoursInput,
    handleProductionInput,
    handleUnitCostInput,
  } = useTimecardJobEditing({
    getWeekStartDate: (timecard) => timecard.weekStartDate,
    recalcTotals: (timecard) => {
      recalcTotals(timecard)
      updateLoadedTimecard(timecard)
      syncReviewRowFromTimecard(timecard)
    },
    autoSave: (timecard) => {
      updateLoadedTimecard(timecard)
      syncReviewRowFromTimecard(timecard)
      autoSave(timecard)
    },
  })

  function handleGroupedResultsOpen(payload: { key: string; open: boolean }) {
    handleTimecardToggle(payload.key, payload.open)
  }

  function handleGroupedResultsRemoveJobRow(payload: { timecard: TimecardModel; jobIndex: number }) {
    removeJobRow(payload.timecard, payload.jobIndex)
  }

  function handleGroupedResultsUpdateJobNumber(payload: { timecard: TimecardModel; jobIndex: number; value: string }) {
    updateJobNumber(payload.timecard, payload.jobIndex, payload.value)
  }

  function handleGroupedResultsUpdateSubsectionArea(payload: { timecard: TimecardModel; jobIndex: number; value: string }) {
    updateSubsectionArea(payload.timecard, payload.jobIndex, payload.value)
  }

  function handleGroupedResultsUpdateAccount(payload: { timecard: TimecardModel; jobIndex: number; value: string }) {
    updateAccount(payload.timecard, payload.jobIndex, payload.value)
  }

  function handleGroupedResultsUpdateDiffValue(payload: { timecard: TimecardModel; jobIndex: number; field: DiffField; value: string }) {
    updateDiffValue(payload.timecard, payload.jobIndex, payload.field, payload.value)
  }

  function handleGroupedResultsUpdateHours(payload: { timecard: TimecardModel; jobIndex: number; dayIndex: number; value: number }) {
    handleHoursInput(payload.timecard, payload.jobIndex, payload.dayIndex, payload.value)
  }

  function handleGroupedResultsUpdateProduction(payload: { timecard: TimecardModel; jobIndex: number; dayIndex: number; value: number }) {
    handleProductionInput(payload.timecard, payload.jobIndex, payload.dayIndex, payload.value)
  }

  function handleGroupedResultsUpdateUnitCost(
    payload: { timecard: TimecardModel; jobIndex: number; dayIndex: number; value: number | null },
  ) {
    handleUnitCostInput(payload.timecard, payload.jobIndex, payload.dayIndex, payload.value)
  }

  function handleGroupedResultsUpdateOffValue(
    payload: { timecard: TimecardModel; jobIndex: number; field: WorkbookOffField; value: number },
  ) {
    updateOffValue(payload.timecard, payload.jobIndex, payload.field, payload.value)
  }

  function handleGroupedResultsUpdateFooterField(
    payload: { timecard: TimecardModel; field: WorkbookFooterField; value: string },
  ) {
    payload.timecard[payload.field] = payload.value
    updateLoadedTimecard(payload.timecard)
    autoSave(payload.timecard)
  }

  function handleGroupedResultsUpdateNotes(payload: { timecard: TimecardModel; value: string }) {
    handleNotesInput(payload.timecard, payload.value)
  }

  return {
    addJobRow,
    cleanupAutoSaveTimers,
    editForm,
    editingTimecardId,
    expandedId,
    handleDeleteTimecard,
    handleGroupedResultsOpen,
    handleGroupedResultsRemoveJobRow,
    handleGroupedResultsUpdateAccount,
    handleGroupedResultsUpdateDiffValue,
    handleGroupedResultsUpdateFooterField,
    handleGroupedResultsUpdateHours,
    handleGroupedResultsUpdateJobNumber,
    handleGroupedResultsUpdateNotes,
    handleGroupedResultsUpdateOffValue,
    handleGroupedResultsUpdateProduction,
    handleGroupedResultsUpdateUnitCost,
    handleGroupedResultsUpdateSubsectionArea,
    isTimecardDeleteDisabled,
    isTimecardLocked,
    saveTimecard,
    toggleEditingEmployee,
  }
}
