import {
  getEmployeeFormSnapshot,
  getEmployeeRecordSnapshot,
  validateEmployeeForm,
  areEmployeeSnapshotsEqual,
  type EmployeeFormState,
} from '@/features/employees/employeeViewHelpers'
import { createEmployeeRecord, deleteEmployeeRecord, updateEmployeeRecord } from '@/services/employees'
import type { EmployeeRecord } from '@/types/domain'

interface Ref<T> {
  value: T
}

interface ReadonlyRef<T> {
  readonly value: T
}

interface UseEmployeeActionsOptions {
  createForm: EmployeeFormState
  createLoading: Ref<boolean>
  deleteConfirmOpen: Ref<boolean>
  deleteLoading: Ref<boolean>
  detailForm: EmployeeFormState
  resetCreateForm: () => void
  resetCreateMessages: () => void
  resetDetailMessages: () => void
  saveLoading: Ref<boolean>
  selectedEmployee: ReadonlyRef<EmployeeRecord | null>
  selectedEmployeeId: Ref<string | 'new'>
  setCreateError: (error: unknown, fallback: string) => void
  setCreateErrorMessage: (message: string) => void
  setCreateInfo: (message: string) => void
  setDetailError: (error: unknown, fallback: string) => void
  setDetailErrorMessage: (message: string) => void
  setDetailInfo: (message: string) => void
  syncingDetailForm: ReadonlyRef<boolean>
}

export function useEmployeeActions({
  createForm,
  createLoading,
  deleteConfirmOpen,
  deleteLoading,
  detailForm,
  resetCreateForm,
  resetCreateMessages,
  resetDetailMessages,
  saveLoading,
  selectedEmployee,
  selectedEmployeeId,
  setCreateError,
  setCreateErrorMessage,
  setCreateInfo,
  setDetailError,
  setDetailErrorMessage,
  setDetailInfo,
  syncingDetailForm,
}: UseEmployeeActionsOptions) {
  function getDetailFormSnapshot() {
    return getEmployeeFormSnapshot(detailForm)
  }

  function hasUnsavedDetailChanges() {
    return !areEmployeeSnapshotsEqual(getEmployeeRecordSnapshot(selectedEmployee.value), getDetailFormSnapshot())
  }

  async function handleCreateEmployee() {
    resetCreateMessages()

    const validationMessage = validateEmployeeForm(createForm)
    if (validationMessage) {
      setCreateErrorMessage(validationMessage)
      return
    }

    createLoading.value = true
    try {
      const employeeId = await createEmployeeRecord({
        employeeNumber: createForm.employeeNumber,
        firstName: createForm.firstName,
        lastName: createForm.lastName,
        occupation: createForm.occupation,
        active: createForm.active,
        isContractor: createForm.isContractor,
      })

      setCreateInfo('Employee created.')
      selectedEmployeeId.value = employeeId
    } catch (error) {
      setCreateError(error, 'Failed to create employee.')
    } finally {
      createLoading.value = false
    }
  }

  async function handleAutoSaveEmployee() {
    if (!selectedEmployee.value) return
    if (syncingDetailForm.value) return

    setDetailErrorMessage('')

    if (!hasUnsavedDetailChanges()) {
      setDetailInfo('Changes save when you leave a field.')
      return
    }

    const validationMessage = validateEmployeeForm(detailForm)
    if (validationMessage) {
      setDetailErrorMessage(validationMessage)
      return
    }

    saveLoading.value = true
    setDetailInfo('Saving changes...')
    try {
      await updateEmployeeRecord(selectedEmployee.value.id, {
        employeeNumber: detailForm.employeeNumber,
        firstName: detailForm.firstName,
        lastName: detailForm.lastName,
        occupation: detailForm.occupation,
        active: detailForm.active,
        isContractor: detailForm.isContractor,
      })

      setDetailInfo('All changes saved.')
    } catch (error) {
      setDetailError(error, 'Failed to update employee.')
    } finally {
      saveLoading.value = false
    }
  }

  async function handleDeleteEmployee() {
    if (!selectedEmployee.value) return
    deleteConfirmOpen.value = true
  }

  async function confirmDeleteEmployee() {
    if (!selectedEmployee.value) {
      deleteConfirmOpen.value = false
      return
    }

    resetDetailMessages()
    deleteLoading.value = true
    try {
      await deleteEmployeeRecord(selectedEmployee.value.id)
      setDetailInfo('Employee deleted.')
      selectedEmployeeId.value = 'new'
      resetCreateForm()
      deleteConfirmOpen.value = false
    } catch (error) {
      setDetailError(error, 'Failed to delete employee.')
    } finally {
      deleteLoading.value = false
    }
  }

  return {
    confirmDeleteEmployee,
    handleAutoSaveEmployee,
    handleCreateEmployee,
    handleDeleteEmployee,
  }
}
