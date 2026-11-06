<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import '@/styles/builder-ui.css'
import BuilderConfirmDialog from '@/components/builder/BuilderConfirmDialog.vue'
import { canEditJobSetup } from '@/auth/capabilities'
import { resolveJobsDashboardReturn, resolveJobsRouteIntent } from '@/features/jobs/jobsRouteIntent'
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

withDefaults(defineProps<{ administration?: boolean }>(), { administration: false })

const auth = useAuthStore()
const jobsStore = useJobsStore()
const router = useRouter()
const initialRouteQuery = { ...useRoute().query }
const dashboardReturn = resolveJobsDashboardReturn(initialRouteQuery)
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
  detailDirty,
  prepareDetailNavigation,
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
  preservePendingSelection: () => detailDirty.value || saveLoading.value,
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
const navigationConfirm = ref<InstanceType<typeof BuilderConfirmDialog>>()
const navigationBusy = ref(false)
const createSnapshot = () => JSON.stringify({ form: createForm, recipients: createNotificationRecipients, inputs: createRecipientInputs })
const emptyCreateSnapshot = createSnapshot()
const createDirty = computed(() => isCreateMode.value && createSnapshot() !== emptyCreateSnapshot)
const recipientDraft = computed(() => Object.values(isAllJobsMode.value ? globalRecipientInputs : detailRecipientInputs).some(value => value.trim()))
async function prepareNavigation() {
  if (navigationBusy.value) return false
  if (createLoading.value || archiveLoading.value || deleteLoading.value || recipientSaving.value) {
    toast.error('Wait for the job change to finish before leaving.', 'Jobs')
    return false
  }
  navigationBusy.value = true
  try {
    const detailSaved = await prepareDetailNavigation()
    if (!createDirty.value && !recipientDraft.value && detailSaved) return true
    const accepted = await navigationConfirm.value?.ask({
      title: 'Keep unsaved job changes?',
      message: detailSaved
        ? 'This new job or recipient draft has not been saved. Discard it to continue?'
        : 'Job changes could not finish saving. Keep editing to retry, or discard the unsaved changes.',
      confirmLabel: 'Discard changes',
      cancelLabel: 'Keep editing',
      destructive: true,
    })
    if (!accepted) return false
    clearDetailAutosaveTimer()
    if (isCreateMode.value) resetCreateForm()
    else applySelectedJobToForm(selectedJob.value)
    for (const key of Object.keys(globalRecipientInputs) as GlobalNotificationModuleKey[]) globalRecipientInputs[key] = ''
    return true
  } finally { navigationBusy.value = false }
}
async function selectJobSafely(job: import('@/types/domain').JobRecord) {
  if (editDrawerOpen.value && selectedJobId.value === job.id) return
  if (await prepareNavigation()) handleJobPrimaryAction(job)
}
async function createJobSafely() {
  if (await prepareNavigation()) openCreateMode()
}
async function selectAllJobsSafely() {
  if (selectedJobId.value !== ALL_JOBS_ID && await prepareNavigation()) selectedJobId.value = ALL_JOBS_ID
}
async function archiveJobSafely() {
  if (await prepareNavigation()) requestToggleArchive()
}
async function deleteJobSafely() {
  if (await prepareNavigation()) requestDeleteJob()
}
async function toggleEditorSafely() {
  if (!editDrawerOpen.value) openEditDrawer()
  else if (await prepareNavigation()) closeEditDrawer()
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (detailDirty.value || createDirty.value || recipientDraft.value || saveLoading.value || createLoading.value || archiveLoading.value || deleteLoading.value || recipientSaving.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}
onBeforeRouteLeave(prepareNavigation)
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))

// Dashboard management links are an opt-in initial selection, never a write.
// Wait for the authorized job subscription before resolving a requested job.
onMounted(() => {
  if (!initialRouteQuery.jobAction) return
  let handled = false
  watch(() => [jobsStore.loading, jobsStore.jobs, auth.rawRole], () => {
    if (handled || jobsStore.loading) return
    handled = true
    const intent = resolveJobsRouteIntent(initialRouteQuery, {
      canCreate: canCreateJobs.value,
      canManage: auth.canManageJobs,
      canUseEditor: canUseJobSetupEditor.value,
      jobs: jobsStore.jobs,
      canEdit: job => canEditJobSetup({
        rawRole: auth.rawRole,
        jobId: job.id,
        assignedJobIds: [...auth.assignedJobIds, ...(job.assignedForemanIds?.includes(auth.currentUser?.uid || '') ? [job.id] : [])],
      }),
    })
    if (!intent) return
    if (intent.kind === 'denied') {
      toast.error('The requested job setup is not available for your account.', 'Jobs')
      return
    }
    if (intent.kind === 'create') openCreateMode()
    else if (intent.kind === 'edit') {
      jobStatusFilter.value = intent.job.active === false ? 'inactive' : 'active'
      openEditDrawer(intent.job.id)
    } else {
      if (intent.kind === 'archived') jobStatusFilter.value = 'inactive'
      openEditDrawer()
    }
  }, { immediate: true })
})
</script>

<template>
  <JobsWorkspaceShell
    :title="administration ? 'Job administration' : 'Jobs'"
    :before-sign-out="prepareNavigation"
    :dashboard-return="dashboardReturn"
    :can-use-job-setup-editor="canUseJobSetupEditor"
    :edit-mode="editDrawerOpen"
    @toggle-edit-mode="toggleEditorSafely"
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
        @create-job="createJobSafely"
        @select-all-jobs="selectAllJobsSafely"
        @select-job="selectJobSafely"
      />
    </template>

    <template #secondary>
      <JobAdminDetailPane
        v-if="canUseJobSetupEditor && editDrawerOpen"
        :inert="navigationBusy || undefined"
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
        @delete-job="deleteJobSafely"
        @remove-create-recipient="
          (moduleKey, email) => removeRecipientFromTarget('create', moduleKey, email)
        "
        @remove-detail-recipient="
          (moduleKey, email) => removeRecipientFromTarget('job', moduleKey, email)
        "
        @remove-global-recipient="
          (moduleKey, email) => removeRecipientFromTarget('all', moduleKey, email)
        "
        @request-toggle-archive="archiveJobSafely"
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

    <BuilderConfirmDialog ref="navigationConfirm" />
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
