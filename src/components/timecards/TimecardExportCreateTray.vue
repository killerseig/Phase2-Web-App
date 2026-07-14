<script setup lang="ts">
import { computed } from 'vue'
import Select from 'primevue/select'
import AppCheckbox from '@/components/common/AppCheckbox.vue'
import AppSearchInput from '@/components/common/AppSearchInput.vue'
import AppTextInput from '@/components/common/AppTextInput.vue'
import TimecardButton from '@/components/timecards/TimecardButton.vue'
import type { EmployeeRecord } from '@/types/domain'

interface JobOption {
  id: string
  label: string
}

interface ForemanOption {
  id: string
  label: string
}

const props = defineProps<{
  message: string
  jobId: string
  jobOptions: JobOption[]
  foremanId: string
  foremanOptions: ForemanOption[]
  targetWeekExists: boolean
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
  updateJobId: [value: string]
  updateForemanId: [value: string]
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

const targetReady = computed(() => (
  Boolean(props.jobId) && (props.targetWeekExists || Boolean(props.foremanId))
))

const createDisabled = computed(() => (
  props.actionLoading || !props.canEditWeek || !targetReady.value
))

const showForemanWarning = computed(() => (
  Boolean(props.jobId) && !props.targetWeekExists && !props.foremanOptions.length
))

</script>

<template>
  <section class="timecards-create">
    <div v-if="message" class="timecards-empty timecards-create__notice">
      {{ message }}
    </div>

    <template v-else>
      <fieldset class="timecards-toolbar__group timecards-create__panel timecards-create__panel--job">
        <legend class="timecards-toolbar__legend">Week Target</legend>
        <h2 class="timecards-create__title">Pick The Job And Foreman</h2>

        <div class="timecards-create__target-grid">
          <label class="timecards-toolbar__search timecards-create__target-field">
            <span>Linked Job</span>
            <Select
              :model-value="jobId"
              class="timecards-toolbar__select timecards-create__control"
              :options="jobOptions"
              option-label="label"
              option-value="id"
              overlay-class="timecards-toolbar__select-overlay"
              placeholder="Select linked job"
              :unstyled="false"
              fluid
              @update:model-value="emit('updateJobId', String($event ?? ''))"
            />
          </label>

          <label class="timecards-toolbar__search timecards-create__target-field">
            <span>Foreman Owner</span>
            <Select
              :model-value="foremanId"
              class="timecards-toolbar__select timecards-create__control"
              :options="foremanOptions"
              option-label="label"
              option-value="id"
              overlay-class="timecards-toolbar__select-overlay"
              placeholder="Select foreman"
              :disabled="!jobId || !foremanOptions.length"
              :unstyled="false"
              fluid
              @update:model-value="emit('updateForemanId', String($event ?? ''))"
            />
          </label>
        </div>

        <p v-if="showForemanWarning" class="timecards-create__warning">
          No foremen are assigned to this job. Assign a foreman before creating a card for it.
        </p>

        <p class="timecards-create__hint">
          New export cards use this job and foreman target. If the saved week does not exist yet, export will open it under that foreman first.
        </p>
      </fieldset>

      <fieldset class="timecards-toolbar__group timecards-create__panel timecards-create__panel--directory">
        <legend class="timecards-toolbar__legend">Employee Directory</legend>
        <h2 class="timecards-create__title">Create From Employee</h2>

        <label class="timecards-toolbar__search timecards-create__search-field">
          <span>Employee Search</span>
          <AppSearchInput
            :model-value="employeeSearch"
            class="timecards-create__search timecards-create__field"
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
            :disabled="createDisabled"
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
      </fieldset>

      <fieldset class="timecards-toolbar__group timecards-create__panel timecards-create__panel--custom">
        <legend class="timecards-toolbar__legend">Custom Card</legend>
        <h2 class="timecards-create__title">Create One-Off Card</h2>

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
          :disabled="createDisabled"
          @click="emit('addCustomCard')"
        >
          Add Custom Card
        </TimecardButton>
      </fieldset>
    </template>
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

.timecards-toolbar__group {
  display: grid;
  gap: var(--timecards-toolbar-group-gap);
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.timecards-toolbar__legend {
  padding: 0;
  color: rgba(64, 85, 36, 0.82);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
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

.timecards-toolbar__select {
  display: flex;
  align-items: stretch;
  width: 100%;
  min-width: 0;
  min-height: var(--timecards-toolbar-control-height);
  border: 1px solid var(--timecards-toolbar-control-border);
  border-radius: var(--timecards-toolbar-control-radius);
  background: var(--timecards-toolbar-control-bg);
  color: var(--timecards-toolbar-control-text);
  box-shadow: none;
  overflow: hidden;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    box-shadow 0.18s ease;
}

.timecards-toolbar__select:hover {
  border-color: var(--timecards-toolbar-control-border-strong);
  background: rgba(248, 250, 240, 0.98);
}

.timecards-toolbar__select.p-focus {
  border-color: var(--timecards-toolbar-control-border-strong);
  box-shadow: var(--timecards-toolbar-focus-ring);
}

.timecards-toolbar__select :deep(.p-select-label) {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  min-height: calc(var(--timecards-toolbar-control-height) - 2px);
  padding: 0 0.75rem;
  font-weight: 500;
  background: transparent;
  color: var(--timecards-toolbar-control-text);
}

.timecards-toolbar__select :deep(.p-select-label.p-placeholder) {
  color: rgba(70, 77, 48, 0.72);
}

.timecards-toolbar__select :deep(.p-select-dropdown) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.3rem;
  background: transparent;
  color: rgba(73, 89, 37, 0.82);
}

:deep(.timecards-toolbar__select-overlay) {
  border: 1px solid rgba(205, 214, 189, 0.96);
  border-radius: 0.45rem;
  background: rgba(255, 255, 251, 0.99);
  box-shadow:
    0 14px 30px rgba(50, 58, 34, 0.12),
    0 3px 8px rgba(50, 58, 34, 0.08);
  overflow: hidden;
}

:deep(.timecards-toolbar__select-overlay .p-select-list-container) {
  padding: 0.3rem;
}

:deep(.timecards-toolbar__select-overlay .p-select-list) {
  display: grid;
  gap: 0.08rem;
  padding: 0;
}

:deep(.timecards-toolbar__select-overlay .p-select-option) {
  min-height: 2.35rem;
  margin: 0;
  padding: 0.55rem 0.7rem;
  border-radius: 0.32rem;
  background: transparent;
  color: rgba(43, 54, 34, 0.94);
  transition:
    background-color 0.16s ease,
    color 0.16s ease,
    box-shadow 0.16s ease;
}

:deep(.timecards-toolbar__select-overlay .p-select-option.p-focus) {
  background: rgba(241, 246, 235, 0.94);
}

:deep(.timecards-toolbar__select-overlay .p-select-option.p-select-option-selected) {
  background: rgba(198, 238, 207, 0.82);
  color: rgba(35, 80, 44, 0.96);
  box-shadow: inset 0 0 0 1px rgba(164, 211, 174, 0.88);
}

:deep(.timecards-toolbar__select-overlay .p-select-option.p-select-option-selected.p-focus) {
  background: rgba(188, 233, 199, 0.92);
}

.timecards-empty {
  padding: 1rem;
  border: 1px dashed rgba(88, 105, 44, 0.38);
  background: rgba(239, 244, 226, 0.74);
  color: rgba(38, 43, 23, 0.82);
  text-align: center;
}

.timecards-create__panel {
  display: grid;
  gap: 0.65rem;
  padding: 0.75rem;
  border: 1px solid rgba(71, 82, 41, 0.24);
  background: rgba(255, 255, 255, 0.18);
}

.timecards-create__panel--job {
  grid-column: 1 / -1;
  align-content: start;
}

.timecards-create__notice {
  grid-column: 1 / -1;
  min-height: auto;
  text-align: left;
}

.timecards-create__title {
  margin: 0;
  font-size: 1rem;
}

.timecards-create__target-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(17rem, 22rem));
  gap: 0.7rem 0.9rem;
  align-items: start;
}

.timecards-create__target-field {
  width: 100%;
  max-width: 22rem;
}

.timecards-create__hint {
  margin: 0;
  max-width: 44rem;
  color: rgba(38, 43, 23, 0.76);
  font-size: 0.84rem;
  line-height: 1.35;
}

.timecards-create__warning {
  margin: -0.1rem 0 0;
  max-width: 34rem;
  color: #8a2828;
  font-size: 0.84rem;
  line-height: 1.35;
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
  border: 1px solid rgba(71, 82, 41, 0.34);
  background: rgba(255, 255, 255, 0.84);
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
  gap: 0.65rem 0.75rem;
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
  font-weight: 600;
  box-shadow: none;
}

.timecards-create__checkbox:hover {
  border-color: var(--timecards-toolbar-control-border-strong);
  background: rgba(248, 250, 240, 0.98);
}

.timecards-create__checkbox:has(input:focus-visible) {
  border-color: var(--timecards-toolbar-control-border-strong);
  box-shadow: var(--timecards-toolbar-focus-ring);
}

.timecards-create__checkbox input {
  accent-color: #3d7a43;
}

.timecards-create__field:disabled,
.timecards-create__control.p-disabled,
.timecards-create__checkbox:has(input:disabled) {
  border-color: rgba(196, 204, 176, 0.92);
  background: rgba(242, 245, 233, 0.94);
  color: rgba(95, 104, 74, 0.82);
  box-shadow: none;
}

.timecards-create__field:disabled {
  cursor: not-allowed;
  -webkit-text-fill-color: rgba(95, 104, 74, 0.82);
  opacity: 1;
}

.timecards-create__search-field {
  max-width: 22rem;
}

.timecards-create__control.p-disabled :deep(.p-select-label),
.timecards-create__control.p-disabled :deep(.p-select-dropdown) {
  background: transparent;
  color: rgba(95, 104, 74, 0.82);
}

.timecards-create__panel--custom :deep(.timecards-button) {
  margin-top: 0.15rem;
}

@media (max-width: 960px) {
  .timecards-create,
  .timecards-create__target-grid,
  .timecards-create__grid {
    grid-template-columns: 1fr;
  }

  .timecards-create__employee {
    grid-template-columns: 1fr;
    gap: 0.2rem;
  }
}
</style>
