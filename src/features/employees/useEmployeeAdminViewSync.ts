import { onBeforeUnmount, onMounted, watch, type ComputedRef, type Ref } from 'vue'
import type { EmployeeRecord } from '@/types/domain'

type UseEmployeeAdminViewSyncOptions = {
  applyEmployeeToDetailForm: (employee: EmployeeRecord | null) => void | Promise<void>
  resetCreateForm: () => void
  selectedEmployee: ComputedRef<EmployeeRecord | null>
  selectedEmployeeId: Ref<string | 'new'>
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
  watch(selectedEmployee, (employee) => {
    if (!employee) {
      if (selectedEmployeeId.value === 'new') {
        resetCreateForm()
      }
      void applyEmployeeToDetailForm(null)
      return
    }

    void applyEmployeeToDetailForm(employee)
  })

  watch(selectedEmployeeId, (nextValue) => {
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
