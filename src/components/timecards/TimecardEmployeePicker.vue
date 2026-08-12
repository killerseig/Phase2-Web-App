<script setup lang="ts">
import AppSearchInput from '@/components/common/AppSearchInput.vue'
import type { EmployeeRecord } from '@/types/domain'

withDefaults(defineProps<{
  search: string
  employees: EmployeeRecord[]
  loading: boolean
  searchDisabled?: boolean
  employeeDisabled?: boolean
  testIdPrefix?: string
  loadingLabel?: string
  emptyLabel?: string
}>(), {
  searchDisabled: false,
  employeeDisabled: false,
  testIdPrefix: '',
  loadingLabel: 'Loading employees...',
  emptyLabel: 'No employees available to add.',
})

const emit = defineEmits<{
  updateSearch: [value: string]
  addEmployee: [employee: EmployeeRecord]
}>()
</script>

<template>
  <div class="timecard-employee-picker">
    <label class="timecard-employee-picker__search-field">
      <span>Employee Search</span>
      <AppSearchInput
        :model-value="search"
        class="timecard-employee-picker__search"
        placeholder="Search employees"
        :disabled="searchDisabled"
        @update:model-value="emit('updateSearch', $event)"
      />
    </label>

    <div class="timecard-employee-picker__list">
      <button
        v-for="employee in employees"
        :key="employee.id"
        class="timecard-employee-picker__employee"
        type="button"
        :data-testid="testIdPrefix ? `${testIdPrefix}${employee.id}` : undefined"
        :disabled="employeeDisabled"
        @click="emit('addEmployee', employee)"
      >
        <div class="timecard-employee-picker__employee-identity">
          <strong class="timecard-employee-picker__employee-name">
            {{ employee.firstName }} {{ employee.lastName }}
          </strong>
          <span class="timecard-employee-picker__employee-number">#{{ employee.employeeNumber }}</span>
        </div>
        <span>{{ employee.occupation }}</span>
      </button>

      <div v-if="loading" class="timecard-employee-picker__empty">
        {{ loadingLabel }}
      </div>
      <div v-else-if="!employees.length" class="timecard-employee-picker__empty">
        {{ emptyLabel }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.timecard-employee-picker {
  display: grid;
  gap: 0.7rem;
}

.timecard-employee-picker__search-field {
  display: grid;
  gap: var(--timecards-toolbar-label-gap);
  align-self: start;
  max-width: var(--timecard-employee-picker-search-max-width, none);
  font-weight: 600;
  min-width: 0;
}

.timecard-employee-picker__search-field > span {
  display: flex;
  align-items: end;
  min-height: var(--timecards-toolbar-label-height);
}

.timecard-employee-picker__list {
  display: grid;
  gap: 0.35rem;
  max-height: 14rem;
  overflow: auto;
  padding-right: 0.2rem;
}

.timecard-employee-picker__employee {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: 0.6rem;
  align-items: center;
  padding: 0.6rem 0.75rem;
  border: var(--timecard-employee-picker-button-border, 1px solid var(--timecards-toolbar-control-border));
  border-radius: var(--timecard-employee-picker-button-radius, var(--timecards-toolbar-control-radius));
  background: var(--timecard-employee-picker-button-bg, var(--timecards-toolbar-control-bg));
  text-align: left;
}

.timecard-employee-picker__employee:disabled {
  opacity: 0.58;
  cursor: not-allowed;
}

.timecard-employee-picker__employee-identity {
  display: grid;
  gap: 0.08rem;
  min-width: 0;
}

.timecard-employee-picker__employee-name {
  font-size: 0.92rem;
  color: #1b2114;
}

.timecard-employee-picker__employee-number {
  color: rgba(38, 43, 23, 0.68);
  font-size: 0.82rem;
  white-space: nowrap;
}

.timecard-employee-picker__employee span {
  color: rgba(38, 43, 23, 0.76);
  font-size: 0.88rem;
}

.timecard-employee-picker__empty {
  padding: 1rem;
  border: 1px dashed rgba(88, 105, 44, 0.38);
  background: rgba(239, 244, 226, 0.74);
  color: rgba(38, 43, 23, 0.82);
  text-align: center;
}

@media (max-width: 960px) {
  .timecard-employee-picker__employee {
    grid-template-columns: 1fr;
    gap: 0.2rem;
  }

  .timecard-employee-picker__search-field {
    gap: 0.4rem;
  }
}
</style>
