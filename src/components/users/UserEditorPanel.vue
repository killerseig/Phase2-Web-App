<script setup lang="ts">
import {
  currentRoleCanBeAssignedJobs,
  EDITABLE_USER_ROLE_OPTIONS,
  isEditableUserRole,
} from '@/auth/roles'
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import AppBadge from '@/components/common/AppBadge.vue'
import AppCheckbox from '@/components/common/AppCheckbox.vue'
import AppField from '@/components/common/AppField.vue'
import AppLoadingButton from '@/components/common/AppLoadingButton.vue'
import AppPane from '@/components/common/AppPane.vue'
import AppPaneHeader from '@/components/common/AppPaneHeader.vue'
import AppSelect from '@/components/common/AppSelect.vue'
import AppStatusMessage from '@/components/common/AppStatusMessage.vue'
import AppTextInput from '@/components/common/AppTextInput.vue'
import SaveStatusIndicator from '@/components/common/SaveStatusIndicator.vue'
import UserAssignedJobsPanel from '@/components/users/UserAssignedJobsPanel.vue'
import {
  getAssignedJobsEmptyStateMessage,
  getRoleBadgeLabel,
  getUserDisplayName,
  shouldShowUserDetailAssignedJobs,
  type EditableUserRole,
  type UserCreateFormState,
  type UserCreateTextField,
  type UserDetailFormState,
  type UserDetailTextField,
} from '@/features/users/userViewHelpers'
import type { JobRecord, UserProfile } from '@/types/domain'

defineProps<{
  isCreateMode: boolean
  createForm: UserCreateFormState
  detailForm: UserDetailFormState
  selectedUser: UserProfile | null
  editingSelf: boolean
  createAction: 'queue' | 'send' | null
  emailAction: 'invite' | 'reset' | null
  saveLoading: boolean
  deleteLoading: boolean
  deleteConfirmOpen: boolean
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
  resendInvite: []
  sendPasswordReset: []
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
  <AppPane class="users-detail">
    <template v-if="isCreateMode">
      <AppPaneHeader eyebrow="Invite" title="Create User" title-tag="h2" />

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
                <option
                  v-for="option in EDITABLE_USER_ROLE_OPTIONS"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
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
            v-if="currentRoleCanBeAssignedJobs(createForm.role)"
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
      <AppPaneHeader
        eyebrow="Selected User"
        :title="getUserDisplayName(selectedUser)"
        title-tag="h2"
      >
        <template #actions>
          <div class="users-detail__header-side">
            <div class="users-detail__status-group">
              <AppBadge tone="accent">{{ getRoleBadgeLabel(selectedUser.role) }}</AppBadge>
              <AppBadge :tone="selectedUser.active ? 'success' : 'danger'">
                {{ selectedUser.active ? 'Active' : 'Inactive' }}
              </AppBadge>
            </div>
            <AppLoadingButton
              v-if="!editingSelf"
              class="users-detail__danger"
              label="Delete User"
              loading-label="Deleting..."
              variant="danger"
              :loading="deleteLoading"
              :disabled="deleteLoading || saveLoading || emailAction !== null"
              @click="emit('deleteUser')"
            />
          </div>
        </template>
      </AppPaneHeader>

      <div class="users-detail__body">
        <form class="users-form" @submit.prevent="emit('detailSubmit')">
          <div class="users-form__grid">
            <AppField class="users-form__field" label="Email">
              <AppTextInput :model-value="selectedUser.email || ''" type="email" readonly />
            </AppField>
            <AppField class="users-form__field" label="Role">
              <AppSelect
                v-if="isEditableUserRole(selectedUser.role)"
                :model-value="detailForm.role"
                :class="{ 'users-form__control--locked': editingSelf }"
                :disabled="saveLoading"
                :tabindex="editingSelf ? -1 : undefined"
                :aria-disabled="editingSelf ? 'true' : undefined"
                @update:model-value="emit('updateDetailRole', getRoleSelectValue($event))"
              >
                <option
                  v-for="option in EDITABLE_USER_ROLE_OPTIONS"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </AppSelect>
              <AppTextInput
                v-else
                :model-value="getRoleBadgeLabel(selectedUser.role)"
                type="text"
                readonly
              />
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

          <div class="users-detail__email-actions" aria-label="User email actions">
            <AppLoadingButton
              label="Resend Invite"
              loading-label="Sending Invite..."
              :loading="emailAction === 'invite'"
              :disabled="
                deleteConfirmOpen ||
                deleteLoading ||
                emailAction !== null ||
                saveLoading ||
                !selectedUser.email?.trim()
              "
              type="button"
              @click="emit('resendInvite')"
            />
            <AppLoadingButton
              label="Send Password Reset"
              loading-label="Sending Password Reset..."
              variant="primary"
              :loading="emailAction === 'reset'"
              :disabled="
                deleteConfirmOpen ||
                deleteLoading ||
                emailAction !== null ||
                saveLoading ||
                !selectedUser.email?.trim()
              "
              type="button"
              @click="emit('sendPasswordReset')"
            />
          </div>

          <AppStatusMessage v-if="!selectedUser.email?.trim()" tone="warning">
            This user does not have an email address. Add one before sending account emails.
          </AppStatusMessage>

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
            v-if="shouldShowUserDetailAssignedJobs(selectedUser, detailForm.role)"
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
          You are editing the currently signed-in account. Role, active state, and delete are locked
          to avoid accidental lockout.
        </AppStatusMessage>
        <SaveStatusIndicator
          v-if="
            saveLoading ||
            detailInfo === 'All changes saved.' ||
            detailInfo === 'Changes save automatically.'
          "
          :saving="saveLoading"
          :message="detailInfo"
          idle-message="Changes save automatically."
        />
      </div>
    </template>

    <template v-else>
      <AppPaneHeader eyebrow="Selected User" title="No User Selected" title-tag="h2" />

      <div class="users-detail__body">
        <AppEmptyState
          class="users-browser__empty"
          message="Select a user to edit, or click New User to create one."
        />
      </div>
    </template>
  </AppPane>
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

.users-detail__header-side {
  display: grid;
  justify-items: end;
  gap: 0.7rem;
}

.users-form {
  display: grid;
  gap: 1rem;
  align-content: start;
}

.users-form__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--form-gap);
}

.users-form__field .app-select {
  --app-select-min-height: var(--control-height-form);
  --app-select-padding-x: var(--control-padding-x);
  --app-select-background: var(--control-background);
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
  gap: var(--field-gap);
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
  gap: var(--action-gap);
}

.users-detail__email-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--action-gap);
}

@media (max-width: 900px) {
  .users-detail,
  .users-detail__body {
    height: auto;
    min-height: 0;
    overflow: visible;
  }

  .users-detail__body {
    padding-right: 0;
  }

  .users-detail__header-side,
  .users-detail__danger {
    width: 100%;
  }

  .users-detail__actions .app-button {
    width: 100%;
  }

  .users-detail__email-actions .app-button {
    flex: 1 1 12rem;
  }
}

@media (max-width: 720px) {
  .users-form__grid {
    grid-template-columns: 1fr;
  }

  .users-detail__header-side {
    width: 100%;
    justify-items: stretch;
  }
}
</style>
