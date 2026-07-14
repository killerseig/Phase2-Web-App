<script setup lang="ts">
import AppSearchInput from '@/components/common/AppSearchInput.vue'
import AppTextInput from '@/components/common/AppTextInput.vue'
import TimecardButton from '@/components/timecards/TimecardButton.vue'
import TimecardSortModePicker from '@/components/timecards/TimecardSortModePicker.vue'
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

function formatToolbarDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return `${parsed.getMonth() + 1}/${parsed.getDate()}/${parsed.getFullYear()}`
}
</script>

<template>
  <header class="timecards-toolbar">
    <TimecardToolbarTabs
      :tabs="mobileToolbarTabs"
      :active-key="activeMobileTab"
      toolbar-label="Timecard tools"
      tab-id-prefix="timecards-toolbar-tab"
      panel-id-prefix="timecards-toolbar-panel"
      collapse-at="900"
      @select-tab="emit('updateActiveMobileTab', $event as MobileToolbarTabKey)"
    />

    <fieldset
      id="timecards-toolbar-panel-week"
      class="timecards-toolbar__group timecards-toolbar__group--details"
      :class="{ 'timecards-toolbar__group--mobile-active': activeMobileTab === 'week' }"
      role="tabpanel"
      :aria-labelledby="'timecards-toolbar-tab-week'"
    >
      <legend class="timecards-toolbar__legend">Week Filters</legend>
      <div class="timecards-toolbar__stack timecards-toolbar__stack--week-fields">
        <label class="timecards-toolbar__search">
          <span>Job Number</span>
          <div class="timecards-toolbar__display-field">
            <span class="timecards-toolbar__display">{{ displayJobCode }}</span>
          </div>
        </label>
        <label class="timecards-toolbar__search">
          <span>Job Name</span>
          <div class="timecards-toolbar__display-field">
            <span class="timecards-toolbar__display">{{ displayJobName }}</span>
          </div>
        </label>
        <label class="timecards-toolbar__search">
          <span>Week Ending</span>
          <AppTextInput
            :model-value="selectedWeekEndDate"
            data-testid="timecards-week-ending"
            type="date"
            @change="emit('weekEndingInput', $event)"
            @click="emit('weekEndingPickerOpen', $event)"
          />
        </label>
      </div>
    </fieldset>

    <fieldset
      id="timecards-toolbar-panel-search"
      class="timecards-toolbar__group timecards-toolbar__group--search"
      :class="{ 'timecards-toolbar__group--mobile-active': activeMobileTab === 'search' }"
      role="tabpanel"
      :aria-labelledby="'timecards-toolbar-tab-search'"
    >
      <legend class="timecards-toolbar__legend">Card Filters</legend>
      <label class="timecards-toolbar__search">
        <span>Employee Search</span>
        <AppSearchInput
          :model-value="cardSearchTerm"
          placeholder="Search all cards"
          @update:model-value="emit('updateCardSearchTerm', $event)"
        />
      </label>
    </fieldset>

    <fieldset
      id="timecards-toolbar-panel-actions"
      class="timecards-toolbar__group timecards-toolbar__group--actions"
      :class="{ 'timecards-toolbar__group--mobile-active': activeMobileTab === 'actions' }"
      role="tabpanel"
      :aria-labelledby="'timecards-toolbar-tab-actions'"
    >
      <legend class="timecards-toolbar__legend">Workspace Actions</legend>
      <div class="timecards-toolbar__lead-spacer" aria-hidden="true"></div>
      <div class="timecards-toolbar__controls">
        <div class="timecards-toolbar__matrix">
          <TimecardButton
            v-if="canCreateSelectedWeek"
            variant="primary"
            data-testid="create-week"
            :disabled="actionLoading || ensuringWeek"
            @click="emit('createWeek')"
          >
            {{ ensuringWeek ? 'Opening Week' : 'Create Week' }}
          </TimecardButton>
          <TimecardButton
            data-testid="create-card"
            :disabled="actionLoading || !canEditWeek || !hasSelectedWeek"
            @click="emit('toggleCreateTray')"
          >
            {{ showCreateTray ? 'Close Create' : 'Create Card' }}
          </TimecardButton>
          <TimecardButton
            variant="primary"
            :disabled="actionLoading || !hasSelectedWeek || !cardCount || !canEditWeek"
            @click="emit('submitWeek')"
          >
            Submit Week
          </TimecardButton>
          <TimecardButton :disabled="!cardCount" @click="emit('expandAll')">
            Expand All
          </TimecardButton>
          <TimecardButton :disabled="!cardCount" @click="emit('compactAll')">
            Compact All
          </TimecardButton>
        </div>
      </div>
    </fieldset>

    <fieldset
      id="timecards-toolbar-panel-sort"
      class="timecards-toolbar__group timecards-toolbar__group--sort"
      :class="{ 'timecards-toolbar__group--mobile-active': activeMobileTab === 'sort' }"
      role="tabpanel"
      :aria-labelledby="'timecards-toolbar-tab-sort'"
    >
      <legend class="timecards-toolbar__legend">Sort Cards</legend>
      <div class="timecards-toolbar__lead-spacer" aria-hidden="true"></div>
      <div class="timecards-toolbar__sort-stack">
        <TimecardSortModePicker
          :model-value="sortMode"
          name="job-timecards-sort-mode"
          @update:model-value="emit('updateSortMode', $event)"
        />
        <TimecardButton
          :disabled="actionLoading || !canEditWeek || cardCount < 2"
          @click="emit('sortCards')"
        >
          Sort Cards
        </TimecardButton>
      </div>
    </fieldset>

    <fieldset
      id="timecards-toolbar-panel-history"
      class="timecards-toolbar__group timecards-toolbar__group--history"
      :class="{ 'timecards-toolbar__group--mobile-active': activeMobileTab === 'history' }"
      role="tabpanel"
      :aria-labelledby="'timecards-toolbar-tab-history'"
    >
      <legend class="timecards-toolbar__legend">Saved Weeks</legend>
      <div class="timecards-toolbar__lead-spacer" aria-hidden="true"></div>
      <div class="timecards-toolbar__history">
        <button
          v-for="week in recentWeeks"
          :key="week.id"
          class="timecards-sidebar__history-row"
          :class="{ 'timecards-sidebar__history-row--active': week.id === activeWeekId }"
          type="button"
          :data-testid="`timecards-history-${week.id}`"
          @click="emit('selectWeek', week)"
        >
          <strong>{{ formatToolbarDate(week.weekEndDate) }}</strong>
          <span>{{ week.status === 'submitted' ? 'Submitted' : 'Draft' }}</span>
        </button>

        <div v-if="!recentWeeks.length && !weeksLoading" class="timecards-sidebar__empty">
          No saved weeks yet.
        </div>
      </div>
    </fieldset>

    <fieldset class="timecards-toolbar__group timecards-toolbar__group--status-bar">
      <legend class="timecards-toolbar__legend">Status</legend>
      <div class="timecards-toolbar__status-strip">
        <span class="timecards-signal">{{ weekRangeLabel }}</span>
        <span class="timecards-signal" :class="{ 'timecards-signal--success': selectedWeekSubmitted }">
          {{ weekStatusLabel }}
        </span>
        <span class="timecards-signal">{{ cardCount }} Cards</span>
        <span class="timecards-signal" :class="{ 'timecards-signal--error': !!saveError }">
          {{ saveStateLabel }}
        </span>
      </div>
    </fieldset>
  </header>
</template>

<style scoped>
.timecards-toolbar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: 0.75rem;
  padding: 0.95rem;
  align-items: start;
  min-width: 0;
  border: 1px solid rgba(88, 105, 44, 0.42);
  background: rgba(247, 249, 239, 0.95);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55);
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
  background: transparent;
}

.timecards-toolbar__legend {
  padding: 0;
  color: rgba(64, 85, 36, 0.82);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.timecards-toolbar__lead-spacer {
  display: block;
  height: calc(var(--timecards-toolbar-label-height) + var(--timecards-toolbar-label-gap));
  margin-bottom: calc(-1 * var(--timecards-toolbar-lead-overlap));
}

.timecards-toolbar__group--status-bar {
  grid-column: 1 / -1;
}

.timecards-toolbar__history {
  display: grid;
  gap: 0.4rem;
  max-height: 13.5rem;
  overflow: auto;
  min-height: 0;
  padding-right: 0.2rem;
  overscroll-behavior: contain;
}

.timecards-toolbar__status-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: 0.55rem;
}

.timecards-toolbar__display-field {
  min-height: var(--timecards-toolbar-control-height);
  min-width: 0;
  padding: 0 0.75rem;
  border: 1px solid var(--timecards-toolbar-control-border);
  border-radius: var(--timecards-toolbar-control-radius);
  background: var(--timecards-toolbar-control-bg);
  color: var(--timecards-toolbar-control-text);
  box-shadow: none;
  box-sizing: border-box;
  font: inherit;
}

.timecards-toolbar__display-field {
  display: flex;
  align-items: center;
}

.timecards-toolbar__display {
  display: flex;
  align-items: center;
  min-height: calc(var(--timecards-toolbar-control-height) - 2px);
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--timecards-toolbar-control-text);
  line-height: 1.3;
}

.timecards-toolbar__controls {
  display: grid;
  gap: 0.55rem;
}

.timecards-toolbar__stack {
  display: grid;
  gap: 0.55rem;
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

.timecards-toolbar__matrix {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
}

.timecards-toolbar__sort-stack {
  display: grid;
  gap: 0.65rem;
}

.timecards-signal {
  min-height: var(--timecards-toolbar-control-height);
  padding: 0 0.8rem;
  border: 1px solid var(--timecards-toolbar-control-border);
  border-radius: var(--timecards-toolbar-control-radius);
  background: var(--timecards-toolbar-control-bg-muted);
  display: inline-flex;
  align-items: center;
  font-size: 0.84rem;
  font-weight: 600;
}

.timecards-signal--success {
  border-color: rgba(52, 112, 76, 0.36);
  color: #205832;
  background: rgba(220, 239, 208, 0.96);
}

.timecards-signal--error {
  border-color: rgba(167, 53, 53, 0.36);
  color: #8a2828;
  background: rgba(248, 224, 220, 0.96);
}

.timecards-sidebar__history-row {
  display: grid;
  gap: 0.18rem;
  padding: 0.65rem 0.7rem;
  border: 1px solid rgba(71, 82, 41, 0.28);
  background: rgba(255, 255, 255, 0.84);
  color: #243018;
  text-align: left;
}

.timecards-sidebar__history-row--active {
  border-color: rgba(48, 121, 68, 0.56);
  background: rgba(224, 238, 212, 0.95);
}

.timecards-sidebar__history-row strong {
  color: #243018;
  font-size: 1rem;
}

.timecards-sidebar__history-row--active strong {
  color: #1b2b17;
}

.timecards-sidebar__history-row--active span {
  color: rgba(27, 43, 23, 0.82);
}

.timecards-sidebar__history-row span,
.timecards-sidebar__empty {
  color: rgba(38, 43, 23, 0.76);
  font-size: 0.84rem;
}

@media (min-width: 901px) {
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
      minmax(17rem, 1.04fr)
      minmax(15.5rem, 0.96fr)
      minmax(16rem, 1fr)
      minmax(16rem, 1.02fr);
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

@media (max-width: 1450px) {
  .timecards-toolbar {
    grid-template-columns: repeat(auto-fit, minmax(13.5rem, 1fr));
  }
}

@media (max-width: 1180px) {
  .timecards-toolbar {
    grid-template-columns: repeat(auto-fit, minmax(13.5rem, 1fr));
  }
}

@media (max-width: 900px) {
  .timecards-toolbar {
    grid-template-columns: 1fr;
    gap: 0.65rem;
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

  .timecards-toolbar__search {
    gap: 0.4rem;
  }

  .timecards-toolbar__matrix {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .timecards-toolbar__status-strip {
    display: flex;
    flex-wrap: nowrap;
    justify-content: center;
    gap: 0.45rem;
    overflow-x: auto;
    padding: 0 0.05rem 0.1rem;
    margin: 0 -0.05rem;
    scrollbar-width: none;
    -ms-overflow-style: none;
    overscroll-behavior-x: contain;
  }

  .timecards-toolbar__status-strip::-webkit-scrollbar {
    display: none;
  }

  .timecards-signal {
    flex: 0 0 auto;
    white-space: nowrap;
  }

}

@media (max-width: 560px) {
  .timecards-toolbar__matrix {
    grid-template-columns: 1fr;
  }
}
</style>
