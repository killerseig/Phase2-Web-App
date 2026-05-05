<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useToastMessages } from '@/composables/useToastMessages'
import AppShell from '@/layouts/AppShell.vue'
import { subscribeVisibleJobs } from '@/services/jobs'
import {
  createUserByAdmin,
  deleteUserByAdmin,
  getRoleBadgeLabel,
  sendPendingInvitesByAdmin,
  subscribeUsers,
  updateUser,
} from '@/services/users'
import { useAuthStore } from '@/stores/auth'
import type { JobRecord, RoleKey, UserProfile } from '@/types/domain'
import { toEffectiveRole } from '@/types/domain'
import { normalizeError } from '@/utils/normalizeError'

type MobileUsersPanel = 'directory' | 'editor'

const auth = useAuthStore()

const users = ref<UserProfile[]>([])
const jobs = ref<JobRecord[]>([])
const searchTerm = ref('')
const selectedUserId = ref<string | 'new' | null>(null)
const activeMobilePanel = ref<MobileUsersPanel>('directory')
const usersLoading = ref(true)
const jobsLoading = ref(true)
const usersError = ref('')
const createError = ref('')
const createInfo = ref('')
const detailError = ref('')
const detailInfo = ref('')
const createAction = ref<'queue' | 'send' | null>(null)
const saveLoading = ref(false)
const deleteLoading = ref(false)
const inviteLoading = ref(false)
const createJobSearchTerm = ref('')
const detailJobSearchTerm = ref('')
const syncingDetailForm = ref(false)
const inviteActionError = ref('')
const inviteActionInfo = ref('')

const createForm = reactive({
  email: '',
  firstName: '',
  lastName: '',
  role: 'foreman' as Exclude<RoleKey, 'none'>,
  assignedJobIds: [] as string[],
})

const detailForm = reactive({
  firstName: '',
  lastName: '',
  role: 'foreman' as Exclude<RoleKey, 'none'>,
  active: true,
  assignedJobIds: [] as string[],
})

let unsubscribeUsers: (() => void) | null = null
let unsubscribeJobs: (() => void) | null = null
let detailSaveTimer: number | null = null

const filteredUsers = computed(() => {
  const query = searchTerm.value.trim().toLowerCase()
  if (!query) return users.value

  return users.value.filter((user) => {
    const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim().toLowerCase()
    const email = (user.email ?? '').toLowerCase()
    const role = getRoleBadgeLabel(user.role).toLowerCase()
    return fullName.includes(query) || email.includes(query) || role.includes(query)
  })
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

  return activeJobs.value.filter((job) => matchesJobSearch(job, query))
})
const filteredDetailJobs = computed(() => {
  const query = detailJobSearchTerm.value.trim().toLowerCase()
  if (!query) return activeJobs.value

  return activeJobs.value.filter((job) => matchesJobSearch(job, query))
})
const pendingInviteUsers = computed(() =>
  users.value.filter((user) => user.inviteStatus === 'pending' && user.email && user.active),
)

const pendingInviteCount = computed(() => pendingInviteUsers.value.length)

const passiveUserDetailMessages = new Set([
  'Changes save automatically.',
  'Saving changes...',
  'All changes saved.',
])

useToastMessages([
  { source: usersError, severity: 'error', summary: 'Users' },
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

function resetCreateForm() {
  createForm.email = ''
  createForm.firstName = ''
  createForm.lastName = ''
  createForm.role = 'foreman'
  createForm.assignedJobIds = []
  createJobSearchTerm.value = ''
  createError.value = ''
  createInfo.value = ''
}

function getInviteStatusLabel(user: UserProfile) {
  if (user.inviteStatus === 'pending') return 'Invite Pending'
  if (user.inviteStatus === 'sent') return 'Invited'
  if (user.inviteStatus === 'accepted') return 'Setup Complete'
  return ''
}

function getInviteStatusClass(user: UserProfile) {
  if (user.inviteStatus === 'pending') return 'users-browser__status--pending'
  if (user.inviteStatus === 'accepted') return 'users-browser__status--accepted'
  return ''
}

async function applySelectedUserToForm(user: UserProfile | null) {
  clearDetailSaveTimer()
  syncingDetailForm.value = true
  if (!user) {
    detailForm.firstName = ''
    detailForm.lastName = ''
    detailForm.role = 'foreman'
    detailForm.active = true
    detailForm.assignedJobIds = []
  } else {
    detailForm.firstName = user.firstName ?? ''
    detailForm.lastName = user.lastName ?? ''
    detailForm.role = toEffectiveRole(user.role) === 'admin' ? 'admin' : 'foreman'
    detailForm.active = user.active
    detailForm.assignedJobIds = [...user.assignedJobIds]
  }
  await nextTick()
  syncingDetailForm.value = false
}

function toggleAssignedJob(target: string[], jobId: string) {
  if (target.includes(jobId)) {
    const index = target.indexOf(jobId)
    target.splice(index, 1)
    return
  }

  target.push(jobId)
}

function toggleCreateAssignedJob(jobId: string) {
  toggleAssignedJob(createForm.assignedJobIds, jobId)
}

function toggleDetailAssignedJob(jobId: string) {
  toggleAssignedJob(detailForm.assignedJobIds, jobId)

  if (syncingDetailForm.value || !selectedUser.value || isCreateMode.value) return

  void handleAutoSaveUser()
}

function getUserDisplayName(user: UserProfile) {
  const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()
  return fullName || user.email || 'Unnamed User'
}

function getJobCode(job: JobRecord) {
  return job.code?.trim() || 'No Number'
}

function getJobName(job: JobRecord) {
  return job.name.trim() || 'Untitled Job'
}

function matchesJobSearch(job: JobRecord, query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return true

  return (
    getJobName(job).toLowerCase().includes(normalizedQuery) ||
    getJobCode(job).toLowerCase().includes(normalizedQuery)
  )
}

function getJobsEmptyStateMessage(query: string) {
  return query.trim() ? 'No jobs match your search.' : 'No active jobs available.'
}

function normalizeAssignedJobIds(jobIds: string[]) {
  return Array.from(
    new Set(jobIds.filter((jobId) => typeof jobId === 'string' && jobId.trim().length > 0)),
  ).sort()
}

function getSelectedUserSnapshot(user: UserProfile | null) {
  if (!user) return null

  const role = toEffectiveRole(user.role) === 'admin' ? 'admin' : 'foreman'
  return {
    firstName: (user.firstName ?? '').trim(),
    lastName: (user.lastName ?? '').trim(),
    role,
    active: user.active,
    assignedJobIds: role === 'foreman' ? normalizeAssignedJobIds(user.assignedJobIds) : [],
  }
}

function getDetailFormSnapshot() {
  const role = detailForm.role === 'admin' ? 'admin' : 'foreman'
  return {
    firstName: detailForm.firstName.trim(),
    lastName: detailForm.lastName.trim(),
    role,
    active: detailForm.active,
    assignedJobIds: role === 'foreman' ? normalizeAssignedJobIds(detailForm.assignedJobIds) : [],
  }
}

function areDetailSnapshotsEqual(
  left: ReturnType<typeof getSelectedUserSnapshot>,
  right: ReturnType<typeof getDetailFormSnapshot> | null,
) {
  if (!left || !right) return false

  return (
    left.firstName === right.firstName &&
    left.lastName === right.lastName &&
    left.role === right.role &&
    left.active === right.active &&
    left.assignedJobIds.length === right.assignedJobIds.length &&
    left.assignedJobIds.every((jobId, index) => jobId === right.assignedJobIds[index])
  )
}

function hasUnsavedDetailChanges() {
  return !areDetailSnapshotsEqual(getSelectedUserSnapshot(selectedUser.value), getDetailFormSnapshot())
}

function clearDetailSaveTimer() {
  if (detailSaveTimer !== null) {
    window.clearTimeout(detailSaveTimer)
    detailSaveTimer = null
  }
}

function queueDetailSave(delay = 450) {
  if (isCreateMode.value || !selectedUser.value || syncingDetailForm.value) return

  clearDetailSaveTimer()

  if (!hasUnsavedDetailChanges()) {
    if (!detailError.value) {
      detailInfo.value = 'Changes save automatically.'
    }
    return
  }

  if (detailError.value) {
    detailError.value = ''
  }

  detailSaveTimer = window.setTimeout(() => {
    void handleAutoSaveUser()
  }, delay)
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

async function handleCreateUser(sendInvite: boolean) {
  createError.value = ''
  createInfo.value = ''

  if (!createForm.email.trim() || !createForm.firstName.trim() || !createForm.lastName.trim()) {
    createError.value = 'Enter the email, first name, and last name.'
    return
  }

  createAction.value = sendInvite ? 'send' : 'queue'
  try {
    const result = await createUserByAdmin({
      email: createForm.email,
      firstName: createForm.firstName,
      lastName: createForm.lastName,
      role: createForm.role,
      assignedJobIds: createForm.role === 'foreman' ? createForm.assignedJobIds : [],
      sendInvite,
    })

    createInfo.value = result.message || 'User created. Invite queued.'
    selectedUserId.value = result.uid
  } catch (error) {
    createError.value = normalizeError(error, 'Failed to create user.')
  } finally {
    createAction.value = null
  }
}

async function handleSendPendingInvites() {
  inviteActionError.value = ''
  inviteActionInfo.value = ''
  inviteLoading.value = true

  try {
    const result = await sendPendingInvitesByAdmin()
    inviteActionInfo.value = result.message || 'Pending invites sent.'
  } catch (error) {
    inviteActionError.value = normalizeError(error, 'Failed to send pending invites.')
  } finally {
    inviteLoading.value = false
  }
}

async function handleAutoSaveUser() {
  if (!selectedUser.value) return

  clearDetailSaveTimer()
  detailError.value = ''

  if (!hasUnsavedDetailChanges()) {
    detailInfo.value = 'Changes save automatically.'
    return
  }

  if (!detailForm.firstName.trim() || !detailForm.lastName.trim()) {
    detailError.value = 'Enter the first name and last name.'
    detailInfo.value = ''
    return
  }

  saveLoading.value = true
  detailInfo.value = 'Saving changes...'
  try {
    await updateUser(selectedUser.value.id, {
      firstName: detailForm.firstName,
      lastName: detailForm.lastName,
      role: detailForm.role,
      active: detailForm.active,
      assignedJobIds: detailForm.role === 'foreman' ? detailForm.assignedJobIds : [],
    })

    detailInfo.value = 'All changes saved.'
  } catch (error) {
    detailError.value = normalizeError(error, 'Failed to update user.')
    detailInfo.value = ''
  } finally {
    saveLoading.value = false
  }
}

async function handleDeleteUser() {
  if (!selectedUser.value || editingSelf.value) return

  const confirmed = window.confirm(`Delete ${getUserDisplayName(selectedUser.value)}? This removes the user from Auth and Firestore.`)
  if (!confirmed) return

  detailError.value = ''
  detailInfo.value = ''
  deleteLoading.value = true
  try {
    const result = await deleteUserByAdmin(selectedUser.value.id)
    detailInfo.value = result.message || 'User deleted.'
    selectedUserId.value = null
    resetCreateForm()
  } catch (error) {
    detailError.value = normalizeError(error, 'Failed to delete user.')
  } finally {
    deleteLoading.value = false
  }
}

watch(selectedUserId, (nextValue) => {
  clearDetailSaveTimer()
  detailError.value = ''
  detailInfo.value = nextValue && nextValue !== 'new' ? 'Changes save automatically.' : ''
  detailJobSearchTerm.value = ''
})

watch(selectedUser, (user) => {
  if (!user) {
    if (selectedUserId.value === 'new') {
      resetCreateForm()
    }
    void applySelectedUserToForm(null)
    return
  }

  void applySelectedUserToForm(user)
})

watch(
  () => createForm.role,
  (role) => {
    if (role === 'admin') {
      createForm.assignedJobIds = []
    }
  },
)

watch(
  () => detailForm.role,
  (role) => {
    if (role === 'admin') {
      detailForm.assignedJobIds = []
    }
  },
)

watch(
  () => JSON.stringify(getDetailFormSnapshot()),
  () => {
    queueDetailSave()
  },
)

onMounted(() => {
  usersLoading.value = true
  jobsLoading.value = true

  unsubscribeUsers = subscribeUsers(
    (nextUsers) => {
      users.value = nextUsers
      usersLoading.value = false

      if (
        selectedUserId.value
        && selectedUserId.value !== 'new'
        && !nextUsers.some((user) => user.id === selectedUserId.value)
      ) {
        selectedUserId.value = null
      }
    },
    (error) => {
      usersError.value = normalizeError(error, 'Failed to load users.')
      usersLoading.value = false
    },
  )

  unsubscribeJobs = subscribeVisibleJobs(
    undefined,
    (nextJobs) => {
      jobs.value = nextJobs
      jobsLoading.value = false
    },
    (error) => {
      usersError.value = normalizeError(error, 'Failed to load jobs.')
      jobsLoading.value = false
    },
  )
})

onBeforeUnmount(() => {
  clearDetailSaveTimer()
  unsubscribeUsers?.()
  unsubscribeJobs?.()
})
</script>

<template>
  <AppShell>
    <div
      class="users-workspace"
      :class="{
        'users-workspace--mobile-directory': activeMobilePanel === 'directory',
        'users-workspace--mobile-editor': activeMobilePanel === 'editor',
      }"
    >
      <div class="users-workspace__mobile-nav" role="tablist" aria-label="Users workspace">
        <button
          class="users-workspace__mobile-toggle"
          :class="{ 'users-workspace__mobile-toggle--active': activeMobilePanel === 'directory' }"
          type="button"
          role="tab"
          :aria-selected="activeMobilePanel === 'directory'"
          @click="showMobilePanel('directory')"
        >
          Users
        </button>
        <button
          class="users-workspace__mobile-toggle"
          :class="{ 'users-workspace__mobile-toggle--active': activeMobilePanel === 'editor' }"
          type="button"
          role="tab"
          :aria-selected="activeMobilePanel === 'editor'"
          @click="showMobilePanel('editor')"
        >
          Editor
        </button>
      </div>

      <section class="users-browser">
        <header class="users-browser__header">
          <div class="users-browser__header-copy">
            <span class="users-workspace__eyebrow">Admin</span>
            <h1 class="users-workspace__title">Users</h1>
          </div>
          <div class="users-browser__header-actions">
            <div class="users-browser__header-topline">
              <div
                :class="[
                  'users-browser__invite-summary',
                  { 'users-browser__invite-summary--empty': pendingInviteCount === 0 },
                ]"
              >
                <span class="users-browser__invite-label">Pending Invites</span>
                <strong class="users-browser__invite-count">{{ pendingInviteCount }}</strong>
              </div>
            </div>
            <div class="users-browser__header-buttons">
              <button class="app-button app-button--primary" type="button" @click="openCreateMode">
                New User
              </button>
              <button
                class="app-button"
                type="button"
                :disabled="inviteLoading || pendingInviteCount === 0"
                @click="handleSendPendingInvites"
              >
                {{ inviteLoading ? 'Sending...' : 'Send Invites' }}
              </button>
            </div>
          </div>
        </header>

        <div class="users-browser__body">
          <div class="users-browser__search">
            <input v-model="searchTerm" type="search" placeholder="Search users" />
          </div>

          <div class="users-browser__list">
            <div v-if="usersLoading" class="users-browser__empty">Loading users...</div>

            <button
              v-for="user in filteredUsers"
              v-else
              :key="user.id"
              type="button"
              class="users-browser__row"
              :class="{ 'users-browser__row--active': selectedUserId === user.id }"
              @click="selectUser(user.id)"
            >
              <div class="users-browser__row-main">
                <strong>{{ getUserDisplayName(user) }}</strong>
                <span>{{ user.email || 'No email' }}</span>
              </div>
              <div class="users-browser__row-meta">
                <span class="users-browser__badge">{{ getRoleBadgeLabel(user.role) }}</span>
                <span
                  v-if="getInviteStatusLabel(user)"
                  :class="['users-browser__status', getInviteStatusClass(user)]"
                >
                  {{ getInviteStatusLabel(user) }}
                </span>
                <span :class="['users-browser__status', { 'users-browser__status--inactive': !user.active }]">
                  {{ user.active ? 'Active' : 'Inactive' }}
                </span>
              </div>
            </button>

            <div v-if="!usersLoading && filteredUsers.length === 0" class="users-browser__empty">
              No users match your search.
            </div>
          </div>
        </div>
      </section>

      <section class="users-detail">
        <template v-if="isCreateMode">
          <header class="users-detail__header">
            <div>
              <span class="users-workspace__eyebrow">Invite</span>
              <h2 class="users-detail__title">Create User</h2>
            </div>
          </header>

          <div class="users-detail__body">
            <form class="users-form" @submit.prevent>
              <div class="users-form__grid">
                <label class="users-form__field">
                  <span>Email</span>
                  <input v-model="createForm.email" type="email" autocomplete="email" placeholder="you@example.com" />
                </label>
                <label class="users-form__field">
                  <span>Role</span>
                  <select v-model="createForm.role" class="app-select">
                    <option value="foreman">Foreman</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                <label class="users-form__field">
                  <span>First Name</span>
                  <input v-model="createForm.firstName" type="text" autocomplete="given-name" />
                </label>
                <label class="users-form__field">
                  <span>Last Name</span>
                  <input v-model="createForm.lastName" type="text" autocomplete="family-name" />
                </label>
              </div>

              <div class="users-detail__actions">
                <button
                  class="app-button"
                  :disabled="createAction !== null"
                  type="button"
                  @click="handleCreateUser(false)"
                >
                  {{ createAction === 'queue' ? `Creating User...` : `Create User, Don't Send Invite` }}
                </button>
                <button
                  class="app-button app-button--primary"
                  :disabled="createAction !== null"
                  type="button"
                  @click="handleCreateUser(true)"
                >
                  {{ createAction === 'send' ? 'Creating User...' : 'Create User & Send Invite' }}
                </button>
              </div>

              <section v-if="createForm.role === 'foreman'" class="users-jobs-panel">
                <div class="users-jobs-panel__header">
                  <strong>Assigned Jobs</strong>
                  <span>{{ createForm.assignedJobIds.length }} selected</span>
                </div>
                <div class="users-jobs-panel__search">
                  <input v-model="createJobSearchTerm" type="search" placeholder="Search jobs by name or number" />
                </div>
                <div v-if="jobsLoading" class="users-browser__empty">Loading jobs...</div>
                <div v-else-if="filteredCreateJobs.length" class="users-jobs-grid">
                  <label v-for="job in filteredCreateJobs" :key="job.id" class="users-job-toggle">
                    <input
                      :checked="createForm.assignedJobIds.includes(job.id)"
                      type="checkbox"
                      @change="toggleCreateAssignedJob(job.id)"
                    />
                    <span class="users-job-toggle__text">
                      <span class="users-job-toggle__name">{{ getJobName(job) }}</span>
                      <span class="users-job-toggle__code">{{ getJobCode(job) }}</span>
                    </span>
                  </label>
                </div>
                <div v-else class="users-browser__empty">
                  {{ getJobsEmptyStateMessage(createJobSearchTerm) }}
                </div>
              </section>
            </form>
          </div>
        </template>

        <template v-else-if="selectedUser">
          <header class="users-detail__header">
            <div>
              <span class="users-workspace__eyebrow">Selected User</span>
              <h2 class="users-detail__title">{{ getUserDisplayName(selectedUser) }}</h2>
            </div>
            <div class="users-detail__header-side">
              <div class="users-detail__status-group">
                <span class="users-browser__badge">{{ getRoleBadgeLabel(selectedUser.role) }}</span>
                <span :class="['users-browser__status', { 'users-browser__status--inactive': !selectedUser.active }]">
                  {{ selectedUser.active ? 'Active' : 'Inactive' }}
                </span>
              </div>
              <button
                v-if="!editingSelf"
                class="app-button users-detail__danger"
                :disabled="deleteLoading || saveLoading"
                type="button"
                @click="handleDeleteUser"
              >
                {{ deleteLoading ? 'Deleting...' : 'Delete User' }}
              </button>
            </div>
          </header>

          <div class="users-detail__body">
            <form class="users-form" @submit.prevent="handleAutoSaveUser">
              <div class="users-form__grid">
                <label class="users-form__field">
                  <span>Email</span>
                  <input :value="selectedUser.email || ''" type="email" readonly />
                </label>
                <label class="users-form__field">
                  <span>Role</span>
                  <select
                    v-model="detailForm.role"
                    :class="['app-select', { 'users-form__control--locked': editingSelf }]"
                    :disabled="saveLoading"
                    :tabindex="editingSelf ? -1 : undefined"
                    :aria-disabled="editingSelf ? 'true' : undefined"
                  >
                    <option value="foreman">Foreman</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                <label class="users-form__field">
                  <span>First Name</span>
                  <input v-model="detailForm.firstName" :disabled="saveLoading" type="text" autocomplete="given-name" />
                </label>
                <label class="users-form__field">
                  <span>Last Name</span>
                  <input v-model="detailForm.lastName" :disabled="saveLoading" type="text" autocomplete="family-name" />
                </label>
              </div>

              <label :class="['users-toggle-row', { 'users-toggle-row--locked': editingSelf }]">
                <input
                  v-model="detailForm.active"
                  :class="{ 'users-toggle-row__input--locked': editingSelf }"
                  type="checkbox"
                  :disabled="saveLoading"
                  :tabindex="editingSelf ? -1 : undefined"
                  :aria-disabled="editingSelf ? 'true' : undefined"
                />
                <span>Active User</span>
              </label>

              <section v-if="detailForm.role === 'foreman'" class="users-jobs-panel">
                <div class="users-jobs-panel__header">
                  <strong>Assigned Jobs</strong>
                  <span>{{ detailForm.assignedJobIds.length }} selected</span>
                </div>
                <div class="users-jobs-panel__search">
                  <input v-model="detailJobSearchTerm" type="search" placeholder="Search jobs by name or number" />
                </div>
                <div v-if="jobsLoading" class="users-browser__empty">Loading jobs...</div>
                <div v-else-if="filteredDetailJobs.length" class="users-jobs-grid">
                  <label v-for="job in filteredDetailJobs" :key="job.id" class="users-job-toggle">
                    <input
                      :checked="detailForm.assignedJobIds.includes(job.id)"
                      :disabled="saveLoading"
                      type="checkbox"
                      @change="toggleDetailAssignedJob(job.id)"
                    />
                    <span class="users-job-toggle__text">
                      <span class="users-job-toggle__name">{{ getJobName(job) }}</span>
                      <span class="users-job-toggle__code">{{ getJobCode(job) }}</span>
                    </span>
                  </label>
                </div>
                <div v-else class="users-browser__empty">
                  {{ getJobsEmptyStateMessage(detailJobSearchTerm) }}
                </div>
              </section>
            </form>

            <div v-if="editingSelf" class="users-workspace__note">
              You are editing the currently signed-in account. Role, active state, and delete are locked to avoid accidental lockout.
            </div>
            <div
              v-if="saveLoading || detailInfo === 'All changes saved.' || detailInfo === 'Changes save automatically.'"
              :class="[
                'users-workspace__note',
                { 'users-workspace__note--success': detailInfo === 'All changes saved.' },
              ]"
            >
              {{ saveLoading ? 'Saving changes...' : detailInfo || 'Changes save automatically.' }}
            </div>
          </div>
        </template>

        <template v-else>
          <header class="users-detail__header">
            <div>
              <span class="users-workspace__eyebrow">Selected User</span>
              <h2 class="users-detail__title">No User Selected</h2>
            </div>
          </header>

          <div class="users-detail__body">
            <div class="users-browser__empty">
              Select a user to edit, or click New User to create one.
            </div>
          </div>
        </template>
      </section>
    </div>
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

.users-detail {
  grid-template-rows: auto minmax(0, 1fr);
}

.users-browser__body {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: 1rem;
  min-height: 0;
}

.users-detail__body {
  display: grid;
  gap: 1rem;
  min-height: 0;
  overflow: auto;
  align-content: start;
  padding-right: 0.15rem;
}

.users-browser__header,
.users-detail__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.users-browser__header-actions {
  display: grid;
  justify-items: end;
  gap: 0.35rem;
  min-width: 0;
}

.users-browser__header-copy {
  min-width: 0;
}

.users-browser__header-topline {
  display: flex;
  justify-content: flex-end;
  width: 100%;
}

.users-browser__header-buttons {
  display: flex;
  flex-wrap: nowrap;
  justify-content: flex-end;
  gap: 0.45rem;
  width: 100%;
}

.users-browser__header-buttons .app-button {
  min-width: 0;
  flex: 1 1 0;
  white-space: nowrap;
}

.users-browser__invite-summary {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 1.9rem;
  padding: 0 0.7rem;
  border: 1px solid rgba(88, 186, 233, 0.18);
  border-radius: 999px;
  background: rgba(38, 74, 96, 0.18);
  color: var(--text-muted);
}

.users-browser__invite-summary--empty {
  border-color: var(--border);
  background: rgba(255, 255, 255, 0.035);
}

.users-browser__invite-label {
  font-size: 0.68rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.users-browser__invite-count {
  color: var(--text);
  font-size: 0.9rem;
  font-weight: 700;
  line-height: 1;
}

.users-workspace__mobile-nav {
  display: none;
}

.users-workspace__mobile-nav {
  gap: 0.7rem;
}

.users-workspace__mobile-toggle {
  min-height: 2.45rem;
  padding: 0 1rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-muted);
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    color 0.2s ease;
}

.users-workspace__mobile-toggle--active {
  border-color: rgba(88, 186, 233, 0.28);
  background:
    linear-gradient(180deg, rgba(49, 83, 105, 0.35), rgba(33, 49, 62, 0.28)),
    rgba(255, 255, 255, 0.04);
  color: var(--text);
}

.users-detail__header-side {
  display: grid;
  justify-items: end;
  gap: 0.7rem;
}

.users-workspace__eyebrow {
  color: var(--accent-strong);
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.users-workspace__title,
.users-detail__title {
  margin: 0.35rem 0 0;
  font-size: 1.1rem;
}

.users-browser__search input,
.users-jobs-panel__search input,
.users-form__field input {
  width: 100%;
  min-height: 2.8rem;
  padding: 0 0.9rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.045);
  color: var(--text);
}

.users-form__field .app-select {
  --app-select-min-height: 2.8rem;
  --app-select-padding-x: 0.9rem;
  --app-select-background: rgba(255, 255, 255, 0.045);
}

.users-form__field .app-select:disabled {
  opacity: 1;
}

.users-form__control--locked {
  pointer-events: none;
}

.users-browser__list {
  display: grid;
  gap: 0.55rem;
  align-content: start;
  min-height: 0;
  overflow: auto;
  padding-right: 0.15rem;
}

.users-browser__row {
  display: grid;
  gap: 0.7rem;
  width: 100%;
  padding: 0.9rem;
  border: 1px solid var(--border);
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.035);
  color: var(--text);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    transform 0.2s ease;
}

.users-browser__row:hover,
.users-browser__row--active {
  border-color: rgba(88, 186, 233, 0.28);
  background:
    linear-gradient(180deg, rgba(49, 83, 105, 0.35), rgba(33, 49, 62, 0.28)),
    rgba(255, 255, 255, 0.04);
  transform: translateY(-1px);
}

.users-browser__row-main {
  display: grid;
  gap: 0.2rem;
}

.users-browser__row-main span,
.users-jobs-panel__header span,
.users-browser__empty {
  color: var(--text-muted);
}

.users-browser__row-meta,
.users-detail__status-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.users-browser__badge,
.users-browser__status {
  display: inline-flex;
  align-items: center;
  min-height: 1.85rem;
  padding: 0 0.6rem;
  border-radius: 999px;
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.users-browser__badge {
  border: 1px solid rgba(88, 186, 233, 0.22);
  background: rgba(38, 74, 96, 0.28);
  color: var(--accent);
}

.users-browser__status {
  border: 1px solid rgba(103, 213, 157, 0.2);
  background: rgba(50, 92, 72, 0.22);
  color: var(--success);
}

.users-browser__status--inactive {
  border-color: rgba(255, 125, 107, 0.2);
  background: rgba(104, 52, 45, 0.22);
  color: var(--danger);
}

.users-browser__status--pending {
  border-color: rgba(235, 194, 90, 0.22);
  background: rgba(107, 88, 31, 0.22);
  color: #f2d889;
}

.users-browser__status--accepted {
  border-color: rgba(88, 186, 233, 0.24);
  background: rgba(38, 74, 96, 0.28);
  color: var(--accent);
}

.users-form {
  display: grid;
  gap: 1rem;
  align-content: start;
}

.users-form__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
}

.users-form__field {
  display: grid;
  gap: 0.45rem;
  color: var(--text-muted);
}

.users-form__field span,
.users-toggle-row span {
  font-size: 0.9rem;
}

.users-toggle-row {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  color: var(--text-muted);
}

.users-toggle-row--locked {
  cursor: default;
}

.users-jobs-panel {
  display: grid;
  gap: 0.85rem;
  min-height: 0;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.03);
}

.users-jobs-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.users-jobs-panel__search {
  display: grid;
}

.users-jobs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.6rem;
}

.users-detail__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}

.users-job-toggle {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 0.65rem;
  min-height: 5.6rem;
  padding: 0.75rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.035);
  color: var(--text-muted);
}

.users-job-toggle input,
.users-toggle-row input {
  margin-top: 0.2rem;
  accent-color: var(--accent-strong);
}

.users-toggle-row input:disabled {
  opacity: 1;
}

.users-toggle-row__input--locked {
  pointer-events: none;
}

.users-job-toggle__text {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}

.users-job-toggle__name {
  color: var(--text);
  line-height: 1.35;
  word-break: break-word;
}

.users-job-toggle__code {
  color: var(--text-soft);
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.users-detail__danger {
  border-color: rgba(255, 125, 107, 0.24);
  color: var(--danger);
}

.users-workspace__note {
  padding: 0.95rem 1rem;
  border: 1px dashed var(--border);
  border-radius: 12px;
  color: var(--text-muted);
}

.users-workspace__note--error {
  border-color: rgba(255, 125, 107, 0.24);
  color: var(--danger);
}

.users-workspace__note--success {
  border-color: rgba(103, 213, 157, 0.24);
  color: var(--success);
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

  .users-workspace__mobile-nav {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .users-workspace--mobile-directory .users-detail {
    display: none;
  }

  .users-workspace--mobile-editor .users-browser {
    display: none;
  }

  .users-browser,
  .users-detail,
  .users-browser__body,
  .users-detail__body,
  .users-browser__list {
    height: auto;
    min-height: 0;
    overflow: visible;
    padding-right: 0;
  }

  .users-browser {
    max-height: none;
  }

  .users-detail__header-side,
  .users-detail__danger {
    width: 100%;
  }

  .users-browser__header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    gap: 0.75rem;
  }

  .users-browser__header-actions {
    width: auto;
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-items: center;
    gap: 0.45rem;
  }

  .users-browser__header-topline {
    display: contents;
  }

  .users-browser__invite-summary {
    width: auto;
    justify-content: flex-start;
    white-space: nowrap;
  }

  .users-browser__header-buttons {
    width: auto;
    justify-content: flex-end;
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
  }

  .users-browser__header-buttons .app-button {
    width: auto;
    flex: 0 0 auto;
  }

  .users-detail__actions .app-button {
    width: 100%;
  }
}

@media (max-width: 720px) {
  .users-form__grid,
  .users-jobs-grid {
    grid-template-columns: 1fr;
  }

  .users-detail__header,
  .users-jobs-panel__header {
    flex-direction: column;
    align-items: flex-start;
  }

  .users-detail__header-side {
    width: 100%;
    justify-items: stretch;
  }
}

@media (max-width: 560px) {
  .users-browser__header {
    grid-template-columns: 1fr;
  }

  .users-browser__header-actions {
    width: 100%;
    justify-content: stretch;
  }

  .users-browser__header-topline {
    display: flex;
    width: 100%;
  }

  .users-browser__invite-summary {
    width: auto;
    max-width: 100%;
    justify-content: flex-start;
  }

  .users-browser__header-buttons {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .users-browser__header-buttons .app-button {
    width: 100%;
  }
}
</style>

