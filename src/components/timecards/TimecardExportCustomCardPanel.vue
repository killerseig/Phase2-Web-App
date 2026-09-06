<script setup lang="ts">
import TimecardButton from '@/components/timecards/TimecardButton.vue'
import TimecardCustomCardFields from '@/components/timecards/TimecardCustomCardFields.vue'

defineProps<{
  firstName: string
  lastName: string
  employeeNumber: string
  occupation: string
  wageRate: string
  isContractor: boolean
  disabled: boolean
  addDisabled: boolean
}>()

const emit = defineEmits<{
  updateFirstName: [value: string]
  updateLastName: [value: string]
  updateEmployeeNumber: [value: string]
  updateOccupation: [value: string]
  updateWageRate: [value: string]
  updateIsContractor: [value: boolean]
  addCustomCard: []
  backToEmployeeSearch: []
}>()
</script>

<template>
  <fieldset class="timecards-toolbar__group timecards-create__panel timecards-create__panel--custom">
    <legend class="timecards-toolbar__legend">One-Off Card</legend>
    <h2 class="timecards-create__title">Create a One-Off Card</h2>

    <p class="timecards-create__guidance">
      Use a one-off card only when the worker is not available in the employee list. Search for the employee first to avoid duplicate or incorrect cards.
    </p>

    <TimecardCustomCardFields
      :first-name="firstName"
      :last-name="lastName"
      :employee-number="employeeNumber"
      :occupation="occupation"
      :wage-rate="wageRate"
      :is-contractor="isContractor"
      :disabled="disabled"
      @update-first-name="emit('updateFirstName', $event)"
      @update-last-name="emit('updateLastName', $event)"
      @update-employee-number="emit('updateEmployeeNumber', $event)"
      @update-occupation="emit('updateOccupation', $event)"
      @update-wage-rate="emit('updateWageRate', $event)"
      @update-is-contractor="emit('updateIsContractor', $event)"
    />

    <div class="timecards-create__actions">
      <TimecardButton
        data-testid="timecards-back-to-employee-search"
        :disabled="disabled"
        @click="emit('backToEmployeeSearch')"
      >
        Back to Employee Search
      </TimecardButton>
      <TimecardButton
        data-testid="timecards-add-one-off-card"
        variant="primary"
        :disabled="addDisabled"
        @click="emit('addCustomCard')"
      >
        Add One-Off Card
      </TimecardButton>
    </div>
  </fieldset>
</template>

<style src="./timecard-create-tray.css" scoped></style>
