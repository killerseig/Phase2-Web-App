<script setup lang="ts">
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import AppBadge from '@/components/common/AppBadge.vue'
import AppButton from '@/components/common/AppButton.vue'
import AppListButton from '@/components/common/AppListButton.vue'
import AppPaneHeader from '@/components/common/AppPaneHeader.vue'
import AppSearchInput from '@/components/common/AppSearchInput.vue'
import AppSelect from '@/components/common/AppSelect.vue'
import {
  getEmployeeCode,
  getEmployeeDisplayName,
  getEmployeeOccupation,
  getEmployeeTypeLabel,
} from '@/features/employees/employeeViewHelpers'
import type { EmployeeRecord } from '@/types/domain'
import type { DirectoryStatusFilter } from '@/utils/directoryFilters'

defineProps<{
  employees: readonly EmployeeRecord[]
  employeesLoading: boolean
  selectedEmployeeId: string | null
  isCreateMode: boolean
  searchTerm: string
  statusFilter: DirectoryStatusFilter
}>()

const emit = defineEmits<{
  createEmployee: []
  selectEmployee: [employeeId: string]
  'update:searchTerm': [value: string]
  'update:statusFilter': [value: DirectoryStatusFilter]
}>()

function handleStatusFilterUpdate(value: string) {
  emit('update:statusFilter', value as DirectoryStatusFilter)
}
</script>

<template>
  <section class="employees-browser">
    <AppPaneHeader eyebrow="Admin" title="Employees">
      <template #actions>
        <AppButton variant="primary" @click="emit('createEmployee')">
          New Employee
        </AppButton>
      </template>
    </AppPaneHeader>

    <div class="employees-browser__body">
      <div class="employees-browser__search">
        <AppSearchInput
          :model-value="searchTerm"
          data-testid="employees-search"
          placeholder="Search employees"
          @update:model-value="emit('update:searchTerm', $event)"
        />
      </div>

      <label class="employees-browser__filter">
        <span>Status</span>
        <AppSelect
          :model-value="statusFilter"
          data-testid="employees-status-filter"
          @update:model-value="handleStatusFilterUpdate"
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="both">Both</option>
        </AppSelect>
      </label>

      <div class="employees-browser__list">
        <AppListButton
          class="employees-browser__row"
          :active="isCreateMode"
          @click="emit('createEmployee')"
        >
          <div class="employees-browser__row-main">
            <strong>Create Employee</strong>
            <span>Add a record to the global employee directory.</span>
          </div>
        </AppListButton>

        <AppEmptyState v-if="employeesLoading" class="employees-browser__empty" message="Loading employees..." />

        <AppListButton
          v-for="employee in employees"
          v-else
          :key="employee.id"
          class="employees-browser__row"
          :active="selectedEmployeeId === employee.id"
          :data-testid="`employee-row-${employee.id}`"
          @click="emit('selectEmployee', employee.id)"
        >
          <div class="employees-browser__row-main">
            <strong>{{ getEmployeeDisplayName(employee) }}</strong>
            <span>{{ getEmployeeOccupation(employee) }}</span>
            <span class="employees-browser__secondary">Employee #{{ getEmployeeCode(employee) }}</span>
          </div>
          <div class="employees-browser__row-meta">
            <AppBadge tone="accent">{{ getEmployeeTypeLabel(employee) }}</AppBadge>
            <AppBadge :tone="employee.active ? 'success' : 'danger'">
              {{ employee.active ? 'Active' : 'Inactive' }}
            </AppBadge>
          </div>
        </AppListButton>

        <AppEmptyState
          v-if="!employeesLoading && employees.length === 0"
          class="employees-browser__empty"
          message="No employees match your search."
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.employees-browser__body {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: 1rem;
  min-height: 0;
}

.employees-browser__filter {
  display: grid;
  gap: 0.45rem;
  color: var(--text-muted);
  font-size: 0.74rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.employees-browser__filter .app-select {
  --app-select-border: var(--border);
  --app-select-min-height: 2.8rem;
  --app-select-padding-x: 0.9rem;
  --app-select-radius: 12px;
  --app-select-background: rgba(255, 255, 255, 0.045);
  text-transform: none;
  letter-spacing: normal;
}

.employees-browser__list {
  display: grid;
  gap: 0.55rem;
  align-content: start;
  min-height: 0;
  overflow: auto;
  padding-right: 0.15rem;
}

.employees-browser__row-main {
  display: grid;
  gap: 0.2rem;
}

.employees-browser__row-main span,
.employees-browser__empty,
.employees-browser__secondary {
  color: var(--text-muted);
}

.employees-browser__secondary {
  font-size: 0.82rem;
}

.employees-browser__row-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

@media (max-width: 900px) {
  .employees-browser__body,
  .employees-browser__list {
    height: auto;
    min-height: 0;
    overflow: visible;
    padding-right: 0;
  }

  :deep(.app-pane-header__actions) .app-button {
    width: auto;
  }
}
</style>
