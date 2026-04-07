<script setup lang="ts">
import AppAlert from '@/components/common/AppAlert.vue'
import AppLoadingState from '@/components/common/AppLoadingState.vue'
import AppSectionCard from '@/components/common/AppSectionCard.vue'
import AppToolbarMeta from '@/components/common/AppToolbarMeta.vue'
import ControllerGroupedResults from '@/components/controller/ControllerGroupedResults.vue'
import ControllerResultsToolbar from '@/components/controller/ControllerResultsToolbar.vue'
import type {
  ControllerGroupedTimecard,
  ControllerJobGroup,
  ControllerSortKey,
  ControllerSortOption,
} from '@/types/controller'
import type { WorkbookFooterField, WorkbookOffField } from '@/types/timecards'
import type { TimecardEmployeeEditorForm, TimecardModel } from '@/utils/timecardUtils'

type DiffField = 'difH' | 'difP' | 'difC'

defineProps<{
  activeFilterSummary: string
  currentSortLabel: string
  loadedWeekLabel: string
  refreshing: boolean
  sortOptions: ControllerSortOption[]
  sortKey: ControllerSortKey
  sortDir: 'asc' | 'desc'
  loadingTimecards: boolean
  timecardsLoadError: string
  groupedTimecards: ControllerJobGroup[]
  editForm: TimecardEmployeeEditorForm
  expandedId: string | null
  editingTimecardId: string | null
  isAdmin: boolean
  formatTimecardWeek: (timecard: TimecardModel) => string
  isTimecardLocked: (timecard: TimecardModel) => boolean
  isTimecardDeleteDisabled: (timecard: TimecardModel) => boolean
}>()

const emit = defineEmits<{
  'update:sortKey': [value: ControllerSortKey]
  'toggle-direction': []
  'update:editForm': [value: TimecardEmployeeEditorForm]
  'toggle-open': [payload: { key: string; open: boolean }]
  'toggle-edit': [entry: ControllerGroupedTimecard]
  delete: [entry: ControllerGroupedTimecard]
  'add-job-row': [timecard: TimecardModel]
  'remove-job-row': [payload: { timecard: TimecardModel; jobIndex: number }]
  'update-job-number': [payload: { timecard: TimecardModel; jobIndex: number; value: string }]
  'update-subsection-area': [payload: { timecard: TimecardModel; jobIndex: number; value: string }]
  'update-account': [payload: { timecard: TimecardModel; jobIndex: number; value: string }]
  'update-diff-value': [payload: { timecard: TimecardModel; jobIndex: number; field: DiffField; value: string }]
  'update-off-value': [payload: { timecard: TimecardModel; jobIndex: number; field: WorkbookOffField; value: number }]
  'update-hours': [payload: { timecard: TimecardModel; jobIndex: number; dayIndex: number; value: number }]
  'update-production': [payload: { timecard: TimecardModel; jobIndex: number; dayIndex: number; value: number }]
  'update-unit-cost': [payload: { timecard: TimecardModel; jobIndex: number; dayIndex: number; value: number | null }]
  'update-footer-field': [payload: { timecard: TimecardModel; field: WorkbookFooterField; value: string }]
  'update-mileage': [payload: { timecard: TimecardModel; value: string }]
  'update-notes': [payload: { timecard: TimecardModel; value: string }]
}>()
</script>

<template>
  <AppSectionCard class="mb-0 controller-review-card">
    <template #header>
      <div class="app-toolbar-split app-toolbar-split--center w-100">
        <AppToolbarMeta
          eyebrow="Controller Review"
          title="Grouped Timecards"
          title-tag="h3"
          title-class="h5 mb-0"
        />

        <AppToolbarMeta
          eyebrow="Loaded range"
          :title="loadedWeekLabel"
          title-tag="div"
          title-class="fw-semibold"
          wrapper-class="text-end"
          compact
        />
      </div>
    </template>

    <ControllerResultsToolbar
      :active-filter-summary="activeFilterSummary"
      :current-sort-label="currentSortLabel"
      :refreshing="refreshing"
      :sort-options="sortOptions"
      :sort-key="sortKey"
      :sort-dir="sortDir"
      @update:sort-key="(value) => emit('update:sortKey', value)"
      @toggle-direction="emit('toggle-direction')"
    />

    <AppLoadingState
      v-if="loadingTimecards"
      class="controller-loading-state"
      sr-label="Loading timecards"
      message="Loading timecards..."
      spinner-class="mb-3"
      aria-live="off"
    />

    <AppAlert
      v-else-if="timecardsLoadError"
      variant="danger"
      title="Unable to load timecards."
      :message="timecardsLoadError"
      class="mb-0"
    />

    <AppAlert
      v-else-if="!groupedTimecards.length"
      variant="info"
      class="mb-0"
      message="No timecards found for the current search."
    />

    <ControllerGroupedResults
      v-else
      :edit-form="editForm"
      :grouped-timecards="groupedTimecards"
      :expanded-id="expandedId"
      :editing-timecard-id="editingTimecardId"
      :is-admin="isAdmin"
      :format-timecard-week="formatTimecardWeek"
      :is-timecard-locked="isTimecardLocked"
      :is-timecard-delete-disabled="isTimecardDeleteDisabled"
      @update:edit-form="emit('update:editForm', $event)"
      @toggle-open="emit('toggle-open', $event)"
      @toggle-edit="emit('toggle-edit', $event)"
      @delete="emit('delete', $event)"
      @add-job-row="emit('add-job-row', $event)"
      @remove-job-row="emit('remove-job-row', $event)"
      @update-job-number="emit('update-job-number', $event)"
      @update-subsection-area="emit('update-subsection-area', $event)"
      @update-account="emit('update-account', $event)"
      @update-diff-value="emit('update-diff-value', $event)"
      @update-off-value="emit('update-off-value', $event)"
      @update-hours="emit('update-hours', $event)"
      @update-production="emit('update-production', $event)"
      @update-unit-cost="emit('update-unit-cost', $event)"
      @update-footer-field="emit('update-footer-field', $event)"
      @update-mileage="emit('update-mileage', $event)"
      @update-notes="emit('update-notes', $event)"
    />
  </AppSectionCard>
</template>

<style scoped lang="scss">
.controller-loading-state {
  align-items: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 220px;
}

.controller-review-card :deep(.card-header) {
  padding: 0.85rem 1rem;
}

.controller-review-card :deep(.card-body) {
  padding: 0.95rem 1rem 1rem;
}
</style>
