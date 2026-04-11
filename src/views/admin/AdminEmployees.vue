<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import AdminEmployeesTableCard from '@/components/admin/AdminEmployeesTableCard.vue'
import AppAlert from '@/components/common/AppAlert.vue'
import AppBadge from '@/components/common/AppBadge.vue'
import AppPageHeader from '@/components/layout/AppPageHeader.vue'
import { ACCOUNT_VALIDATION } from '@/constants/app'
import { TIMECARD_OCCUPATIONS } from '@/constants/timecards'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useToast } from '@/composables/useToast'
import { normalizeError } from '@/services/serviceUtils'
import { useEmployeesStore } from '@/stores/employees'
import type { EmployeeDirectoryEmployee } from '@/types/models'
import type { EmployeeFormInput, EmployeeSortKey, SortDir } from '@/types/adminEmployees'
import { createEmployeeForm } from '@/types/adminEmployees'

const employeesStore = useEmployeesStore()
const { confirm } = useConfirmDialog()
const toast = useToast()
const { employees, loading: loadingEmployees, error: employeesError } = storeToRefs(employeesStore)

const occupationOptions = TIMECARD_OCCUPATIONS.map((occupation) => ({
  value: occupation,
  label: occupation,
})) as readonly { value: string; label: string }[]

const showEmployeeForm = ref(false)
const employeeForm = ref<EmployeeFormInput>(createEmployeeForm())
const creatingEmployee = ref(false)
const editingEmployeeId = ref<string | null>(null)
const editEmployeeForm = ref<EmployeeFormInput>(createEmployeeForm())
const editEmployeeFormOriginal = ref<EmployeeFormInput>(createEmployeeForm())
const savingEmployeeEdit = ref(false)
const activeEmployeeActionsId = ref('')

const employeeSortKey = ref<EmployeeSortKey>('lastName')
const employeeSortDir = ref<SortDir>('asc')

const err = computed(() => employeesError.value || '')

const totalEmployeesCount = computed(() => employees.value.length)
const activeEmployeesCount = computed(() => employees.value.filter((employee) => employee.active).length)
const inactiveEmployeesCount = computed(() => employees.value.filter((employee) => !employee.active).length)

const sortedEmployees = computed(() => {
  const key = employeeSortKey.value
  const dir = employeeSortDir.value === 'asc' ? 1 : -1

  return [...employees.value].sort((a, b) => {
    if (key === 'status') {
      if (a.active === b.active) return a.employeeNumber.localeCompare(b.employeeNumber) * dir
      return a.active ? -dir : dir
    }

    const aValue = String(a[key as keyof EmployeeDirectoryEmployee] ?? '').toLowerCase()
    const bValue = String(b[key as keyof EmployeeDirectoryEmployee] ?? '').toLowerCase()
    if (aValue === bValue) return a.employeeNumber.localeCompare(b.employeeNumber) * dir
    return aValue > bValue ? dir : -dir
  })
})

function loadEmployees() {
  employeesStore.subscribeAllEmployees()
}

function resetEmployeeForm() {
  employeeForm.value = createEmployeeForm()
}

function cancelEmployeeForm() {
  resetEmployeeForm()
  showEmployeeForm.value = false
}

function handleToggleEmployeeForm() {
  if (showEmployeeForm.value) {
    cancelEmployeeForm()
    return
  }

  cancelEmployeeEdit()
  showEmployeeForm.value = true
}

function validateEmployeeForm(form: EmployeeFormInput) {
  if (!ACCOUNT_VALIDATION.EMPLOYEE_NUMBER_PATTERN.test(form.employeeNumber.trim())) {
    return 'Employee number must be 4 or 5 digits'
  }
  if (!form.firstName.trim()) return 'First name is required'
  if (!form.lastName.trim()) return 'Last name is required'
  if (!form.occupation.trim()) return 'Occupation is required'
  return ''
}

function createEmployeeEditForm(employee?: EmployeeDirectoryEmployee): EmployeeFormInput {
  return {
    employeeNumber: employee?.employeeNumber || '',
    firstName: employee?.firstName || '',
    lastName: employee?.lastName || '',
    occupation: employee?.occupation || '',
    wageRate: employee?.wageRate == null ? '' : String(employee.wageRate),
    active: employee?.active ?? true,
  }
}

async function submitEmployeeForm() {
  const validationMessage = validateEmployeeForm(employeeForm.value)
  if (validationMessage) {
    toast.show(validationMessage, 'error')
    return
  }

  creatingEmployee.value = true
  try {
    await employeesStore.createEmployeeRecord({
      employeeNumber: employeeForm.value.employeeNumber.trim(),
      firstName: employeeForm.value.firstName.trim(),
      lastName: employeeForm.value.lastName.trim(),
      occupation: employeeForm.value.occupation.trim(),
      wageRate: employeeForm.value.wageRate.trim() ? Number(employeeForm.value.wageRate) : null,
      active: employeeForm.value.active,
    })
    toast.show('Employee added', 'success')
    cancelEmployeeForm()
  } catch (error) {
    toast.show(normalizeError(error, 'Failed to create employee'), 'error')
  } finally {
    creatingEmployee.value = false
  }
}

function handleEditEmployee(employee: EmployeeDirectoryEmployee) {
  editingEmployeeId.value = employee.id
  editEmployeeForm.value = createEmployeeEditForm(employee)
  editEmployeeFormOriginal.value = createEmployeeEditForm(employee)
}

function clearEmployeeEdit() {
  editingEmployeeId.value = null
  editEmployeeForm.value = createEmployeeForm()
  editEmployeeFormOriginal.value = createEmployeeForm()
}

function cancelEmployeeEdit() {
  clearEmployeeEdit()
  activeEmployeeActionsId.value = ''
}

async function saveEmployeeEdit(employee: EmployeeDirectoryEmployee, closeActions = false) {
  if (editingEmployeeId.value !== employee.id) return true

  const validationMessage = validateEmployeeForm(editEmployeeForm.value)
  if (validationMessage) {
    toast.show(validationMessage, 'error')
    return false
  }

  savingEmployeeEdit.value = true
  try {
    await employeesStore.updateEmployeeRecord(employee.id, {
      employeeNumber: editEmployeeForm.value.employeeNumber.trim(),
      firstName: editEmployeeForm.value.firstName.trim(),
      lastName: editEmployeeForm.value.lastName.trim(),
      occupation: editEmployeeForm.value.occupation.trim(),
      wageRate: editEmployeeForm.value.wageRate.trim() ? Number(editEmployeeForm.value.wageRate) : null,
      active: editEmployeeForm.value.active,
    })
    toast.show('Employee updated', 'success')
    clearEmployeeEdit()
    if (closeActions) activeEmployeeActionsId.value = ''
    return true
  } catch (error) {
    toast.show(normalizeError(error, 'Failed to update employee'), 'error')
    return false
  } finally {
    savingEmployeeEdit.value = false
  }
}

async function toggleEmployeeActions(employee: EmployeeDirectoryEmployee) {
  const isOpen = activeEmployeeActionsId.value === employee.id
  if (isOpen) {
    const saved = await saveEmployeeEdit(employee, true)
    if (!saved) return
    return
  }

  cancelEmployeeForm()
  cancelEmployeeEdit()
  handleEditEmployee(employee)
  activeEmployeeActionsId.value = employee.id
}

async function handleDeleteEmployee(employee: EmployeeDirectoryEmployee) {
  const confirmed = await confirm(
    `Delete "${employee.firstName} ${employee.lastName}" from the employee directory? This does not remove them from historical timecards.`,
    {
      title: 'Delete Employee',
      confirmText: 'Delete',
      variant: 'danger',
    },
  )
  if (!confirmed) return

  try {
    await employeesStore.deleteEmployeeRecord(employee.id)
    toast.show('Employee deleted', 'success')
    if (activeEmployeeActionsId.value === employee.id) {
      cancelEmployeeEdit()
    }
  } catch (error) {
    toast.show(normalizeError(error, 'Failed to delete employee'), 'error')
  }
}

function handleEmployeeSort({ sortKey, sortDir }: { sortKey: string; sortDir: SortDir }) {
  employeeSortKey.value = sortKey as EmployeeSortKey
  employeeSortDir.value = sortDir
}

onMounted(() => {
  loadEmployees()
})

onUnmounted(() => {
  employeesStore.stopEmployeesSubscription()
})
</script>

<template>
  <div class="app-page app-page--wide admin-employees-page">
    <AppPageHeader
      eyebrow="Admin Workspace"
      title="Employees"
      subtitle="Manage employee directory records, occupations, wage data, and assignment readiness."
      compact
    >
      <template #badges>
        <AppBadge :label="`${totalEmployeesCount} total`" variant-class="text-bg-secondary" />
        <AppBadge :label="`${activeEmployeesCount} active`" variant-class="text-bg-success" />
        <AppBadge :label="`${inactiveEmployeesCount} inactive`" variant-class="text-bg-warning" />
      </template>
    </AppPageHeader>

    <div class="admin-employees-page__stack">
      <AppAlert
        class="app-note admin-employees-page__note"
        icon="bi bi-info-circle"
      >
        Employees are managed here once, then foremen can pull them into their timecard workflow as needed.
      </AppAlert>

      <AdminEmployeesTableCard
        class="admin-employees-page__table-card"
        :employees="sortedEmployees"
        :loading="loadingEmployees"
        :error="err"
        :editing-employee-id="editingEmployeeId"
        :edit-form="editEmployeeForm"
        :saving-employee-edit="savingEmployeeEdit"
        :active-employee-actions-id="activeEmployeeActionsId"
        :sort-key="employeeSortKey"
        :sort-dir="employeeSortDir"
        :occupation-options="occupationOptions"
        :create-form="employeeForm"
        :show-inline-create="showEmployeeForm"
        :creating-employee="creatingEmployee"
        @update:create-form="employeeForm = $event"
        @update:edit-form="editEmployeeForm = $event"
        @sort-change="handleEmployeeSort"
        @toggle-create="handleToggleEmployeeForm"
        @submit-create="submitEmployeeForm"
        @cancel-create="cancelEmployeeForm"
        @save-edit="saveEmployeeEdit($event, true)"
        @cancel-edit="cancelEmployeeEdit"
        @toggle-actions="toggleEmployeeActions"
        @delete-employee="handleDeleteEmployee"
      />
    </div>
  </div>
</template>
