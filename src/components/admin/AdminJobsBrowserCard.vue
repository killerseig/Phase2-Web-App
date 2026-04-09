<script setup lang="ts">
import { computed } from 'vue'
import AdminCardWrapper from '@/components/admin/AdminCardWrapper.vue'
import AppAlert from '@/components/common/AppAlert.vue'
import AppSelectableListItem from '@/components/common/AppSelectableListItem.vue'
import InlineSelectMenu from '@/components/common/InlineSelectMenu.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import TimecardWeekStatusBadge from '@/components/common/TimecardWeekStatusBadge.vue'
import type { Job } from '@/types/models'
import type { JobSortKey, SortDir } from '@/types/adminJobs'

const props = defineProps<{
  jobs: Job[]
  loading: boolean
  error: string
  selectedJobId: string
  sortKey: JobSortKey
  sortDir: SortDir
  currentWeekEnd: string
  currentWeekLabel: string
  showCreate: boolean
}>()

const emit = defineEmits<{
  'sort-change': [payload: { sortKey: string; sortDir: SortDir }]
  'select-job': [job: Job]
  'toggle-create': []
}>()

const sortOptions = [
  { key: 'code', label: 'Job #' },
  { key: 'name', label: 'Job Name' },
  { key: 'projectManager', label: 'Project Manager' },
  { key: 'foreman', label: 'Foreman' },
  { key: 'status', label: 'Status' },
] as const satisfies readonly { key: JobSortKey; label: string }[]

const selectedSortKey = computed({
  get: () => props.sortKey,
  set: (value: JobSortKey) => emit('sort-change', { sortKey: value, sortDir: props.sortDir }),
})

const sortMenuOptions = sortOptions.map((option) => ({
  value: option.key,
  label: option.label,
})) as readonly { value: JobSortKey; label: string }[]

const sortLabel = computed(() => {
  return sortOptions.find((option) => option.key === props.sortKey)?.label ?? 'Job Name'
})

function toggleDirection() {
  emit('sort-change', {
    sortKey: props.sortKey,
    sortDir: props.sortDir === 'asc' ? 'desc' : 'asc',
  })
}

function asText(value: unknown, fallback = '--') {
  if (value === null || value === undefined) return fallback
  const text = String(value).trim()
  return text ? text : fallback
}
</script>

<template>
  <AdminCardWrapper
    title="Jobs"
    icon="building"
    :loading="loading"
    :error="error"
    :subtitle="`${jobs.length} total job${jobs.length === 1 ? '' : 's'}`"
  >
    <template #header-actions>
      <button
        type="button"
        class="btn btn-primary btn-sm"
        @click="emit('toggle-create')"
      >
        <i class="bi" :class="showCreate ? 'bi-dash-lg' : 'bi-plus-lg'"></i>
        {{ showCreate ? 'Close' : 'New Job' }}
      </button>
    </template>

    <AppAlert
      v-if="jobs.length === 0"
      variant="info"
      class="text-center mb-0"
      message="No jobs found. Create your first job from the workspace."
    />

    <div v-else class="jobs-browser">
      <div class="jobs-browser__controls">
        <div class="jobs-browser__sort">
          <label class="jobs-browser__sort-label" for="admin-jobs-sort">Sort by</label>
        <div class="jobs-browser__sort-row">
            <InlineSelectMenu
              :model-value="selectedSortKey"
              :options="sortMenuOptions"
              button-class="form-select form-select-sm jobs-browser__sort-select"
              @update:model-value="selectedSortKey = $event as JobSortKey"
            />

            <button
              type="button"
              class="btn btn-sm btn-outline-secondary jobs-browser__sort-button"
              :aria-label="`Toggle sort direction from ${sortLabel}`"
              @click="toggleDirection"
            >
              <i class="bi" :class="sortDir === 'asc' ? 'bi-sort-down' : 'bi-sort-up'"></i>
            </button>
          </div>
        </div>
      </div>

      <div class="jobs-browser__list">
        <AppSelectableListItem
          v-for="job in jobs"
          :key="job.id"
          as="button"
          class="jobs-browser__item"
          :selected="selectedJobId === job.id"
          @activate="emit('select-job', job)"
        >
          <div class="jobs-browser__item-top">
            <div class="jobs-browser__code">
              {{ asText(job.code, 'No job #') }}
            </div>
            <div class="jobs-browser__badges">
              <StatusBadge :status="job.active ? 'active' : 'archived'" />
            </div>
          </div>

          <div class="jobs-browser__name">
            {{ asText(job.name, 'Unnamed job') }}
          </div>

          <div class="jobs-browser__meta">
            <span class="jobs-browser__meta-item">PM {{ asText(job.projectManager) }}</span>
            <span class="jobs-browser__meta-item">Foreman {{ asText(job.foreman) }}</span>
          </div>

          <div class="jobs-browser__submeta">
            <span>{{ job.gc || 'No GC listed' }}</span>
          </div>

          <div class="jobs-browser__footer">
            <TimecardWeekStatusBadge
              :status="job.timecardStatus"
              :period-end-date="job.timecardPeriodEndDate"
              :current-week-end="currentWeekEnd"
              :current-week-label="currentWeekLabel"
            />
            <span
              class="jobs-browser__open"
              :class="{ 'jobs-browser__open--selected': selectedJobId === job.id }"
              aria-hidden="true"
            >
              <i class="bi" :class="selectedJobId === job.id ? 'bi-check2-circle' : 'bi-arrow-up-right'"></i>
            </span>
          </div>
        </AppSelectableListItem>
      </div>
    </div>
  </AdminCardWrapper>
</template>
