<script setup lang="ts">
import { computed } from 'vue'
import ActionToggleGroup from '@/components/common/ActionToggleGroup.vue'
import AppAlert from '@/components/common/AppAlert.vue'
import BaseTable from '@/components/common/BaseTable.vue'
import InlineField from '@/components/common/InlineField.vue'
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
  sortKey: string
  sortDir: SortDir
}>()

const emit = defineEmits<{
  'update:editForm': [value: UserEditForm]
  'sort-change': [payload: { sortKey: string; sortDir: SortDir }]
  'save-edit': [user: UserProfile]
  'cancel-edit': []
  'toggle-actions': [user: UserProfile]
  'delete-user': [user: UserProfile]
}>()

const userColumns: Column[] = [
  { key: 'email', label: 'Email', sortable: true },
  { key: 'firstName', label: 'First Name', sortable: true, width: '16%' },
  { key: 'lastName', label: 'Last Name', sortable: true, width: '16%' },
  { key: 'role', label: 'Role', sortable: true, width: '12%', slot: 'role' },
  { key: 'status', label: 'Status', width: '12%', slot: 'status' },
  { key: 'actions', label: 'Actions', width: '18%', align: 'end', slot: 'actions' },
]

const tableUsers = computed<UserTableRow[]>(() => props.users as UserTableRow[])

function updateEditField<K extends keyof UserEditForm>(field: K, value: UserEditForm[K]) {
  emit('update:editForm', {
    ...props.editForm,
    [field]: value,
  })
}

function asUser(row: unknown): UserProfile {
  return row as UserProfile
}
</script>

<template>
  <AdminCardWrapper
    title="User Profiles"
    icon="person-circle"
    :loading="loading"
    :error="error"
  >
    <AppAlert
      v-if="users.length === 0"
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
      @sort-change="emit('sort-change', $event)"
    >
      <template #cell-email="{ row }">
        <InlineField
          :editing="editingUserId === asUser(row).id"
          :model-value="editForm.email"
          type="email"
          :disabled="true"
          @update:model-value="updateEditField('email', String($event))"
        >
          <span class="small">{{ asUser(row).email }}</span>
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
          <span>{{ asUser(row).firstName }}</span>
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
          <span>{{ asUser(row).lastName }}</span>
        </InlineField>
      </template>

      <template #role="{ row }">
        <InlineField
          :editing="editingUserId === asUser(row).id"
          :model-value="editForm.role"
          type="select"
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
        <ActionToggleGroup
          :open="activeUserActionsId === asUser(row).id"
          :toggle-disabled="savingUserEdit && editingUserId === asUser(row).id"
          @toggle="emit('toggle-actions', asUser(row))"
        >
          <button
            class="btn btn-outline-danger"
            title="Delete user"
            @click.stop="emit('delete-user', asUser(row))"
          >
            <i class="bi bi-trash text-danger"></i>
          </button>
        </ActionToggleGroup>
      </template>
    </BaseTable>
  </AdminCardWrapper>
</template>
