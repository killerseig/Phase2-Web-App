<script setup lang="ts">
import TimecardEmployeePicker from '@/components/timecards/TimecardEmployeePicker.vue'
import type { EmployeeRecord } from '@/types/domain'

defineProps<{
  search: string
  employees: EmployeeRecord[]
  loading: boolean
  disabled: boolean
}>()

const emit = defineEmits<{
  updateSearch: [value: string]
  addEmployee: [employee: EmployeeRecord]
}>()
</script>

<template>
  <div class="timecards-create__panel timecards-create__panel--directory">
    <div class="timecards-create__header">
      <span class="timecards-create__eyebrow">Employee Directory</span>
      <h2>Create From Employee</h2>
    </div>

    <TimecardEmployeePicker
      :search="search"
      :employees="employees"
      :loading="loading"
      :search-disabled="disabled"
      :employee-disabled="disabled"
      test-id-prefix="timecards-add-employee-"
      @update-search="emit('updateSearch', $event)"
      @add-employee="emit('addEmployee', $event)"
    />
  </div>
</template>

<style src="./timecard-create-tray.css" scoped></style>
