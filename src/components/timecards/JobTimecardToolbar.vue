<script setup lang="ts">
import JobTimecardActionsPanel from '@/components/timecards/JobTimecardActionsPanel.vue'
import JobTimecardSavedWeeksPanel from '@/components/timecards/JobTimecardSavedWeeksPanel.vue'
import JobTimecardSearchPanel from '@/components/timecards/JobTimecardSearchPanel.vue'
import JobTimecardSortPanel from '@/components/timecards/JobTimecardSortPanel.vue'
import JobTimecardStatusBar from '@/components/timecards/JobTimecardStatusBar.vue'
import JobTimecardWeekPanel from '@/components/timecards/JobTimecardWeekPanel.vue'
import TimecardToolbarShell from '@/components/timecards/TimecardToolbarShell.vue'
import TimecardToolbarTabs from '@/components/timecards/TimecardToolbarTabs.vue'
import type { TimecardWeekRecord } from '@/types/domain'

type WorkbookSortMode = 'name' | 'number'
type MobileToolbarTabKey = 'week' | 'search' | 'actions' | 'sort' | 'history'

const mobileToolbarTabs: Array<{ key: MobileToolbarTabKey; label: string }> = [
  { key: 'week', label: 'Week' },
  { key: 'search', label: 'Search' },
  { key: 'actions', label: 'Actions' },
  { key: 'sort', label: 'Sort' },
  { key: 'history', label: 'Saved' },
]

defineProps<{
  activeMobileTab: MobileToolbarTabKey
  displayJobCode: string
  displayJobName: string
  selectedWeekEndDate: string
  cardSearchTerm: string
  canCreateSelectedWeek: boolean
  actionLoading: boolean
  ensuringWeek: boolean
  canEditWeek: boolean
  hasSelectedWeek: boolean
  cardCount: number
  showCreateTray: boolean
  sortMode: WorkbookSortMode
  recentWeeks: TimecardWeekRecord[]
  activeWeekId: string | null
  weeksLoading: boolean
  weekRangeLabel: string
  weekStatusLabel: string
  selectedWeekSubmitted: boolean
  saveError: string
  saveStateLabel: string
}>()

const emit = defineEmits<{
  updateActiveMobileTab: [value: MobileToolbarTabKey]
  updateCardSearchTerm: [value: string]
  updateSortMode: [value: WorkbookSortMode]
  weekEndingInput: [event: Event]
  weekEndingPickerOpen: [event: Event]
  createWeek: []
  toggleCreateTray: []
  submitWeek: []
  expandAll: []
  compactAll: []
  sortCards: []
  selectWeek: [week: TimecardWeekRecord]
}>()
</script>

<template>
  <TimecardToolbarShell as="header">
    <TimecardToolbarTabs
      :tabs="mobileToolbarTabs"
      :active-key="activeMobileTab"
      toolbar-label="Timecard tools"
      tab-id-prefix="timecards-toolbar-tab"
      panel-id-prefix="timecards-toolbar-panel"
      collapse-at="900"
      @select-tab="emit('updateActiveMobileTab', $event as MobileToolbarTabKey)"
    />

    <JobTimecardWeekPanel
      :display-job-code="displayJobCode"
      :display-job-name="displayJobName"
      :selected-week-end-date="selectedWeekEndDate"
      :mobile-active="activeMobileTab === 'week'"
      @week-ending-input="emit('weekEndingInput', $event)"
      @week-ending-picker-open="emit('weekEndingPickerOpen', $event)"
    />

    <JobTimecardSearchPanel
      :card-search-term="cardSearchTerm"
      :mobile-active="activeMobileTab === 'search'"
      @update-card-search-term="emit('updateCardSearchTerm', $event)"
    />

    <JobTimecardActionsPanel
      :can-create-selected-week="canCreateSelectedWeek"
      :action-loading="actionLoading"
      :ensuring-week="ensuringWeek"
      :can-edit-week="canEditWeek"
      :has-selected-week="hasSelectedWeek"
      :card-count="cardCount"
      :show-create-tray="showCreateTray"
      :mobile-active="activeMobileTab === 'actions'"
      @create-week="emit('createWeek')"
      @toggle-create-tray="emit('toggleCreateTray')"
      @submit-week="emit('submitWeek')"
      @expand-all="emit('expandAll')"
      @compact-all="emit('compactAll')"
    />

    <JobTimecardSortPanel
      :sort-mode="sortMode"
      :action-loading="actionLoading"
      :can-edit-week="canEditWeek"
      :card-count="cardCount"
      :mobile-active="activeMobileTab === 'sort'"
      @update-sort-mode="emit('updateSortMode', $event)"
      @sort-cards="emit('sortCards')"
    />

    <JobTimecardSavedWeeksPanel
      :recent-weeks="recentWeeks"
      :active-week-id="activeWeekId"
      :weeks-loading="weeksLoading"
      :mobile-active="activeMobileTab === 'history'"
      @select-week="emit('selectWeek', $event)"
    />

    <JobTimecardStatusBar
      :week-range-label="weekRangeLabel"
      :week-status-label="weekStatusLabel"
      :selected-week-submitted="selectedWeekSubmitted"
      :card-count="cardCount"
      :save-error="saveError"
      :save-state-label="saveStateLabel"
    />
  </TimecardToolbarShell>
</template>

<style src="./timecard-toolbar-content.css" scoped></style>

<style scoped>
@media (min-width: 1280px) {
  .timecards-toolbar {
    grid-template-columns:
      minmax(13.75rem, 1.15fr)
      minmax(12.5rem, 0.95fr)
      minmax(12rem, 0.86fr)
      minmax(12.5rem, 0.9fr)
      minmax(12rem, 0.9fr);
    grid-template-areas:
      'details search sort actions history'
      'details search sort actions history'
      'status status status status status';
  }

  .timecards-toolbar__group--details {
    grid-area: details;
  }

  .timecards-toolbar__group--search {
    grid-area: search;
  }

  .timecards-toolbar__group--sort {
    grid-area: sort;
  }

  .timecards-toolbar__group--actions {
    grid-area: actions;
  }

  .timecards-toolbar__group--history {
    grid-area: history;
  }

  .timecards-toolbar__group--status-bar {
    grid-area: status;
  }
}

@media (max-width: 1600px) {
  .timecards-toolbar {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr));
  }
}

@media (max-width: 1180px) {
  .timecards-toolbar {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr));
  }
}

@media (max-width: 900px) {
  .timecards-toolbar {
    grid-template-columns: 1fr;
    gap: 0.65rem;
  }
}
</style>
