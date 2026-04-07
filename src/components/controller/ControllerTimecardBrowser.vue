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
          Sorted by {{ currentSortLabel }}
        </div>
        <div v-if="refreshing" class="controller-timecard-browser__refreshing">
          Refreshing matching timecards...
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

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;

.controller-timecard-browser__body {
  display: grid;
  gap: 0.75rem;
  padding: 0.8rem;
}

.controller-timecard-browser--embedded :deep(.card-body) {
  padding-top: 0.95rem;
}

.controller-timecard-browser__controls {
  display: grid;
  gap: 0.6rem;
  grid-template-columns: 1fr;
}

.controller-timecard-browser__filters-label,
.controller-timecard-browser__sort-label,
.controller-timecard-browser__eyebrow {
  color: $text-muted;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.controller-timecard-browser__filters-value {
  font-size: 0.92rem;
  font-weight: 600;
  line-height: 1.35;
  margin-top: 0.15rem;
}

.controller-timecard-browser__refreshing {
  color: $warning;
  font-size: 0.82rem;
  margin-top: 0.2rem;
}

.controller-timecard-browser__filters-meta {
  color: $text-muted;
  font-size: 0.82rem;
  margin-top: 0.18rem;
}

.controller-timecard-browser__sort-row {
  align-items: center;
  display: grid;
  gap: 0.45rem;
  grid-template-columns: minmax(0, 1fr) auto;
  margin-top: 0.2rem;
}

.controller-timecard-browser__groups {
  display: grid;
  gap: 0.75rem;
}

.controller-timecard-browser__group {
  background: rgba($surface-2, 0.7);
  border: 1px solid rgba($border-color, 0.8);
  border-radius: 0.8rem;
  overflow: hidden;
}

.controller-timecard-browser__group-header {
  align-items: start;
  background: linear-gradient(180deg, rgba($primary, 0.08) 0%, rgba($primary, 0.03) 100%);
  display: grid;
  gap: 0.45rem;
  grid-template-columns: minmax(0, 1fr);
  padding: 0.7rem 0.8rem;
}

.controller-timecard-browser__group-heading {
  min-width: 0;
}

.controller-timecard-browser__group-title {
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
  margin-top: 0.1rem;
  text-wrap: balance;
}

.controller-timecard-browser__group-meta,
.controller-timecard-browser__creator-meta,
.controller-timecard-browser__item-meta,
.controller-timecard-browser__item-week,
.controller-timecard-browser__item-metrics {
  color: $text-muted;
  font-size: 0.8rem;
}

.controller-timecard-browser__group-summary {
  align-items: start;
  justify-items: start;
}

.controller-timecard-browser__creator {
  border-top: 1px solid rgba($border-color, 0.65);
  padding: 0.65rem 0.7rem 0.7rem;
}

.controller-timecard-browser__creator-header {
  align-items: center;
  display: flex;
  gap: 0.6rem;
  justify-content: space-between;
  margin-bottom: 0.45rem;
}

.controller-timecard-browser__creator-title {
  font-size: 0.9rem;
  font-weight: 700;
}

.controller-timecard-browser__items {
  display: grid;
  gap: 0.4rem;
}

.controller-timecard-browser__item {
  align-items: start;
  background: rgba($surface, 0.9);
  border-color: rgba($border-color, 0.82);
  border-radius: 0.75rem;
  display: grid;
  gap: 0.55rem;
  grid-template-columns: minmax(0, 1fr) auto;
  padding: 0.6rem 0.7rem;
  text-align: left;
}

.controller-timecard-browser__item-name {
  font-size: 0.94rem;
  font-weight: 700;
  line-height: 1.2;
}

.controller-timecard-browser__item-meta,
.controller-timecard-browser__item-week {
  margin-top: 0.14rem;
}

.controller-timecard-browser__item-side {
  align-items: flex-end;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  text-align: right;
}

.controller-timecard-browser__item-metrics {
  font-weight: 600;
}

.controller-timecard-browser :deep(.app-selectable-list-item--selected) {
  border-color: rgba($primary, 0.9);
  box-shadow: 0 0 0 0.14rem rgba($primary, 0.18);
}

.controller-timecard-browser :deep(.app-selectable-list-item--selected .controller-timecard-browser__item-name) {
  color: $body-color;
}

.controller-timecard-browser :deep(.controller-timecard-summary) {
  gap: 0.18rem;
}

.controller-timecard-browser :deep(.controller-timecard-summary__metrics) {
  font-size: 0.78rem;
}

.controller-timecard-browser :deep(.controller-timecard-summary__count) {
  font-size: 0.82rem;
}

.controller-timecard-browser :deep(.app-badge-pill) {
  font-size: 0.72rem;
  padding: 0.28rem 0.58rem;
}

@media (min-width: 1500px) {
  .controller-timecard-browser__group-header {
    grid-template-columns: minmax(0, 1fr) auto;
  }
}

@media (max-width: 767px) {
  .controller-timecard-browser__body {
    padding: 0.8rem;
  }

  .controller-timecard-browser__item {
    grid-template-columns: 1fr;
  }

  .controller-timecard-browser__item-side {
    align-items: flex-start;
    text-align: left;
  }
}
</style>
