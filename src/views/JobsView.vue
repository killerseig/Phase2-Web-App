<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import AppBadge from '@/components/common/AppBadge.vue'
import AppButton from '@/components/common/AppButton.vue'
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import AppLoadingButton from '@/components/common/AppLoadingButton.vue'
import AppStatusMessage from '@/components/common/AppStatusMessage.vue'
import JobBrowserPanel from '@/components/jobs/JobBrowserPanel.vue'
import JobDetailsFormFields from '@/components/jobs/JobDetailsFormFields.vue'
import JobFieldUserAssignmentPanel from '@/components/jobs/JobFieldUserAssignmentPanel.vue'
import JobNotificationRecipientsPanel from '@/components/jobs/JobNotificationRecipientsPanel.vue'
import { useAppToast } from '@/composables/useAppToast'
import { usePageMessages } from '@/composables/usePageMessages'
import { useToastMessages } from '@/composables/useToastMessages'
import {
  ALL_JOBS_ID,
  JOB_NOTIFICATION_MODULES,
  createEmptyNotificationRecipients,
  createRecipientInputState,
  getJobDisplayName,
  toggleAssignedForeman,
} from '@/features/jobs/jobViewHelpers'
import { useJobsAdminSubscriptions } from '@/features/jobs/useJobsAdminSubscriptions'
import { useJobConfirmDialogs } from '@/features/jobs/useJobConfirmDialogs'
import { useJobCreateForm } from '@/features/jobs/useJobCreateForm'
import { useJobCrudActions } from '@/features/jobs/useJobCrudActions'
import { useJobDetailForm } from '@/features/jobs/useJobDetailForm'
import { useJobsNavigationActions } from '@/features/jobs/useJobsNavigationActions'
import { useJobsLifecycle } from '@/features/jobs/useJobsLifecycle'
import { useJobNotificationRecipients } from '@/features/jobs/useJobNotificationRecipients'
import { useJobsSelectionSync } from '@/features/jobs/useJobsSelectionSync'
import { useJobsSideEffects } from '@/features/jobs/useJobsSideEffects'
import { useJobsViewState } from '@/features/jobs/useJobsViewState'
import AppShell from '@/layouts/AppShell.vue'
import { useAuthStore } from '@/stores/auth'
import { useJobsStore } from '@/stores/jobs'
import type { NotificationModuleKey, NotificationRecipients } from '@/types/domain'
import type { DirectoryStatusFilter } from '@/utils/directoryFilters'

const auth = useAuthStore()
const jobsStore = useJobsStore()
const router = useRouter()
const toast = useAppToast()

const searchTerm = ref('')
const foremanSearchTerm = ref('')
const jobStatusFilter = ref<DirectoryStatusFilter>('active')
const editDrawerOpen = ref(false)
const selectedJobId = ref<string | 'new' | typeof ALL_JOBS_ID | null>(null)
const {
  pageError: createError,
  pageInfo: createInfo,
  resetMessages: resetCreateMessages,
  setPageError: setCreateError,
  setPageErrorMessage: setCreateErrorMessage,
  setPageInfo: setCreateInfo,
} = usePageMessages()
const {
  pageError: detailError,
  pageInfo: detailInfo,
  resetMessages: resetDetailMessages,
  setPageError: setDetailError,
  setPageErrorMessage: setDetailErrorMessage,
  setPageInfo: setDetailInfo,
} = usePageMessages()
const createLoading = ref(false)
const saveLoading = ref(false)
const deleteLoading = ref(false)
const archiveLoading = ref(false)
const {
  globalNotificationRecipients,
  startAdminSubscriptions,
  stopAdminSubscriptions,
  users,
  usersError,
  usersLoading,
} = useJobsAdminSubscriptions({
  getIsAdmin: () => auth.isAdmin,
  setDetailError,
})

const {
  createForm,
  createNotificationRecipients,
  createRecipientInputs,
  resetCreateForm,
  updateCreateFormField,
} = useJobCreateForm({
  clearCreateMessages: resetCreateMessages,
})
const detailNotificationRecipients = reactive<NotificationRecipients>(createEmptyNotificationRecipients())
const detailRecipientInputs = reactive<Record<NotificationModuleKey, string>>(createRecipientInputState())
const globalRecipientInputs = reactive<Record<NotificationModuleKey, string>>(createRecipientInputState())

const {
  activeJobCount,
  archivedJobCount,
  filteredForemen,
  gcSuggestions,
  isAllJobsMode,
  isCreateMode,
  jobTypeOptions,
  selectedJob,
  showAllJobsEntry,
  visibleJobs,
} = useJobsViewState({
  activeJobs: { get value() { return jobsStore.activeJobs } },
  allJobs: { get value() { return jobsStore.jobs } },
  editDrawerOpen,
  foremanSearchTerm,
  getIsAdmin: () => auth.isAdmin,
  jobStatusFilter,
  searchTerm,
  selectedJobId,
  users,
})
const {
  archiveConfirmOpen,
  archiveJobConfirmLabel,
  archiveJobConfirmMessage,
  archiveJobConfirmTitle,
  closeArchiveConfirm,
  closeDeleteConfirm,
  deleteConfirmOpen,
  deleteJobConfirmMessage,
  handleArchiveConfirmOpenUpdate,
  handleDeleteConfirmOpenUpdate,
  requestDeleteJob,
  requestToggleArchive,
} = useJobConfirmDialogs({
  archiveBusy: archiveLoading,
  deleteBusy: deleteLoading,
  selectedJob,
})
const {
  handleCreateJob,
  handleDeleteJob,
  handleToggleArchive,
  persistJobDetail,
} = useJobCrudActions({
  archiveLoading,
  closeArchiveConfirm,
  closeDeleteConfirm,
  createForm,
  createLoading,
  createNotificationRecipients,
  deleteLoading,
  detailNotificationRecipients,
  resetCreateMessages,
  resetDetailMessages,
  saveLoading,
  selectedJob,
  selectedJobId,
  setCreateError,
  setCreateErrorMessage,
  setCreateInfo,
  setDetailError,
  setDetailInfo,
  visibleJobs,
})
const {
  applySelectedJobToForm,
  clearDetailAutosaveTimer,
  detailForm,
  handleSaveJob,
  queueDetailAutosave,
  shouldHydrateSelectedJob,
  updateDetailFormField,
} = useJobDetailForm({
  detailNotificationRecipients,
  detailRecipientInputs,
  getEditDrawerOpen: () => editDrawerOpen.value,
  getIsAdmin: () => auth.isAdmin,
  getIsCreateMode: () => isCreateMode.value,
  getSelectedJob: () => selectedJob.value,
  persistJobDetail,
  setDetailError: setDetailErrorMessage,
  setDetailInfo,
})
const {
  addRecipientToTarget,
  recipientSaving,
  removeRecipientFromTarget,
} = useJobNotificationRecipients({
  createError,
  createInfo,
  createNotificationRecipients,
  createRecipientInputs,
  detailError,
  detailInfo,
  detailNotificationRecipients,
  detailRecipientInputs,
  globalNotificationRecipients,
  globalRecipientInputs,
  selectedJob,
})
const {
  closeEditDrawer,
  handleJobPrimaryAction,
  openCreateMode,
  openEditDrawer,
} = useJobsNavigationActions({
  editDrawerOpen,
  getIsAdmin: () => auth.isAdmin,
  resetCreateForm,
  router,
  selectedJobId,
})
useJobsSelectionSync({
  applySelectedJobToForm,
  clearDetailAutosaveTimer,
  editDrawerOpen,
  getIsAdmin: () => auth.isAdmin,
  selectedJob,
  selectedJobId,
  shouldHydrateSelectedJob,
  visibleJobs,
})
useJobsSideEffects({
  detailForm,
  getJobsError: () => jobsStore.error,
  queueDetailAutosave,
  showJobsError: (message) => toast.error(message, 'Jobs'),
})

const passiveJobDetailMessages = new Set(['Saving...', 'All changes saved.'])

useToastMessages([
  { source: usersError, severity: 'error', summary: 'Jobs' },
  { source: createError, severity: 'error', summary: 'Create Job' },
  { source: createInfo, severity: 'success', summary: 'Create Job' },
  { source: detailError, severity: 'error', summary: 'Job Editor' },
  {
    source: detailInfo,
    severity: 'success',
    summary: 'Job Editor',
    when: (message) => !passiveJobDetailMessages.has(message),
  },
])

useJobsLifecycle({
  clearDetailAutosaveTimer,
  startAdminSubscriptions,
  startJobsSubscription: () => jobsStore.subscribeVisibleJobs(),
  stopAdminSubscriptions,
  stopJobsSubscription: () => jobsStore.stopJobsSubscription(),
})
</script>

<template>
  <AppShell>
    <template v-if="auth.isAdmin" #topbar-actions>
      <AppButton
        class="app-shell__topbar-button"
        variant="primary"
        data-testid="jobs-edit-mode"
        @click="editDrawerOpen ? closeEditDrawer() : openEditDrawer()"
      >
        {{ editDrawerOpen ? 'Done Editing' : 'Edit Mode' }}
      </AppButton>
    </template>

    <div
      class="jobs-workspace"
      :class="{ 'jobs-workspace--split': auth.isAdmin && editDrawerOpen }"
    >
      <JobBrowserPanel
        :is-admin="auth.isAdmin"
        :edit-mode="editDrawerOpen"
        :search-term="searchTerm"
        :status-filter="jobStatusFilter"
        :active-job-count="activeJobCount"
        :archived-job-count="archivedJobCount"
        :visible-jobs="visibleJobs"
        :loading="jobsStore.loading"
        :selected-job-id="selectedJobId"
        :show-all-jobs-entry="showAllJobsEntry"
        :all-jobs-id="ALL_JOBS_ID"
        @update-search-term="searchTerm = $event"
        @update-status-filter="jobStatusFilter = $event"
        @create-job="openCreateMode"
        @select-all-jobs="selectedJobId = ALL_JOBS_ID"
        @select-job="handleJobPrimaryAction"
      />

      <section
        v-if="auth.isAdmin && editDrawerOpen"
        class="jobs-detail"
      >
        <template v-if="isCreateMode">
          <header class="jobs-detail__header">
            <div>
              <span class="jobs-workspace__eyebrow">Create</span>
              <h2 class="jobs-detail__title">New Job</h2>
            </div>
          </header>

          <div class="jobs-detail__body">
            <form class="jobs-form" @submit.prevent="handleCreateJob">
              <JobDetailsFormFields
                :model="createForm"
                :job-type-options="jobTypeOptions"
                test-id-prefix="jobs-create"
                @update-field="updateCreateFormField"
              />

              <JobFieldUserAssignmentPanel
                :selected-ids="createForm.assignedForemanIds"
                :users="filteredForemen"
                :search-term="foremanSearchTerm"
                :loading="usersLoading"
                row-test-id-prefix="jobs-foreman"
                @update-search-term="foremanSearchTerm = $event"
                @toggle-user="toggleAssignedForeman(createForm.assignedForemanIds, $event)"
              />

              <JobNotificationRecipientsPanel
                description="Applies only to this new job"
                :modules="JOB_NOTIFICATION_MODULES"
                :recipients="createNotificationRecipients"
                :inputs="createRecipientInputs"
                @update-input="(moduleKey, value) => (createRecipientInputs[moduleKey] = value)"
                @add-recipient="addRecipientToTarget('create', $event)"
                @remove-recipient="(moduleKey, email) => removeRecipientFromTarget('create', moduleKey, email)"
              />

              <div class="jobs-detail__actions">
                <AppLoadingButton
                  label="Create Job"
                  loading-label="Creating..."
                  variant="primary"
                  :loading="createLoading"
                  data-testid="jobs-create-button"
                  type="submit"
                />
              </div>
            </form>
          </div>
        </template>

        <template v-else-if="isAllJobsMode">
          <header class="jobs-detail__header">
            <div>
              <span class="jobs-workspace__eyebrow">Global Scope</span>
              <h2 class="jobs-detail__title">All Jobs</h2>
            </div>
            <div class="jobs-detail__status-group">
              <AppBadge tone="accent">Defaults</AppBadge>
            </div>
          </header>

          <div class="jobs-detail__body">
            <JobNotificationRecipientsPanel
              description="Sent for every job unless that job adds more recipients"
              :modules="JOB_NOTIFICATION_MODULES"
              :recipients="globalNotificationRecipients"
              :inputs="globalRecipientInputs"
              :disabled="recipientSaving"
              @update-input="(moduleKey, value) => (globalRecipientInputs[moduleKey] = value)"
              @add-recipient="addRecipientToTarget('all', $event)"
              @remove-recipient="(moduleKey, email) => removeRecipientFromTarget('all', moduleKey, email)"
            />
          </div>
        </template>

        <template v-else-if="selectedJob">
          <header class="jobs-detail__header">
            <div>
              <span class="jobs-workspace__eyebrow">Selected Job</span>
              <h2 class="jobs-detail__title">{{ getJobDisplayName(selectedJob) }}</h2>
            </div>
            <div class="jobs-detail__status-group">
              <AppBadge :tone="selectedJob.active ? 'success' : 'danger'">
                {{ selectedJob.active ? 'Active' : 'Archived' }}
              </AppBadge>
            </div>
          </header>

          <div class="jobs-detail__body">
            <form class="jobs-form" @submit.prevent="handleSaveJob">
              <JobDetailsFormFields
                :model="detailForm"
                :job-type-options="jobTypeOptions"
                @update-field="updateDetailFormField"
              />

              <JobFieldUserAssignmentPanel
                :selected-ids="detailForm.assignedForemanIds"
                :users="filteredForemen"
                :search-term="foremanSearchTerm"
                :loading="usersLoading"
                @update-search-term="foremanSearchTerm = $event"
                @toggle-user="toggleAssignedForeman(detailForm.assignedForemanIds, $event)"
              />

              <JobNotificationRecipientsPanel
                description="Added on top of All Jobs defaults for this job only"
                :modules="JOB_NOTIFICATION_MODULES"
                :recipients="detailNotificationRecipients"
                :inputs="detailRecipientInputs"
                :disabled="recipientSaving"
                @update-input="(moduleKey, value) => (detailRecipientInputs[moduleKey] = value)"
                @add-recipient="addRecipientToTarget('job', $event)"
                @remove-recipient="(moduleKey, email) => removeRecipientFromTarget('job', moduleKey, email)"
              />

              <div class="jobs-detail__actions">
                <AppButton :disabled="archiveLoading" @click="requestToggleArchive">
                  {{ archiveLoading ? 'Updating...' : selectedJob.active ? 'Archive Job' : 'Restore Job' }}
                </AppButton>
                <AppButton variant="danger" :disabled="deleteLoading" @click="requestDeleteJob">
                  {{ deleteLoading ? 'Deleting...' : 'Delete Job' }}
                </AppButton>
              </div>
            </form>
            <AppStatusMessage
              v-if="saveLoading || detailInfo === 'All changes saved.'"
              :tone="!saveLoading && detailInfo === 'All changes saved.' ? 'success' : 'default'"
            >
              {{ saveLoading ? 'Saving...' : 'All changes saved.' }}
            </AppStatusMessage>
          </div>
        </template>

        <template v-else>
          <div class="jobs-detail__body">
            <AppEmptyState
              class="jobs-browser__empty"
              message="Select a job to edit, or create a new one."
            />
          </div>
        </template>
      </section>
    </div>

    <datalist id="job-gc-options">
      <option v-for="gc in gcSuggestions" :key="gc" :value="gc" />
    </datalist>

    <ConfirmDialog
      :open="archiveConfirmOpen"
      :title="archiveJobConfirmTitle"
      :message="archiveJobConfirmMessage"
      :confirm-label="archiveJobConfirmLabel"
      :busy="archiveLoading"
      @update:open="handleArchiveConfirmOpenUpdate"
      @confirm="handleToggleArchive"
    />

    <ConfirmDialog
      :open="deleteConfirmOpen"
      title="Delete job?"
      :message="deleteJobConfirmMessage"
      confirm-label="Delete Job"
      destructive
      :busy="deleteLoading"
      @update:open="handleDeleteConfirmOpenUpdate"
      @confirm="handleDeleteJob"
    />
  </AppShell>
</template>

<style scoped>
.jobs-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.jobs-workspace--split {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

.jobs-detail {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 1rem;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.018), rgba(255, 255, 255, 0)),
    rgba(29, 38, 49, 0.92);
  box-shadow: var(--shadow);
}

.jobs-detail__body {
  display: grid;
  gap: 1rem;
  min-height: 0;
  overflow: auto;
  align-content: start;
  padding-right: 0.15rem;
}

.jobs-detail__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.jobs-workspace__eyebrow {
  color: var(--accent-strong);
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.jobs-detail__title {
  margin: 0.35rem 0 0;
  font-size: 1.1rem;
}

.jobs-detail__status-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.jobs-form {
  display: grid;
  gap: 1rem;
  align-content: start;
}

.jobs-browser__empty {
  color: var(--text-muted);
  display: grid;
  place-content: center;
  min-height: 12rem;
  padding: 1.5rem;
  border: 1px dashed var(--border);
  border-radius: 12px;
  text-align: center;
}

.jobs-detail__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}

@media (max-width: 1100px) {
  .jobs-workspace--split {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .jobs-workspace {
    grid-template-columns: 1fr;
  }

  .jobs-detail__header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
