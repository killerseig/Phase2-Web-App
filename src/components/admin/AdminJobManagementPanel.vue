<script setup lang="ts">
import { computed } from 'vue'
import AppAlert from '@/components/common/AppAlert.vue'
import AdminCardWrapper from '@/components/admin/AdminCardWrapper.vue'
import AdminJobRosterCard from '@/components/admin/AdminJobRosterCard.vue'
import SearchSelectField from '@/components/common/SearchSelectField.vue'
import type {
  EmployeeDirectoryOption,
  JobAssignedForemanItem,
  JobForemanOption,
  JobRosterFormInput,
} from '@/types/adminJobTeam'
import type { EmployeeDirectoryEmployee, Job, JobRosterEmployee } from '@/types/models'

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

const props = defineProps<{
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
  embedded?: boolean
}>()

const foremanOptions = computed(() => (
  props.assignedForemen
    .filter((foreman) => !foreman.missing)
    .map((foreman) => ({
      id: foreman.id,
      label: foreman.label,
    }))
))

const currentForemanId = computed(() => (
  props.assignedForemen.find((foreman) => foreman.isDisplayForeman)?.id
  ?? ''
))

const canSetForeman = computed(() => (
  Boolean(
    props.selectedForemanId
    && props.selectedForemanId !== currentForemanId.value
    && !props.settingDisplayForemanId,
  )
))
</script>

<template>
  <component
    :is="embedded ? 'div' : AdminCardWrapper"
    v-bind="embedded
        ? {}
        : {
          title: 'Job Crew',
          icon: 'people',
          subtitle: job ? `${job.name}${job.code ? ` | ${job.code}` : ''}` : 'Select a job to manage its crew.',
        }"
    class="admin-job-management-panel"
    :class="{ 'admin-job-management-panel--embedded': embedded }"
  >
    <AppAlert
      v-if="!job"
      variant="info"
      class="mb-0"
      message="Select a job from the browser to manage its crew."
    />

    <div v-else class="admin-job-management-panel__grid">
      <div v-if="foremanOptions.length" class="admin-job-management-panel__context">
        <div class="admin-job-management-panel__context-controls">
          <div class="admin-job-management-panel__foreman-field">
            <SearchSelectField
              :model-value="selectedForemanId"
              :options="foremanOptions"
              label="Foreman"
              placeholder="Search assigned foremen"
              prepend-icon="bi bi-search"
              clear-label="Clear selection"
              @update:model-value="emit('update:selectedForemanId', $event)"
            />
          </div>

          <button
            type="button"
            class="btn btn-sm btn-outline-primary"
            :disabled="!canSetForeman"
            @click="selectedForemanId && emit('set-display-foreman', selectedForemanId)"
          >
            <span
              v-if="settingDisplayForemanId === selectedForemanId"
              class="spinner-border spinner-border-sm me-2"
              aria-hidden="true"
            ></span>
            Update Foreman
          </button>
        </div>
      </div>

      <AppAlert
        v-if="!foremanOptions.length"
        variant="secondary"
        class="mb-0"
        message="No foremen are assigned to this job yet. Assign a foreman from the Users workspace first."
      />

      <div class="admin-job-management-panel__roster">
        <AdminJobRosterCard
          :embedded="embedded"
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
  </component>
</template>
