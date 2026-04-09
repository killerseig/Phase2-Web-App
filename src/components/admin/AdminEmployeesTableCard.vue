<script setup lang="ts">
import { computed } from 'vue'
import AppAlert from '@/components/common/AppAlert.vue'
import BaseTable from '@/components/common/BaseTable.vue'
import InlineField from '@/components/common/InlineField.vue'
import InlineSelectMenu from '@/components/common/InlineSelectMenu.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import AdminCardWrapper from '@/components/admin/AdminCardWrapper.vue'
import type { EmployeeDirectoryEmployee } from '@/types/models'
import type { EmployeeFormInput, EmployeeSortKey, SortDir } from '@/types/adminEmployees'

type Align = 'start' | 'center' | 'end'
type Column = { key: string; label: string; sortable?: boolean; width?: string; align?: Align; slot?: string }
type EmployeeTableRow = EmployeeDirectoryEmployee & Record<string, unknown>

const props = defineProps<{
  employees: EmployeeDirectoryEmployee[]
  loading: boolean
  error: string
  editingEmployeeId: string | null
  editForm: EmployeeFormInput
  savingEmployeeEdit: boolean
  activeEmployeeActionsId: string
  sortKey: EmployeeSortKey
  sortDir: SortDir
  occupationOptions: readonly { value: string; label: string }[]
  createForm: EmployeeFormInput
  showInlineCreate: boolean
  creatingEmployee: boolean
}>()

const emit = defineEmits<{
  'update:editForm': [value: EmployeeFormInput]
  'update:createForm': [value: EmployeeFormInput]
  'sort-change': [payload: { sortKey: string; sortDir: SortDir }]
  'save-edit': [employee: EmployeeDirectoryEmployee]
  'cancel-edit': []
  'toggle-actions': [employee: EmployeeDirectoryEmployee]
  'delete-employee': [employee: EmployeeDirectoryEmployee]
  'toggle-create': []
  'submit-create': []
  'cancel-create': []
}>()

const employeeColumns: Column[] = [
  { key: 'employeeNumber', label: 'Employee #', sortable: true, width: '12%' },
  { key: 'firstName', label: 'First Name', sortable: true, width: '15%' },
  { key: 'lastName', label: 'Last Name', sortable: true, width: '15%' },
  { key: 'occupation', label: 'Occupation', sortable: true, width: '24%', slot: 'occupation' },
  { key: 'wageRate', label: 'Wage', width: '10%', align: 'end', slot: 'wageRate' },
  { key: 'status', label: 'Status', sortable: true, width: '10%', align: 'center', slot: 'status' },
  { key: 'actions', label: 'Actions', width: '14%', align: 'end', slot: 'actions' },
]

const tableEmployees = computed<EmployeeTableRow[]>(() => props.employees as EmployeeTableRow[])

const statusOptions = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
] as const

function updateEditField<K extends keyof EmployeeFormInput>(field: K, value: EmployeeFormInput[K]) {
  emit('update:editForm', {
    ...props.editForm,
    [field]: value,
  })
}

function updateCreateField<K extends keyof EmployeeFormInput>(field: K, value: EmployeeFormInput[K]) {
  emit('update:createForm', {
    ...props.createForm,
    [field]: value,
  })
}

function asEmployee(row: unknown): EmployeeDirectoryEmployee {
  return row as EmployeeDirectoryEmployee
}

function handleCreateRowKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    emit('submit-create')
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    emit('cancel-create')
  }
}
</script>

<template>
  <AdminCardWrapper
    title="Employee Directory"
    icon="person-vcard"
    :loading="loading"
    :error="error"
  >
    <template #header-actions>
      <button
        type="button"
        class="btn btn-primary btn-sm"
        @click="emit('toggle-create')"
      >
        <i class="bi" :class="showInlineCreate ? 'bi-dash-lg' : 'bi-plus-lg'"></i>
        {{ showInlineCreate ? 'Cancel' : 'New Employee' }}
      </button>
    </template>

    <AppAlert
      v-if="employees.length === 0 && !showInlineCreate"
      variant="info"
      class="text-center mb-0"
      message="No employees yet. Create your first employee from the table."
    />

    <BaseTable
      v-else
      :rows="tableEmployees"
      :columns="employeeColumns"
      row-key="id"
      :sort-key="sortKey"
      :sort-dir="sortDir"
      table-class="admin-employees-table"
      @sort-change="emit('sort-change', $event)"
    >
      <template #row-prepend>
        <tr v-if="showInlineCreate" class="admin-employees-table__create-row">
          <td>
            <input
              class="form-control form-control-sm admin-employees-table__field"
              type="text"
              :value="createForm.employeeNumber"
              placeholder="1234"
              autofocus
              @input="updateCreateField('employeeNumber', ($event.target as HTMLInputElement).value)"
              @keydown="handleCreateRowKeydown"
            />
          </td>
          <td>
            <input
              class="form-control form-control-sm admin-employees-table__field"
              type="text"
              :value="createForm.firstName"
              placeholder="First name"
              @input="updateCreateField('firstName', ($event.target as HTMLInputElement).value)"
              @keydown="handleCreateRowKeydown"
            />
          </td>
          <td>
            <input
              class="form-control form-control-sm admin-employees-table__field"
              type="text"
              :value="createForm.lastName"
              placeholder="Last name"
              @input="updateCreateField('lastName', ($event.target as HTMLInputElement).value)"
              @keydown="handleCreateRowKeydown"
            />
          </td>
          <td>
            <InlineSelectMenu
              :model-value="createForm.occupation"
              :options="occupationOptions"
              button-class="form-select form-select-sm app-table-cell-input admin-employees-table__field"
              placeholder="Select occupation"
              @update:model-value="updateCreateField('occupation', String($event))"
              @escape="emit('cancel-create')"
            />
          </td>
          <td>
            <input
              class="form-control form-control-sm admin-employees-table__field text-end"
              type="number"
              min="0"
              step="0.01"
              :value="createForm.wageRate"
              placeholder="25.00"
              @input="updateCreateField('wageRate', ($event.target as HTMLInputElement).value)"
              @keydown="handleCreateRowKeydown"
            />
          </td>
          <td class="text-center">
            <InlineSelectMenu
              :model-value="String(createForm.active)"
              :options="statusOptions"
              button-class="form-select form-select-sm app-table-cell-input admin-employees-table__field"
              @update:model-value="updateCreateField('active', String($event) === 'true')"
              @escape="emit('cancel-create')"
            />
          </td>
          <td class="text-end">
            <div class="admin-employees-table__create-actions">
              <button
                type="button"
                class="btn btn-sm btn-outline-secondary btn-icon admin-employees-table__action-button"
                title="Cancel new employee"
                :disabled="creatingEmployee"
                @click="emit('cancel-create')"
              >
                <i class="bi bi-x-lg"></i>
              </button>
              <button
                type="button"
                class="btn btn-sm btn-primary btn-icon admin-employees-table__action-button"
                title="Create employee"
                :disabled="creatingEmployee"
                @click="emit('submit-create')"
              >
                <span
                  v-if="creatingEmployee"
                  class="spinner-border spinner-border-sm"
                  role="status"
                  aria-hidden="true"
                ></span>
                <i v-else class="bi bi-check-lg"></i>
              </button>
            </div>
          </td>
        </tr>
      </template>

      <template #cell-employeeNumber="{ row }">
        <InlineField
          :editing="editingEmployeeId === asEmployee(row).id"
          :model-value="editForm.employeeNumber"
          placeholder="Employee #"
          input-class="form-control form-control-sm admin-employees-table__field"
          @update:model-value="updateEditField('employeeNumber', String($event))"
          @enter="emit('save-edit', asEmployee(row))"
          @escape="emit('cancel-edit')"
        >
          <span class="admin-employees-table__employee-number" :title="asEmployee(row).employeeNumber">
            {{ asEmployee(row).employeeNumber }}
          </span>
        </InlineField>
      </template>

      <template #cell-firstName="{ row }">
        <InlineField
          :editing="editingEmployeeId === asEmployee(row).id"
          :model-value="editForm.firstName"
          placeholder="First name"
          input-class="form-control form-control-sm admin-employees-table__field"
          @update:model-value="updateEditField('firstName', String($event))"
          @enter="emit('save-edit', asEmployee(row))"
          @escape="emit('cancel-edit')"
        >
          <span class="admin-employees-table__cell-text" :title="asEmployee(row).firstName">
            {{ asEmployee(row).firstName }}
          </span>
        </InlineField>
      </template>

      <template #cell-lastName="{ row }">
        <InlineField
          :editing="editingEmployeeId === asEmployee(row).id"
          :model-value="editForm.lastName"
          placeholder="Last name"
          input-class="form-control form-control-sm admin-employees-table__field"
          @update:model-value="updateEditField('lastName', String($event))"
          @enter="emit('save-edit', asEmployee(row))"
          @escape="emit('cancel-edit')"
        >
          <span class="admin-employees-table__cell-text" :title="asEmployee(row).lastName">
            {{ asEmployee(row).lastName }}
          </span>
        </InlineField>
      </template>

      <template #occupation="{ row }">
        <InlineField
          :editing="editingEmployeeId === asEmployee(row).id"
          :model-value="editForm.occupation"
          type="select"
          select-class="form-select form-select-sm app-table-cell-input admin-employees-table__field"
          :options="occupationOptions"
          @update:model-value="updateEditField('occupation', String($event))"
          @enter="emit('save-edit', asEmployee(row))"
          @escape="emit('cancel-edit')"
        >
          <span class="admin-employees-table__cell-text" :title="asEmployee(row).occupation || '--'">
            {{ asEmployee(row).occupation || '--' }}
          </span>
        </InlineField>
      </template>

      <template #wageRate="{ row }">
        <InlineField
          :editing="editingEmployeeId === asEmployee(row).id"
          :model-value="editForm.wageRate"
          type="number"
          step="0.01"
          input-class="form-control form-control-sm admin-employees-table__field text-end"
          placeholder="25.00"
          @update:model-value="updateEditField('wageRate', String($event))"
          @enter="emit('save-edit', asEmployee(row))"
          @escape="emit('cancel-edit')"
        >
          <span class="admin-employees-table__wage">
            {{ asEmployee(row).wageRate?.toFixed(2) ?? '--' }}
          </span>
        </InlineField>
      </template>

      <template #status="{ row }">
        <InlineField
          :editing="editingEmployeeId === asEmployee(row).id"
          :model-value="String(editForm.active)"
          type="select"
          select-class="form-select form-select-sm app-table-cell-input admin-employees-table__field"
          :options="statusOptions"
          @update:model-value="updateEditField('active', String($event) === 'true')"
          @enter="emit('save-edit', asEmployee(row))"
          @escape="emit('cancel-edit')"
        >
          <StatusBadge :status="asEmployee(row).active ? 'active' : 'inactive'" />
        </InlineField>
      </template>

      <template #actions="{ row }">
        <div class="admin-employees-table__row-actions">
          <button
            v-if="editingEmployeeId !== asEmployee(row).id"
            type="button"
            class="btn btn-sm btn-outline-secondary btn-icon admin-employees-table__action-button"
            title="Edit employee"
            @click.stop="emit('toggle-actions', asEmployee(row))"
          >
            <i class="bi bi-pencil"></i>
          </button>

          <template v-else>
            <button
              type="button"
              class="btn btn-sm btn-outline-danger btn-icon admin-employees-table__action-button"
              title="Delete employee"
              :disabled="savingEmployeeEdit"
              @click.stop="emit('delete-employee', asEmployee(row))"
            >
              <i class="bi bi-trash text-danger"></i>
            </button>
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary btn-icon admin-employees-table__action-button"
              title="Cancel edits"
              :disabled="savingEmployeeEdit"
              @click.stop="emit('cancel-edit')"
            >
              <i class="bi bi-x-lg"></i>
            </button>
            <button
              type="button"
              class="btn btn-sm btn-primary btn-icon admin-employees-table__action-button"
              title="Save employee"
              :disabled="savingEmployeeEdit"
              @click.stop="emit('save-edit', asEmployee(row))"
            >
              <span
                v-if="savingEmployeeEdit"
                class="spinner-border spinner-border-sm"
                role="status"
                aria-hidden="true"
              ></span>
              <i v-else class="bi bi-check-lg"></i>
            </button>
          </template>
        </div>
      </template>
    </BaseTable>
  </AdminCardWrapper>
</template>
