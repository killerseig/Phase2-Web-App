import { nextTick, reactive, ref } from 'vue'
import type { EmployeeRecord } from '@/types/domain'
import type {
  EmployeeBooleanField,
  EmployeeFormState,
  EmployeeTextField,
} from './employeeViewHelpers'

type UseEmployeeFormStateOptions = {
  resetCreateMessages: () => void
  clearDetailError: () => void
}

function createEmptyEmployeeForm(): EmployeeFormState {
  return {
    employeeNumber: '',
    firstName: '',
    lastName: '',
    occupation: '',
    active: true,
    isContractor: false,
  }
}

function assignEmployeeForm(target: EmployeeFormState, source: EmployeeFormState) {
  target.employeeNumber = source.employeeNumber
  target.firstName = source.firstName
  target.lastName = source.lastName
  target.occupation = source.occupation
  target.active = source.active
  target.isContractor = source.isContractor
}

export function useEmployeeFormState({
  clearDetailError,
  resetCreateMessages,
}: UseEmployeeFormStateOptions) {
  const syncingDetailForm = ref(false)
  const createForm = reactive<EmployeeFormState>(createEmptyEmployeeForm())
  const detailForm = reactive<EmployeeFormState>(createEmptyEmployeeForm())

  function resetCreateForm() {
    assignEmployeeForm(createForm, createEmptyEmployeeForm())
    resetCreateMessages()
  }

  async function applyEmployeeToDetailForm(employee: EmployeeRecord | null) {
    syncingDetailForm.value = true
    clearDetailError()

    try {
      if (!employee) {
        assignEmployeeForm(detailForm, createEmptyEmployeeForm())
      } else {
        assignEmployeeForm(detailForm, {
          employeeNumber: employee.employeeNumber,
          firstName: employee.firstName,
          lastName: employee.lastName,
          occupation: employee.occupation,
          active: employee.active,
          isContractor: employee.isContractor,
        })
      }

      await nextTick()
    } finally {
      syncingDetailForm.value = false
    }
  }

  function updateCreateTextField(field: EmployeeTextField, value: string) {
    createForm[field] = value
  }

  function updateCreateBooleanField(field: EmployeeBooleanField, value: boolean) {
    createForm[field] = value
  }

  function updateDetailTextField(field: EmployeeTextField, value: string) {
    detailForm[field] = value
  }

  function updateDetailBooleanField(field: EmployeeBooleanField, value: boolean) {
    detailForm[field] = value
  }

  return {
    applyEmployeeToDetailForm,
    createForm,
    detailForm,
    resetCreateForm,
    syncingDetailForm,
    updateCreateBooleanField,
    updateCreateTextField,
    updateDetailBooleanField,
    updateDetailTextField,
  }
}
