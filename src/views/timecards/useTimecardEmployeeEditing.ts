import type { Ref } from 'vue'
import type { ToastNotifier } from '@/composables/useToast'
import {
  buildTimecardEmployeeEditorForm,
  parseSubcontractedEmployee,
  parseWage,
  type TimecardEmployeeEditorForm,
  type TimecardModel,
} from './timecardUtils'

type ValidateTimecardIdentity = (input: {
  firstName: string
  lastName: string
  employeeNumber: string
}) => string | null

type UseTimecardEmployeeEditingOptions = {
  editForm: Ref<TimecardEmployeeEditorForm>
  editingTimecardId: Ref<string | null>
  expandedId: Ref<string | null>
  toast: ToastNotifier
  recalcTotals: (timecard: TimecardModel) => void
  autoSave: (timecard: TimecardModel) => void
  validateTimecardIdentity: ValidateTimecardIdentity
}

export function useTimecardEmployeeEditing(options: UseTimecardEmployeeEditingOptions) {
  const {
    editForm,
    editingTimecardId,
    expandedId,
    toast,
    recalcTotals,
    autoSave,
    validateTimecardIdentity,
  } = options

  function handleTimecardToggle(id: string, open: boolean) {
    expandedId.value = open ? id : null
  }

  function parseMileageInput(value: string): number | null {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed < 0) return null
    return parsed
  }

  function updateMileage(timecard: TimecardModel, rawValue: string) {
    timecard.mileage = parseMileageInput(rawValue)
    autoSave(timecard)
  }

  function startEditingEmployee(timecard: TimecardModel) {
    editingTimecardId.value = timecard.id
    editForm.value = buildTimecardEmployeeEditorForm(timecard)
  }

  function confirmEditingEmployee(timecard: TimecardModel) {
    const validationMessage = validateTimecardIdentity({
      firstName: editForm.value.firstName,
      lastName: editForm.value.lastName,
      employeeNumber: editForm.value.employeeNumber,
    })
    if (validationMessage) {
      toast.show(validationMessage, 'error')
      return
    }

    timecard.employeeNumber = editForm.value.employeeNumber.trim()
    timecard.firstName = editForm.value.firstName.trim()
    timecard.lastName = editForm.value.lastName.trim()
    timecard.employeeName = `${timecard.firstName} ${timecard.lastName}`
    timecard.employeeWage = parseWage(editForm.value.employeeWage)
    timecard.subcontractedEmployee = parseSubcontractedEmployee(editForm.value.subcontractedEmployee)
    timecard.occupation = editForm.value.occupation.trim()
    recalcTotals(timecard)
    autoSave(timecard)
    editingTimecardId.value = null
  }

  function toggleEditingEmployee(timecard: TimecardModel) {
    if (editingTimecardId.value === timecard.id) {
      confirmEditingEmployee(timecard)
    } else {
      startEditingEmployee(timecard)
    }
  }

  function handleNotesInput(timecard: TimecardModel, value: string) {
    timecard.notes = value
    autoSave(timecard)
  }

  return {
    handleNotesInput,
    handleTimecardToggle,
    toggleEditingEmployee,
    updateMileage,
  }
}
