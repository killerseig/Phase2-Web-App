<script setup lang="ts">
import type { TimecardWeekRecord } from '@/types/domain'

defineProps<{
  weeks: readonly TimecardWeekRecord[]
  weeksLoading: boolean
  isAdmin: boolean
  actionLoading: boolean
  mobileActive: boolean
  formatDate: (value: string) => string
  formatSubtitle: (week: TimecardWeekRecord) => string
}>()

const emit = defineEmits<{
  deleteWeek: [week: TimecardWeekRecord]
}>()
</script>

<template>
  <fieldset
    id="timecard-export-panel-saved"
    class="timecard-export-saved-weeks timecards-toolbar__group timecards-toolbar__group--history"
    :class="{ 'timecards-toolbar__group--mobile-active': mobileActive }"
    role="tabpanel"
    :aria-labelledby="'timecard-export-tab-saved'"
  >
    <legend class="timecard-export-saved-weeks__legend">Saved Weeks</legend>
    <div class="timecard-export-saved-weeks__lead-spacer" aria-hidden="true"></div>
    <div class="timecard-export-saved-weeks__history">
      <div
        v-for="week in weeks"
        :key="week.id"
        class="timecard-export-saved-weeks__row"
        :data-testid="`timecard-export-week-${week.id}`"
      >
        <strong>{{ formatDate(week.weekEndDate) }}</strong>
        <span>{{ formatSubtitle(week) }}</span>
        <span>{{ week.status === 'submitted' ? 'Submitted' : 'Draft' }}</span>
        <button
          v-if="isAdmin && week.status === 'draft'"
          class="timecard-export-saved-weeks__action"
          type="button"
          :disabled="actionLoading"
          :data-testid="`timecard-export-delete-week-${week.id}`"
          @click="emit('deleteWeek', week)"
        >
          Delete Draft
        </button>
      </div>

      <div v-if="!weeks.length && !weeksLoading" class="timecard-export-saved-weeks__empty">
        No saved weeks match the current filters.
      </div>
    </div>
  </fieldset>
</template>

<style scoped>
.timecard-export-saved-weeks__legend {
  padding: 0;
  color: rgba(64, 85, 36, 0.82);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.timecard-export-saved-weeks__lead-spacer {
  display: block;
  height: calc(var(--timecards-toolbar-label-height) + var(--timecards-toolbar-label-gap));
  margin-bottom: calc(-1 * var(--timecards-toolbar-lead-overlap));
}

.timecard-export-saved-weeks__history {
  display: grid;
  gap: 0.4rem;
  max-height: 13.5rem;
  min-height: 0;
  overflow: auto;
  padding-right: 0.2rem;
  overscroll-behavior: contain;
}

.timecard-export-saved-weeks__row {
  display: grid;
  gap: 0.08rem;
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--timecards-toolbar-control-border);
  border-radius: var(--timecards-toolbar-control-radius);
  background: var(--timecards-toolbar-control-bg);
  color: #243018;
  text-align: left;
  line-height: 1.18;
  box-shadow: none;
}

.timecard-export-saved-weeks__row strong {
  color: #243018;
  font-size: 0.92rem;
}

.timecard-export-saved-weeks__row span,
.timecard-export-saved-weeks__empty {
  color: rgba(38, 43, 23, 0.76);
  font-size: 0.76rem;
}

.timecard-export-saved-weeks__action {
  justify-self: start;
  margin-top: 0.35rem;
  padding: 0.28rem 0.55rem;
  border: 1px solid rgba(142, 48, 39, 0.42);
  border-radius: var(--timecards-toolbar-control-radius);
  background: rgba(255, 246, 243, 0.95);
  color: #8f3027;
  font: inherit;
  font-size: 0.76rem;
  font-weight: 700;
}

.timecard-export-saved-weeks__action:hover:not(:disabled) {
  border-color: rgba(142, 48, 39, 0.62);
  background: rgba(255, 237, 232, 0.98);
}

.timecard-export-saved-weeks__action:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

@media (max-width: 960px) {
  .timecard-export-saved-weeks__lead-spacer {
    display: none;
  }
}
</style>
