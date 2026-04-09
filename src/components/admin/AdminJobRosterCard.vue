<script setup lang="ts">
import { computed } from 'vue'
import AppAlert from '@/components/common/AppAlert.vue'
import AppSectionCard from '@/components/common/AppSectionCard.vue'
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
  embedded?: boolean
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
  { key: 'employeeNumber', label: '#', width: '12%', slot: 'employeeNumber' },
  { key: 'name', label: 'Employee', width: '34%', slot: 'name' },
  { key: 'occupation', label: 'Occupation', width: '24%', slot: 'occupation' },
  { key: 'status', label: 'Status', width: '12%', slot: 'status' },
  { key: 'actions', label: 'Actions', width: '18%', align: 'end', slot: 'actions' },
]

const tableEmployees = computed<JobRosterTableRow[]>(() => props.employees as JobRosterTableRow[])
const selectedEmployeeLabel = computed(() => (
  props.selectedEmployee
    ? `${props.selectedEmployee.firstName} ${props.selectedEmployee.lastName}`.trim()
    : ''
))

function asEmployee(row: unknown) {
  return row as JobRosterEmployee
}
</script>

<template>
  <AppSectionCard
    class="admin-job-roster-card"
    :class="{ 'admin-job-roster-card--embedded': embedded }"
    title="Crew"
    :subtitle="totalEmployeeCount === employees.length
      ? `${totalEmployeeCount} employee${totalEmployeeCount === 1 ? '' : 's'} assigned to this job.`
      : `Showing ${employees.length} of ${totalEmployeeCount} assigned crew member${totalEmployeeCount === 1 ? '' : 's'}.`"
    icon="bi bi-people"
    body-class="admin-job-roster-card__body"
  >
    <div class="row g-3 align-items-end admin-job-roster-card__entry-form">
      <div class="col-12 col-xl">
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
          label="Add Crew Member"
          :placeholder="employeeDirectoryLoading ? 'Loading employees...' : 'Search employees by name, #, or occupation'"
          prepend-icon="bi bi-search"
          clear-label="Clear selection"
          @update:model-value="emit('update:selectedEmployeeId', $event)"
        />

        <div v-if="selectedEmployee" class="admin-job-roster-card__selected-inline">
          <span class="admin-job-roster-card__selected-inline-name">{{ selectedEmployeeLabel }}</span>
          <span>#{{ selectedEmployee.employeeNumber }}</span>
          <span>{{ selectedEmployee.occupation || 'No occupation listed' }}</span>
        </div>
      </div>
      <div class="col-12 col-xl-auto admin-job-roster-card__actions">
        <button
          type="button"
          class="btn btn-sm btn-outline-primary"
          :disabled="savingEmployee || !form.selectedEmployeeId"
          @click="emit('submit')"
        >
          <span v-if="savingEmployee" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
          Add To Crew
        </button>
      </div>
    </div>

    <AppAlert
      v-if="totalEmployeeCount === 0"
      variant="info"
      class="mb-0"
      message="No crew members are assigned to this job yet."
    />

    <AppAlert
      v-else-if="employees.length === 0"
      variant="secondary"
      class="mb-0"
      message="No crew members match the current search."
    />

    <BaseTable
      v-else
      :rows="tableEmployees"
      :columns="rosterColumns"
      row-key="id"
      table-class="admin-job-roster-table admin-job-roster-card__table"
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
        <div v-if="asEmployee(row).contractor" class="d-flex flex-column">
          <span>{{ asEmployee(row).occupation || '--' }}</span>
          <small class="text-muted">{{ asEmployee(row).contractor?.category || asEmployee(row).contractor?.name }}</small>
        </div>
        <span v-else>{{ asEmployee(row).occupation || '--' }}</span>
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
