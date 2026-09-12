<script setup lang="ts">
import AppCheckbox from '@/components/common/AppCheckbox.vue'
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import AppSearchInput from '@/components/common/AppSearchInput.vue'
import AppSectionHeader from '@/components/common/AppSectionHeader.vue'
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
    <AppSectionHeader
      class="jobs-foremen-panel__header"
      title="Assigned Field Users"
      title-tag="strong"
    >
      <template #actions>
        <span class="jobs-foremen-panel__selected-count">{{ selectedIds.length }} selected</span>
      </template>
    </AppSectionHeader>

    <div class="jobs-foremen-panel__search">
      <AppSearchInput
        :model-value="searchTerm"
        placeholder="Search foremen or project managers"
        @update:model-value="emit('updateSearchTerm', $event)"
      />
    </div>

    <AppEmptyState
      v-if="loading"
      panel
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
        panel
        class="jobs-foremen-panel__empty jobs-foremen-panel__empty--compact"
        message="No assignable users match your search."
      />
    </div>
  </section>
</template>

<style scoped>
.jobs-foremen-panel {
  --app-section-header-title-color: var(--text);
  --app-section-header-title-font-size: var(--font-size-section-title);
  --app-section-header-title-font-weight: var(--font-weight-heading);
  --app-section-header-title-letter-spacing: normal;
  --app-section-header-title-text-transform: none;
  display: grid;
  gap: var(--form-gap);
  min-height: 0;
  padding: 1rem 0 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  border-top: 1px solid var(--border-soft);
}

.jobs-foremen-panel__selected-count {
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
  gap: var(--action-gap);
  min-height: 4.6rem;
  padding: 0.75rem 0.8rem;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  background: transparent;
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

.jobs-foreman-toggle__meta {
  color: var(--text-muted);
}

.jobs-foremen-panel__empty--compact {
  --app-empty-state-min-height: 4rem;
  max-width: 100%;
  min-width: 0;
}

@media (max-width: 760px) {
  .jobs-foremen-panel__header {
    --app-section-header-flex-direction: column;
    --app-section-header-align-items: flex-start;
  }
}
</style>
