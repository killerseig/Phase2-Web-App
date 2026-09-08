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
    <AppPaneHeader :eyebrow="canManageJobs ? 'Admin' : 'Field Workspace'" title="Jobs">
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
        <AppEmptyState v-if="loading" class="jobs-browser__empty" message="Loading jobs..." />

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
          data-testid="jobs-empty"
          class="jobs-browser__empty"
          message="No jobs match this view."
        />
      </div>
    </div>
  </AppPane>
</template>

<style scoped>
.jobs-browser__body {
  display: grid;
  grid-template-rows: auto auto auto minmax(0, 1fr);
  gap: 1rem;
  min-height: 0;
}

.jobs-browser__filters {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--form-gap);
  flex-wrap: wrap;
}

.jobs-browser__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  color: var(--text-soft);
  font-size: 0.76rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.jobs-browser__filter {
  display: grid;
  gap: var(--field-gap);
  color: var(--text-muted);
  font-size: 0.74rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
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
  gap: var(--list-gap);
  align-content: start;
  min-height: 0;
  overflow: auto;
  padding-right: 0.15rem;
}

.jobs-browser__row-main {
  display: grid;
  gap: 0.2rem;
}

.jobs-browser__row-main span,
.jobs-browser__empty,
.jobs-browser__secondary {
  color: var(--text-muted);
}

.jobs-browser__secondary {
  font-size: 0.84rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.jobs-browser__empty {
  display: grid;
  place-content: center;
  min-height: 12rem;
  padding: 1.5rem;
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
  text-align: center;
}

@media (max-width: 760px) {
  .jobs-browser__header,
  .jobs-browser__filters {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
