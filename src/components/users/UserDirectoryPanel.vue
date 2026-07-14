<script setup lang="ts">
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import AppBadge, { type AppBadgeTone } from '@/components/common/AppBadge.vue'
import AppButton from '@/components/common/AppButton.vue'
import AppListButton from '@/components/common/AppListButton.vue'
import AppLoadingButton from '@/components/common/AppLoadingButton.vue'
import AppPaneHeader from '@/components/common/AppPaneHeader.vue'
import AppSearchInput from '@/components/common/AppSearchInput.vue'
import AppSelect from '@/components/common/AppSelect.vue'
import { getRoleBadgeLabel } from '@/features/users/userViewHelpers'
import type { UserProfile } from '@/types/domain'
import type { DirectoryStatusFilter } from '@/utils/directoryFilters'

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
  <section class="users-browser">
    <AppPaneHeader class="users-browser__header" eyebrow="Admin" title="Users">
      <template #actions>
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
            <AppButton variant="primary" @click="emit('createUser')">
              New User
            </AppButton>
            <AppLoadingButton
              label="Send Invites"
              loading-label="Sending..."
              :loading="inviteLoading"
              type="button"
              :disabled="pendingInviteCount === 0"
              @click="emit('sendInvites')"
            />
          </div>
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
        <AppEmptyState v-if="usersLoading" class="users-browser__empty" message="Loading users..." />

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
            <AppBadge
              v-if="getInviteStatusLabel(user)"
              :tone="getInviteStatusTone(user)"
            >
              {{ getInviteStatusLabel(user) }}
            </AppBadge>
            <AppBadge :tone="user.active ? 'success' : 'danger'">
              {{ user.active ? 'Active' : 'Inactive' }}
            </AppBadge>
          </div>
        </AppListButton>

        <AppEmptyState
          v-if="!usersLoading && users.length === 0"
          class="users-browser__empty"
          message="No users match your search."
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.users-browser__header-actions {
  display: grid;
  justify-items: end;
  gap: 0.35rem;
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

.users-browser__body {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: 1rem;
  min-height: 0;
}

.users-browser__filter {
  display: grid;
  gap: 0.45rem;
  color: var(--text-muted);
  font-size: 0.74rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.users-browser__filter .app-select {
  --app-select-border: var(--border);
  --app-select-min-height: 2.8rem;
  --app-select-padding-x: 0.9rem;
  --app-select-radius: 12px;
  --app-select-background: rgba(255, 255, 255, 0.045);
  text-transform: none;
  letter-spacing: normal;
}

.users-browser__list {
  display: grid;
  gap: 0.55rem;
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
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

@media (max-width: 900px) {
  .users-browser__body,
  .users-browser__list {
    height: auto;
    min-height: 0;
    overflow: visible;
    padding-right: 0;
  }

  .users-browser__header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    gap: 0.75rem;
  }

  .users-browser__header-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    width: auto;
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
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    width: auto;
    gap: 0.45rem;
  }

  .users-browser__header-buttons .app-button {
    width: auto;
    flex: 0 0 auto;
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
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    width: 100%;
  }

  .users-browser__header-buttons .app-button {
    width: 100%;
  }
}
</style>
