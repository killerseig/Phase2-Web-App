<script setup lang="ts">
import AppSearchInput from '@/components/common/AppSearchInput.vue'
import AppCheckbox from '@/components/common/AppCheckbox.vue'
import AppTextInput from '@/components/common/AppTextInput.vue'
import TimecardButton from '@/components/timecards/TimecardButton.vue'
import type { EmployeeRecord } from '@/types/domain'

defineProps<{
  employeeSearch: string
  employees: EmployeeRecord[]
  employeesLoading: boolean
  actionLoading: boolean
  canEditWeek: boolean
  customFirstName: string
  customLastName: string
  customEmployeeNumber: string
  customOccupation: string
  customWageRate: string
  customIsContractor: boolean
}>()

const emit = defineEmits<{
  updateEmployeeSearch: [value: string]
  updateCustomFirstName: [value: string]
  updateCustomLastName: [value: string]
  updateCustomEmployeeNumber: [value: string]
  updateCustomOccupation: [value: string]
  updateCustomWageRate: [value: string]
  updateCustomIsContractor: [value: boolean]
  addEmployee: [employee: EmployeeRecord]
  addCustomCard: []
}>()

</script>

<template>
  <section class="timecards-create">
    <div class="timecards-create__panel timecards-create__panel--directory">
      <div class="timecards-create__header">
        <span class="timecards-create__eyebrow">Employee Directory</span>
        <h2>Create From Employee</h2>
      </div>

      <label class="timecards-toolbar__search timecards-create__search-field">
        <span>Employee Search</span>
        <AppSearchInput
          :model-value="employeeSearch"
          class="timecards-create__search"
          placeholder="Search employees"
          :disabled="actionLoading || !canEditWeek"
          @update:model-value="emit('updateEmployeeSearch', $event)"
        />
      </label>

      <div class="timecards-create__list">
        <button
          v-for="employee in employees"
          :key="employee.id"
          class="timecards-create__employee"
          type="button"
          :data-testid="`timecards-add-employee-${employee.id}`"
          :disabled="actionLoading || !canEditWeek"
          @click="emit('addEmployee', employee)"
        >
          <div class="timecards-create__employee-identity">
            <strong class="timecards-create__employee-name">{{ employee.firstName }} {{ employee.lastName }}</strong>
            <span class="timecards-create__employee-number">#{{ employee.employeeNumber }}</span>
          </div>
          <span>{{ employee.occupation }}</span>
        </button>

        <div v-if="employeesLoading" class="timecards-empty">
          Loading employees...
        </div>
        <div v-else-if="!employees.length" class="timecards-empty">
          No employees available to add.
        </div>
      </div>
    </div>

    <div class="timecards-create__panel timecards-create__panel--custom">
      <div class="timecards-create__header">
        <span class="timecards-create__eyebrow">Custom Card</span>
        <h2>Create One-Off Card</h2>
      </div>

      <div class="timecards-create__grid">
        <label class="timecards-toolbar__search">
          <span>First Name</span>
          <AppTextInput
            :model-value="customFirstName"
            class="timecards-create__field"
            type="text"
            :disabled="actionLoading || !canEditWeek"
            @update:model-value="emit('updateCustomFirstName', $event)"
          />
        </label>
        <label class="timecards-toolbar__search">
          <span>Last Name</span>
          <AppTextInput
            :model-value="customLastName"
            class="timecards-create__field"
            type="text"
            :disabled="actionLoading || !canEditWeek"
            @update:model-value="emit('updateCustomLastName', $event)"
          />
        </label>
        <label class="timecards-toolbar__search">
          <span>Employee #</span>
          <AppTextInput
            :model-value="customEmployeeNumber"
            class="timecards-create__field"
            type="text"
            :disabled="actionLoading || !canEditWeek"
            @update:model-value="emit('updateCustomEmployeeNumber', $event)"
          />
        </label>
        <label class="timecards-toolbar__search">
          <span>Occupation</span>
          <AppTextInput
            :model-value="customOccupation"
            class="timecards-create__field"
            type="text"
            :disabled="actionLoading || !canEditWeek"
            @update:model-value="emit('updateCustomOccupation', $event)"
          />
        </label>
        <label class="timecards-toolbar__search">
          <span>Wage</span>
          <AppTextInput
            :model-value="customWageRate"
            class="timecards-create__field"
            type="number"
            min="0"
            step="0.01"
            inputmode="decimal"
            :disabled="actionLoading || !canEditWeek"
            @update:model-value="emit('updateCustomWageRate', $event)"
          />
        </label>
        <div class="timecards-toolbar__search">
          <span>Type</span>
          <label class="timecards-create__checkbox">
            <AppCheckbox
              :model-value="customIsContractor"
              :disabled="actionLoading || !canEditWeek"
              @update:model-value="emit('updateCustomIsContractor', $event)"
            />
            <span>Contractor</span>
          </label>
        </div>
      </div>

      <TimecardButton
        variant="primary"
        :disabled="actionLoading || !canEditWeek"
        @click="emit('addCustomCard')"
      >
        Add Custom Card
      </TimecardButton>
    </div>
  </section>
</template>

<style scoped>
.timecards-create {
  --app-text-input-min-height: var(--timecards-toolbar-control-height);
  --app-text-input-padding-x: 0.75rem;
  --app-text-input-border: var(--timecards-toolbar-control-border);
  --app-text-input-radius: var(--timecards-toolbar-control-radius);
  --app-text-input-background: var(--timecards-toolbar-control-bg);
  --app-text-input-color: var(--timecards-toolbar-control-text);
  --app-text-input-color-scheme: light;
  --app-text-input-font: inherit;
  --app-text-input-box-shadow: none;
  --app-text-input-placeholder-color: rgba(70, 77, 48, 0.72);
  --app-text-input-focus-border: var(--timecards-toolbar-control-border-strong);
  --app-text-input-focus-background: rgba(248, 250, 240, 0.98);
  --app-text-input-focus-box-shadow: var(--timecards-toolbar-focus-ring);
  --app-search-input-min-height: var(--timecards-toolbar-control-height);
  --app-search-input-padding-x: 0.75rem;
  --app-search-input-border: var(--timecards-toolbar-control-border);
  --app-search-input-radius: var(--timecards-toolbar-control-radius);
  --app-search-input-background: var(--timecards-toolbar-control-bg);
  --app-search-input-color: var(--timecards-toolbar-control-text);
  --app-search-input-color-scheme: light;
  --app-search-input-font: inherit;
  --app-search-input-placeholder-color: rgba(70, 77, 48, 0.72);
  --app-search-input-focus-border: var(--timecards-toolbar-control-border-strong);
  --app-search-input-focus-outline: none;
  --app-search-input-focus-background: rgba(248, 250, 240, 0.98);
  --app-search-input-focus-box-shadow: var(--timecards-toolbar-focus-ring);
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(20rem, 0.95fr);
  gap: 0.9rem;
  padding: 0.85rem;
  border: 1px solid rgba(88, 105, 44, 0.42);
  background: rgba(247, 249, 239, 0.95);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55);
}

.timecards-create__panel {
  display: grid;
  gap: 0.7rem;
  padding: 0.8rem;
  border: 1px solid rgba(71, 82, 41, 0.24);
  background: rgba(255, 255, 255, 0.32);
}

.timecards-create__header {
  display: grid;
  gap: 0.1rem;
}

.timecards-create__eyebrow {
  color: rgba(64, 85, 36, 0.82);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.timecards-create__header h2 {
  margin: 0;
  font-size: 1rem;
}

.timecards-toolbar__search {
  display: grid;
  gap: var(--timecards-toolbar-label-gap);
  font-weight: 600;
  min-width: 0;
}

.timecards-toolbar__search > span {
  display: flex;
  align-items: end;
  min-height: var(--timecards-toolbar-label-height);
}

.timecards-create__search-field {
  align-self: start;
}

.timecards-create__list {
  display: grid;
  gap: 0.35rem;
  max-height: 14rem;
  overflow: auto;
  padding-right: 0.2rem;
}

.timecards-create__employee {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: 0.6rem;
  align-items: center;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--timecards-toolbar-control-border);
  border-radius: var(--timecards-toolbar-control-radius);
  background: var(--timecards-toolbar-control-bg);
  text-align: left;
}

.timecards-create__employee:disabled {
  opacity: 0.58;
  cursor: not-allowed;
}

.timecards-create__employee-identity {
  display: grid;
  gap: 0.08rem;
  min-width: 0;
}

.timecards-create__employee-name {
  font-size: 0.92rem;
  color: #1b2114;
}

.timecards-create__employee-number {
  color: rgba(38, 43, 23, 0.68);
  font-size: 0.82rem;
  white-space: nowrap;
}

.timecards-create__employee span {
  color: rgba(38, 43, 23, 0.76);
  font-size: 0.88rem;
}

.timecards-create__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
}

.timecards-create__checkbox {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: var(--timecards-toolbar-control-height);
  padding: 0 0.75rem;
  border: 1px solid var(--timecards-toolbar-control-border);
  border-radius: var(--timecards-toolbar-control-radius);
  background: var(--timecards-toolbar-control-bg);
  color: var(--timecards-toolbar-control-text);
}

.timecards-create__checkbox input {
  accent-color: #3d7a43;
}

.timecards-create__panel--custom :deep(.timecards-button) {
  margin-top: 0.15rem;
}

.timecards-empty {
  padding: 1rem;
  border: 1px dashed rgba(88, 105, 44, 0.38);
  background: rgba(239, 244, 226, 0.74);
  color: rgba(38, 43, 23, 0.82);
  text-align: center;
}

@media (max-width: 960px) {
  .timecards-create {
    grid-template-columns: 1fr;
  }

  .timecards-create__employee {
    grid-template-columns: 1fr;
    gap: 0.2rem;
  }

  .timecards-toolbar__search {
    gap: 0.4rem;
  }

  .timecards-create__grid {
    grid-template-columns: 1fr;
  }
}
</style>
