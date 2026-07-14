<script setup lang="ts">
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import AppSearchInput from '@/components/common/AppSearchInput.vue'
import AppTextInput from '@/components/common/AppTextInput.vue'
import TimecardExportSavedWeeksPanel from '@/components/timecards/TimecardExportSavedWeeksPanel.vue'
import TimecardExportStatusBar, { type TimecardExportStatusSignal } from '@/components/timecards/TimecardExportStatusBar.vue'
import TimecardButton from '@/components/timecards/TimecardButton.vue'
import TimecardSortModePicker from '@/components/timecards/TimecardSortModePicker.vue'
import TimecardToolbarTabs, { type TimecardToolbarTab } from '@/components/timecards/TimecardToolbarTabs.vue'
import type { TimecardWeekRecord } from '@/types/domain'
import { openNativeDatePicker, readInputValue } from '@/utils/domEvents'

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
  isAdmin: boolean
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
}>()

function updateTextFilter(field: ToolbarFilterField, event: Event) {
  emit('updateFilter', field, readInputValue(event))
}

function updateSelectFilter(field: ToolbarFilterField, value: unknown) {
  emit('updateFilter', field, value as ToolbarFilterValue)
}

</script>

<template>
  <section class="timecards-toolbar">
    <TimecardToolbarTabs
      :tabs="tabs"
      :active-key="activeMobileToolbarTab"
      toolbar-label="Timecard export tools"
      tab-id-prefix="timecard-export-tab"
      panel-id-prefix="timecard-export-panel"
      collapse-at="960"
      @select-tab="emit('selectMobileTab', $event)"
    />

    <fieldset
      id="timecard-export-panel-weeks"
      class="timecards-toolbar__group timecards-toolbar__group--filters timecards-toolbar__group--weeks"
      :class="{ 'timecards-toolbar__group--mobile-active': activeMobileToolbarTab === 'weeks' }"
      role="tabpanel"
      :aria-labelledby="'timecard-export-tab-weeks'"
    >
      <legend class="timecards-toolbar__legend">Week Filters</legend>
      <label class="timecards-toolbar__search">
        <span>Search Weeks</span>
        <AppSearchInput
          :model-value="filters.weekSearch"
          data-testid="timecard-export-week-search"
          placeholder="Job, foreman, or date"
          @update:model-value="emit('updateFilter', 'weekSearch', $event)"
        />
      </label>

      <div class="timecards-toolbar__stack timecards-toolbar__stack--date-filters">
        <label class="timecards-toolbar__search">
          <span>Date Mode</span>
          <Select
            :model-value="filters.dateMode"
            class="timecards-toolbar__select"
            :options="dateModeOptions"
            option-label="label"
            option-value="value"
            overlay-class="timecards-toolbar__select-overlay"
            :unstyled="false"
            fluid
            @update:model-value="updateSelectFilter('dateMode', $event)"
          />
        </label>

        <div
          class="timecards-toolbar__date-row"
          :class="{ 'timecards-toolbar__date-row--range': filters.dateMode === 'range' }"
        >
          <label v-if="filters.dateMode === 'single'" class="timecards-toolbar__search">
            <span>Week Ending</span>
            <AppTextInput
              :model-value="filters.singleWeekEndDate"
              type="date"
              @change="updateTextFilter('singleWeekEndDate', $event)"
              @click="openNativeDatePicker"
            />
          </label>

          <template v-else>
            <label class="timecards-toolbar__search">
              <span>Start Date</span>
              <AppTextInput
                :model-value="filters.rangeStartDate"
                type="date"
                @change="updateTextFilter('rangeStartDate', $event)"
                @click="openNativeDatePicker"
              />
            </label>

            <label class="timecards-toolbar__search">
              <span>End Date</span>
              <AppTextInput
                :model-value="filters.rangeEndDate"
                type="date"
                @change="updateTextFilter('rangeEndDate', $event)"
                @click="openNativeDatePicker"
              />
            </label>
          </template>
        </div>
      </div>
    </fieldset>

    <fieldset
      id="timecard-export-panel-archive"
      class="timecards-toolbar__group timecards-toolbar__group--filters timecards-toolbar__group--archive"
      :class="{ 'timecards-toolbar__group--mobile-active': activeMobileToolbarTab === 'archive' }"
      role="tabpanel"
      :aria-labelledby="'timecard-export-tab-archive'"
    >
      <legend class="timecards-toolbar__legend">Archive Filters</legend>
      <div class="timecards-toolbar__matrix">
        <label class="timecards-toolbar__search timecards-toolbar__search--wide">
          <span>Jobs</span>
          <MultiSelect
            :model-value="filters.selectedJobIds"
            class="timecards-toolbar__multiselect"
            :options="availableJobOptions"
            option-label="label"
            option-value="id"
            overlay-class="timecards-toolbar__multiselect-overlay"
            placeholder="All Jobs"
            filter
            filter-placeholder="Search jobs"
            :filter-fields="['label', 'code', 'name']"
            :max-selected-labels="1"
            selected-items-label="{0} jobs selected"
            :show-toggle-all="false"
            show-clear
            reset-filter-on-clear
            reset-filter-on-hide
            fluid
            empty-filter-message="No jobs match this search."
            empty-message="No jobs available."
            :unstyled="false"
            @update:model-value="updateSelectFilter('selectedJobIds', $event)"
          />
        </label>

        <label class="timecards-toolbar__search">
          <span>Foreman</span>
          <Select
            :model-value="filters.foreman"
            class="timecards-toolbar__select"
            :options="availableForemanOptions"
            option-label="label"
            option-value="value"
            overlay-class="timecards-toolbar__select-overlay"
            :unstyled="false"
            fluid
            @update:model-value="updateSelectFilter('foreman', $event)"
          />
        </label>

        <label class="timecards-toolbar__search">
          <span>Status</span>
          <Select
            :model-value="filters.status"
            class="timecards-toolbar__select"
            :options="weekStatusOptions"
            option-label="label"
            option-value="value"
            overlay-class="timecards-toolbar__select-overlay"
            :unstyled="false"
            fluid
            @update:model-value="updateSelectFilter('status', $event)"
          />
        </label>
      </div>
    </fieldset>

    <fieldset
      id="timecard-export-panel-sort"
      class="timecards-toolbar__group timecards-toolbar__group--sort"
      :class="{ 'timecards-toolbar__group--mobile-active': activeMobileToolbarTab === 'sort' }"
      role="tabpanel"
      :aria-labelledby="'timecard-export-tab-sort'"
    >
      <legend class="timecards-toolbar__legend">Sort Cards</legend>
      <div class="timecards-toolbar__lead-spacer" aria-hidden="true"></div>
      <div class="timecards-toolbar__sort-stack">
        <TimecardSortModePicker
          :model-value="sortMode"
          name="timecard-export-sort-mode"
          @update:model-value="emit('updateSortMode', $event)"
        />

        <label class="timecards-toolbar__search">
          <span>Employee Search</span>
          <AppSearchInput
            :model-value="filters.cardSearch"
            placeholder="Search all matching cards"
            @update:model-value="emit('updateFilter', 'cardSearch', $event)"
          />
        </label>
      </div>
    </fieldset>

    <fieldset
      id="timecard-export-panel-actions"
      class="timecards-toolbar__group timecards-toolbar__group--actions"
      :class="{ 'timecards-toolbar__group--mobile-active': activeMobileToolbarTab === 'actions' }"
      role="tabpanel"
      :aria-labelledby="'timecard-export-tab-actions'"
    >
      <legend class="timecards-toolbar__legend">Workspace Actions</legend>
      <div class="timecards-toolbar__lead-spacer" aria-hidden="true"></div>
      <div class="timecards-toolbar__controls">
        <div class="timecards-toolbar__matrix">
          <TimecardButton @click="emit('setAllCardsCompact', false)">
            Expand All
          </TimecardButton>
          <TimecardButton @click="emit('setAllCardsCompact', true)">
            Compact All
          </TimecardButton>
          <TimecardButton variant="primary" @click="emit('exportPdf')">
            Export PDF
          </TimecardButton>
          <TimecardButton variant="primary" @click="emit('exportCsv')">
            Export CSV
          </TimecardButton>
          <TimecardButton
            v-if="isAdmin"
            :disabled="actionLoading"
            @click="emit('toggleCreateTray')"
          >
            {{ showCreateTray ? 'Close Create' : 'Create Card' }}
          </TimecardButton>
        </div>
      </div>
    </fieldset>

    <TimecardExportSavedWeeksPanel
      :weeks="filteredWeeks"
      :weeks-loading="weeksLoading"
      :is-admin="isAdmin"
      :action-loading="actionLoading"
      :mobile-active="activeMobileToolbarTab === 'saved'"
      :format-date="formatDate"
      :format-subtitle="formatWeekSubtitle"
      @delete-week="emit('deleteWeek', $event)"
    />

    <TimecardExportStatusBar :signals="statusSignals" />
  </section>
</template>

<style scoped>
.timecards-toolbar {
  border: 1px solid rgba(88, 105, 44, 0.42);
  background: rgba(247, 249, 239, 0.95);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55);
}

.timecards-toolbar__legend {
  color: rgba(64, 85, 36, 0.82);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.timecards-toolbar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: 0.75rem;
  padding: 0.95rem;
  align-items: start;
  --timecards-toolbar-label-height: 1.15rem;
  --timecards-toolbar-label-gap: 0.4rem;
  --timecards-toolbar-group-gap: 0.65rem;
  --timecards-toolbar-lead-overlap: 0.52rem;
  --app-text-input-min-height: var(--timecards-toolbar-control-height);
  --app-text-input-padding-x: 0.75rem;
  --app-text-input-border: var(--timecards-toolbar-control-border);
  --app-text-input-radius: var(--timecards-toolbar-control-radius);
  --app-text-input-background: var(--timecards-toolbar-control-bg);
  --app-text-input-color: var(--timecards-toolbar-control-text);
  --app-text-input-color-scheme: light;
  --app-text-input-font: inherit;
  --app-text-input-box-shadow: none;
  --app-text-input-placeholder-color: rgba(70, 77, 48, 0.72);
  --app-text-input-focus-border: var(--timecards-toolbar-control-border-strong);
  --app-text-input-focus-background: rgba(248, 250, 240, 0.98);
  --app-text-input-focus-box-shadow: var(--timecards-toolbar-focus-ring);
  --app-search-input-min-height: var(--timecards-toolbar-control-height);
  --app-search-input-padding-x: 0.75rem;
  --app-search-input-border: var(--timecards-toolbar-control-border);
  --app-search-input-radius: var(--timecards-toolbar-control-radius);
  --app-search-input-background: var(--timecards-toolbar-control-bg);
  --app-search-input-color: var(--timecards-toolbar-control-text);
  --app-search-input-color-scheme: light;
  --app-search-input-font: inherit;
  --app-search-input-placeholder-color: rgba(70, 77, 48, 0.72);
  --app-search-input-focus-border: var(--timecards-toolbar-control-border-strong);
  --app-search-input-focus-outline: none;
  --app-search-input-focus-background: rgba(248, 250, 240, 0.98);
  --app-search-input-focus-box-shadow: var(--timecards-toolbar-focus-ring);
}

.timecards-toolbar__group {
  display: grid;
  gap: var(--timecards-toolbar-group-gap);
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.timecards-toolbar__legend {
  padding: 0;
}

.timecards-toolbar__stack,
.timecards-toolbar__controls {
  display: grid;
  gap: 0.55rem;
}

.timecards-toolbar__lead-spacer {
  display: block;
  height: calc(var(--timecards-toolbar-label-height) + var(--timecards-toolbar-label-gap));
  margin-bottom: calc(-1 * var(--timecards-toolbar-lead-overlap));
}

.timecards-toolbar__group--status-bar {
  grid-column: 1 / -1;
}

.timecards-toolbar__search {
  display: grid;
  gap: var(--timecards-toolbar-label-gap);
  font-weight: 600;
  min-width: 0;
}

.timecards-toolbar__search > span {
  display: flex;
  align-items: end;
  min-height: var(--timecards-toolbar-label-height);
}

.timecards-toolbar__search--wide {
  grid-column: 1 / -1;
}

.timecards-toolbar__multiselect,
.timecards-toolbar__select {
  display: flex;
  align-items: stretch;
  width: 100%;
  min-width: 0;
  min-height: var(--timecards-toolbar-control-height);
  border: 1px solid var(--timecards-toolbar-control-border);
  border-radius: var(--timecards-toolbar-control-radius);
  background: var(--timecards-toolbar-control-bg);
  color: var(--timecards-toolbar-control-text);
  box-shadow: none;
  overflow: hidden;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    box-shadow 0.18s ease;
}

.timecards-toolbar__multiselect:hover,
.timecards-toolbar__select:hover {
  border-color: var(--timecards-toolbar-control-border-strong);
  background: rgba(248, 250, 240, 0.98);
}

.timecards-toolbar__multiselect.p-focus,
.timecards-toolbar__select.p-focus {
  border-color: var(--timecards-toolbar-control-border-strong);
  box-shadow: var(--timecards-toolbar-focus-ring);
}

.timecards-toolbar__multiselect :deep(.p-multiselect-label),
.timecards-toolbar__select :deep(.p-select-label) {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  min-height: calc(var(--timecards-toolbar-control-height) - 2px);
  padding: 0 0.75rem;
  font-weight: 500;
  background: transparent;
  color: var(--timecards-toolbar-control-text);
}

.timecards-toolbar__multiselect :deep(.p-multiselect-label.p-placeholder),
.timecards-toolbar__select :deep(.p-select-label.p-placeholder) {
  color: rgba(70, 77, 48, 0.72);
}

.timecards-toolbar__multiselect :deep(.p-multiselect-dropdown),
.timecards-toolbar__select :deep(.p-select-dropdown) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.3rem;
  background: transparent;
  color: rgba(73, 89, 37, 0.82);
}

.timecards-toolbar__multiselect :deep(.p-multiselect-clear-icon) {
  color: rgba(73, 89, 37, 0.72);
}

.timecards-toolbar__multiselect :deep(.p-multiselect-option.p-multiselect-option-selected) {
  background: var(--timecards-toolbar-control-bg-active);
  color: #24411c;
}

.timecards-toolbar__multiselect :deep(.p-multiselect-option.p-multiselect-option-selected.p-focus) {
  background: rgba(214, 233, 197, 0.98);
}

.timecards-toolbar :deep(.timecards-toolbar__multiselect-overlay) {
  border: 1px solid rgba(205, 214, 189, 0.96);
  border-radius: 0.6rem;
  background: rgba(255, 255, 251, 0.99);
  box-shadow:
    0 14px 30px rgba(50, 58, 34, 0.12),
    0 3px 8px rgba(50, 58, 34, 0.08);
  overflow: hidden;
}

.timecards-toolbar :deep(.timecards-toolbar__multiselect-overlay .p-multiselect-header) {
  padding: 0.7rem 0.7rem 0.42rem;
  background: transparent;
  border-bottom: none;
}

.timecards-toolbar :deep(.timecards-toolbar__multiselect-overlay .p-multiselect-filter-container) {
  display: block;
}

.timecards-toolbar :deep(.timecards-toolbar__multiselect-overlay .p-multiselect-filter) {
  min-height: 2.5rem;
  padding: 0 2.35rem 0 0.9rem;
  border: 1px solid rgba(196, 206, 182, 0.95);
  border-radius: 0.45rem;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: none;
  color: rgba(51, 61, 39, 0.92);
}

.timecards-toolbar :deep(.timecards-toolbar__multiselect-overlay .p-multiselect-filter::placeholder) {
  color: rgba(85, 96, 64, 0.68);
}

.timecards-toolbar :deep(.timecards-toolbar__multiselect-overlay .p-multiselect-filter:focus) {
  outline: none;
  border-color: rgba(157, 190, 134, 0.96);
  box-shadow: 0 0 0 1px rgba(197, 228, 186, 0.72);
}

.timecards-toolbar :deep(.timecards-toolbar__multiselect-overlay .p-inputicon) {
  color: rgba(120, 134, 97, 0.86);
}

.timecards-toolbar :deep(.timecards-toolbar__multiselect-overlay .p-multiselect-list-container) {
  padding: 0 0.35rem 0.4rem;
}

.timecards-toolbar :deep(.timecards-toolbar__multiselect-overlay .p-multiselect-list) {
  display: grid;
  gap: 0.08rem;
  padding: 0;
}

.timecards-toolbar :deep(.timecards-toolbar__multiselect-overlay .p-multiselect-option) {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-height: 2.45rem;
  margin: 0;
  padding: 0.55rem 0.7rem;
  border-radius: 0.35rem;
  background: transparent;
  color: rgba(43, 54, 34, 0.94);
  transition:
    background-color 0.16s ease,
    color 0.16s ease,
    box-shadow 0.16s ease;
}

.timecards-toolbar :deep(.timecards-toolbar__multiselect-overlay .p-multiselect-option.p-focus) {
  background: rgba(241, 246, 235, 0.94);
}

.timecards-toolbar :deep(.timecards-toolbar__multiselect-overlay .p-multiselect-option.p-multiselect-option-selected) {
  background: rgba(198, 238, 207, 0.82);
  color: rgba(35, 80, 44, 0.96);
  box-shadow: inset 0 0 0 1px rgba(164, 211, 174, 0.88);
}

.timecards-toolbar :deep(.timecards-toolbar__multiselect-overlay .p-multiselect-option.p-multiselect-option-selected.p-focus) {
  background: rgba(188, 233, 199, 0.92);
}

.timecards-toolbar :deep(.timecards-toolbar__multiselect-overlay .p-checkbox) {
  flex: 0 0 auto;
}

.timecards-toolbar :deep(.timecards-toolbar__multiselect-overlay .p-checkbox-box) {
  width: 1.1rem;
  height: 1.1rem;
  border: 1px solid rgba(190, 202, 173, 0.95);
  border-radius: 0.24rem;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: none;
}

.timecards-toolbar :deep(.timecards-toolbar__multiselect-overlay .p-checkbox.p-checkbox-checked .p-checkbox-box) {
  border-color: rgba(68, 182, 108, 0.98);
  background: rgba(68, 182, 108, 0.98);
  color: #fff;
}

.timecards-toolbar :deep(.timecards-toolbar__multiselect-overlay .p-checkbox-icon) {
  width: 0.72rem;
  height: 0.72rem;
}

.timecards-toolbar :deep(.timecards-toolbar__multiselect-overlay .p-multiselect-empty-message) {
  padding: 0.7rem 0.8rem 0.8rem;
  color: rgba(85, 96, 64, 0.82);
}

:deep(.timecards-toolbar__select-overlay) {
  border: 1px solid rgba(205, 214, 189, 0.96);
  border-radius: 0.45rem;
  background: rgba(255, 255, 251, 0.99);
  box-shadow:
    0 14px 30px rgba(50, 58, 34, 0.12),
    0 3px 8px rgba(50, 58, 34, 0.08);
  overflow: hidden;
}

:deep(.timecards-toolbar__select-overlay .p-select-list-container) {
  padding: 0.3rem;
}

:deep(.timecards-toolbar__select-overlay .p-select-list) {
  display: grid;
  gap: 0.08rem;
  padding: 0;
}

:deep(.timecards-toolbar__select-overlay .p-select-option) {
  min-height: 2.35rem;
  margin: 0;
  padding: 0.55rem 0.7rem;
  border-radius: 0.32rem;
  background: transparent;
  color: rgba(43, 54, 34, 0.94);
  transition:
    background-color 0.16s ease,
    color 0.16s ease,
    box-shadow 0.16s ease;
}

:deep(.timecards-toolbar__select-overlay .p-select-option.p-focus) {
  background: rgba(241, 246, 235, 0.94);
}

:deep(.timecards-toolbar__select-overlay .p-select-option.p-select-option-selected) {
  background: rgba(198, 238, 207, 0.82);
  color: rgba(35, 80, 44, 0.96);
  box-shadow: inset 0 0 0 1px rgba(164, 211, 174, 0.88);
}

:deep(.timecards-toolbar__select-overlay .p-select-option.p-select-option-selected.p-focus) {
  background: rgba(188, 233, 199, 0.92);
}

.timecards-toolbar__matrix {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
}

.timecards-toolbar__stack--date-filters {
  gap: 0.55rem;
}

.timecards-toolbar__date-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.55rem;
}

.timecards-toolbar__date-row--range {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.timecards-toolbar__sort-stack {
  display: grid;
  gap: 0.65rem;
}

@media (min-width: 961px) {
  .timecards-toolbar {
    align-items: stretch;
  }

  .timecards-toolbar__group {
    align-content: start;
    min-height: 100%;
    padding: 0.72rem 0.82rem 0.82rem;
    border: 1px solid rgba(101, 120, 60, 0.2);
    background:
      linear-gradient(180deg, rgba(255, 255, 251, 0.46) 0%, rgba(244, 247, 232, 0.42) 100%);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.44),
      inset 0 0 0 1px rgba(255, 255, 255, 0.18);
  }

  .timecards-toolbar__group--status-bar {
    padding-top: 0.68rem;
  }
}

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
  .timecards-toolbar,
  .timecards-toolbar__matrix {
    grid-template-columns: 1fr;
  }

  .timecards-toolbar__legend {
    display: none;
  }

  .timecards-toolbar__group {
    display: none;
  }

  .timecards-toolbar__group--mobile-active,
  .timecards-toolbar__group--status-bar {
    display: grid;
  }

  .timecards-toolbar__lead-spacer {
    display: none;
  }

  .timecards-toolbar__group--mobile-active {
    gap: 0.7rem;
    padding: 0.8rem;
    border: 1px solid rgba(88, 105, 44, 0.24);
    background: rgba(255, 255, 255, 0.32);
  }

}
</style>
