<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import AppAlert from '@/components/common/AppAlert.vue'
import AdminUsersCreateCard from '@/components/admin/AdminUsersCreateCard.vue'
import AdminUsersTableCard from '@/components/admin/AdminUsersTableCard.vue'
import AppPageHeader from '@/components/layout/AppPageHeader.vue'
import { useUsersStore } from '@/stores/users'
import { type UserProfile } from '@/services'
import { ROLES, type Role } from '@/constants/app'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useToast } from '@/composables/useToast'
import { normalizeError } from '@/services/serviceUtils'
import { getFirstValidationMessage, validateCreateUserForm } from '@/utils/validation'

type SortDir = 'asc' | 'desc'
type UserSortKey = 'email' | 'firstName' | 'lastName' | 'role'

const usersStore = useUsersStore()
const { confirm } = useConfirmDialog()
const toast = useToast()
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

const userSortKey = ref<UserSortKey>('email')
const userSortDir = ref<SortDir>('asc')
const userRoleOptions = [
  { value: ROLES.NONE, label: 'None (No Access)' },
  { value: ROLES.FOREMAN, label: 'Foreman' },
  { value: ROLES.CONTROLLER, label: 'Controller' },
  { value: ROLES.ADMIN, label: 'Admin' },
] as const

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
    toast.show(validationMessage, 'error')
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
    toast.show(`User created successfully. Welcome email sent to ${userForm.value.email}`, 'success')
    showUserForm.value = false
    resetUserForm()
    loadUsers()
  } catch (e) {
    const msg = normalizeError(e, 'Failed to create user')
    toast.show(friendlyError(msg), 'error')
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
    toast.show('First name and last name are required', 'error')
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
      toast.show('User updated', 'success')
    }
    clearUserEdit()
    if (closeActions) activeUserActionsId.value = ''
    return true
  } catch {
    toast.show('Failed to update user', 'error')
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
    toast.show(`User deleted${cleanupMessage}`, 'success')
    if (activeUserActionsId.value === user.id) {
      cancelUserEdit()
    }
  } catch {
    toast.show('Failed to delete user', 'error')
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
  
  <div class="app-page">
    <AppPageHeader eyebrow="Admin Panel" title="User Management" subtitle="Manage user profiles and permissions." />

    <AppAlert
      class="app-note small"
      icon="bi bi-info-circle"
      icon-class="mt-1"
    >
      Setting a user to <strong>None</strong> role or <strong>Inactive</strong> automatically removes their email from all recipient lists.
    </AppAlert>

    <AdminUsersCreateCard
      v-model:open="showUserForm"
      :form="userForm"
      :loading="creatingUser"
      :role-options="userRoleOptions"
      @update:form="userForm = $event"
      @submit="submitUserForm"
      @cancel="cancelUserForm"
    />

    <AdminUsersTableCard
      :users="sortedUsers"
      :loading="loadingUsers"
      :error="err"
      :editing-user-id="editingUserId"
      :edit-form="editUserForm"
      :saving-user-edit="savingUserEdit"
      :active-user-actions-id="activeUserActionsId"
      :role-options="userRoleOptions"
      :sort-key="userSortKey"
      :sort-dir="userSortDir"
      @update:edit-form="editUserForm = $event"
      @sort-change="handleUserSort"
      @save-edit="saveUserEdit($event, true)"
      @cancel-edit="cancelUserEdit"
      @toggle-actions="toggleUserActions"
      @delete-user="handleDeleteUser"
    />
  </div>
</template>
