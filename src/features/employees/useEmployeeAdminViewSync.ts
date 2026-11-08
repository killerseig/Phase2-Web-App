import { onBeforeUnmount, onMounted, watch } from 'vue'
import type { AdminRequestContext } from '@/features/admin/useAdminRequestContext'
import type { EmployeeRecord } from '@/types/domain'
import type { ReadonlyRef, WritableRef } from '@/types/reactivity'

type UseEmployeeAdminViewSyncOptions = {
  context?: AdminRequestContext
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
  context,
  applyEmployeeToDetailForm,
  resetCreateForm,
  selectedEmployee,
  selectedEmployeeId,
  setDetailErrorMessage,
  setDetailInfo,
  startEmployeesSubscription,
  stopEmployeesSubscription,
}: UseEmployeeAdminViewSyncOptions) {
  let mounted = false
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
    mounted = true
    if (context && !context.allowed.value) return
    startEmployeesSubscription()
  })

  onBeforeUnmount(() => {
    mounted = false
    stopEmployeesSubscription()
  })
  if (context) watch(context.revision, () => {
    stopEmployeesSubscription()
    if (mounted && context.allowed.value) startEmployeesSubscription()
  }, { flush: 'sync' })
}
