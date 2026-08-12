<script setup lang="ts">
import { computed, ref } from 'vue'
import DirectoryEditorWorkspaceShell from '@/components/common/DirectoryEditorWorkspaceShell.vue'
import UserConfirmDialogs from '@/components/users/UserConfirmDialogs.vue'
import UserDirectoryPanel from '@/components/users/UserDirectoryPanel.vue'
import UserEditorPanel from '@/components/users/UserEditorPanel.vue'
import {
  buildDirectoryEditorMobilePanelTabs,
  useDirectoryEditorPanels,
} from '@/composables/useDirectoryEditorPanels'
import { usePageMessages } from '@/composables/usePageMessages'
import { useToastMessages } from '@/composables/useToastMessages'
import {
  shouldShowUserDetailSuccessToast,
  useUserAdminViewState,
} from '@/features/users/useUserAdminViewState'
import { useUserAdminViewSync } from '@/features/users/useUserAdminViewSync'
import { useUserAdminRecords } from '@/features/users/useUserAdminRecords'
import { useUserCreateActions } from '@/features/users/useUserCreateActions'
import { useUserDetailActions } from '@/features/users/useUserDetailActions'
import { useUserFormState } from '@/features/users/useUserFormState'
import { useAuthStore } from '@/stores/auth'
import type { DirectoryStatusFilter } from '@/utils/directoryFilters'

const mobilePanelTabs = buildDirectoryEditorMobilePanelTabs('Users')

const auth = useAuthStore()

const searchTerm = ref('')
const statusFilter = ref<DirectoryStatusFilter>('active')
const selectedUserId = ref<string | 'new' | null>(null)
const {
  jobs,
  jobsError,
  jobsLoading,
  startJobsSubscription,
  stopJobsSubscription,
  users,
  usersError,
  usersLoading,
  startUsersSubscription,
  stopUsersSubscription,
} = useUserAdminRecords({
  selectedUserId,
})
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
  setPageError: setDetailError,
  setPageErrorMessage: setDetailErrorMessage,
  setPageInfo: setDetailInfo,
} = usePageMessages()
const {
  pageError: inviteActionError,
  pageInfo: inviteActionInfo,
  resetMessages: resetInviteMessages,
  setPageError: setInviteError,
  setPageInfo: setInviteInfo,
} = usePageMessages()
const createAction = ref<'queue' | 'send' | null>(null)
const saveLoading = ref(false)
const deleteLoading = ref(false)
const deleteConfirmOpen = ref(false)
const inviteLoading = ref(false)

useToastMessages([
  { source: usersError, severity: 'error', summary: 'Users' },
  { source: jobsError, severity: 'error', summary: 'Users' },
  { source: createError, severity: 'error', summary: 'Create User' },
  { source: createInfo, severity: 'success', summary: 'Create User' },
  { source: inviteActionError, severity: 'error', summary: 'Invites' },
  { source: inviteActionInfo, severity: 'success', summary: 'Invites' },
  { source: detailError, severity: 'error', summary: 'User Editor' },
  {
    source: detailInfo,
    severity: 'success',
    summary: 'User Editor',
    when: shouldShowUserDetailSuccessToast,
  },
])

const {
  applyUserToDetailForm,
  createForm,
  createJobSearchTerm,
  detailForm,
  detailJobSearchTerm,
  getDetailFormSnapshot,
  hasUnsavedDetailChanges,
  resetCreateForm,
  resetDetailJobSearchTerm,
  syncingDetailForm,
  toggleCreateAssignedJob,
  toggleDetailAssignedJob: toggleDetailAssignedJobSelection,
  updateCreateRole,
  updateCreateTextField,
  updateDetailActive,
  updateDetailRole,
  updateDetailTextField,
} = useUserFormState({
  resetCreateMessages,
})

const {
  deleteUserConfirmMessage,
  editingSelf,
  filteredCreateJobs,
  filteredDetailJobs,
  filteredUsers,
  isCreateMode,
  pendingInviteCount,
  selectedUser,
} = useUserAdminViewState({
  createJobSearchTerm,
  currentUserId: computed(() => auth.currentUser?.uid ?? null),
  detailJobSearchTerm,
  jobs,
  searchTerm,
  selectedUserId,
  statusFilter,
  users,
})

const {
  handleCreateUser,
  handleSendPendingInvites,
} = useUserCreateActions({
  createAction,
  createForm,
  inviteLoading,
  resetCreateMessages,
  resetInviteMessages,
  selectedUserId,
  setCreateError,
  setCreateErrorMessage,
  setCreateInfo,
  setInviteError,
  setInviteInfo,
})
const {
  clearDetailSaveTimer,
  confirmDeleteUser,
  handleAutoSaveUser,
  handleDeleteUser,
  handleDetailAssignedJobToggle,
  queueDetailSave,
} = useUserDetailActions({
  deleteConfirmOpen,
  deleteLoading,
  detailError,
  detailForm,
  editingSelf,
  hasUnsavedDetailChanges,
  isCreateMode,
  resetCreateForm,
  saveLoading,
  selectedUser,
  selectedUserId,
  setDetailError,
  setDetailErrorMessage,
  setDetailInfo,
  syncingDetailForm,
  toggleDetailAssignedJob: toggleDetailAssignedJobSelection,
})

const {
  activeMobilePanel,
  openCreateMode,
  selectRecord: selectUser,
  showMobilePanel,
} = useDirectoryEditorPanels<string | 'new' | null, string>({
  createSelection: 'new',
  selectedId: selectedUserId,
  onCreateMode: resetCreateForm,
})

useUserAdminViewSync({
  applyUserToDetailForm,
  clearDetailSaveTimer,
  getDetailFormSnapshot,
  queueDetailSave,
  resetCreateForm,
  resetDetailJobSearchTerm,
  selectedUser,
  selectedUserId,
  setDetailErrorMessage,
  setDetailInfo,
  startJobsSubscription,
  startUsersSubscription,
  stopJobsSubscription,
  stopUsersSubscription,
})
</script>

<template>
  <DirectoryEditorWorkspaceShell
    class="users-workspace"
    data-testid="users-page"
    :active-panel="activeMobilePanel"
    :panels="mobilePanelTabs"
    tabs-label="Users workspace"
    @show="showMobilePanel"
  >
    <template #primary>
      <UserDirectoryPanel
        v-model:search-term="searchTerm"
        v-model:status-filter="statusFilter"
        class="app-split-workspace__primary-pane"
        :users="filteredUsers"
        :users-loading="usersLoading"
        :selected-user-id="selectedUserId === 'new' ? null : selectedUserId"
        :pending-invite-count="pendingInviteCount"
        :invite-loading="inviteLoading"
        @create-user="openCreateMode"
        @select-user="selectUser"
        @send-invites="handleSendPendingInvites"
      />
    </template>

    <template #secondary>
      <UserEditorPanel
        class="app-split-workspace__secondary-pane"
        :is-create-mode="isCreateMode"
        :create-form="createForm"
        :detail-form="detailForm"
        :selected-user="selectedUser"
        :editing-self="editingSelf"
        :create-action="createAction"
        :save-loading="saveLoading"
        :delete-loading="deleteLoading"
        :detail-info="detailInfo"
        :create-jobs="filteredCreateJobs"
        :detail-jobs="filteredDetailJobs"
        :jobs-loading="jobsLoading"
        :create-job-search-term="createJobSearchTerm"
        :detail-job-search-term="detailJobSearchTerm"
        @create-user="handleCreateUser"
        @delete-user="handleDeleteUser"
        @detail-submit="handleAutoSaveUser"
        @update-create-text-field="updateCreateTextField"
        @update-create-role="updateCreateRole"
        @toggle-create-assigned-job="toggleCreateAssignedJob"
        @update-create-job-search-term="createJobSearchTerm = $event"
        @update-detail-text-field="updateDetailTextField"
        @update-detail-role="updateDetailRole"
        @update-detail-active="updateDetailActive"
        @toggle-detail-assigned-job="handleDetailAssignedJobToggle"
        @update-detail-job-search-term="detailJobSearchTerm = $event"
      />
    </template>

    <UserConfirmDialogs
      :delete-busy="deleteLoading"
      :delete-message="deleteUserConfirmMessage"
      :delete-open="deleteConfirmOpen"
      @confirm-delete="confirmDeleteUser"
      @update-delete-open="deleteConfirmOpen = $event"
    />
  </DirectoryEditorWorkspaceShell>
</template>


