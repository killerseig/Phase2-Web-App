<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppAlert from '@/components/common/AppAlert.vue'
import AppSectionCard from '@/components/common/AppSectionCard.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import TimecardWeekStatusBadge from '@/components/common/TimecardWeekStatusBadge.vue'
import AdminJobDetailsCard from '@/components/admin/AdminJobDetailsCard.vue'
import AdminJobManagementPanel from '@/components/admin/AdminJobManagementPanel.vue'
import type { JobFormInput } from '@/types/adminJobs'
import type {
  EmployeeDirectoryOption,
  JobAssignedForemanItem,
  JobForemanOption,
  JobRosterFormInput,
} from '@/types/adminJobTeam'
import type { EmployeeDirectoryEmployee, Job, JobRosterEmployee } from '@/types/models'

type WorkspaceTab = 'details' | 'team'

const props = defineProps<{
  job: Job | null
  form: JobFormInput
  dirty: boolean
  saving: boolean
  togglingJobId: string
  currentWeekEnd: string
  currentWeekLabel: string
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
  'update:form': [value: JobFormInput]
  save: []
  reset: []
  close: []
  delete: [job: Job]
  'toggle-archive': [payload: { job: Job; active: boolean }]
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

const activeTab = ref<WorkspaceTab>('details')

const tabOptions: { value: WorkspaceTab; label: string }[] = [
  { value: 'details', label: 'Details' },
  { value: 'team', label: 'Crew' },
]

const rosterActiveCount = computed(() => props.rosterEmployees.filter((employee) => employee.active).length)
const teamSummary = computed(() => {
  const foremanCount = props.assignedForemen.length
  const totalAssignedCount = props.totalRosterEmployees

  return [
    `${foremanCount} foreman${foremanCount === 1 ? '' : 'en'}`,
    `${rosterActiveCount.value} active roster`,
    `${totalAssignedCount} total assigned`,
  ].join(' • ')
})

const assignmentSummary = computed(() => {
  const totalAssignedCount = props.totalRosterEmployees

  return [
    `${rosterActiveCount.value} active crew`,
    `${totalAssignedCount} total crew`,
  ].join(' | ')
})

const summaryMeta = computed(() => {
  if (!props.job) return []
  return [
    props.job.code || 'No job #',
    props.job.projectManager ? `PM ${props.job.projectManager}` : 'No PM',
    props.job.gc || 'No GC listed',
  ]
})

watch(
  () => props.job?.id,
  () => {
    activeTab.value = 'details'
  }
)
</script>

<template>
  <AppSectionCard
    class="admin-job-workspace"
    body-class="d-flex flex-column gap-2"
    header-class="admin-job-workspace__header-shell"
  >
    <template #header>
      <div v-if="job" class="admin-job-workspace__header">
        <div class="admin-job-workspace__identity">
          <div class="admin-job-workspace__eyebrow">Selected Job</div>
          <div class="admin-job-workspace__title-row">
            <h3 class="mb-0">{{ job.name }}</h3>
            <StatusBadge :status="job.active ? 'active' : 'archived'" />
          </div>
          <div class="admin-job-workspace__meta">
            <span
              v-for="item in summaryMeta"
              :key="item"
              class="admin-job-workspace__meta-item"
            >
              {{ item }}
            </span>
          </div>
        </div>

        <div class="admin-job-workspace__actions">
          <button
            type="button"
            class="btn btn-sm btn-primary"
            :disabled="saving || !dirty"
            @click="emit('save')"
          >
            Save
          </button>
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary"
            :disabled="saving || !dirty"
            @click="emit('reset')"
          >
            Reset
          </button>
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary"
            @click="emit('close')"
          >
            Close
          </button>
          <button
            type="button"
            class="btn btn-sm"
            :class="job.active ? 'btn-outline-warning' : 'btn-outline-success'"
            :disabled="togglingJobId === job.id"
            @click="emit('toggle-archive', { job, active: !job.active })"
          >
            {{ job.active ? 'Archive' : 'Restore' }}
          </button>
          <button
            type="button"
            class="btn btn-sm btn-outline-danger"
            @click="emit('delete', job)"
          >
            Delete
          </button>
        </div>
      </div>

      <div
        v-if="job"
        class="admin-job-workspace__toolbar"
      >
        <div class="admin-job-workspace__toolbar-summary">
          <TimecardWeekStatusBadge
            :status="job.timecardStatus"
            :period-end-date="job.timecardPeriodEndDate"
            :current-week-end="currentWeekEnd"
            :current-week-label="currentWeekLabel"
          />

          <div class="admin-job-workspace__team-summary">
            {{ assignmentSummary }}
          </div>
        </div>

        <div class="admin-job-workspace__tabs" role="tablist" aria-label="Selected job workspace">
          <button
            v-for="tab in tabOptions"
            :key="tab.value"
            type="button"
            class="btn btn-sm admin-job-workspace__tab"
            :class="{ 'admin-job-workspace__tab--active': activeTab === tab.value }"
            :aria-pressed="activeTab === tab.value"
            @click="activeTab = tab.value"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>
    </template>

    <AppAlert
      v-if="!job"
      variant="info"
      class="mb-0"
      message="Select a job from the list to edit details and manage its crew."
    />

    <template v-else>
      <AdminJobDetailsCard
        v-show="activeTab === 'details'"
        embedded
        :job="job"
        :form="form"
        :dirty="dirty"
        :saving="saving"
        :toggling-job-id="togglingJobId"
        :current-week-end="currentWeekEnd"
        :current-week-label="currentWeekLabel"
        @update:form="emit('update:form', $event)"
        @save="emit('save')"
        @reset="emit('reset')"
        @close="emit('close')"
        @delete="emit('delete', $event)"
        @toggle-archive="emit('toggle-archive', $event)"
      />

      <AdminJobManagementPanel
        v-show="activeTab === 'team'"
        embedded
        :job="job"
        :assigned-foremen="assignedForemen"
        :available-foreman-options="availableForemanOptions"
        :selected-foreman-id="selectedForemanId"
        :assigning-foreman-id="assigningForemanId"
        :removing-foreman-id="removingForemanId"
        :setting-display-foreman-id="settingDisplayForemanId"
        :roster-employees="rosterEmployees"
        :total-roster-employees="totalRosterEmployees"
        :roster-search-term="rosterSearchTerm"
        :available-employee-options="availableEmployeeOptions"
        :employee-directory-loading="employeeDirectoryLoading"
        :employee-directory-error="employeeDirectoryError"
        :roster-form="rosterForm"
        :selected-employee="selectedEmployee"
        :saving-roster-employee="savingRosterEmployee"
        :toggling-roster-employee-id="togglingRosterEmployeeId"
        :removing-roster-employee-id="removingRosterEmployeeId"
        @update:selected-foreman-id="emit('update:selectedForemanId', $event)"
        @update:roster-search-term="emit('update:rosterSearchTerm', $event)"
        @update:selected-employee-id="emit('update:selectedEmployeeId', $event)"
        @update:roster-form="emit('update:rosterForm', $event)"
        @assign-foreman="emit('assign-foreman')"
        @remove-foreman="emit('remove-foreman', $event)"
        @set-display-foreman="emit('set-display-foreman', $event)"
        @add-roster-employee="emit('add-roster-employee')"
        @toggle-roster-employee="emit('toggle-roster-employee', $event)"
        @remove-roster-employee="emit('remove-roster-employee', $event)"
      />
    </template>
  </AppSectionCard>
</template>
