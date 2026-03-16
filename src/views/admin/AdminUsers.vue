<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import AppPageHeader from '@/components/layout/AppPageHeader.vue'
import Toast from '@/components/Toast.vue'
import AdminCardWrapper from '@/components/admin/AdminCardWrapper.vue'
import StatusBadge from '@/components/admin/StatusBadge.vue'
import BaseAccordionCard from '@/components/common/BaseAccordionCard.vue'
import BaseTable from '@/components/common/BaseTable.vue'
import { useUsersStore } from '@/stores/users'
import { type UserProfile } from '@/services'
import { ROLES, type Role } from '@/constants/app'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { normalizeError } from '@/services/serviceUtils'
import { getFirstValidationMessage, validateCreateUserForm } from '@/utils/validation'

type Align = 'start' | 'center' | 'end'
type Column = { key: string; label: string; sortable?: boolean; width?: string; align?: Align; slot?: string }

type SortDir = 'asc' | 'desc'
type UserSortKey = 'email' | 'firstName' | 'lastName' | 'role'

const usersStore = useUsersStore()
const { confirm } = useConfirmDialog()
const toastRef = ref<InstanceType<typeof Toast> | null>(null)
const { users, loading: loadingUsers, error: usersError } = storeToRefs(usersStore)

const createUserForm = () => ({
  email: '',
  firstName: '',
  lastName: '',
  role: ROLES.NONE as Role,
})

const createUserEditForm = (user?: UserProfile) => ({
  email: user?.email || '',
  firstName: user?.firstName || '',
  lastName: user?.lastName || '',
  role: (user?.role || ROLES.NONE) as Role,
})

const showUserForm = ref(false)
const userForm = ref(createUserForm())
const creatingUser = ref(false)
const editingUserId = ref<string | null>(null)
const editUserForm = ref(createUserEditForm())
const editUserFormOriginal = ref(createUserEditForm())
const savingUserEdit = ref(false)
const activeUserActionsId = ref('')

const err = computed(() => usersError.value || '')

const userColumns: Column[] = [
  { key: 'email', label: 'Email', sortable: true },
  { key: 'firstName', label: 'First Name', sortable: true, width: '16%' },
  { key: 'lastName', label: 'Last Name', sortable: true, width: '16%' },
  { key: 'role', label: 'Role', sortable: true, width: '12%', slot: 'role' },
  { key: 'status', label: 'Status', width: '12%', slot: 'status' },
  { key: 'actions', label: 'Actions', width: '18%', align: 'end', slot: 'actions' },
]

const userSortKey = ref<UserSortKey>('email')
const userSortDir = ref<SortDir>('asc')

const sortedUsers = computed(() => {
  const key = userSortKey.value
  const dir = userSortDir.value === 'asc' ? 1 : -1
  const normalize = (val: unknown) => {
    if (val === undefined || val === null) return ''
    if (typeof val === 'string') return val.toLowerCase()
    return String(val).toLowerCase()
  }

  return [...users.value].sort((a, b) => {
    const aVal = normalize(a[key])
    const bVal = normalize(b[key])
    if (aVal === bVal) return 0
    return aVal > bVal ? dir : -dir
  })
})

function friendlyError(message: string) {
  if (message.toLowerCase().includes('missing or insufficient permissions')) {
    return 'Missing permissions. Admin user profile required.'
  }
  return message
}

function loadUsers() {
  usersStore.subscribeAllUsers()
}

async function submitUserForm() {
  const validation = validateCreateUserForm({
    email: userForm.value.email,
    firstName: userForm.value.firstName,
    lastName: userForm.value.lastName,
  })
  const validationMessage = getFirstValidationMessage(validation)
  if (validationMessage) {
    toastRef.value?.show(validationMessage, 'error')
    return
  }

  creatingUser.value = true
  try {
    await usersStore.createUser(
      userForm.value.email.trim(),
      userForm.value.firstName.trim(),
      userForm.value.lastName.trim(),
      userForm.value.role
    )
    toastRef.value?.show(`User created successfully. Welcome email sent to ${userForm.value.email}`, 'success')
    showUserForm.value = false
    resetUserForm()
    loadUsers()
  } catch (e) {
    const msg = normalizeError(e, 'Failed to create user')
    toastRef.value?.show(friendlyError(msg), 'error')
  } finally {
    creatingUser.value = false
  }
}

function handleEditUser(user: UserProfile) {
  editingUserId.value = user.id
  editUserForm.value = createUserEditForm(user)
  editUserFormOriginal.value = createUserEditForm(user)
}

function clearUserEdit() {
  editingUserId.value = null
  editUserForm.value = createUserEditForm()
  editUserFormOriginal.value = createUserEditForm()
}

function resetUserForm() {
  userForm.value = createUserForm()
}

function cancelUserForm() {
  resetUserForm()
  showUserForm.value = false
}

async function saveUserEdit(user: UserProfile, closeActions = false) {
  if (editingUserId.value !== user.id) return true
  if (!editUserForm.value.firstName.trim() || !editUserForm.value.lastName.trim()) {
    toastRef.value?.show('First name and last name are required', 'error')
    return false
  }

  savingUserEdit.value = true
  try {
    const updates: Partial<Pick<UserProfile, 'firstName' | 'lastName' | 'role'>> = {}
    if (editUserForm.value.firstName.trim() !== editUserFormOriginal.value.firstName) {
      updates.firstName = editUserForm.value.firstName.trim()
    }
    if (editUserForm.value.lastName.trim() !== editUserFormOriginal.value.lastName) {
      updates.lastName = editUserForm.value.lastName.trim()
    }
    if (editUserForm.value.role !== editUserFormOriginal.value.role) {
      updates.role = editUserForm.value.role
    }
    if (Object.keys(updates).length > 0) {
      await usersStore.updateUserProfile(user.id, updates)
      toastRef.value?.show('User updated', 'success')
    }
    clearUserEdit()
    if (closeActions) activeUserActionsId.value = ''
    return true
  } catch {
    toastRef.value?.show('Failed to update user', 'error')
    return false
  } finally {
    savingUserEdit.value = false
  }
}

function cancelUserEdit() {
  clearUserEdit()
  activeUserActionsId.value = ''
}

async function handleDeleteUser(user: UserProfile) {
  const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email
  const confirmed = await confirm(
    `Delete "${name}"? This cannot be undone and will also remove them from email recipient lists.`,
    {
      title: 'Delete User',
      confirmText: 'Delete',
      variant: 'danger',
    }
  )
  if (!confirmed) return

  try {
    const result = await usersStore.deleteUser(user.id)
    const jobCount = Number(result?.updatedJobCount || 0)
    const removed = !!result?.removedFromRecipientLists
    const cleanupMessage = removed
      ? ` and removed from recipient lists${jobCount > 0 ? ` (${jobCount} job list${jobCount === 1 ? '' : 's'} updated)` : ''}`
      : ''
    toastRef.value?.show(`User deleted${cleanupMessage}`, 'success')
    if (activeUserActionsId.value === user.id) {
      cancelUserEdit()
    }
  } catch {
    toastRef.value?.show('Failed to delete user', 'error')
  }
}

function handleUserSort({ sortKey, sortDir }: { sortKey: string; sortDir: SortDir }) {
  userSortKey.value = sortKey as UserSortKey
  userSortDir.value = sortDir
}

async function toggleUserActions(user: UserProfile) {
  const isOpen = activeUserActionsId.value === user.id
  if (isOpen) {
    const saved = await saveUserEdit(user, true)
    if (!saved) return
    return
  }

  cancelUserEdit()
  handleEditUser(user)
  activeUserActionsId.value = user.id
}

onMounted(() => {
  loadUsers()
})

onUnmounted(() => {
  usersStore.stopUsersSubscription()
})
</script>

<template>
  <Toast ref="toastRef" />
  <div class="app-page">
    <AppPageHeader eyebrow="Admin Panel" title="User Management" subtitle="Manage user profiles and permissions." />

    <div class="alert app-note small d-flex align-items-start gap-2" role="alert">
      <i class="bi bi-info-circle mt-1"></i>
      <div>
        Setting a user to <strong>None</strong> role or <strong>Inactive</strong> automatically removes their email from all recipient lists.
      </div>
    </div>

    <BaseAccordionCard
      v-model:open="showUserForm"
      title="Create User"
      subtitle="Add a new user account and set their role"
    >
      <form class="row g-3" @submit.prevent="submitUserForm">
        <div class="col-md-4">
          <label class="form-label small">Email</label>
          <input
            v-model="userForm.email"
            type="email"
            class="form-control"
            placeholder="user@example.com"
            required
          />
        </div>
        <div class="col-md-4">
          <label class="form-label small">First Name</label>
          <input
            v-model="userForm.firstName"
            type="text"
            class="form-control"
            placeholder="John"
            required
          />
        </div>
        <div class="col-md-4">
          <label class="form-label small">Last Name</label>
          <input
            v-model="userForm.lastName"
            type="text"
            class="form-control"
            placeholder="Doe"
            required
          />
        </div>
        <div class="col-md-4">
          <label class="form-label small">Role</label>
          <select v-model="userForm.role" class="form-select" required>
            <option :value="ROLES.NONE">None (No Access)</option>
            <option :value="ROLES.FOREMAN">Foreman</option>
            <option :value="ROLES.CONTROLLER">Controller</option>
            <option :value="ROLES.ADMIN">Admin</option>
          </select>
        </div>
        <div class="col-12 d-flex gap-2 justify-content-end pt-2">
          <button type="button" class="btn btn-outline-secondary" @click.stop="cancelUserForm" :disabled="creatingUser">
            Cancel
          </button>
          <button type="submit" class="btn btn-primary" :disabled="creatingUser">
            <span v-if="creatingUser" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            Create User
          </button>
        </div>
      </form>
    </BaseAccordionCard>

    <AdminCardWrapper
      title="User Profiles"
      icon="person-circle"
      :loading="loadingUsers"
      :error="err"
    >
      <div v-if="loadingUsers" class="text-center py-5">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
      </div>

      <div v-else-if="users.length === 0" class="alert alert-info text-center mb-0">
        No users yet. Create your first user above.
      </div>

      <div v-else>
        <BaseTable
          :rows="sortedUsers"
          :columns="userColumns"
          row-key="id"
          :sort-key="userSortKey"
          :sort-dir="userSortDir"
          @sort-change="handleUserSort"
        >
          <template #cell-email="{ row }">
            <template v-if="editingUserId === row.id">
              <input v-model="editUserForm.email" class="form-control form-control-sm" type="email" disabled />
            </template>
            <span v-else class="small">{{ row.email }}</span>
          </template>

          <template #cell-firstName="{ row }">
            <template v-if="editingUserId === row.id">
              <input
                v-model="editUserForm.firstName"
                class="form-control form-control-sm"
                placeholder="First name"
                @keydown.enter="saveUserEdit(row, true)"
                @keydown.esc="cancelUserEdit"
              />
            </template>
            <span v-else>{{ row.firstName }}</span>
          </template>

          <template #cell-lastName="{ row }">
            <template v-if="editingUserId === row.id">
              <input
                v-model="editUserForm.lastName"
                class="form-control form-control-sm"
                placeholder="Last name"
                @keydown.enter="saveUserEdit(row, true)"
                @keydown.esc="cancelUserEdit"
              />
            </template>
            <span v-else>{{ row.lastName }}</span>
          </template>

          <template #role="{ row }">
            <template v-if="editingUserId === row.id">
              <select
                v-model="editUserForm.role"
                class="form-select form-select-sm"
                @keydown.enter="saveUserEdit(row, true)"
                @keydown.esc="cancelUserEdit"
              >
                <option :value="ROLES.NONE">None</option>
                <option :value="ROLES.FOREMAN">Foreman</option>
                <option :value="ROLES.CONTROLLER">Controller</option>
                <option :value="ROLES.ADMIN">Admin</option>
              </select>
            </template>
            <span
              v-else
              class="badge app-badge-pill app-badge-pill--sm"
              :class="{
                'bg-secondary': row.role === ROLES.NONE,
                'bg-warning': row.role === ROLES.FOREMAN,
                'bg-primary': row.role === ROLES.CONTROLLER,
                'bg-danger': row.role === ROLES.ADMIN,
              }"
            >
              {{ row.role }}
            </span>
          </template>

          <template #status="{ row }">
            <StatusBadge :status="row.active ? 'active' : 'inactive'" />
          </template>

          <template #actions="{ row }">
            <div class="d-flex align-items-center justify-content-end gap-2 flex-nowrap">
              <div v-if="activeUserActionsId === row.id" class="btn-group btn-group-sm flex-nowrap" role="group">
                <button
                  @click.stop="handleDeleteUser(row)"
                  class="btn btn-outline-danger"
                  title="Delete user"
                >
                  <i class="bi bi-trash text-danger"></i>
                </button>
              </div>

              <button
                class="btn btn-sm btn-outline-secondary"
                @click.stop="toggleUserActions(row)"
                :aria-pressed="activeUserActionsId === row.id"
                :disabled="savingUserEdit && editingUserId === row.id"
                title="Toggle edit mode"
              >
                <i class="bi bi-pencil"></i>
              </button>
            </div>
          </template>
        </BaseTable>
      </div>
    </AdminCardWrapper>
  </div>
</template>
