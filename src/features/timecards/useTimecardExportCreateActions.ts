import {
  makeTimecardExportEmployeeSeed,
  resolveTimecardExportCreateForeman,
  resolveTimecardExportCreateJobNumber,
  validateTimecardExportCustomCardForm,
  type TimecardExportCreateForemanOption,
  type TimecardExportCustomCardFormState,
  type TimecardExportFilterState,
  type TimecardExportJobOption,
} from '@/features/timecards/exportViewHelpers'
import { createTimecardCard, ensureTimecardWeek } from '@/services/timecards'
import type { EmployeeRecord, TimecardWeekRecord } from '@/types/domain'

interface Ref<T> {
  value: T
}

interface ReadonlyRef<T> {
  readonly value: T
}

interface UseTimecardExportCreateActionsOptions {
  actionLoading: Ref<boolean>
  canEditWeek: ReadonlyRef<boolean>
  closeCreateTray: () => void
  createCardForemanId: Ref<string>
  createCardForemanOptions: ReadonlyRef<readonly TimecardExportCreateForemanOption[]>
  createCardJobId: Ref<string>
  createCardJobOptions: ReadonlyRef<readonly TimecardExportJobOption[]>
  customCardForm: TimecardExportCustomCardFormState
  employeeSearchTerm: Ref<string>
  expandAndSelectCard: (cardId: string) => void
  filters: TimecardExportFilterState
  getIsAdmin: () => boolean
  getNextSortIndexForWeek: (weekId: string) => number
  resetCustomCardForm: () => void
  resetPageAndSaveMessages: () => void
  scrollCardIntoView: (cardId: string) => void
  setCardEditMode: (cardId: string, editable: boolean) => void
  setPageError: (error: unknown, fallbackMessage: string) => void
  setPageErrorMessage: (message: string) => void
  targetCreateWeek: ReadonlyRef<TimecardWeekRecord | null>
}

export function useTimecardExportCreateActions({
  actionLoading,
  canEditWeek,
  closeCreateTray,
  createCardForemanId,
  createCardForemanOptions,
  createCardJobId,
  createCardJobOptions,
  customCardForm,
  employeeSearchTerm,
  expandAndSelectCard,
  filters,
  getIsAdmin,
  getNextSortIndexForWeek,
  resetCustomCardForm,
  resetPageAndSaveMessages,
  scrollCardIntoView,
  setCardEditMode,
  setPageError,
  setPageErrorMessage,
  targetCreateWeek,
}: UseTimecardExportCreateActionsOptions) {
  function resolveCreateCardJobNumber() {
    return resolveTimecardExportCreateJobNumber(createCardJobOptions.value, createCardJobId.value)
  }

  function resolveCreateCardForeman() {
    return resolveTimecardExportCreateForeman(createCardForemanOptions.value, createCardForemanId.value)
  }

  function syncExportFiltersToCreateTarget(week: Pick<TimecardWeekRecord, 'jobId' | 'weekEndDate' | 'ownerForemanName'>) {
    filters.dateMode = 'single'
    filters.singleWeekEndDate = week.weekEndDate
    filters.rangeStartDate = week.weekEndDate
    filters.rangeEndDate = week.weekEndDate
    filters.selectedJobIds = [week.jobId]
    filters.foreman = week.ownerForemanName?.trim() || 'all'
    filters.status = 'all'
  }

  async function ensureCreateTargetWeek() {
    const targetWeek = targetCreateWeek.value
    if (!targetWeek || filters.dateMode !== 'single') return null
    if (targetWeek.id) return targetWeek
    const selectedForeman = resolveCreateCardForeman()
    if (!selectedForeman) return null

    const weekId = await ensureTimecardWeek({
      jobId: targetWeek.jobId,
      jobCode: targetWeek.jobCode,
      jobName: targetWeek.jobName,
      ownerForemanUserId: selectedForeman.id,
      ownerForemanName: selectedForeman.label,
      weekEndDate: targetWeek.weekEndDate,
    })

    return {
      ...targetWeek,
      id: weekId,
      ownerForemanUserId: selectedForeman.id,
      ownerForemanName: selectedForeman.label,
    }
  }

  function validateCustomCardForm() {
    return validateTimecardExportCustomCardForm(customCardForm, {
      hasLinkedJob: !!createCardJobId.value,
      hasLinkedJobNumber: !!resolveCreateCardJobNumber(),
      needsForemanOwner: !targetCreateWeek.value?.id && !createCardForemanId.value,
      isAdmin: getIsAdmin(),
    })
  }

  async function handleAddEmployee(employee: EmployeeRecord) {
    if (!canEditWeek.value) return
    const linkedJobNumber = resolveCreateCardJobNumber()
    if (!createCardJobId.value || !linkedJobNumber) {
      setPageErrorMessage(!createCardJobId.value ? 'Select the linked job.' : 'Select a linked job with a job number.')
      return
    }

    actionLoading.value = true
    resetPageAndSaveMessages()
    try {
      const week = await ensureCreateTargetWeek()
      if (!week) {
        setPageErrorMessage('Switch Date Mode to Single before creating cards.')
        return
      }

      const cardId = await createTimecardCard(
        week.id,
        week.weekStartDate,
        makeTimecardExportEmployeeSeed(employee),
        getNextSortIndexForWeek(week.id),
        linkedJobNumber,
      )
      expandAndSelectCard(cardId)
      setCardEditMode(cardId, true)
      syncExportFiltersToCreateTarget(week)
      employeeSearchTerm.value = ''
      closeCreateTray()
      scrollCardIntoView(cardId)
    } catch (error) {
      setPageError(error, 'Failed to add the employee card.')
    } finally {
      actionLoading.value = false
    }
  }

  async function handleAddCustomCard() {
    if (!canEditWeek.value) return

    resetPageAndSaveMessages()
    const validationMessage = validateCustomCardForm()
    if (validationMessage) {
      setPageErrorMessage(validationMessage)
      return
    }

    actionLoading.value = true
    try {
      const week = await ensureCreateTargetWeek()
      if (!week) {
        setPageErrorMessage('Switch Date Mode to Single before creating cards.')
        return
      }

      const cardId = await createTimecardCard(
        week.id,
        week.weekStartDate,
        {
          firstName: customCardForm.firstName.trim(),
          lastName: customCardForm.lastName.trim(),
          employeeNumber: customCardForm.employeeNumber.trim(),
          occupation: customCardForm.occupation.trim(),
          wageRate: getIsAdmin() ? Number(customCardForm.wageRate.trim()) : null,
          isContractor: customCardForm.isContractor,
        },
        getNextSortIndexForWeek(week.id),
        resolveCreateCardJobNumber(),
      )
      expandAndSelectCard(cardId)
      setCardEditMode(cardId, true)
      syncExportFiltersToCreateTarget(week)
      resetCustomCardForm()
      closeCreateTray()
      scrollCardIntoView(cardId)
    } catch (error) {
      setPageError(error, 'Failed to add the custom timecard.')
    } finally {
      actionLoading.value = false
    }
  }

  return {
    handleAddCustomCard,
    handleAddEmployee,
  }
}
