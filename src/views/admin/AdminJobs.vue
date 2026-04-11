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
      subtitle="Browse jobs, edit details, and assign one foreman from one split workspace."
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
          :foreman-options="foremanOptions"
          :dirty="activeJobDirty"
          :saving="editingJobSaving"
          :toggling-job-id="togglingJobId"
          :current-week-end="currentWeekEnd"
          :current-week-label="currentWeekLabel"
          @update:form="setEditingJobForm"
          @save="saveActiveJob"
          @reset="resetActiveJobChanges"
          @close="closeActiveJob"
          @delete="handleDeleteJob"
          @toggle-archive="({ job, active }) => toggleArchive(job, active)"
        />
      </div>
    </AppMasterDetailWorkspace>
  </div>
</template>


