<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import AppAlert from '@/components/common/AppAlert.vue'
import ControllerFilterCard from '@/components/controller/ControllerFilterCard.vue'
import ControllerGroupedResults from '@/components/controller/ControllerGroupedResults.vue'
import ControllerResultsToolbar from '@/components/controller/ControllerResultsToolbar.vue'
import ControllerStatCard from '@/components/controller/ControllerStatCard.vue'
import AppLoadingState from '@/components/common/AppLoadingState.vue'
import AppPageHeader from '@/components/layout/AppPageHeader.vue'
import { ROLES } from '@/constants/app'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useControllerFilters } from '@/composables/useControllerFilters'
import { useControllerTimecardData } from '@/composables/useControllerTimecardData'
import { useControllerTimecardEditing } from '@/composables/useControllerTimecardEditing'
import { useControllerTimecardResults } from '@/composables/useControllerTimecardResults'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { useJobsStore } from '@/stores/jobs'

const auth = useAuthStore()
const jobsStore = useJobsStore()
const { confirm } = useConfirmDialog()
const toast = useToast()

const isAdmin = computed(() => auth.role === ROLES.ADMIN)
const displayName = computed(() => auth.user?.displayName || auth.user?.email || 'Controller')

const {
  appliedFilters,
  activeFilterSummary,
  autoFilterSignature,
  buildFilterPayload,
  currentFilterSummary,
  currentWeekLabel,
  filterValidationError,
  formatSearchRange,
  jobOptions,
  loadedPeriod,
  loadedWeekLabel,
  pendingFilterChanges,
  resetFilterValues,
  selectedJobId,
  selectedRangeEndDate,
  selectedRangeStartDate,
  selectedSingleDate,
  statusFilter,
  subcontractedFilter,
  tradeFilter,
  firstNameFilter,
  lastNameFilter,
  useWeekRange,
  weekPickerConfig,
} = useControllerFilters({
  jobs: computed(() => jobsStore.jobs),
})

const {
  applyFilters,
  clearQueuedReload,
  downloadingCsv,
  downloadingPdf,
  handleDownload,
  isDownloading,
  loadedTimecardMap,
  loadingTimecards,
  queueAutoReload,
  recalculateReviewSummary,
  refreshingTimecards,
  reviewSummary,
  reviewTimecards,
  timecardsLoadError,
} = useControllerTimecardData({
  appliedFilters,
  loadedPeriod,
  buildFilterPayload,
  filterValidationError,
  pendingFilterChanges,
  formatSearchRange,
  buildTimecardKey,
  toast,
})

const {
  currentSortLabel,
  formatTimecardWeek,
  groupedTimecards,
  handleSortKeyChange,
  resetSort,
  sortOptions,
  timecardSortDir,
  timecardSortKey,
  toggleSortDirection,
} = useControllerTimecardResults({
  reviewTimecards,
  loadedTimecardMap,
  buildTimecardKey,
})

function buildTimecardKey(jobId: string, timecardId: string): string {
  return `${jobId}::${timecardId}`
}

function resetFilters() {
  resetFilterValues()
  resetSort()
}

const {
  addJobRow,
  cleanupAutoSaveTimers,
  editForm,
  editingTimecardId,
  expandedId,
  handleDeleteTimecard,
  handleGroupedResultsOpen,
  handleGroupedResultsRemoveJobRow,
  handleGroupedResultsUpdateAccount,
  handleGroupedResultsUpdateDiffValue,
  handleGroupedResultsUpdateHours,
  handleGroupedResultsUpdateJobNumber,
  handleGroupedResultsUpdateMileage,
  handleGroupedResultsUpdateNotes,
  handleGroupedResultsUpdateProduction,
  handleGroupedResultsUpdateSubsectionArea,
  isTimecardDeleteDisabled,
  isTimecardLocked,
  toggleEditingEmployee,
} = useControllerTimecardEditing({
  authRole: () => auth.role,
  isAdmin,
  reviewTimecards,
  loadedTimecardMap,
  buildTimecardKey,
  queueAutoReload,
  recalculateReviewSummary,
  confirm,
  toast,
})

onMounted(async () => {
  await Promise.all([
    jobsStore.fetchAllJobs(true),
    applyFilters(),
  ])
})

watch(autoFilterSignature, () => {
  queueAutoReload()
})

onBeforeUnmount(() => {
  clearQueuedReload()
  cleanupAutoSaveTimers()
})
</script>

<template>
  

  <div class="app-page app-page--wide">
    <AppPageHeader eyebrow="Controller Workspace" title="Timecard Search, Review & Edits" :subtitle="`Signed in as ${displayName}`" />

    <ControllerFilterCard
      v-model:use-week-range="useWeekRange"
      v-model:selected-single-date="selectedSingleDate"
      v-model:selected-range-start-date="selectedRangeStartDate"
      v-model:selected-range-end-date="selectedRangeEndDate"
      v-model:selected-job-id="selectedJobId"
      v-model:trade-filter="tradeFilter"
      v-model:first-name-filter="firstNameFilter"
      v-model:last-name-filter="lastNameFilter"
      v-model:subcontracted-filter="subcontractedFilter"
      v-model:status-filter="statusFilter"
      :week-picker-config="weekPickerConfig"
      :job-options="jobOptions"
      :current-week-label="currentWeekLabel"
      :current-filter-summary="currentFilterSummary"
      :pending-filter-changes="pendingFilterChanges"
      :refreshing-timecards="refreshingTimecards"
      :downloading-pdf="downloadingPdf"
      :downloading-csv="downloadingCsv"
      :is-downloading="isDownloading"
      :loading-timecards="loadingTimecards"
      :filter-validation-error="filterValidationError"
      @download="handleDownload"
      @reset="resetFilters"
    />

    <div class="row g-3 mb-4">
      <div class="col-6 col-xl-3">
        <ControllerStatCard label="Timecards" :value="reviewSummary.totalCount" :helper-text="loadedWeekLabel" />
      </div>

      <div class="col-6 col-xl-3">
        <ControllerStatCard
          label="Submitted"
          :value="reviewSummary.submittedCount"
          helper-text="Matching results"
          value-class="text-success"
        />
      </div>

      <div class="col-6 col-xl-3">
        <ControllerStatCard
          label="Drafts"
          :value="reviewSummary.draftCount"
          helper-text="Matching results"
          value-class="text-warning"
        />
      </div>

      <div class="col-6 col-xl-3">
        <ControllerStatCard
          label="Total Hours"
          :value="Number(reviewSummary.totalHours ?? 0).toFixed(2).replace(/\\.00$/, '')"
          helper-text="Across current search"
        />
      </div>
    </div>

    <div class="card controller-card app-section-card">
      <div class="card-header panel-header d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <div class="text-muted small mb-1">Controller Review</div>
          <h3 class="h5 mb-0">Grouped Timecards</h3>
        </div>

        <div class="text-end">
          <div class="small text-muted">Loaded range</div>
          <div class="fw-semibold">{{ loadedWeekLabel }}</div>
        </div>
      </div>

      <div class="card-body">
        <ControllerResultsToolbar
          :active-filter-summary="activeFilterSummary"
          :current-sort-label="currentSortLabel"
          :refreshing="refreshingTimecards"
          :sort-options="sortOptions"
          :sort-key="timecardSortKey"
          :sort-dir="timecardSortDir"
          @update:sort-key="handleSortKeyChange"
          @toggle-direction="toggleSortDirection"
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

        <AppAlert v-else-if="!groupedTimecards.length" variant="info" class="mb-0" message="No timecards found for the current search." />

        <ControllerGroupedResults
          v-else
          v-model:edit-form="editForm"
          :grouped-timecards="groupedTimecards"
          :expanded-id="expandedId"
          :editing-timecard-id="editingTimecardId"
          :is-admin="isAdmin"
          :format-timecard-week="formatTimecardWeek"
          :is-timecard-locked="isTimecardLocked"
          :is-timecard-delete-disabled="isTimecardDeleteDisabled"
          @toggle-open="handleGroupedResultsOpen"
          @toggle-edit="toggleEditingEmployee"
          @delete="handleDeleteTimecard"
          @add-job-row="addJobRow"
          @remove-job-row="handleGroupedResultsRemoveJobRow"
          @update-job-number="handleGroupedResultsUpdateJobNumber"
          @update-subsection-area="handleGroupedResultsUpdateSubsectionArea"
          @update-account="handleGroupedResultsUpdateAccount"
          @update-diff-value="handleGroupedResultsUpdateDiffValue"
          @update-hours="handleGroupedResultsUpdateHours"
          @update-production="handleGroupedResultsUpdateProduction"
          @update-mileage="handleGroupedResultsUpdateMileage"
          @update-notes="handleGroupedResultsUpdateNotes"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;

$controller-group-border: mix($surface-3, $primary, 82%);
$controller-divider: rgba($primary, 0.18);

.controller-card {
  background: $surface-2;
  border: 1px solid $border-color;
  color: $body-color;
}

.controller-loading-state {
  align-items: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 220px;
}

@media (max-width: 991px) {
}

@media (max-width: 575px) {
}
</style>
