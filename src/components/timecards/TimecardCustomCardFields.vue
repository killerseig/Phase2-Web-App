<script setup lang="ts">
import AppCheckbox from '@/components/common/AppCheckbox.vue'
import AppTextInput from '@/components/common/AppTextInput.vue'

defineProps<{
  firstName: string
  lastName: string
  employeeNumber: string
  occupation: string
  wageRate: string
  isContractor: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  updateFirstName: [value: string]
  updateLastName: [value: string]
  updateEmployeeNumber: [value: string]
  updateOccupation: [value: string]
  updateWageRate: [value: string]
  updateIsContractor: [value: boolean]
}>()
</script>

<template>
  <div class="timecard-custom-card-fields">
    <label class="timecards-toolbar__search">
      <span>First Name</span>
      <AppTextInput
        :model-value="firstName"
        class="timecard-custom-card-fields__field"
        type="text"
        :disabled="disabled"
        @update:model-value="emit('updateFirstName', $event)"
      />
    </label>
    <label class="timecards-toolbar__search">
      <span>Last Name</span>
      <AppTextInput
        :model-value="lastName"
        class="timecard-custom-card-fields__field"
        type="text"
        :disabled="disabled"
        @update:model-value="emit('updateLastName', $event)"
      />
    </label>
    <label class="timecards-toolbar__search">
      <span>Employee #</span>
      <AppTextInput
        :model-value="employeeNumber"
        class="timecard-custom-card-fields__field"
        type="text"
        :disabled="disabled"
        @update:model-value="emit('updateEmployeeNumber', $event)"
      />
    </label>
    <label class="timecards-toolbar__search">
      <span>Occupation</span>
      <AppTextInput
        :model-value="occupation"
        class="timecard-custom-card-fields__field"
        type="text"
        :disabled="disabled"
        @update:model-value="emit('updateOccupation', $event)"
      />
    </label>
    <label class="timecards-toolbar__search">
      <span>Wage</span>
      <AppTextInput
        :model-value="wageRate"
        class="timecard-custom-card-fields__field"
        type="number"
        min="0"
        step="0.01"
        inputmode="decimal"
        :disabled="disabled"
        @update:model-value="emit('updateWageRate', $event)"
      />
    </label>
    <div class="timecards-toolbar__search">
      <span>Type</span>
      <label class="timecard-custom-card-fields__checkbox">
        <AppCheckbox
          :model-value="isContractor"
          :disabled="disabled"
          @update:model-value="emit('updateIsContractor', $event)"
        />
        <span>Contractor</span>
      </label>
    </div>
  </div>
</template>

<style src="./timecard-toolbar-content.css" scoped></style>

<style scoped>
.timecard-custom-card-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--timecards-custom-card-grid-gap, 0.65rem 0.75rem);
}

.timecard-custom-card-fields__checkbox {
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

.timecard-custom-card-fields__checkbox:hover {
  border-color: var(--timecards-toolbar-control-border-strong);
  background: rgba(248, 250, 240, 0.98);
}

.timecard-custom-card-fields__checkbox:has(input:focus-visible) {
  border-color: var(--timecards-toolbar-control-border-strong);
  box-shadow: var(--timecards-toolbar-focus-ring);
}

.timecard-custom-card-fields__checkbox input {
  accent-color: #3d7a43;
}

.timecard-custom-card-fields__field:disabled,
.timecard-custom-card-fields__checkbox:has(input:disabled) {
  border-color: rgba(196, 204, 176, 0.92);
  background: rgba(242, 245, 233, 0.94);
  color: rgba(95, 104, 74, 0.82);
  box-shadow: none;
}

.timecard-custom-card-fields__field:disabled {
  cursor: not-allowed;
  -webkit-text-fill-color: rgba(95, 104, 74, 0.82);
  opacity: 1;
}

@media (max-width: 960px) {
  .timecard-custom-card-fields {
    grid-template-columns: 1fr;
  }
}
</style>
