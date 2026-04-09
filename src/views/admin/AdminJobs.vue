<script setup lang="ts">
import AdminJobsCreateCard from '@/components/admin/AdminJobsCreateCard.vue'
import AdminJobsBrowserCard from '@/components/admin/AdminJobsBrowserCard.vue'
import AdminJobWorkspacePane from '@/components/admin/AdminJobWorkspacePane.vue'
import AppBadge from '@/components/common/AppBadge.vue'
import AppMasterDetailWorkspace from '@/components/common/AppMasterDetailWorkspace.vue'
import AppPageHeader from '@/components/layout/AppPageHeader.vue'
import { useAdminJobs } from '@/composables/admin/useAdminJobs'
import { computed } from 'vue'

const {
  activeJobActionsId,
  activeJob,
  activeJobDirty,
  cancelJobForm,
  closeActiveJob,
  creatingJob,
  currentWeekEnd,
  currentWeekLabel,
  editingJobForm,
  editingJobSaving,
  err,
  foremanOptions,
  handleDeleteJob,
  handleJobSort,
  jobForm,
  jobTeam,
  jobSortDir,
  jobSortKey,
  loadingJobs,
  resetActiveJobChanges,
  saveActiveJob,
  selectJob,
  setEditingJobForm,
  setJobForm,
  setShowJobForm,
  showJobForm,
  sortedJobs,
  submitJobForm,
  toggleArchive,
  togglingJobId,
} = useAdminJobs()

const {
  assignedForemen,
  assigningForemanId,
  availableEmployeeOptions,
  availableForemanOptions,
  employeeDirectoryError,
  employeeDirectoryLoading,
  foremanSelectionId,
  removingForemanId,
  removingRosterEmployeeId,
  rosterEmployees,
  rosterForm,
  rosterSearchTerm,
  savingRosterEmployee,
  selectedDirectoryEmployee,
  setDisplayForeman,
  setForemanSelectionId,
  setRosterForm,
  setRosterSearchTerm,
  setSelectedEmployeeId,
  settingDisplayForemanId,
  addRosterEmployee,
  assignSelectedForeman,
  removeAssignedForeman,
  removeRosterEmployee,
  toggleRosterEmployeeStatus,
  togglingRosterEmployeeId,
} = jobTeam

const totalJobsCount = computed(() => sortedJobs.value.length)
const activeJobsCount = computed(() => sortedJobs.value.filter((job) => job.active).length)
const archivedJobsCount = computed(() => sortedJobs.value.filter((job) => !job.active).length)
const jobsBrowserColumn = computed(() =>
  showJobForm.value ? 'minmax(390px, 460px)' : 'minmax(340px, 390px)'
)
const jobsBrowserBreakpoint = computed(() => (showJobForm.value ? 1320 : 1160))
</script>

<template>
  <div class="app-page app-page--wide admin-jobs-page">
    <AppPageHeader
      eyebrow="Admin Workspace"
      title="Jobs"
      subtitle="Browse jobs, edit details, and manage each job's crew from one split workspace."
      compact
    >
      <template #badges>
        <AppBadge :label="`${totalJobsCount} total`" variant-class="text-bg-secondary" />
        <AppBadge :label="`${activeJobsCount} active`" variant-class="text-bg-success" />
        <AppBadge :label="`${archivedJobsCount} archived`" variant-class="text-bg-warning" />
        <AppBadge :label="currentWeekLabel" variant-class="text-bg-info" />
      </template>
    </AppPageHeader>

    <AppMasterDetailWorkspace
      :browser-column="jobsBrowserColumn"
      :controls-breakpoint="999"
      :browser-breakpoint="jobsBrowserBreakpoint"
      browse-label="Jobs"
      browser-title="Jobs"
    >
      <template #browser>
        <div class="admin-jobs-page__browser">
          <AdminJobsCreateCard
            v-if="showJobForm"
            :open="showJobForm"
            :form="jobForm"
            :loading="creatingJob"
            :foreman-options="foremanOptions"
            @update:open="setShowJobForm"
            @update:form="setJobForm"
            @submit="submitJobForm"
            @cancel="cancelJobForm"
          />

          <AdminJobsBrowserCard
            :jobs="sortedJobs"
            :loading="loadingJobs"
            :error="err"
            :selected-job-id="activeJobActionsId"
            :sort-key="jobSortKey"
            :sort-dir="jobSortDir"
            :current-week-end="currentWeekEnd"
            :current-week-label="currentWeekLabel"
            :show-create="showJobForm"
            @sort-change="handleJobSort"
            @select-job="selectJob"
            @toggle-create="setShowJobForm(!showJobForm)"
          />
        </div>
      </template>

      <div class="admin-jobs-page__detail">
        <AdminJobWorkspacePane
          :job="activeJob"
          :form="editingJobForm"
          :dirty="activeJobDirty"
          :saving="editingJobSaving"
          :toggling-job-id="togglingJobId"
          :current-week-end="currentWeekEnd"
          :current-week-label="currentWeekLabel"
          :assigned-foremen="assignedForemen"
          :available-foreman-options="availableForemanOptions"
          :selected-foreman-id="foremanSelectionId"
          :assigning-foreman-id="assigningForemanId"
          :removing-foreman-id="removingForemanId"
          :setting-display-foreman-id="settingDisplayForemanId"
          :roster-employees="rosterEmployees"
          :total-roster-employees="rosterEmployees.length"
          :roster-search-term="rosterSearchTerm"
          :available-employee-options="availableEmployeeOptions"
          :employee-directory-loading="employeeDirectoryLoading"
          :employee-directory-error="employeeDirectoryError || ''"
          :roster-form="rosterForm"
          :selected-employee="selectedDirectoryEmployee"
          :saving-roster-employee="savingRosterEmployee"
          :toggling-roster-employee-id="togglingRosterEmployeeId"
          :removing-roster-employee-id="removingRosterEmployeeId"
          @update:form="setEditingJobForm"
          @save="saveActiveJob"
          @reset="resetActiveJobChanges"
          @close="closeActiveJob"
          @delete="handleDeleteJob"
          @toggle-archive="({ job, active }) => toggleArchive(job, active)"
          @update:selected-foreman-id="setForemanSelectionId"
          @update:roster-search-term="setRosterSearchTerm"
          @update:selected-employee-id="setSelectedEmployeeId"
          @update:roster-form="setRosterForm"
          @assign-foreman="assignSelectedForeman"
          @remove-foreman="removeAssignedForeman"
          @set-display-foreman="setDisplayForeman"
          @add-roster-employee="addRosterEmployee"
          @toggle-roster-employee="toggleRosterEmployeeStatus"
          @remove-roster-employee="removeRosterEmployee"
        />
      </div>
    </AppMasterDetailWorkspace>
  </div>
</template>


