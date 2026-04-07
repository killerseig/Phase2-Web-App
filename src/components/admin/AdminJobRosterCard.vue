<script setup lang="ts">
import { computed } from 'vue'
import AppAlert from '@/components/common/AppAlert.vue'
import AppSectionCard from '@/components/common/AppSectionCard.vue'
import BaseCheckboxField from '@/components/common/BaseCheckboxField.vue'
import BaseInputField from '@/components/common/BaseInputField.vue'
import BaseSearchField from '@/components/common/BaseSearchField.vue'
import BaseTable from '@/components/common/BaseTable.vue'
import SearchSelectField from '@/components/common/SearchSelectField.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import type { EmployeeDirectoryOption, JobRosterTableRow, JobRosterFormInput } from '@/types/adminJobTeam'
import type { EmployeeDirectoryEmployee, JobRosterEmployee } from '@/types/models'

type Align = 'start' | 'center' | 'end'
type Column = { key: string; label: string; width?: string; align?: Align; slot?: string }

const props = defineProps<{
  employees: JobRosterEmployee[]
  totalEmployeeCount: number
  searchTerm: string
  availableEmployeeOptions: EmployeeDirectoryOption[]
  employeeDirectoryLoading: boolean
  employeeDirectoryError: string
  form: JobRosterFormInput
  selectedEmployee: EmployeeDirectoryEmployee | null
  savingEmployee: boolean
  togglingEmployeeId: string
  removingEmployeeId: string
}>()

const emit = defineEmits<{
  'update:searchTerm': [value: string]
  'update:form': [value: JobRosterFormInput]
  'update:selectedEmployeeId': [value: string]
  submit: []
  'toggle-employee': [employeeId: string]
  'remove-employee': [employeeId: string]
}>()

const rosterColumns: Column[] = [
  { key: 'employeeNumber', label: '#', width: '10%', slot: 'employeeNumber' },
  { key: 'name', label: 'Employee', width: '20%', slot: 'name' },
  { key: 'occupation', label: 'Occupation', width: '16%', slot: 'occupation' },
  { key: 'wageRate', label: 'Wage', width: '10%', align: 'end', slot: 'wageRate' },
  { key: 'type', label: 'Type', width: '16%', slot: 'type' },
  { key: 'status', label: 'Status', width: '10%', slot: 'status' },
  { key: 'actions', label: 'Actions', width: '18%', align: 'end', slot: 'actions' },
]

const tableEmployees = computed<JobRosterTableRow[]>(() => props.employees as JobRosterTableRow[])

function updateFormField<K extends keyof JobRosterFormInput>(field: K, value: JobRosterFormInput[K]) {
  emit('update:form', {
    ...props.form,
    [field]: value,
  })
}

function asEmployee(row: unknown) {
  return row as JobRosterEmployee
}
</script>

<template>
  <AppSectionCard
    title="Job Roster"
    :subtitle="totalEmployeeCount === employees.length
      ? `${totalEmployeeCount} employee${totalEmployeeCount === 1 ? '' : 's'} assigned to this job.`
      : `Showing ${employees.length} of ${totalEmployeeCount} roster employee${totalEmployeeCount === 1 ? '' : 's'}.`"
    icon="bi bi-people"
    body-class="d-flex flex-column gap-3"
  >
    <div class="row g-3 align-items-end">
      <div class="col-12 col-md-4">
        <BaseSearchField
          :model-value="searchTerm"
          label="Search Roster"
          placeholder="Name, #, occupation, contractor"
          clearable
          show-icon
          @update:model-value="emit('update:searchTerm', $event)"
        />
      </div>
      <div class="col-12 col-md-6">
        <AppAlert
          v-if="employeeDirectoryError"
          variant="danger"
          class="mb-2"
          :message="`Employee database could not be loaded: ${employeeDirectoryError}`"
        />
        <AppAlert
          v-else-if="!employeeDirectoryLoading && availableEmployeeOptions.length === 0"
          variant="secondary"
          class="mb-2"
          :message="totalEmployeeCount > 0
            ? 'No additional active employees are available to add from the employee database for this job.'
            : 'No active employees are currently available from the employee database.'"
        />
        <SearchSelectField
          :model-value="form.selectedEmployeeId"
          :options="availableEmployeeOptions"
          :disabled="employeeDirectoryLoading || !!employeeDirectoryError"
          label="Add Employee From Database"
          :placeholder="employeeDirectoryLoading ? 'Loading employees...' : 'Search active employees'"
          prepend-icon="bi bi-search"
          clear-label="No employee selected"
          @update:model-value="emit('update:selectedEmployeeId', $event)"
        />
      </div>
      <div class="col-12 col-md-2">
        <BaseInputField
          :model-value="selectedEmployee?.employeeNumber || ''"
          label="Employee #"
          readonly
          placeholder="Auto"
        />
      </div>
      <div class="col-12 col-md-4">
        <BaseInputField
          :model-value="selectedEmployee?.occupation || ''"
          label="Occupation"
          readonly
          placeholder="Auto"
        />
      </div>
      <div class="col-12 col-md-2">
        <BaseInputField
          :model-value="form.wageRate"
          type="number"
          min="0"
          step="0.01"
          label="Wage Rate"
          placeholder="25.00"
          @update:model-value="updateFormField('wageRate', $event)"
        />
      </div>
      <div class="col-12 col-md-4">
        <BaseCheckboxField
          :model-value="form.subcontracted"
          label="Subcontracted Employee"
          wrapper-class="pt-md-4"
          @update:model-value="updateFormField('subcontracted', $event)"
        />
      </div>
      <div v-if="form.subcontracted" class="col-12 col-md-4">
        <BaseInputField
          :model-value="form.contractorName"
          label="Contractor Name"
          placeholder="ABC Labor"
          @update:model-value="updateFormField('contractorName', $event)"
        />
      </div>
      <div v-if="form.subcontracted" class="col-12 col-md-4">
        <BaseInputField
          :model-value="form.contractorCategory"
          label="Contractor Category"
          placeholder="Framing"
          @update:model-value="updateFormField('contractorCategory', $event)"
        />
      </div>
      <div class="col-12 d-flex justify-content-end">
        <button
          type="button"
          class="btn btn-sm btn-outline-primary"
          :disabled="savingEmployee || !form.selectedEmployeeId"
          @click="emit('submit')"
        >
          <span v-if="savingEmployee" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
          Add Employee To Job
        </button>
      </div>
    </div>

    <AppAlert
      v-if="totalEmployeeCount === 0"
      variant="info"
      class="mb-0"
      message="No employees are on this job roster yet."
    />

    <AppAlert
      v-else-if="employees.length === 0"
      variant="secondary"
      class="mb-0"
      message="No roster employees match the current search."
    />

    <BaseTable
      v-else
      :rows="tableEmployees"
      :columns="rosterColumns"
      row-key="id"
      table-class="admin-job-roster-table"
      :striped="false"
    >
      <template #employeeNumber="{ row }">
        <span class="fw-semibold">{{ asEmployee(row).employeeNumber }}</span>
      </template>

      <template #name="{ row }">
        <div class="d-flex flex-column">
          <span class="fw-semibold">{{ asEmployee(row).firstName }} {{ asEmployee(row).lastName }}</span>
          <small v-if="asEmployee(row).contractor" class="text-muted">{{ asEmployee(row).contractor?.name }}</small>
        </div>
      </template>

      <template #occupation="{ row }">
        {{ asEmployee(row).occupation || '--' }}
      </template>

      <template #wageRate="{ row }">
        <span>{{ asEmployee(row).wageRate ?? '--' }}</span>
      </template>

      <template #type="{ row }">
        <div v-if="asEmployee(row).contractor" class="d-flex flex-column">
          <span class="badge text-bg-info align-self-start">Sub</span>
          <small class="text-muted">{{ asEmployee(row).contractor?.name }} | {{ asEmployee(row).contractor?.category }}</small>
        </div>
        <span v-else class="badge text-bg-secondary">Direct</span>
      </template>

      <template #status="{ row }">
        <StatusBadge :status="asEmployee(row).active ? 'active' : 'inactive'" />
      </template>

      <template #actions="{ row }">
        <div class="d-flex justify-content-end gap-2 flex-wrap">
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary"
            :disabled="togglingEmployeeId === asEmployee(row).id"
            @click="emit('toggle-employee', asEmployee(row).id)"
          >
            <span
              v-if="togglingEmployeeId === asEmployee(row).id"
              class="spinner-border spinner-border-sm me-2"
              aria-hidden="true"
            ></span>
            {{ asEmployee(row).active ? 'Deactivate' : 'Activate' }}
          </button>
          <button
            type="button"
            class="btn btn-sm btn-outline-danger"
            :disabled="removingEmployeeId === asEmployee(row).id"
            @click="emit('remove-employee', asEmployee(row).id)"
          >
            <span
              v-if="removingEmployeeId === asEmployee(row).id"
              class="spinner-border spinner-border-sm me-2"
              aria-hidden="true"
            ></span>
            Remove
          </button>
        </div>
      </template>
    </BaseTable>
  </AppSectionCard>
</template>
