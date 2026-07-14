import {
  getNextJobTimecardSortIndex,
  makeJobTimecardEmployeeSeed,
  validateJobTimecardCustomCardForm,
  type JobTimecardCustomCardFormState,
} from '@/features/timecards/jobViewHelpers'
import { createTimecardCard } from '@/services/timecards'
import type { EmployeeRecord, TimecardCardRecord, TimecardWeekRecord } from '@/types/domain'

interface Ref<T> {
  value: T
}

interface ReadonlyRef<T> {
  readonly value: T
}

interface UseJobTimecardCreateActionsOptions {
  actionLoading: Ref<boolean>
  canEditWeek: ReadonlyRef<boolean>
  cards: ReadonlyRef<TimecardCardRecord[]>
  closeCreateTray: () => void
  customCardForm: JobTimecardCustomCardFormState
  employeeSearchTerm: Ref<string>
  expandAndSelectCard: (cardId: string) => void
  getIsAdmin: () => boolean
  linkedJobNumber: ReadonlyRef<string>
  resetCustomCardForm: () => void
  resetPageAndSaveMessages: () => void
  scrollCardIntoView: (cardId: string) => void
  selectedWeek: ReadonlyRef<TimecardWeekRecord | null>
  selectedWeekStartDate: ReadonlyRef<string>
  setPageError: (error: unknown, fallbackMessage: string) => void
  setPageErrorMessage: (message: string) => void
}

export function useJobTimecardCreateActions({
  actionLoading,
  canEditWeek,
  cards,
  closeCreateTray,
  customCardForm,
  employeeSearchTerm,
  expandAndSelectCard,
  getIsAdmin,
  linkedJobNumber,
  resetCustomCardForm,
  resetPageAndSaveMessages,
  scrollCardIntoView,
  selectedWeek,
  selectedWeekStartDate,
  setPageError,
  setPageErrorMessage,
}: UseJobTimecardCreateActionsOptions) {
  function getNextSortIndex() {
    return getNextJobTimecardSortIndex(cards.value)
  }

  async function handleAddEmployee(employee: EmployeeRecord) {
    if (!selectedWeek.value || !canEditWeek.value) return

    actionLoading.value = true
    resetPageAndSaveMessages()
    try {
      const cardId = await createTimecardCard(
        selectedWeek.value.id,
        selectedWeekStartDate.value,
        makeJobTimecardEmployeeSeed(employee),
        getNextSortIndex(),
        linkedJobNumber.value,
      )
      expandAndSelectCard(cardId)
      employeeSearchTerm.value = ''
      closeCreateTray()
      scrollCardIntoView(cardId)
    } catch (error) {
      setPageError(error, 'Failed to add the employee card.')
    } finally {
      actionLoading.value = false
    }
  }

  function validateCustomCardForm() {
    return validateJobTimecardCustomCardForm(customCardForm, { canEditWage: getIsAdmin() })
  }

  async function handleAddCustomCard() {
    if (!selectedWeek.value || !canEditWeek.value) return

    resetPageAndSaveMessages()
    const validationMessage = validateCustomCardForm()
    if (validationMessage) {
      setPageErrorMessage(validationMessage)
      return
    }

    actionLoading.value = true
    try {
      const cardId = await createTimecardCard(
        selectedWeek.value.id,
        selectedWeekStartDate.value,
        {
          firstName: customCardForm.firstName,
          lastName: customCardForm.lastName,
          employeeNumber: customCardForm.employeeNumber,
          occupation: customCardForm.occupation,
          wageRate: customCardForm.wageRate.trim() ? Number(customCardForm.wageRate.trim()) : null,
          isContractor: customCardForm.isContractor,
        },
        getNextSortIndex(),
        linkedJobNumber.value,
      )
      expandAndSelectCard(cardId)
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
