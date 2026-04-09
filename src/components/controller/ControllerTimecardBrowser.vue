<script setup lang="ts">
import AppAlert from '@/components/common/AppAlert.vue'
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import AppLoadingState from '@/components/common/AppLoadingState.vue'
import AppSectionCard from '@/components/common/AppSectionCard.vue'
import AppSelectableListItem from '@/components/common/AppSelectableListItem.vue'
import ControllerTimecardSummary from '@/components/controller/ControllerTimecardSummary.vue'
import TimecardStatusBadge from '@/components/timecards/TimecardStatusBadge.vue'
import type { ControllerGroupedTimecard, ControllerJobGroup, ControllerSortKey, ControllerSortOption } from '@/types/controller'
import type { TimecardModel } from '@/utils/timecardUtils'

defineOptions({
  name: 'ControllerTimecardBrowser',
})

defineProps<{
  groupedTimecards: ControllerJobGroup[]
  selectedKey: string | null
  activeFilterSummary: string
  currentSortLabel: string
  refreshing: boolean
  loading: boolean
  loadError: string
  sortOptions: ControllerSortOption[]
  sortKey: ControllerSortKey
  sortDir: 'asc' | 'desc'
  formatTimecardWeek: (timecard: TimecardModel) => string
  embedded?: boolean
}>()

const emit = defineEmits<{
  select: [key: string]
  'update:sortKey': [value: ControllerSortKey]
  'toggle-direction': []
}>()

function handleSelect(entry: ControllerGroupedTimecard) {
  emit('select', entry.key)
}

function formatMetric(value: number | null | undefined): string {
  const numeric = Number(value ?? 0)
  if (!Number.isFinite(numeric) || Number.isNaN(numeric)) return '0'
  return numeric.toFixed(1).replace(/\.0$/, '')
}

function formatCountLabel(count: number, label: string): string {
  return `${count} ${label}${count === 1 ? '' : 's'}`
}

function formatGroupCount(count: number): string {
  return `${count} job group${count === 1 ? '' : 's'}`
}
</script>

<template>
  <AppSectionCard
    :title="embedded ? '' : 'Timecard Browser'"
    :subtitle="embedded ? '' : formatGroupCount(groupedTimecards.length)"
    icon="bi bi-card-list"
    body-class="controller-timecard-browser__body"
    :card-class="embedded
      ? 'controller-timecard-browser controller-timecard-browser--embedded'
      : 'controller-timecard-browser'"
  >
    <div class="controller-timecard-browser__controls">
      <div class="controller-timecard-browser__filters">
        <div class="controller-timecard-browser__filters-label">Active Filters</div>
        <div class="controller-timecard-browser__filters-value">
          {{ activeFilterSummary }}
        </div>
        <div class="controller-timecard-browser__filters-meta">
          <span>Sorted by {{ currentSortLabel }}</span>
          <span v-if="refreshing" class="controller-timecard-browser__refreshing">
            Refreshing results...
          </span>
        </div>
      </div>

      <div class="controller-timecard-browser__sort">
        <label class="controller-timecard-browser__sort-label" for="controller-browser-sort">Sort by</label>
        <div class="controller-timecard-browser__sort-row">
          <select
            id="controller-browser-sort"
            class="form-select form-select-sm"
            :value="sortKey"
            @change="emit('update:sortKey', ($event.target as HTMLSelectElement).value as ControllerSortKey)"
          >
            <option
              v-for="option in sortOptions"
              :key="option.key"
              :value="option.key"
            >
              {{ option.label }}
            </option>
          </select>

          <button
            type="button"
            class="btn btn-sm btn-outline-secondary"
            :aria-label="`Toggle sort direction from ${currentSortLabel}`"
            @click="emit('toggle-direction')"
          >
            <i class="bi" :class="sortDir === 'asc' ? 'bi-sort-down' : 'bi-sort-up'"></i>
          </button>
        </div>
      </div>
    </div>

    <AppLoadingState
      v-if="loading"
      message="Loading timecards..."
      spinner-class="mb-2"
      message-class="text-muted mb-0"
    />

    <AppAlert
      v-else-if="loadError"
      variant="danger"
      :message="loadError"
      class="mb-0"
    />

    <AppEmptyState
      v-else-if="!groupedTimecards.length"
      icon="bi bi-search"
      icon-class="fs-3"
      title="No matching timecards"
      message="Try a broader filter set or pick a different week."
      compact
    />

    <div v-else class="controller-timecard-browser__groups">
      <section
        v-for="group in groupedTimecards"
        :key="group.jobId"
        class="controller-timecard-browser__group"
      >
        <div class="controller-timecard-browser__group-header">
          <div class="controller-timecard-browser__group-heading">
            <div class="controller-timecard-browser__eyebrow">Job</div>
            <div class="controller-timecard-browser__group-title">{{ group.jobName }}</div>
            <div class="controller-timecard-browser__group-meta">
              {{ group.jobCode }} | {{ formatCountLabel(group.totalCount, 'timecard') }}
            </div>
          </div>

          <ControllerTimecardSummary
            class="controller-timecard-browser__group-summary"
            :draft-count="group.draftCount"
            :submitted-count="group.submittedCount"
            :total-hours="group.totalHours"
            :total-production="group.totalProduction"
            :total-line="group.totalLine"
            align="start"
          />
        </div>

        <div
          v-for="creatorGroup in group.creatorGroups"
          :key="`${group.jobId}-${creatorGroup.creatorKey}`"
          class="controller-timecard-browser__creator"
        >
          <div class="controller-timecard-browser__creator-header">
            <div class="controller-timecard-browser__creator-title">
              {{ creatorGroup.creatorName }}
            </div>
            <div class="controller-timecard-browser__creator-meta">
              {{ formatCountLabel(creatorGroup.totalCount, 'card') }}
            </div>
          </div>

          <div class="controller-timecard-browser__items">
            <AppSelectableListItem
              v-for="entry in creatorGroup.timecards"
              :key="entry.key"
              as="button"
              class="controller-timecard-browser__item"
              tone="muted"
              :selected="selectedKey === entry.key"
              @activate="handleSelect(entry)"
            >
              <div class="controller-timecard-browser__item-main">
                <div class="controller-timecard-browser__item-name">
                  {{ entry.timecard.employeeName || 'Unnamed Employee' }}
                </div>
                <div class="controller-timecard-browser__item-meta">
                  #{{ entry.timecard.employeeNumber || '-' }} | {{ entry.timecard.occupation || 'No occupation' }}
                </div>
                <div class="controller-timecard-browser__item-week">
                  {{ formatTimecardWeek(entry.timecard) }}
                </div>
              </div>

              <div class="controller-timecard-browser__item-side">
                <TimecardStatusBadge :status="entry.timecard.status" />
                <div class="controller-timecard-browser__item-metrics">
                  {{ formatMetric(entry.timecard.totals?.hoursTotal) }} hrs
                  <span aria-hidden="true">|</span>
                  {{ formatMetric(entry.timecard.totals?.productionTotal) }} prod
                </div>
              </div>
            </AppSelectableListItem>
          </div>
        </div>
      </section>
    </div>
  </AppSectionCard>
</template>
