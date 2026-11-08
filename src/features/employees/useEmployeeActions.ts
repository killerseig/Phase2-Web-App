import { watch } from 'vue'
import { useAdminRequestScope, type AdminRequestContext } from '@/features/admin/useAdminRequestContext'
import {
  validateEmployeeForm,
  type EmployeeFormState,
} from '@/features/employees/employeeViewHelpers'
import { createEmployeeRecord, deleteEmployeeRecord, updateEmployeeRecord } from '@/services/employees'
import type { EmployeeRecord } from '@/types/domain'
import type { ReadonlyRef, WritableRef } from '@/types/reactivity'

interface UseEmployeeActionsOptions {
  context?: AdminRequestContext
  createForm: EmployeeFormState
  createLoading: WritableRef<boolean>
  deleteConfirmOpen: WritableRef<boolean>
  deleteLoading: WritableRef<boolean>
  detailForm: EmployeeFormState
  hasUnsavedDetailChanges: (employee: EmployeeRecord | null) => boolean
  resetCreateForm: () => void
  resetCreateMessages: () => void
  resetDetailMessages: () => void
  saveLoading: WritableRef<boolean>
  selectedEmployee: ReadonlyRef<EmployeeRecord | null>
  selectedEmployeeId: WritableRef<string | 'new'>
  setCreateError: (error: unknown, fallback: string) => void
  setCreateErrorMessage: (message: string) => void
  setCreateInfo: (message: string) => void
  setDetailError: (error: unknown, fallback: string) => void
  setDetailErrorMessage: (message: string) => void
  setDetailInfo: (message: string) => void
  syncingDetailForm: ReadonlyRef<boolean>
}

export function useEmployeeActions({
  context,
  createForm,
  createLoading,
  deleteConfirmOpen,
  deleteLoading,
  detailForm,
  hasUnsavedDetailChanges,
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
  const createScope = useAdminRequestScope(context, () => selectedEmployeeId.value, () => createForm)
  const detailScope = useAdminRequestScope(context, () => selectedEmployeeId.value, () => detailForm)
  let deletion: { id: string; current: () => boolean } | undefined
  watch(createScope.revision, () => { createLoading.value = false }, { flush: 'sync' })
  watch(detailScope.revision, () => {
    saveLoading.value = false
    deleteLoading.value = false
    deleteConfirmOpen.value = false
    deletion = undefined
  }, { flush: 'sync' })
  async function handleCreateEmployee() {
    if (!createScope.allowed.value || createLoading.value) return
    const request = createScope.capture()
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

      if (!request.draftCurrent()) return
      createLoading.value = false
      setCreateInfo('Employee created.')
      selectedEmployeeId.value = employeeId
    } catch (error) {
      if (request.draftCurrent()) setCreateError(error, 'Failed to create employee.')
    } finally {
      if (request.current()) createLoading.value = false
    }
  }

  async function handleAutoSaveEmployee() {
    if (!detailScope.allowed.value || saveLoading.value || deleteLoading.value || deleteConfirmOpen.value) return
    if (!selectedEmployee.value) return
    if (syncingDetailForm.value) return

    const request = detailScope.capture()
    setDetailErrorMessage('')

    if (!hasUnsavedDetailChanges(selectedEmployee.value)) {
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

      if (request.draftCurrent()) setDetailInfo('All changes saved.')
    } catch (error) {
      if (request.draftCurrent()) setDetailError(error, 'Failed to update employee.')
    } finally {
      if (request.current()) saveLoading.value = false
    }
  }

  async function handleDeleteEmployee() {
    if (!detailScope.allowed.value || !selectedEmployee.value || saveLoading.value || deleteLoading.value) return
    deletion = { id: selectedEmployee.value.id, current: detailScope.capture().current }
    deleteConfirmOpen.value = true
  }

  async function confirmDeleteEmployee() {
    const target = deletion
    if (!target?.current() || !deleteConfirmOpen.value || target.id !== selectedEmployee.value?.id) {
      deleteConfirmOpen.value = false
      return
    }
    if (deleteLoading.value || saveLoading.value) return

    resetDetailMessages()
    deleteLoading.value = true
    try {
      await deleteEmployeeRecord(target.id)
      if (!target.current()) return
      setDetailInfo('Employee deleted.')
      deleteLoading.value = false
      deleteConfirmOpen.value = false
      selectedEmployeeId.value = 'new'
      resetCreateForm()
      deleteConfirmOpen.value = false
    } catch (error) {
      if (target.current()) setDetailError(error, 'Failed to delete employee.')
    } finally {
      if (target.current()) deleteLoading.value = false
    }
  }

  return {
    confirmDeleteEmployee,
    handleAutoSaveEmployee,
    handleCreateEmployee,
    handleDeleteEmployee,
  }
}
