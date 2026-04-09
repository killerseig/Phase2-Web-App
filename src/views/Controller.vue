<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppBadge from '@/components/common/AppBadge.vue'
import AppMasterDetailWorkspace from '@/components/common/AppMasterDetailWorkspace.vue'
import ControllerFilterCard from '@/components/controller/ControllerFilterCard.vue'
import ControllerTimecardBrowser from '@/components/controller/ControllerTimecardBrowser.vue'
import ControllerTimecardDetailPane from '@/components/controller/ControllerTimecardDetailPane.vue'
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

const totalHoursLabel = computed(() => (
  `${Number(reviewSummary.value.totalHours ?? 0).toFixed(1).replace(/\.0$/, '')} hrs`
))

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

const selectedTimecardKey = ref<string | null>(null)

const {
  cleanupAutoSaveTimers,
  editForm,
  editingTimecardId,
  handleDeleteTimecard,
  handleGroupedResultsUpdateAccount,
  handleGroupedResultsUpdateDiffValue,
  handleGroupedResultsUpdateFooterField,
  handleGroupedResultsUpdateHours,
  handleGroupedResultsUpdateJobNumber,
  handleGroupedResultsUpdateNotes,
  handleGroupedResultsUpdateOffValue,
  handleGroupedResultsUpdateProduction,
  handleGroupedResultsUpdateUnitCost,
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

const flattenedEntries = computed(() => (
  groupedTimecards.value.flatMap((group) => (
    group.creatorGroups.flatMap((creatorGroup) => creatorGroup.timecards)
  ))
))

const selectedEntry = computed(() => {
  if (!selectedTimecardKey.value) return flattenedEntries.value[0] ?? null
  return flattenedEntries.value.find((entry) => entry.key === selectedTimecardKey.value) ?? flattenedEntries.value[0] ?? null
})

const selectedTimecard = computed(() => selectedEntry.value?.timecard ?? null)
const selectedCardLocked = computed(() => (
  selectedTimecard.value ? isTimecardLocked(selectedTimecard.value) : true
))
const selectedDeleteDisabled = computed(() => (
  selectedTimecard.value ? isTimecardDeleteDisabled(selectedTimecard.value) : true
))
const selectedIsEditing = computed(() => (
  Boolean(selectedEntry.value && editingTimecardId.value === selectedEntry.value.key)
))

function selectTimecard(key: string) {
  selectedTimecardKey.value = key
}

function withSelectedEntry(run: (entry: NonNullable<typeof selectedEntry.value>) => void) {
  const entry = selectedEntry.value
  if (!entry) return
  run(entry)
}

function handleSelectedToggleEdit() {
  withSelectedEntry((entry) => {
    selectTimecard(entry.key)
    toggleEditingEmployee(entry)
  })
}

function handleSelectedDelete() {
  withSelectedEntry((entry) => {
    void handleDeleteTimecard(entry)
  })
}

function handleSelectedUpdateJobNumber(payload: { jobIndex: number; value: string }) {
  withSelectedEntry((entry) => handleGroupedResultsUpdateJobNumber({ timecard: entry.timecard, ...payload }))
}

function handleSelectedUpdateSubsectionArea(payload: { jobIndex: number; value: string }) {
  withSelectedEntry((entry) => handleGroupedResultsUpdateSubsectionArea({ timecard: entry.timecard, ...payload }))
}

function handleSelectedUpdateAccount(payload: { jobIndex: number; value: string }) {
  withSelectedEntry((entry) => handleGroupedResultsUpdateAccount({ timecard: entry.timecard, ...payload }))
}

function handleSelectedUpdateDiffValue(payload: { jobIndex: number; field: 'difH' | 'difP' | 'difC'; value: string }) {
  withSelectedEntry((entry) => handleGroupedResultsUpdateDiffValue({ timecard: entry.timecard, ...payload }))
}

function handleSelectedUpdateOffValue(payload: { jobIndex: number; field: 'offHours' | 'offProduction' | 'offCost'; value: number }) {
  withSelectedEntry((entry) => handleGroupedResultsUpdateOffValue({ timecard: entry.timecard, ...payload }))
}

function handleSelectedUpdateHours(payload: { jobIndex: number; dayIndex: number; value: number }) {
  withSelectedEntry((entry) => handleGroupedResultsUpdateHours({ timecard: entry.timecard, ...payload }))
}

function handleSelectedUpdateProduction(payload: { jobIndex: number; dayIndex: number; value: number }) {
  withSelectedEntry((entry) => handleGroupedResultsUpdateProduction({ timecard: entry.timecard, ...payload }))
}

function handleSelectedUpdateUnitCost(payload: { jobIndex: number; dayIndex: number; value: number | null }) {
  withSelectedEntry((entry) => handleGroupedResultsUpdateUnitCost({ timecard: entry.timecard, ...payload }))
}

function handleSelectedUpdateFooterField(payload: { field: 'footerJobOrGl' | 'footerAccount' | 'footerOffice' | 'footerAmount'; value: string }) {
  withSelectedEntry((entry) => handleGroupedResultsUpdateFooterField({ timecard: entry.timecard, ...payload }))
}

function handleSelectedUpdateNotes(value: string) {
  withSelectedEntry((entry) => handleGroupedResultsUpdateNotes({ timecard: entry.timecard, value }))
}

function handleEditFormUpdate(value: typeof editForm.value) {
  editForm.value = value
}

onMounted(async () => {
  await Promise.all([
    jobsStore.fetchAllJobs(true),
    applyFilters(),
  ])
})

watch(autoFilterSignature, () => {
  queueAutoReload()
})

watch(flattenedEntries, (entries) => {
  if (!entries.length) {
    selectedTimecardKey.value = null
    return
  }

  if (!selectedTimecardKey.value || !entries.some((entry) => entry.key === selectedTimecardKey.value)) {
    selectedTimecardKey.value = entries[0]?.key ?? null
  }
}, { immediate: true })

onBeforeUnmount(() => {
  clearQueuedReload()
  cleanupAutoSaveTimers()
})
</script>

<template>
  <div class="app-page app-page--wide controller-page">
    <AppPageHeader
      eyebrow="Controller Workspace"
      title="Timecards"
      subtitle="Search, review, and edit weekly timecards."
      compact
    >
      <template #meta>
        <span>Signed in as {{ displayName }}</span>
      </template>
      <template #badges>
        <AppBadge :label="loadedWeekLabel" variant-class="text-bg-secondary" />
        <AppBadge :label="`${reviewSummary.totalCount} cards`" variant-class="text-bg-info" />
        <AppBadge :label="`${reviewSummary.submittedCount} submitted`" variant-class="text-bg-success" />
        <AppBadge :label="`${reviewSummary.draftCount} drafts`" variant-class="text-bg-warning" />
        <AppBadge :label="totalHoursLabel" variant-class="text-bg-secondary" />
      </template>
    </AppPageHeader>

    <AppMasterDetailWorkspace
      browser-column="minmax(270px, 300px)"
      controls-column="minmax(300px, 340px)"
      browse-label="Timecards"
      controls-label="Filters"
      browser-title="Timecard Browser"
      controls-title="Search Filters"
    >
      <template #browser="{ closeDrawer, browserInDrawer }">
        <ControllerTimecardBrowser
          :grouped-timecards="groupedTimecards"
          :selected-key="selectedTimecardKey"
          :active-filter-summary="activeFilterSummary"
          :current-sort-label="currentSortLabel"
          :refreshing="refreshingTimecards"
          :loading="loadingTimecards"
          :load-error="timecardsLoadError"
          :sort-options="sortOptions"
          :sort-key="timecardSortKey"
          :sort-dir="timecardSortDir"
          :format-timecard-week="formatTimecardWeek"
          :embedded="browserInDrawer"
          @select="(key) => { selectTimecard(key); closeDrawer() }"
          @update:sort-key="handleSortKeyChange"
          @toggle-direction="toggleSortDirection"
        />
      </template>

      <template #controls="{ controlsInDrawer }">
        <div class="controller-page__rail">
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
            :embedded="controlsInDrawer"
            @download="handleDownload"
            @reset="resetFilters"
          />
        </div>
      </template>

      <template #default="{ controlsInDrawer }">
        <ControllerTimecardDetailPane
          :selected-entry="selectedEntry"
          :edit-form="editForm"
          :is-editing="selectedIsEditing"
          :job-fields-locked="selectedCardLocked"
          :notes-locked="selectedCardLocked"
          :edit-disabled="selectedCardLocked"
          :delete-disabled="selectedDeleteDisabled"
          :format-timecard-week="formatTimecardWeek"
          @update:edit-form="handleEditFormUpdate"
          @toggle-edit="handleSelectedToggleEdit"
          @delete="handleSelectedDelete"
          @update-job-number="handleSelectedUpdateJobNumber"
          @update-subsection-area="handleSelectedUpdateSubsectionArea"
          @update-account="handleSelectedUpdateAccount"
          @update-diff-value="handleSelectedUpdateDiffValue"
          @update-off-value="handleSelectedUpdateOffValue"
          @update-hours="handleSelectedUpdateHours"
          @update-production="handleSelectedUpdateProduction"
          @update-unit-cost="handleSelectedUpdateUnitCost"
          @update-footer-field="handleSelectedUpdateFooterField"
          @update-notes="handleSelectedUpdateNotes"
        />
      </template>
    </AppMasterDetailWorkspace>
  </div>
</template>
