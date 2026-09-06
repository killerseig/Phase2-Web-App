<script setup lang="ts">
import { computed, ref } from 'vue'
import TimecardExportCustomCardPanel from '@/components/timecards/TimecardExportCustomCardPanel.vue'
import TimecardExportEmployeePanel from '@/components/timecards/TimecardExportEmployeePanel.vue'
import TimecardExportTargetPanel from '@/components/timecards/TimecardExportTargetPanel.vue'
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
const createMode = ref<'employee' | 'one-off'>('employee')

</script>

<template>
  <section class="timecards-create">
    <div v-if="message" class="timecards-empty timecards-create__notice">
      {{ message }}
    </div>

    <template v-else>
      <TimecardExportTargetPanel
        :job-id="jobId"
        :job-options="jobOptions"
        :foreman-id="foremanId"
        :foreman-options="foremanOptions"
        :target-week-exists="targetWeekExists"
        @update-job-id="emit('updateJobId', $event)"
        @update-foreman-id="emit('updateForemanId', $event)"
      />

      <TimecardExportEmployeePanel
        v-if="createMode === 'employee'"
        :search="employeeSearch"
        :employees="employees"
        :loading="employeesLoading"
        :search-disabled="actionLoading || !canEditWeek"
        :employee-disabled="createDisabled"
        @update-search="emit('updateEmployeeSearch', $event)"
        @add-employee="emit('addEmployee', $event)"
        @create-one-off-card="createMode = 'one-off'"
      />

      <TimecardExportCustomCardPanel
        v-else
        :first-name="customFirstName"
        :last-name="customLastName"
        :employee-number="customEmployeeNumber"
        :occupation="customOccupation"
        :wage-rate="customWageRate"
        :is-contractor="customIsContractor"
        :disabled="actionLoading || !canEditWeek"
        :add-disabled="createDisabled"
        @update-first-name="emit('updateCustomFirstName', $event)"
        @update-last-name="emit('updateCustomLastName', $event)"
        @update-employee-number="emit('updateCustomEmployeeNumber', $event)"
        @update-occupation="emit('updateCustomOccupation', $event)"
        @update-wage-rate="emit('updateCustomWageRate', $event)"
        @update-is-contractor="emit('updateCustomIsContractor', $event)"
        @add-custom-card="emit('addCustomCard')"
        @back-to-employee-search="createMode = 'employee'"
      />
    </template>
  </section>
</template>

<style src="./timecard-create-tray.css" scoped></style>

<style scoped>
.timecards-create {
  --timecards-create-panel-gap: 0.65rem;
  --timecards-create-panel-padding: 0.75rem;
  --timecards-create-panel-bg: rgba(255, 255, 255, 0.18);
}
</style>
