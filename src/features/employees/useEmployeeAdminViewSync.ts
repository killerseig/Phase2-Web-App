import { onBeforeUnmount, onMounted, watch } from 'vue'
import type { EmployeeRecord } from '@/types/domain'
import type { ReadonlyRef, WritableRef } from '@/types/reactivity'

type UseEmployeeAdminViewSyncOptions = {
  applyEmployeeToDetailForm: (employee: EmployeeRecord | null) => void | Promise<void>
  resetCreateForm: () => void
  selectedEmployee: ReadonlyRef<EmployeeRecord | null>
  selectedEmployeeId: WritableRef<string | 'new'>
  setDetailErrorMessage: (message: string) => void
  setDetailInfo: (message: string) => void
  startEmployeesSubscription: () => void
  stopEmployeesSubscription: () => void
}

export function useEmployeeAdminViewSync({
  applyEmployeeToDetailForm,
  resetCreateForm,
  selectedEmployee,
  selectedEmployeeId,
  setDetailErrorMessage,
  setDetailInfo,
  startEmployeesSubscription,
  stopEmployeesSubscription,
}: UseEmployeeAdminViewSyncOptions) {
  watch(() => selectedEmployee.value, (employee) => {
    if (!employee) {
      if (selectedEmployeeId.value === 'new') {
        resetCreateForm()
      }
      void applyEmployeeToDetailForm(null)
      return
    }

    void applyEmployeeToDetailForm(employee)
  })

  watch(() => selectedEmployeeId.value, (nextValue) => {
    setDetailErrorMessage('')
    setDetailInfo(nextValue === 'new' ? '' : 'Changes save when you leave a field.')
  })

  onMounted(() => {
    startEmployeesSubscription()
  })

  onBeforeUnmount(() => {
    stopEmployeesSubscription()
  })
}
