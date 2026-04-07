<script setup lang="ts">
import AdminJobsCreateCard from '@/components/admin/AdminJobsCreateCard.vue'
import AdminJobsExportToolbar from '@/components/admin/AdminJobsExportToolbar.vue'
import AdminJobManagementPanel from '@/components/admin/AdminJobManagementPanel.vue'
import AdminJobsTableCard from '@/components/admin/AdminJobsTableCard.vue'
import AppPageHeader from '@/components/layout/AppPageHeader.vue'
import { useAdminJobs } from '@/composables/admin/useAdminJobs'

const {
  activeJobActionsId,
  activeJob,
  cancelJobForm,
  creatingJob,
  currentWeekEnd,
  currentWeekLabel,
  editingJobForm,
  editingJobId,
  editingJobSaving,
  err,
  exportAllSubmittedAllJobs,
  exportDateConfig,
  exportDateInWeek,
  exportWeekEnding,
  exportWeekLabel,
  foremanOptions,
  handleDeleteJob,
  handleJobSort,
  jobForm,
  jobTeam,
  jobSortDir,
  jobSortKey,
  loadingJobs,
  setEditingJobForm,
  setExportDateInWeek,
  setJobForm,
  setShowJobForm,
  showJobForm,
  sortedJobs,
  submitJobForm,
  toggleArchive,
  toggleJobActions,
  togglingJobId,
} = useAdminJobs()

const {
    assignedForemen,
    assigningForemanId,
    availableEmployeeOptions,
    availableForemanOptions,
    employeeDirectoryError,
    employeeDirectoryLoading,
    filteredRosterEmployees,
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
</script>

<template>
  <div class="app-page">
    <AppPageHeader eyebrow="Admin Panel" title="Jobs" subtitle="Create, edit, archive, and export job records." />

    <AdminJobsCreateCard
      :open="showJobForm"
      :form="jobForm"
      :loading="creatingJob"
      :foreman-options="foremanOptions"
      @update:open="setShowJobForm"
      @update:form="setJobForm"
      @submit="submitJobForm"
      @cancel="cancelJobForm"
    />

    <AdminJobsExportToolbar
      :export-date-in-week="exportDateInWeek"
      :export-date-config="exportDateConfig"
      :export-week-label="exportWeekLabel"
      :export-week-ending="exportWeekEnding"
      @update:export-date-in-week="setExportDateInWeek"
      @export="exportAllSubmittedAllJobs"
    />

    <AdminJobsTableCard
      :jobs="sortedJobs"
      :loading="loadingJobs"
      :error="err"
      :editing-job-id="editingJobId"
      :edit-form="editingJobForm"
      :editing-job-saving="editingJobSaving"
      :active-job-actions-id="activeJobActionsId"
      :toggling-job-id="togglingJobId"
      :foreman-options="foremanOptions"
      :sort-key="jobSortKey"
      :sort-dir="jobSortDir"
      :current-week-end="currentWeekEnd"
      :current-week-label="currentWeekLabel"
      @update:edit-form="setEditingJobForm"
      @sort-change="handleJobSort"
      @toggle-actions="toggleJobActions"
      @delete-job="handleDeleteJob"
      @toggle-archive="({ job, active }) => toggleArchive(job, active)"
    />

    <AdminJobManagementPanel
      :job="activeJob"
      :assigned-foremen="assignedForemen"
      :available-foreman-options="availableForemanOptions"
      :selected-foreman-id="foremanSelectionId"
      :assigning-foreman-id="assigningForemanId"
      :removing-foreman-id="removingForemanId"
      :setting-display-foreman-id="settingDisplayForemanId"
      :roster-employees="filteredRosterEmployees"
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
</template>

