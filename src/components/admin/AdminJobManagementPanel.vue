<script setup lang="ts">
import AppAlert from '@/components/common/AppAlert.vue'
import AdminCardWrapper from '@/components/admin/AdminCardWrapper.vue'
import AdminJobForemenCard from '@/components/admin/AdminJobForemenCard.vue'
import AdminJobRosterCard from '@/components/admin/AdminJobRosterCard.vue'
import type {
  EmployeeDirectoryOption,
  JobAssignedForemanItem,
  JobForemanOption,
  JobRosterFormInput,
} from '@/types/adminJobTeam'
import type { EmployeeDirectoryEmployee, Job, JobRosterEmployee } from '@/types/models'

defineProps<{
  job: Job | null
  assignedForemen: JobAssignedForemanItem[]
  availableForemanOptions: JobForemanOption[]
  selectedForemanId: string
  assigningForemanId: string
  removingForemanId: string
  settingDisplayForemanId: string
  rosterEmployees: JobRosterEmployee[]
  totalRosterEmployees: number
  rosterSearchTerm: string
  availableEmployeeOptions: EmployeeDirectoryOption[]
  employeeDirectoryLoading: boolean
  employeeDirectoryError: string
  rosterForm: JobRosterFormInput
  selectedEmployee: EmployeeDirectoryEmployee | null
  savingRosterEmployee: boolean
  togglingRosterEmployeeId: string
  removingRosterEmployeeId: string
}>()

const emit = defineEmits<{
  'update:selectedForemanId': [value: string]
  'update:rosterSearchTerm': [value: string]
  'update:selectedEmployeeId': [value: string]
  'update:rosterForm': [value: JobRosterFormInput]
  'assign-foreman': []
  'remove-foreman': [foremanId: string]
  'set-display-foreman': [foremanId: string]
  'add-roster-employee': []
  'toggle-roster-employee': [employeeId: string]
  'remove-roster-employee': [employeeId: string]
}>()
</script>

<template>
  <AdminCardWrapper
    title="Job Team Management"
    icon="people"
    :subtitle="job ? `${job.name}${job.code ? ` | ${job.code}` : ''}` : 'Open a job row above to manage foremen and roster employees.'"
  >
    <AppAlert
      v-if="!job"
      variant="info"
      class="mb-0"
      message="Open a job above with the edit button to manage foremen and roster employees."
    />

    <div v-else class="row g-3">
      <div class="col-12 col-xl-4">
        <AdminJobForemenCard
          :assigned-foremen="assignedForemen"
          :available-foreman-options="availableForemanOptions"
          :selected-foreman-id="selectedForemanId"
          :assigning-foreman-id="assigningForemanId"
          :removing-foreman-id="removingForemanId"
          :setting-display-foreman-id="settingDisplayForemanId"
          :display-foreman="job.foreman || ''"
          @update:selected-foreman-id="emit('update:selectedForemanId', $event)"
          @assign="emit('assign-foreman')"
          @remove="emit('remove-foreman', $event)"
          @set-display="emit('set-display-foreman', $event)"
        />
      </div>

      <div class="col-12 col-xl-8">
        <AdminJobRosterCard
          :employees="rosterEmployees"
          :total-employee-count="totalRosterEmployees"
          :search-term="rosterSearchTerm"
          :available-employee-options="availableEmployeeOptions"
          :employee-directory-loading="employeeDirectoryLoading"
          :employee-directory-error="employeeDirectoryError"
          :form="rosterForm"
          :selected-employee="selectedEmployee"
          :saving-employee="savingRosterEmployee"
          :toggling-employee-id="togglingRosterEmployeeId"
          :removing-employee-id="removingRosterEmployeeId"
          @update:search-term="emit('update:rosterSearchTerm', $event)"
          @update:selected-employee-id="emit('update:selectedEmployeeId', $event)"
          @update:form="emit('update:rosterForm', $event)"
          @submit="emit('add-roster-employee')"
          @toggle-employee="emit('toggle-roster-employee', $event)"
          @remove-employee="emit('remove-roster-employee', $event)"
        />
      </div>
    </div>
  </AdminCardWrapper>
</template>
