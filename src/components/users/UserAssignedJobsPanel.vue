<script setup lang="ts">
import AppCheckbox from '@/components/common/AppCheckbox.vue'
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import AppSearchInput from '@/components/common/AppSearchInput.vue'
import AppSectionHeader from '@/components/common/AppSectionHeader.vue'
import { getAssignedJobCode, getAssignedJobName } from '@/features/users/userViewHelpers'
import type { JobRecord } from '@/types/domain'

const props = withDefaults(defineProps<{
  assignedJobIds: readonly string[]
  disabled?: boolean
  emptyMessage: string
  jobs: readonly JobRecord[]
  jobsLoading: boolean
  searchTerm: string
}>(), {
  disabled: false,
})

const emit = defineEmits<{
  'update:searchTerm': [value: string]
  toggleJob: [jobId: string]
}>()

</script>

<template>
  <section class="users-jobs-panel">
    <AppSectionHeader
      class="users-jobs-panel__header"
      title="Assigned Jobs"
      title-tag="strong"
    >
      <template #actions>
        <span class="users-jobs-panel__selected-count">{{ props.assignedJobIds.length }} selected</span>
      </template>
    </AppSectionHeader>
    <div class="users-jobs-panel__search">
      <AppSearchInput
        :model-value="props.searchTerm"
        placeholder="Search jobs by name or number"
        @update:model-value="emit('update:searchTerm', $event)"
      />
    </div>
    <AppEmptyState
      v-if="props.jobsLoading"
      class="users-browser__empty"
      message="Loading jobs..."
    />
    <div v-else-if="props.jobs.length" class="users-jobs-grid">
      <label v-for="job in props.jobs" :key="job.id" class="users-job-toggle">
        <AppCheckbox
          :model-value="props.assignedJobIds.includes(job.id)"
          :disabled="props.disabled"
          @update:model-value="emit('toggleJob', job.id)"
        />
        <span class="users-job-toggle__text">
          <span class="users-job-toggle__name">{{ getAssignedJobName(job) }}</span>
          <span class="users-job-toggle__code">{{ getAssignedJobCode(job) }}</span>
        </span>
      </label>
    </div>
    <AppEmptyState
      v-else
      class="users-browser__empty"
      :message="props.emptyMessage"
    />
  </section>
</template>

<style scoped>
.users-jobs-panel {
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

.users-jobs-panel__selected-count,
.users-browser__empty {
  color: var(--text-muted);
}

.users-jobs-panel__search {
  display: grid;
}

.users-jobs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.6rem;
}

.users-job-toggle {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: var(--action-gap);
  min-height: 5.6rem;
  padding: 0.75rem 0.8rem;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
}

.users-job-toggle input {
  margin-top: 0.2rem;
  accent-color: var(--accent-strong);
}

.users-job-toggle input:disabled {
  opacity: 1;
}

.users-job-toggle__text {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}

.users-job-toggle__name {
  color: var(--text);
  line-height: 1.35;
  word-break: break-word;
}

.users-job-toggle__code {
  color: var(--text-soft);
  font-size: var(--font-size-help);
}

@media (max-width: 720px) {
  .users-jobs-grid {
    grid-template-columns: 1fr;
  }

  .users-jobs-panel__header {
    --app-section-header-flex-direction: column;
    --app-section-header-align-items: flex-start;
  }
}
</style>
