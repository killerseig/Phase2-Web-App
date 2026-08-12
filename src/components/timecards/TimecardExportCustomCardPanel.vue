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
}>()
</script>

<template>
  <fieldset class="timecards-toolbar__group timecards-create__panel timecards-create__panel--custom">
    <legend class="timecards-toolbar__legend">Custom Card</legend>
    <h2 class="timecards-create__title">Create One-Off Card</h2>

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

    <TimecardButton
      variant="primary"
      :disabled="addDisabled"
      @click="emit('addCustomCard')"
    >
      Add Custom Card
    </TimecardButton>
  </fieldset>
</template>

<style src="./timecard-create-tray.css" scoped></style>
