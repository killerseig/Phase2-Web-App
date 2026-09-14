<script setup lang="ts">
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import AppBadge, { type AppBadgeTone } from '@/components/common/AppBadge.vue'
import AppButton from '@/components/common/AppButton.vue'
import AppListButton from '@/components/common/AppListButton.vue'
import AppLoadingButton from '@/components/common/AppLoadingButton.vue'
import AppPane from '@/components/common/AppPane.vue'
import AppPaneHeader from '@/components/common/AppPaneHeader.vue'
import AppSearchInput from '@/components/common/AppSearchInput.vue'
import AppSelect from '@/components/common/AppSelect.vue'
import { getRoleBadgeLabel } from '@/features/users/userViewHelpers'
import type { UserProfile } from '@/types/domain'
import type { DirectoryStatusFilter } from '@/utils/directoryFilters'
import '@/components/common/directory-browser.css'

defineProps<{
  users: readonly UserProfile[]
  usersLoading: boolean
  selectedUserId: string | null
  searchTerm: string
  statusFilter: DirectoryStatusFilter
  pendingInviteCount: number
  inviteLoading: boolean
}>()

const emit = defineEmits<{
  createUser: []
  selectUser: [userId: string]
  sendInvites: []
  'update:searchTerm': [value: string]
  'update:statusFilter': [value: DirectoryStatusFilter]
}>()

function getUserDisplayName(user: UserProfile) {
  const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()
  return fullName || user.email || 'Unnamed User'
}

function getInviteStatusLabel(user: UserProfile) {
  if (user.inviteStatus === 'pending') return 'Invite Pending'
  if (user.inviteStatus === 'sent') return 'Invited'
  if (user.inviteStatus === 'accepted') return 'Setup Complete'
  return ''
}

function getInviteStatusTone(user: UserProfile): AppBadgeTone {
  if (user.inviteStatus === 'pending') return 'warning'
  if (user.inviteStatus === 'accepted') return 'accent'
  return 'success'
}

function handleStatusFilterUpdate(value: string) {
  emit('update:statusFilter', value as DirectoryStatusFilter)
}
</script>

<template>
  <AppPane class="users-browser directory-browser">
    <AppPaneHeader class="users-browser__header" title="User directory" title-tag="h2">
      <template #description>
        {{ pendingInviteCount }} pending {{ pendingInviteCount === 1 ? 'invite' : 'invites' }}
      </template>
      <template #actions>
        <div class="users-browser__header-buttons">
          <AppButton variant="primary" @click="emit('createUser')"> New User </AppButton>
          <AppLoadingButton
            label="Send Invites"
            loading-label="Sending..."
            :loading="inviteLoading"
            type="button"
            :disabled="pendingInviteCount === 0"
            @click="emit('sendInvites')"
          />
        </div>
      </template>
    </AppPaneHeader>

    <div class="users-browser__body">
      <div class="users-browser__search">
        <AppSearchInput
          :model-value="searchTerm"
          data-testid="users-search"
          placeholder="Search users"
          @update:model-value="emit('update:searchTerm', $event)"
        />
      </div>

      <label class="users-browser__filter">
        <span>Status</span>
        <AppSelect
          :model-value="statusFilter"
          data-testid="users-status-filter"
          @update:model-value="handleStatusFilterUpdate"
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="both">Both</option>
        </AppSelect>
      </label>

      <div class="users-browser__list">
        <AppEmptyState
          panel
          v-if="usersLoading"
          class="users-browser__empty"
          message="Loading users..."
        />

        <AppListButton
          v-for="user in users"
          v-else
          :key="user.id"
          class="users-browser__row"
          :active="selectedUserId === user.id"
          :data-testid="`users-row-${user.id}`"
          @click="emit('selectUser', user.id)"
        >
          <div class="users-browser__row-main">
            <strong>{{ getUserDisplayName(user) }}</strong>
            <span>{{ user.email || 'No email' }}</span>
          </div>
          <div class="users-browser__row-meta">
            <AppBadge tone="accent">{{ getRoleBadgeLabel(user.role) }}</AppBadge>
            <AppBadge v-if="getInviteStatusLabel(user)" :tone="getInviteStatusTone(user)">
              {{ getInviteStatusLabel(user) }}
            </AppBadge>
            <AppBadge
              class="users-browser__account-status"
              :tone="user.active ? 'success' : 'danger'"
            >
              {{ user.active ? 'Active' : 'Inactive' }}
            </AppBadge>
          </div>
        </AppListButton>

        <AppEmptyState
          v-if="!usersLoading && users.length === 0"
          panel
          class="users-browser__empty"
          message="No users match your search."
        />
      </div>
    </div>
  </AppPane>
</template>

<style scoped>
.users-browser__header {
  flex-direction: column;
  align-items: stretch;
}

.users-browser__header :deep(.app-pane-header__actions) {
  justify-content: flex-start;
}

.users-browser__header-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.users-browser__body {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: 1rem;
  min-height: 0;
}

.users-browser__filter {
  display: grid;
  gap: var(--field-gap);
  color: var(--text-muted);
  font-size: var(--font-size-label);
  letter-spacing: normal;
  text-transform: none;
}

.users-browser__filter .app-select {
  --app-select-border: var(--border);
  --app-select-min-height: var(--control-height-form);
  --app-select-padding-x: var(--control-padding-x);
  --app-select-radius: var(--control-radius);
  --app-select-background: var(--control-background);
  text-transform: none;
  letter-spacing: normal;
}

.users-browser__list {
  display: grid;
  gap: var(--list-gap);
  align-content: start;
  min-height: 0;
  overflow: auto;
  padding-right: 0.15rem;
}

.users-browser__row-main {
  display: grid;
  gap: 0.2rem;
}

.users-browser__row-main span,
.users-browser__empty {
  color: var(--text-muted);
}

.users-browser__row-meta {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 4.25rem;
  gap: var(--field-gap);
}

.users-browser__row-meta .app-badge {
  --app-badge-min-height: 2.25rem;
  --app-badge-padding: 0.2rem 0.35rem;
  min-width: 0;
  justify-content: center;
  text-align: center;
  line-height: 1.2;
}

.users-browser__account-status {
  grid-column: 3;
}

@media (max-width: 900px) {
  .users-browser__body,
  .users-browser__list {
    height: auto;
    min-height: 0;
    overflow: visible;
    padding-right: 0;
  }
}
</style>
