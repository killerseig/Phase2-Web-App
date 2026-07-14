<script setup lang="ts">
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import AppBadge from '@/components/common/AppBadge.vue'
import AppButton from '@/components/common/AppButton.vue'
import AppCheckbox from '@/components/common/AppCheckbox.vue'
import AppField from '@/components/common/AppField.vue'
import AppLoadingButton from '@/components/common/AppLoadingButton.vue'
import AppSelect from '@/components/common/AppSelect.vue'
import AppStatusMessage from '@/components/common/AppStatusMessage.vue'
import AppTextInput from '@/components/common/AppTextInput.vue'
import UserAssignedJobsPanel from '@/components/users/UserAssignedJobsPanel.vue'
import {
  getAssignedJobsEmptyStateMessage,
  getRoleBadgeLabel,
  getUserDisplayName,
  type EditableUserRole,
  type UserCreateFormState,
  type UserCreateTextField,
  type UserDetailFormState,
  type UserDetailTextField,
} from '@/features/users/userViewHelpers'
import type { JobRecord, UserProfile } from '@/types/domain'
import { roleCanBeAssignedJobs } from '@/types/domain'

defineProps<{
  isCreateMode: boolean
  createForm: UserCreateFormState
  detailForm: UserDetailFormState
  selectedUser: UserProfile | null
  editingSelf: boolean
  createAction: 'queue' | 'send' | null
  saveLoading: boolean
  deleteLoading: boolean
  detailInfo: string
  createJobs: readonly JobRecord[]
  detailJobs: readonly JobRecord[]
  jobsLoading: boolean
  createJobSearchTerm: string
  detailJobSearchTerm: string
}>()

const emit = defineEmits<{
  createUser: [sendInvite: boolean]
  deleteUser: []
  detailSubmit: []
  updateCreateTextField: [field: UserCreateTextField, value: string]
  updateCreateRole: [value: EditableUserRole]
  toggleCreateAssignedJob: [jobId: string]
  updateCreateJobSearchTerm: [value: string]
  updateDetailTextField: [field: UserDetailTextField, value: string]
  updateDetailRole: [value: EditableUserRole]
  updateDetailActive: [value: boolean]
  toggleDetailAssignedJob: [jobId: string]
  updateDetailJobSearchTerm: [value: string]
}>()

function getRoleSelectValue(value: string): EditableUserRole {
  return value as EditableUserRole
}

function handleCreateTextInput(field: UserCreateTextField, value: string) {
  emit('updateCreateTextField', field, value)
}

function handleDetailTextInput(field: UserDetailTextField, value: string) {
  emit('updateDetailTextField', field, value)
}
</script>

<template>
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
            <AppField class="users-form__field" label="Email">
              <AppTextInput
                :model-value="createForm.email"
                type="email"
                autocomplete="email"
                placeholder="you@example.com"
                @update:model-value="handleCreateTextInput('email', $event)"
              />
            </AppField>
            <AppField class="users-form__field" label="Role">
              <AppSelect
                :model-value="createForm.role"
                @update:model-value="emit('updateCreateRole', getRoleSelectValue($event))"
              >
                <option value="foreman">Foreman</option>
                <option value="project-manager">Project Manager</option>
                <option value="admin">Admin</option>
              </AppSelect>
            </AppField>
            <AppField class="users-form__field" label="First Name">
              <AppTextInput
                :model-value="createForm.firstName"
                type="text"
                autocomplete="given-name"
                @update:model-value="handleCreateTextInput('firstName', $event)"
              />
            </AppField>
            <AppField class="users-form__field" label="Last Name">
              <AppTextInput
                :model-value="createForm.lastName"
                type="text"
                autocomplete="family-name"
                @update:model-value="handleCreateTextInput('lastName', $event)"
              />
            </AppField>
          </div>

          <div class="users-detail__actions">
            <AppLoadingButton
              label="Create User, Don't Send Invite"
              loading-label="Creating User..."
              :loading="createAction === 'queue'"
              :disabled="createAction !== null"
              type="button"
              @click="emit('createUser', false)"
            />
            <AppLoadingButton
              label="Create User & Send Invite"
              loading-label="Creating User..."
              variant="primary"
              :loading="createAction === 'send'"
              :disabled="createAction !== null"
              type="button"
              @click="emit('createUser', true)"
            />
          </div>

          <UserAssignedJobsPanel
            v-if="roleCanBeAssignedJobs(createForm.role)"
            :assigned-job-ids="createForm.assignedJobIds"
            :empty-message="getAssignedJobsEmptyStateMessage(createJobSearchTerm)"
            :jobs="createJobs"
            :jobs-loading="jobsLoading"
            :search-term="createJobSearchTerm"
            @toggle-job="emit('toggleCreateAssignedJob', $event)"
            @update:search-term="emit('updateCreateJobSearchTerm', $event)"
          />
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
            <AppBadge tone="accent">{{ getRoleBadgeLabel(selectedUser.role) }}</AppBadge>
            <AppBadge :tone="selectedUser.active ? 'success' : 'danger'">
              {{ selectedUser.active ? 'Active' : 'Inactive' }}
            </AppBadge>
          </div>
          <AppButton
            v-if="!editingSelf"
            class="users-detail__danger"
            variant="danger"
            :disabled="deleteLoading || saveLoading"
            @click="emit('deleteUser')"
          >
            {{ deleteLoading ? 'Deleting...' : 'Delete User' }}
          </AppButton>
        </div>
      </header>

      <div class="users-detail__body">
        <form class="users-form" @submit.prevent="emit('detailSubmit')">
          <div class="users-form__grid">
            <AppField class="users-form__field" label="Email">
              <AppTextInput :model-value="selectedUser.email || ''" type="email" readonly />
            </AppField>
            <AppField class="users-form__field" label="Role">
              <AppSelect
                :model-value="detailForm.role"
                :class="{ 'users-form__control--locked': editingSelf }"
                :disabled="saveLoading"
                :tabindex="editingSelf ? -1 : undefined"
                :aria-disabled="editingSelf ? 'true' : undefined"
                @update:model-value="emit('updateDetailRole', getRoleSelectValue($event))"
              >
                <option value="foreman">Foreman</option>
                <option value="project-manager">Project Manager</option>
                <option value="admin">Admin</option>
              </AppSelect>
            </AppField>
            <AppField class="users-form__field" label="First Name">
              <AppTextInput
                :model-value="detailForm.firstName"
                :disabled="saveLoading"
                type="text"
                autocomplete="given-name"
                @update:model-value="handleDetailTextInput('firstName', $event)"
              />
            </AppField>
            <AppField class="users-form__field" label="Last Name">
              <AppTextInput
                :model-value="detailForm.lastName"
                :disabled="saveLoading"
                type="text"
                autocomplete="family-name"
                @update:model-value="handleDetailTextInput('lastName', $event)"
              />
            </AppField>
          </div>

          <label :class="['users-toggle-row', { 'users-toggle-row--locked': editingSelf }]">
            <AppCheckbox
              :model-value="detailForm.active"
              :class="{ 'users-toggle-row__input--locked': editingSelf }"
              :disabled="saveLoading"
              :tabindex="editingSelf ? -1 : undefined"
              :aria-disabled="editingSelf ? 'true' : undefined"
              @update:model-value="emit('updateDetailActive', $event)"
            />
            <span>Active User</span>
          </label>

          <UserAssignedJobsPanel
            v-if="roleCanBeAssignedJobs(detailForm.role)"
            :assigned-job-ids="detailForm.assignedJobIds"
            :disabled="saveLoading"
            :empty-message="getAssignedJobsEmptyStateMessage(detailJobSearchTerm)"
            :jobs="detailJobs"
            :jobs-loading="jobsLoading"
            :search-term="detailJobSearchTerm"
            @toggle-job="emit('toggleDetailAssignedJob', $event)"
            @update:search-term="emit('updateDetailJobSearchTerm', $event)"
          />
        </form>

        <AppStatusMessage v-if="editingSelf" tone="warning">
          You are editing the currently signed-in account. Role, active state, and delete are locked to avoid accidental lockout.
        </AppStatusMessage>
        <AppStatusMessage
          v-if="saveLoading || detailInfo === 'All changes saved.' || detailInfo === 'Changes save automatically.'"
          :tone="!saveLoading && detailInfo === 'All changes saved.' ? 'success' : 'default'"
        >
          {{ saveLoading ? 'Saving changes...' : detailInfo || 'Changes save automatically.' }}
        </AppStatusMessage>
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
        <AppEmptyState
          class="users-browser__empty"
          message="Select a user to edit, or click New User to create one."
        />
      </div>
    </template>
  </section>
</template>

<style scoped>
.users-detail {
  grid-template-rows: auto minmax(0, 1fr);
}

.users-detail__body {
  display: grid;
  gap: 1rem;
  min-height: 0;
  overflow: auto;
  align-content: start;
  padding-right: 0.15rem;
}

.users-detail__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
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

.users-detail__title {
  margin: 0.35rem 0 0;
  font-size: 1.1rem;
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

.users-toggle-row span {
  font-size: 0.9rem;
}

.users-browser__empty {
  color: var(--text-muted);
}

.users-detail__status-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
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

.users-detail__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}

@media (max-width: 900px) {
  .users-detail,
  .users-detail__body {
    height: auto;
    min-height: 0;
    overflow: visible;
    padding-right: 0;
  }

  .users-detail__header-side,
  .users-detail__danger {
    width: 100%;
  }

  .users-detail__actions .app-button {
    width: 100%;
  }
}

@media (max-width: 720px) {
  .users-form__grid {
    grid-template-columns: 1fr;
  }

  .users-detail__header {
    flex-direction: column;
    align-items: flex-start;
  }

  .users-detail__header-side {
    width: 100%;
    justify-items: stretch;
  }
}
</style>
