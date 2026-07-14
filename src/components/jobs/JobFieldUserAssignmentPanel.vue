<script setup lang="ts">
import AppCheckbox from '@/components/common/AppCheckbox.vue'
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import AppSearchInput from '@/components/common/AppSearchInput.vue'
import { getJobFieldUserDisplayName } from '@/features/jobs/jobViewHelpers'
import type { UserProfile } from '@/types/domain'

defineProps<{
  selectedIds: string[]
  users: UserProfile[]
  searchTerm: string
  loading: boolean
  rowTestIdPrefix?: string
}>()

const emit = defineEmits<{
  updateSearchTerm: [value: string]
  toggleUser: [userId: string]
}>()

</script>

<template>
  <section class="jobs-foremen-panel">
    <div class="jobs-foremen-panel__header">
      <strong>Assigned Field Users</strong>
      <span>{{ selectedIds.length }} selected</span>
    </div>

    <div class="jobs-foremen-panel__search">
      <AppSearchInput
        :model-value="searchTerm"
        placeholder="Search foremen or project managers"
        @update:model-value="emit('updateSearchTerm', $event)"
      />
    </div>

    <AppEmptyState
      v-if="loading"
      class="jobs-foremen-panel__empty"
      message="Loading assignable users..."
    />
    <div v-else class="jobs-foremen-grid">
      <label
        v-for="user in users"
        :key="user.id"
        class="jobs-foreman-toggle"
        :data-testid="rowTestIdPrefix ? `${rowTestIdPrefix}-${user.id}` : undefined"
      >
        <AppCheckbox
          :model-value="selectedIds.includes(user.id)"
          @update:model-value="emit('toggleUser', user.id)"
        />
        <span class="jobs-foreman-toggle__text">
          <span class="jobs-foreman-toggle__name">{{ getJobFieldUserDisplayName(user, 'Unnamed Field User') }}</span>
          <span class="jobs-foreman-toggle__meta">
            {{ user.email || 'No email' }} - {{ user.active ? 'Active' : 'Inactive' }}
          </span>
        </span>
      </label>
      <AppEmptyState
        v-if="users.length === 0"
        class="jobs-foremen-panel__empty jobs-foremen-panel__empty--compact"
        message="No assignable users match your search."
      />
    </div>
  </section>
</template>

<style scoped>
.jobs-foremen-panel {
  display: grid;
  gap: 0.85rem;
  min-height: 0;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.03);
}

.jobs-foremen-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.jobs-foremen-panel__header span {
  color: var(--text-muted);
}

.jobs-foremen-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.6rem;
  max-height: 22rem;
  overflow: auto;
  padding-right: 0.15rem;
}

.jobs-foreman-toggle {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 0.65rem;
  min-height: 4.6rem;
  padding: 0.75rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.035);
  color: var(--text-muted);
}

.jobs-foreman-toggle input {
  margin-top: 0.1rem;
  accent-color: var(--accent-strong);
}

.jobs-foreman-toggle__text {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}

.jobs-foreman-toggle__name {
  color: var(--text);
  line-height: 1.35;
  word-break: break-word;
}

.jobs-foreman-toggle__meta,
.jobs-foremen-panel__empty {
  color: var(--text-muted);
}

.jobs-foremen-panel__empty {
  display: grid;
  place-content: center;
  min-height: 12rem;
  padding: 1.5rem;
  border: 1px dashed var(--border);
  border-radius: 12px;
  text-align: center;
}

.jobs-foremen-panel__empty--compact {
  min-height: 3.4rem;
  max-width: 100%;
  min-width: 0;
  padding: 0.9rem 1rem;
}

@media (max-width: 760px) {
  .jobs-foremen-panel__header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
