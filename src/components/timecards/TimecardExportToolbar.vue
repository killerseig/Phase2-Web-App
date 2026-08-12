<script setup lang="ts">
import TimecardExportActionsPanel from '@/components/timecards/TimecardExportActionsPanel.vue'
import TimecardExportArchiveFiltersPanel from '@/components/timecards/TimecardExportArchiveFiltersPanel.vue'
import TimecardExportSavedWeeksPanel from '@/components/timecards/TimecardExportSavedWeeksPanel.vue'
import TimecardExportSortPanel from '@/components/timecards/TimecardExportSortPanel.vue'
import TimecardExportStatusBar, { type TimecardExportStatusSignal } from '@/components/timecards/TimecardExportStatusBar.vue'
import TimecardExportWeekFiltersPanel from '@/components/timecards/TimecardExportWeekFiltersPanel.vue'
import TimecardToolbarShell from '@/components/timecards/TimecardToolbarShell.vue'
import TimecardToolbarTabs, { type TimecardToolbarTab } from '@/components/timecards/TimecardToolbarTabs.vue'
import type { TimecardWeekRecord } from '@/types/domain'

type DateFilterMode = 'single' | 'range'
type WeekStatusFilter = 'submitted' | 'draft' | 'all'
type SortMode = 'number' | 'name'

interface TimecardExportToolbarFilters {
  dateMode: DateFilterMode
  singleWeekEndDate: string
  rangeStartDate: string
  rangeEndDate: string
  selectedJobIds: string[]
  foreman: string
  status: WeekStatusFilter
  weekSearch: string
  cardSearch: string
}

type ToolbarFilterField = keyof TimecardExportToolbarFilters
type ToolbarFilterValue = string | string[]

defineProps<{
  tabs: readonly TimecardToolbarTab[]
  activeMobileToolbarTab: string
  filters: TimecardExportToolbarFilters
  dateModeOptions: { label: string; value: DateFilterMode }[]
  availableJobOptions: { id: string; code: string; name: string; label: string }[]
  availableForemanOptions: { label: string; value: string }[]
  weekStatusOptions: { label: string; value: WeekStatusFilter }[]
  sortMode: SortMode
  canUseTimecardExport: boolean
  actionLoading: boolean
  showCreateTray: boolean
  filteredWeeks: readonly TimecardWeekRecord[]
  weeksLoading: boolean
  statusSignals: readonly TimecardExportStatusSignal[]
  formatDate: (value: string) => string
  formatWeekSubtitle: (week: TimecardWeekRecord) => string
}>()

const emit = defineEmits<{
  selectMobileTab: [key: string]
  updateFilter: [field: ToolbarFilterField, value: ToolbarFilterValue]
  updateSortMode: [value: SortMode]
  setAllCardsCompact: [value: boolean]
  exportPdf: []
  exportCsv: []
  toggleCreateTray: []
  deleteWeek: [week: TimecardWeekRecord]
  reopenWeek: [week: TimecardWeekRecord]
  submitWeek: [week: TimecardWeekRecord]
}>()

</script>

<template>
  <TimecardToolbarShell stretch-at="960">
    <TimecardToolbarTabs
      :tabs="tabs"
      :active-key="activeMobileToolbarTab"
      toolbar-label="Timecard export tools"
      tab-id-prefix="timecard-export-tab"
      panel-id-prefix="timecard-export-panel"
      collapse-at="960"
      @select-tab="emit('selectMobileTab', $event)"
    />

    <TimecardExportWeekFiltersPanel
      :filters="filters"
      :date-mode-options="dateModeOptions"
      :mobile-active="activeMobileToolbarTab === 'weeks'"
      @update-filter="(field, value) => emit('updateFilter', field, value)"
    />

    <TimecardExportArchiveFiltersPanel
      :filters="filters"
      :available-job-options="availableJobOptions"
      :available-foreman-options="availableForemanOptions"
      :week-status-options="weekStatusOptions"
      :mobile-active="activeMobileToolbarTab === 'archive'"
      @update-filter="(field, value) => emit('updateFilter', field, value)"
    />

    <TimecardExportSortPanel
      :sort-mode="sortMode"
      :card-search="filters.cardSearch"
      :mobile-active="activeMobileToolbarTab === 'sort'"
      @update-sort-mode="emit('updateSortMode', $event)"
      @update-card-search="emit('updateFilter', 'cardSearch', $event)"
    />

    <TimecardExportActionsPanel
      :can-use-timecard-export="canUseTimecardExport"
      :action-loading="actionLoading"
      :show-create-tray="showCreateTray"
      :mobile-active="activeMobileToolbarTab === 'actions'"
      @set-all-cards-compact="emit('setAllCardsCompact', $event)"
      @export-pdf="emit('exportPdf')"
      @export-csv="emit('exportCsv')"
      @toggle-create-tray="emit('toggleCreateTray')"
    />

    <TimecardExportSavedWeeksPanel
      :weeks="filteredWeeks"
      :weeks-loading="weeksLoading"
      :can-use-timecard-export="canUseTimecardExport"
      :action-loading="actionLoading"
      :mobile-active="activeMobileToolbarTab === 'saved'"
      :format-date="formatDate"
      :format-subtitle="formatWeekSubtitle"
      @delete-week="emit('deleteWeek', $event)"
      @reopen-week="emit('reopenWeek', $event)"
      @submit-week="emit('submitWeek', $event)"
    />

    <TimecardExportStatusBar :signals="statusSignals" />
  </TimecardToolbarShell>
</template>

<style src="./timecard-toolbar-content.css" scoped></style>

<style scoped>
@media (min-width: 1280px) {
  .timecards-toolbar {
    grid-template-columns:
      minmax(18rem, 1.22fr)
      minmax(18rem, 1.22fr)
      minmax(17rem, 1.04fr)
      minmax(16.5rem, 1.05fr)
      minmax(17rem, 1.1fr);
    grid-template-areas:
      'weeks archive sort actions saved'
      'weeks archive sort actions saved'
      'status status status status status';
  }

  .timecards-toolbar__group--weeks {
    grid-area: weeks;
  }

  .timecards-toolbar__group--archive {
    grid-area: archive;
  }

  .timecards-toolbar__group--sort {
    grid-area: sort;
  }

  .timecards-toolbar__group--actions {
    grid-area: actions;
  }

  .timecards-toolbar__group--history {
    grid-area: saved;
  }

  .timecards-toolbar__group--status-bar {
    grid-area: status;
  }
}

@media (max-width: 960px) {
  .timecards-toolbar {
    grid-template-columns: 1fr;
  }

}
</style>
