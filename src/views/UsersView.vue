<script setup lang="ts">
import { computed, ref } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import AppMobilePanelTabs from '@/components/common/AppMobilePanelTabs.vue'
import UserDirectoryPanel from '@/components/users/UserDirectoryPanel.vue'
import UserEditorPanel from '@/components/users/UserEditorPanel.vue'
import { usePageMessages } from '@/composables/usePageMessages'
import { useToastMessages } from '@/composables/useToastMessages'
import {
  getRoleBadgeLabel,
  getUserDisplayName,
  matchesAssignedJobSearch,
} from '@/features/users/userViewHelpers'
import { useUserAdminViewSync } from '@/features/users/useUserAdminViewSync'
import { useUserAdminRecords } from '@/features/users/useUserAdminRecords'
import { useUserCreateActions } from '@/features/users/useUserCreateActions'
import { useUserDetailActions } from '@/features/users/useUserDetailActions'
import { useUserFormState } from '@/features/users/useUserFormState'
import AppShell from '@/layouts/AppShell.vue'
import { useAuthStore } from '@/stores/auth'
import type { UserProfile } from '@/types/domain'
import { filterDirectoryRecords, type DirectoryStatusFilter } from '@/utils/directoryFilters'

type MobileUsersPanel = 'directory' | 'editor'

const mobilePanelTabs = [
  { key: 'directory', label: 'Users' },
  { key: 'editor', label: 'Editor' },
] as const

const auth = useAuthStore()

const searchTerm = ref('')
const statusFilter = ref<DirectoryStatusFilter>('active')
const selectedUserId = ref<string | 'new' | null>(null)
const activeMobilePanel = ref<MobileUsersPanel>('directory')
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

const filteredUsers = computed(() => {
  return filterDirectoryRecords(users.value, statusFilter.value, searchTerm.value, (user) => [
    `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
    user.email,
    getRoleBadgeLabel(user.role),
  ])
})

const selectedUser = computed(() =>
  users.value.find((user) => user.id === selectedUserId.value) ?? null,
)

const isCreateMode = computed(() => selectedUserId.value === 'new')
const activeJobs = computed(() => jobs.value.filter((job) => job.active))
const editingSelf = computed(() => selectedUser.value?.id === auth.currentUser?.uid)
const filteredCreateJobs = computed(() => {
  const query = createJobSearchTerm.value.trim().toLowerCase()
  if (!query) return activeJobs.value

  return activeJobs.value.filter((job) => matchesAssignedJobSearch(job, query))
})
const filteredDetailJobs = computed(() => {
  const query = detailJobSearchTerm.value.trim().toLowerCase()
  if (!query) return activeJobs.value

  return activeJobs.value.filter((job) => matchesAssignedJobSearch(job, query))
})
const pendingInviteUsers = computed(() =>
  users.value.filter((user) => user.inviteStatus === 'pending' && user.email && user.active),
)

const pendingInviteCount = computed(() => pendingInviteUsers.value.length)
const deleteUserConfirmMessage = computed(() => (
  selectedUser.value
    ? `Delete ${getUserDisplayName(selectedUser.value)}? This removes the user from Auth and Firestore.`
    : ''
))

const passiveUserDetailMessages = new Set([
  'Changes save automatically.',
  'Saving changes...',
  'All changes saved.',
])

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
    when: (message) => !passiveUserDetailMessages.has(message),
  },
])

const {
  applyUserToDetailForm,
  createForm,
  createJobSearchTerm,
  detailForm,
  detailJobSearchTerm,
  getDetailFormSnapshot,
  hasUnsavedDetailChanges: hasUnsavedDetailChangesForUser,
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
})

async function applySelectedUserToForm(user: UserProfile | null) {
  clearDetailSaveTimer()
  await applyUserToDetailForm(user)
}

function toggleDetailAssignedJob(jobId: string) {
  toggleDetailAssignedJobSelection(jobId)

  if (syncingDetailForm.value || !selectedUser.value || isCreateMode.value) return

  void handleAutoSaveUser()
}

function hasUnsavedDetailChanges() {
  return hasUnsavedDetailChangesForUser(selectedUser.value)
}

function openCreateMode() {
  selectedUserId.value = 'new'
  activeMobilePanel.value = 'editor'
  resetCreateForm()
}

function selectUser(userId: string) {
  selectedUserId.value = userId
  activeMobilePanel.value = 'editor'
}

function showMobilePanel(panel: MobileUsersPanel) {
  activeMobilePanel.value = panel
}

useUserAdminViewSync({
  applySelectedUserToForm,
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
  <AppShell>
    <div
      class="users-workspace"
      data-testid="users-page"
      :class="{
        'users-workspace--mobile-directory': activeMobilePanel === 'directory',
        'users-workspace--mobile-editor': activeMobilePanel === 'editor',
      }"
    >
      <AppMobilePanelTabs
        label="Users workspace"
        :active-panel="activeMobilePanel"
        :panels="mobilePanelTabs"
        @show="(panel) => showMobilePanel(panel as MobileUsersPanel)"
      />

      <UserDirectoryPanel
        v-model:search-term="searchTerm"
        v-model:status-filter="statusFilter"
        :users="filteredUsers"
        :users-loading="usersLoading"
        :selected-user-id="selectedUserId === 'new' ? null : selectedUserId"
        :pending-invite-count="pendingInviteCount"
        :invite-loading="inviteLoading"
        @create-user="openCreateMode"
        @select-user="selectUser"
        @send-invites="handleSendPendingInvites"
      />

      <UserEditorPanel
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
        @toggle-detail-assigned-job="toggleDetailAssignedJob"
        @update-detail-job-search-term="detailJobSearchTerm = $event"
      />
    </div>

    <ConfirmDialog
      :open="deleteConfirmOpen"
      title="Delete user?"
      :message="deleteUserConfirmMessage"
      confirm-label="Delete User"
      destructive
      :busy="deleteLoading"
      @update:open="deleteConfirmOpen = $event"
      @confirm="confirmDeleteUser"
    />
  </AppShell>
</template>

<style scoped>
.users-workspace {
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  gap: 1rem;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.users-browser,
.users-detail {
  display: grid;
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

.users-browser {
  grid-template-rows: auto minmax(0, 1fr);
}

@media (max-width: 1180px) {
  .users-workspace {
    grid-template-columns: 1fr;
  }

  .users-browser {
    max-height: 26rem;
  }
}

@media (max-width: 900px) {
  .users-workspace {
    height: auto;
    overflow: visible;
  }

  .users-workspace--mobile-directory .users-detail {
    display: none;
  }

  .users-workspace--mobile-editor .users-browser {
    display: none;
  }

  .users-browser,
  .users-detail {
    height: auto;
    min-height: 0;
    overflow: visible;
  }

  .users-browser {
    max-height: none;
  }
}

</style>

