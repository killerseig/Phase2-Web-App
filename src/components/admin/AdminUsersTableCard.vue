<script setup lang="ts">
import { computed } from 'vue'
import AppAlert from '@/components/common/AppAlert.vue'
import BaseTable from '@/components/common/BaseTable.vue'
import InlineField from '@/components/common/InlineField.vue'
import InlineSelectMenu from '@/components/common/InlineSelectMenu.vue'
import RoleBadge from '@/components/common/RoleBadge.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import AdminCardWrapper from '@/components/admin/AdminCardWrapper.vue'
import type { Role } from '@/constants/app'
import type { UserProfile } from '@/services'

type Align = 'start' | 'center' | 'end'
type SortDir = 'asc' | 'desc'
type Column = { key: string; label: string; sortable?: boolean; width?: string; align?: Align; slot?: string }

interface UserEditForm {
  email: string
  firstName: string
  lastName: string
  role: Role
}

type UserTableRow = UserProfile & Record<string, unknown>

const props = defineProps<{
  users: UserProfile[]
  loading: boolean
  error: string
  editingUserId: string | null
  editForm: UserEditForm
  savingUserEdit: boolean
  activeUserActionsId: string
  roleOptions: readonly { value: Role; label: string }[]
  createForm: UserEditForm
  showInlineCreate: boolean
  creatingUser: boolean
  sortKey: string
  sortDir: SortDir
}>()

const emit = defineEmits<{
  'update:editForm': [value: UserEditForm]
  'update:createForm': [value: UserEditForm]
  'sort-change': [payload: { sortKey: string; sortDir: SortDir }]
  'save-edit': [user: UserProfile]
  'cancel-edit': []
  'toggle-actions': [user: UserProfile]
  'delete-user': [user: UserProfile]
  'toggle-create': []
  'submit-create': []
  'cancel-create': []
}>()

const userColumns: Column[] = [
  { key: 'email', label: 'Email', sortable: true, width: '32%' },
  { key: 'firstName', label: 'First Name', sortable: true, width: '20%' },
  { key: 'lastName', label: 'Last Name', sortable: true, width: '18%' },
  { key: 'role', label: 'Role', sortable: true, width: '10%', slot: 'role', align: 'center' },
  { key: 'status', label: 'Status', width: '10%', slot: 'status', align: 'center' },
  { key: 'actions', label: 'Actions', width: '10%', align: 'end', slot: 'actions' },
]

const tableUsers = computed<UserTableRow[]>(() => props.users as UserTableRow[])

function updateEditField<K extends keyof UserEditForm>(field: K, value: UserEditForm[K]) {
  emit('update:editForm', {
    ...props.editForm,
    [field]: value,
  })
}

function updateCreateField<K extends keyof UserEditForm>(field: K, value: UserEditForm[K]) {
  emit('update:createForm', {
    ...props.createForm,
    [field]: value,
  })
}

function asUser(row: unknown): UserProfile {
  return row as UserProfile
}

function handleCreateRowKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    emit('submit-create')
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    emit('cancel-create')
  }
}
</script>

<template>
  <AdminCardWrapper
    title="User Profiles"
    icon="person-circle"
    :loading="loading"
    :error="error"
  >
    <template #header-actions>
      <button
        type="button"
        class="btn btn-primary btn-sm"
        @click="emit('toggle-create')"
      >
        <i class="bi" :class="showInlineCreate ? 'bi-dash-lg' : 'bi-plus-lg'"></i>
        {{ showInlineCreate ? 'Cancel' : 'New User' }}
      </button>
    </template>

    <AppAlert
      v-if="users.length === 0 && !showInlineCreate"
      variant="info"
      class="text-center mb-0"
      message="No users yet. Create your first user above."
    />

    <BaseTable
      v-else
      :rows="tableUsers"
      :columns="userColumns"
      row-key="id"
      :sort-key="sortKey"
      :sort-dir="sortDir"
      table-class="admin-users-table"
      @sort-change="emit('sort-change', $event)"
    >
      <template #row-prepend>
        <tr v-if="showInlineCreate" class="admin-users-table__create-row">
          <td>
            <input
              class="form-control form-control-sm admin-users-table__field"
              type="email"
              :value="createForm.email"
              placeholder="user@example.com"
              autofocus
              @input="updateCreateField('email', ($event.target as HTMLInputElement).value)"
              @keydown="handleCreateRowKeydown"
            />
          </td>
          <td>
            <input
              class="form-control form-control-sm admin-users-table__field"
              type="text"
              :value="createForm.firstName"
              placeholder="First name"
              @input="updateCreateField('firstName', ($event.target as HTMLInputElement).value)"
              @keydown="handleCreateRowKeydown"
            />
          </td>
          <td>
            <input
              class="form-control form-control-sm admin-users-table__field"
              type="text"
              :value="createForm.lastName"
              placeholder="Last name"
              @input="updateCreateField('lastName', ($event.target as HTMLInputElement).value)"
              @keydown="handleCreateRowKeydown"
            />
          </td>
          <td class="text-center">
            <InlineSelectMenu
              :model-value="createForm.role"
              :options="roleOptions"
              button-class="form-select form-select-sm app-table-cell-input admin-users-table__field"
              placeholder="Select role"
              @update:model-value="updateCreateField('role', $event as Role)"
              @escape="emit('cancel-create')"
            />
          </td>
          <td class="text-center">
            <StatusBadge status="active" />
          </td>
          <td class="text-end">
            <div class="admin-users-table__create-actions">
              <button
                type="button"
                class="btn btn-sm btn-outline-secondary btn-icon admin-users-table__action-button"
                title="Cancel new user"
                :disabled="creatingUser"
                @click="emit('cancel-create')"
              >
                <i class="bi bi-x-lg"></i>
              </button>
              <button
                type="button"
                class="btn btn-sm btn-primary btn-icon admin-users-table__action-button"
                title="Create user"
                :disabled="creatingUser"
                @click="emit('submit-create')"
              >
                <span
                  v-if="creatingUser"
                  class="spinner-border spinner-border-sm"
                  role="status"
                  aria-hidden="true"
                ></span>
                <i v-else class="bi bi-check-lg"></i>
              </button>
            </div>
          </td>
        </tr>
      </template>

      <template #cell-email="{ row }">
        <InlineField
          :editing="editingUserId === asUser(row).id"
          :model-value="editForm.email"
          type="email"
          :disabled="true"
          @update:model-value="updateEditField('email', String($event))"
        >
          <span class="admin-users-table__email" :title="asUser(row).email ?? undefined">
            {{ asUser(row).email ?? '' }}
          </span>
        </InlineField>
      </template>

      <template #cell-firstName="{ row }">
        <InlineField
          :editing="editingUserId === asUser(row).id"
          :model-value="editForm.firstName"
          placeholder="First name"
          @update:model-value="updateEditField('firstName', String($event))"
          @enter="emit('save-edit', asUser(row))"
          @escape="emit('cancel-edit')"
        >
          <span class="admin-users-table__cell-text" :title="asUser(row).firstName ?? undefined">
            {{ asUser(row).firstName ?? '' }}
          </span>
        </InlineField>
      </template>

      <template #cell-lastName="{ row }">
        <InlineField
          :editing="editingUserId === asUser(row).id"
          :model-value="editForm.lastName"
          placeholder="Last name"
          @update:model-value="updateEditField('lastName', String($event))"
          @enter="emit('save-edit', asUser(row))"
          @escape="emit('cancel-edit')"
        >
          <span class="admin-users-table__cell-text" :title="asUser(row).lastName ?? undefined">
            {{ asUser(row).lastName ?? '' }}
          </span>
        </InlineField>
      </template>

      <template #role="{ row }">
        <InlineField
          :editing="editingUserId === asUser(row).id"
          :model-value="editForm.role"
          type="select"
          select-class="form-select form-select-sm app-table-cell-input admin-users-table__field"
          :options="roleOptions"
          @update:model-value="updateEditField('role', $event as Role)"
          @enter="emit('save-edit', asUser(row))"
          @escape="emit('cancel-edit')"
        >
          <RoleBadge :role="asUser(row).role" />
        </InlineField>
      </template>

      <template #status="{ row }">
        <StatusBadge :status="asUser(row).active ? 'active' : 'inactive'" />
      </template>

      <template #actions="{ row }">
        <div class="admin-users-table__row-actions">
          <button
            v-if="editingUserId !== asUser(row).id"
            type="button"
            class="btn btn-sm btn-outline-secondary btn-icon admin-users-table__action-button"
            title="Edit user"
            @click.stop="emit('toggle-actions', asUser(row))"
          >
            <i class="bi bi-pencil"></i>
          </button>

          <template v-else>
            <button
              type="button"
              class="btn btn-sm btn-outline-danger btn-icon admin-users-table__action-button"
              title="Delete user"
              :disabled="savingUserEdit"
              @click.stop="emit('delete-user', asUser(row))"
            >
              <i class="bi bi-trash text-danger"></i>
            </button>
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary btn-icon admin-users-table__action-button"
              title="Cancel edits"
              :disabled="savingUserEdit"
              @click.stop="emit('cancel-edit')"
            >
              <i class="bi bi-x-lg"></i>
            </button>
            <button
              type="button"
              class="btn btn-sm btn-primary btn-icon admin-users-table__action-button"
              title="Save user"
              :disabled="savingUserEdit"
              @click.stop="emit('save-edit', asUser(row))"
            >
              <span
                v-if="savingUserEdit"
                class="spinner-border spinner-border-sm"
                role="status"
                aria-hidden="true"
              ></span>
              <i v-else class="bi bi-check-lg"></i>
            </button>
          </template>
        </div>
      </template>
    </BaseTable>
  </AdminCardWrapper>
</template>
