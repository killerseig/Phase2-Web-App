<script setup lang="ts">
import TimecardEmployeePicker from '@/components/timecards/TimecardEmployeePicker.vue'
import TimecardOneOffCardAction from '@/components/timecards/TimecardOneOffCardAction.vue'
import type { EmployeeRecord } from '@/types/domain'

defineProps<{
  search: string
  employees: EmployeeRecord[]
  loading: boolean
  searchDisabled: boolean
  employeeDisabled: boolean
}>()

const emit = defineEmits<{
  updateSearch: [value: string]
  addEmployee: [employee: EmployeeRecord]
  createOneOffCard: []
}>()
</script>

<template>
  <fieldset class="timecards-toolbar__group timecards-create__panel timecards-create__panel--directory">
    <legend class="timecards-toolbar__legend">Employee Directory</legend>
    <h2 class="timecards-create__title">Create From Employee</h2>

    <TimecardEmployeePicker
      :search="search"
      :employees="employees"
      :loading="loading"
      :search-disabled="searchDisabled"
      :employee-disabled="employeeDisabled"
      @update-search="emit('updateSearch', $event)"
      @add-employee="emit('addEmployee', $event)"
    />

    <TimecardOneOffCardAction
      :disabled="searchDisabled"
      @select="emit('createOneOffCard')"
    />
  </fieldset>
</template>

<style src="./timecard-create-tray.css" scoped></style>

<style scoped>
.timecards-create__panel--directory {
  --timecard-employee-picker-search-max-width: 22rem;
  --timecard-employee-picker-button-border: 1px solid rgba(71, 82, 41, 0.34);
  --timecard-employee-picker-button-radius: 0;
  --timecard-employee-picker-button-bg: rgba(255, 255, 255, 0.84);
}
</style>
