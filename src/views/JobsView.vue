<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import JobAdminDetailPane from '@/components/jobs/JobAdminDetailPane.vue'
import JobBrowserPanel from '@/components/jobs/JobBrowserPanel.vue'
import JobConfirmDialogs from '@/components/jobs/JobConfirmDialogs.vue'
import JobsWorkspaceShell from '@/components/jobs/JobsWorkspaceShell.vue'
import { useAppToast } from '@/composables/useAppToast'
import { usePageMessages } from '@/composables/usePageMessages'
import { useToastMessages } from '@/composables/useToastMessages'
import {
  ALL_JOBS_ID,
  JOB_NOTIFICATION_MODULES,
  JOB_SPECIFIC_NOTIFICATION_MODULES,
  createEmptyNotificationRecipients,
  createGlobalRecipientInputState,
  createRecipientInputState,
  shouldShowJobDetailSuccessToast,
  toggleAssignedForeman,
} from '@/features/jobs/jobViewHelpers'
import { useJobsAdminSubscriptions } from '@/features/jobs/useJobsAdminSubscriptions'
import { useJobsCapabilities } from '@/features/jobs/useJobsCapabilities'
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
import { useAuthStore } from '@/stores/auth'
import { useJobsStore } from '@/stores/jobs'
import type {
  GlobalNotificationModuleKey,
  NotificationModuleKey,
  NotificationRecipients,
} from '@/types/domain'
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
  getCanLoadAssignableUsers: () => canUseJobSetupEditor.value,
  getCanManageGlobalRecipients: () => auth.canManageJobs,
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
const detailNotificationRecipients = reactive<NotificationRecipients>(
  createEmptyNotificationRecipients(),
)
const detailRecipientInputs = reactive<Record<NotificationModuleKey, string>>(
  createRecipientInputState(),
)
const globalRecipientInputs = reactive<Record<GlobalNotificationModuleKey, string>>(
  createGlobalRecipientInputState(),
)

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
  activeJobs: {
    get value() {
      return jobsStore.activeJobs
    },
  },
  allJobs: {
    get value() {
      return jobsStore.jobs
    },
  },
  editDrawerOpen,
  foremanSearchTerm,
  getCanCreateJobs: () => canCreateJobs.value,
  getCanManageJobs: () => auth.canManageJobs,
  getCanUseJobSetupEditor: () => canUseJobSetupEditor.value,
  jobStatusFilter,
  searchTerm,
  selectedJobId,
  users,
})
const { canCreateJobs, canDeleteOrArchiveJobs, canEditSelectedJobSetup, canUseJobSetupEditor } =
  useJobsCapabilities({
    auth,
    selectedJob,
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
const { handleCreateJob, handleDeleteJob, handleToggleArchive, persistJobDetail } =
  useJobCrudActions({
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
  getCanEditSelectedJob: () => canEditSelectedJobSetup.value,
  getIsCreateMode: () => isCreateMode.value,
  getSelectedJob: () => selectedJob.value,
  persistJobDetail,
  setDetailError: setDetailErrorMessage,
  setDetailInfo,
})
const { addRecipientToTarget, recipientSaving, removeRecipientFromTarget } =
  useJobNotificationRecipients({
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
const { closeEditDrawer, handleJobPrimaryAction, openCreateMode, openEditDrawer } =
  useJobsNavigationActions({
    editDrawerOpen,
    getCanCreateJobs: () => canCreateJobs.value,
    getCanManageGlobalJobDefaults: () => auth.canManageJobs,
    getCanUseJobSetupEditor: () => canUseJobSetupEditor.value,
    resetCreateForm,
    router,
    selectedJobId,
  })
useJobsSelectionSync({
  applySelectedJobToForm,
  clearDetailAutosaveTimer,
  editDrawerOpen,
  getCanManageGlobalJobDefaults: () => auth.canManageJobs,
  getCanUseJobSetupEditor: () => canUseJobSetupEditor.value,
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

useToastMessages([
  { source: usersError, severity: 'error', summary: 'Jobs' },
  { source: createError, severity: 'error', summary: 'Create Job' },
  { source: createInfo, severity: 'success', summary: 'Create Job' },
  { source: detailError, severity: 'error', summary: 'Job Editor' },
  {
    source: detailInfo,
    severity: 'success',
    summary: 'Job Editor',
    when: shouldShowJobDetailSuccessToast,
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
  <JobsWorkspaceShell
    :can-use-job-setup-editor="canUseJobSetupEditor"
    :edit-mode="editDrawerOpen"
    @toggle-edit-mode="editDrawerOpen ? closeEditDrawer() : openEditDrawer()"
  >
    <template #primary>
      <JobBrowserPanel
        class="app-split-workspace__primary-pane"
        :can-create-jobs="canCreateJobs"
        :can-manage-jobs="auth.canManageJobs"
        :can-use-job-setup-editor="canUseJobSetupEditor"
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
    </template>

    <template #secondary>
      <JobAdminDetailPane
        v-if="canUseJobSetupEditor && editDrawerOpen"
        class="app-split-workspace__secondary-pane"
        :archive-loading="archiveLoading"
        :can-delete-or-archive-jobs="canDeleteOrArchiveJobs"
        :can-edit-selected-job="canEditSelectedJobSetup"
        :create-form="createForm"
        :create-loading="createLoading"
        :create-notification-recipients="createNotificationRecipients"
        :create-recipient-inputs="createRecipientInputs"
        :delete-loading="deleteLoading"
        :detail-form="detailForm"
        :detail-info="detailInfo"
        :detail-notification-recipients="detailNotificationRecipients"
        :detail-recipient-inputs="detailRecipientInputs"
        :filtered-foremen="filteredForemen"
        :foreman-search-term="foremanSearchTerm"
        :global-notification-recipients="globalNotificationRecipients"
        :global-recipient-inputs="globalRecipientInputs"
        :is-all-jobs-mode="isAllJobsMode"
        :is-create-mode="isCreateMode"
        :global-notification-modules="JOB_NOTIFICATION_MODULES"
        :job-notification-modules="JOB_SPECIFIC_NOTIFICATION_MODULES"
        :job-type-options="jobTypeOptions"
        :recipient-saving="recipientSaving"
        :save-loading="saveLoading"
        :selected-job="selectedJob"
        :users-loading="usersLoading"
        @add-create-recipient="addRecipientToTarget('create', $event)"
        @add-detail-recipient="addRecipientToTarget('job', $event)"
        @add-global-recipient="addRecipientToTarget('all', $event)"
        @create-job="handleCreateJob"
        @delete-job="requestDeleteJob"
        @remove-create-recipient="
          (moduleKey, email) => removeRecipientFromTarget('create', moduleKey, email)
        "
        @remove-detail-recipient="
          (moduleKey, email) => removeRecipientFromTarget('job', moduleKey, email)
        "
        @remove-global-recipient="
          (moduleKey, email) => removeRecipientFromTarget('all', moduleKey, email)
        "
        @request-toggle-archive="requestToggleArchive"
        @save-job="handleSaveJob"
        @toggle-create-foreman="toggleAssignedForeman(createForm.assignedForemanIds, $event)"
        @toggle-detail-foreman="toggleAssignedForeman(detailForm.assignedForemanIds, $event)"
        @update-create-field="updateCreateFormField"
        @update-create-recipient-input="
          (moduleKey, value) => (createRecipientInputs[moduleKey] = value)
        "
        @update-detail-field="updateDetailFormField"
        @update-detail-recipient-input="
          (moduleKey, value) => (detailRecipientInputs[moduleKey] = value)
        "
        @update-foreman-search-term="foremanSearchTerm = $event"
        @update-global-recipient-input="
          (moduleKey, value) => (globalRecipientInputs[moduleKey] = value)
        "
      />
    </template>

    <datalist id="job-gc-options">
      <option v-for="gc in gcSuggestions" :key="gc" :value="gc" />
    </datalist>

    <JobConfirmDialogs
      :archive-busy="archiveLoading"
      :archive-confirm-label="archiveJobConfirmLabel"
      :archive-message="archiveJobConfirmMessage"
      :archive-open="archiveConfirmOpen"
      :archive-title="archiveJobConfirmTitle"
      :delete-busy="deleteLoading"
      :delete-message="deleteJobConfirmMessage"
      :delete-open="deleteConfirmOpen"
      @confirm-archive="handleToggleArchive"
      @confirm-delete="handleDeleteJob"
      @update-archive-open="handleArchiveConfirmOpenUpdate"
      @update-delete-open="handleDeleteConfirmOpenUpdate"
    />
  </JobsWorkspaceShell>
</template>
