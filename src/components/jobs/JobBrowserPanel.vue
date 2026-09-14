<script setup lang="ts">
import AppButton from '@/components/common/AppButton.vue'
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import AppListButton from '@/components/common/AppListButton.vue'
import AppPane from '@/components/common/AppPane.vue'
import AppPaneHeader from '@/components/common/AppPaneHeader.vue'
import AppSearchInput from '@/components/common/AppSearchInput.vue'
import AppSelect from '@/components/common/AppSelect.vue'
import { getJobDisplayName } from '@/features/jobs/jobViewHelpers'
import type { JobRecord } from '@/types/domain'
import { formatJobTypeLabel } from '@/types/domain'
import type { DirectoryStatusFilter } from '@/utils/directoryFilters'

defineProps<{
  canCreateJobs: boolean
  canManageJobs: boolean
  canUseJobSetupEditor: boolean
  editMode: boolean
  searchTerm: string
  statusFilter: DirectoryStatusFilter
  activeJobCount: number
  archivedJobCount: number
  visibleJobs: JobRecord[]
  loading: boolean
  selectedJobId: string | null
  showAllJobsEntry: boolean
  allJobsId: string
}>()

const emit = defineEmits<{
  updateSearchTerm: [value: string]
  updateStatusFilter: [value: DirectoryStatusFilter]
  createJob: []
  selectAllJobs: []
  selectJob: [job: JobRecord]
}>()

function getJobCode(job: Pick<JobRecord, 'code'>) {
  return job.code?.trim() || 'No Job Number'
}

function getJobMeta(job: JobRecord) {
  const parts = [formatJobTypeLabel(job.type)]
  if (job.gc?.trim()) parts.push(job.gc.trim())
  return parts.join(' / ')
}

function handleStatusFilterUpdate(value: string) {
  emit('updateStatusFilter', value as DirectoryStatusFilter)
}
</script>

<template>
  <AppPane class="jobs-browser">
    <AppPaneHeader title="Job directory" title-tag="h2">
      <template v-if="canCreateJobs && editMode" #actions>
        <AppButton variant="primary" data-testid="jobs-new-button" @click="emit('createJob')">
          New Job
        </AppButton>
      </template>
    </AppPaneHeader>

    <div class="jobs-browser__body">
      <div class="jobs-browser__search">
        <AppSearchInput
          :model-value="searchTerm"
          data-testid="jobs-search"
          placeholder="Search jobs"
          @update:model-value="emit('updateSearchTerm', $event)"
        />
      </div>

      <div class="jobs-browser__filters">
        <div class="jobs-browser__summary">
          <span>{{ activeJobCount }} active</span>
          <span v-if="canManageJobs">{{ archivedJobCount }} archived</span>
          <span>{{ visibleJobs.length }} visible</span>
        </div>

        <label v-if="canManageJobs && editMode" class="jobs-browser__filter">
          <span>Status</span>
          <AppSelect
            :model-value="statusFilter"
            data-testid="jobs-status-filter"
            @update:model-value="handleStatusFilterUpdate"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="both">Both</option>
          </AppSelect>
        </label>
      </div>

      <div class="jobs-browser__list">
        <AppEmptyState panel v-if="loading" class="jobs-browser__empty" message="Loading jobs..." />

        <AppListButton
          v-if="showAllJobsEntry"
          class="jobs-browser__row jobs-browser__row--global"
          :active="selectedJobId === allJobsId"
          variant="dashed"
          @click="emit('selectAllJobs')"
        >
          <div class="jobs-browser__row-main">
            <strong>All Jobs</strong>
            <span>Global notification defaults</span>
            <span class="jobs-browser__secondary">
              Daily Logs / Timecards / Shop Orders / Job Activity
            </span>
          </div>
        </AppListButton>

        <AppListButton
          v-for="job in visibleJobs"
          :key="job.id"
          class="jobs-browser__row"
          :active="canUseJobSetupEditor && editMode && selectedJobId === job.id"
          :data-testid="`job-card-${getJobCode(job)}`"
          @click="emit('selectJob', job)"
        >
          <div class="jobs-browser__row-main">
            <strong>{{ getJobDisplayName(job) }}</strong>
            <span>{{ getJobMeta(job) }}</span>
            <span class="jobs-browser__secondary">Job #{{ getJobCode(job) }}</span>
          </div>
        </AppListButton>

        <AppEmptyState
          v-if="!loading && visibleJobs.length === 0"
          panel
          data-testid="jobs-empty"
          class="jobs-browser__empty"
          message="No jobs match your search."
        />
      </div>
    </div>
  </AppPane>
</template>

<style scoped>
.jobs-browser__body {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: var(--space-4);
  min-height: 0;
}

.jobs-browser__filters {
  display: grid;
  gap: var(--form-gap);
}

.jobs-browser__summary {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  color: var(--text-soft);
  font-size: var(--font-size-xs);
  font-variant-numeric: tabular-nums;
}

.jobs-browser__summary span + span {
  padding-left: var(--space-3);
  border-left: 1px solid var(--border);
}

.jobs-browser__filter {
  display: grid;
  gap: var(--field-gap);
  color: var(--text-muted);
  font-size: var(--font-size-label);
  letter-spacing: normal;
  text-transform: none;
}

.jobs-browser__filter .app-select {
  --app-select-min-height: var(--control-height-form);
  --app-select-padding-x: var(--control-padding-x);
  --app-select-background: var(--control-background);
  text-transform: none;
  letter-spacing: normal;
}

.jobs-browser__list {
  display: grid;
  grid-auto-rows: max-content;
  gap: var(--space-1);
  align-content: start;
  min-height: 0;
  overflow: auto;
  padding-right: 0.15rem;
}

.jobs-browser__row {
  --app-list-button-padding: 0.5rem 0.65rem;
  --app-list-button-active-background: #252d35;
  --app-list-button-active-border: transparent;
  position: relative;
}

.jobs-browser__row--global {
  margin-bottom: var(--space-3);
  border-style: solid;
  border-color: var(--border-soft);
}

.jobs-browser__row.app-list-button--active::before {
  content: '';
  position: absolute;
  inset: var(--space-3) auto var(--space-3) 0;
  width: 3px;
  border-radius: 1px;
  background: var(--accent);
}

.jobs-browser__row-main {
  display: grid;
  gap: var(--space-1);
  min-width: 0;
  overflow-wrap: anywhere;
}

.jobs-browser__row-main strong {
  font-size: 1.0625rem;
  letter-spacing: -0.015em;
}

.jobs-browser__row-main > span {
  font-size: var(--font-size-sm);
}

.jobs-browser__row-main span,
.jobs-browser__empty,
.jobs-browser__secondary {
  color: var(--text-muted);
}

.jobs-browser__row-main > .jobs-browser__secondary {
  color: var(--text-soft);
  font-size: var(--font-size-xs);
  font-variant-numeric: tabular-nums;
}
</style>
