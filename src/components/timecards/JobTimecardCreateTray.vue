<script setup lang="ts">
import JobTimecardCustomCardPanel from '@/components/timecards/JobTimecardCustomCardPanel.vue'
import JobTimecardEmployeePanel from '@/components/timecards/JobTimecardEmployeePanel.vue'
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
    <JobTimecardEmployeePanel
      :search="employeeSearch"
      :employees="employees"
      :loading="employeesLoading"
      :disabled="actionLoading || !canEditWeek"
      @update-search="emit('updateEmployeeSearch', $event)"
      @add-employee="emit('addEmployee', $event)"
    />

    <JobTimecardCustomCardPanel
      :first-name="customFirstName"
      :last-name="customLastName"
      :employee-number="customEmployeeNumber"
      :occupation="customOccupation"
      :wage-rate="customWageRate"
      :is-contractor="customIsContractor"
      :disabled="actionLoading || !canEditWeek"
      @update-first-name="emit('updateCustomFirstName', $event)"
      @update-last-name="emit('updateCustomLastName', $event)"
      @update-employee-number="emit('updateCustomEmployeeNumber', $event)"
      @update-occupation="emit('updateCustomOccupation', $event)"
      @update-wage-rate="emit('updateCustomWageRate', $event)"
      @update-is-contractor="emit('updateCustomIsContractor', $event)"
      @add-custom-card="emit('addCustomCard')"
    />
  </section>
</template>

<style src="./timecard-create-tray.css" scoped></style>
