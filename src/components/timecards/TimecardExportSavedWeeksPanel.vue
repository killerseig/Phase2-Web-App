<script setup lang="ts">
import TimecardToolbarPanel from '@/components/timecards/TimecardToolbarPanel.vue'
import type { TimecardWeekRecord } from '@/types/domain'

defineProps<{
  weeks: readonly TimecardWeekRecord[]
  weeksLoading: boolean
  canUseTimecardExport: boolean
  canReopenSubmittedWeeks: boolean
  actionLoading: boolean
  mobileActive: boolean
  formatDate: (value: string) => string
  formatSubtitle: (week: TimecardWeekRecord) => string
}>()

const emit = defineEmits<{
  deleteWeek: [week: TimecardWeekRecord]
  reopenWeek: [week: TimecardWeekRecord]
  submitWeek: [week: TimecardWeekRecord]
}>()
</script>

<template>
  <TimecardToolbarPanel
    class="timecard-export-saved-weeks"
    panel-id="timecard-export-panel-saved"
    title="Saved Weeks"
    labelled-by="timecard-export-tab-saved"
    :mobile-active="mobileActive"
    :modifiers="['history']"
    collapse-at="960"
  >
    <div class="timecard-export-saved-weeks__lead-spacer" aria-hidden="true"></div>
    <div class="timecard-export-saved-weeks__history">
      <div
        v-for="week in weeks"
        :key="week.id"
        class="timecard-export-saved-weeks__row"
        :data-testid="`timecard-export-week-${week.id}`"
      >
        <div class="timecard-export-saved-weeks__summary">
          <div class="timecard-export-saved-weeks__heading">
            <strong>{{ formatDate(week.weekEndDate) }}</strong>
            <span
              class="timecard-export-saved-weeks__status"
              :class="{ 'timecard-export-saved-weeks__status--submitted': week.status === 'submitted' }"
            >
              {{ week.status === 'submitted' ? 'Submitted' : 'Draft' }}
            </span>
          </div>
          <span class="timecard-export-saved-weeks__subtitle">{{ formatSubtitle(week) }}</span>
        </div>

        <div v-if="canUseTimecardExport" class="timecard-export-saved-weeks__actions">
          <button
            v-if="week.status === 'draft'"
            class="timecard-export-saved-weeks__action"
            type="button"
            aria-label="Submit Week"
            title="Submit Week"
            :disabled="actionLoading"
            :data-testid="`timecard-export-submit-week-${week.id}`"
            @click="emit('submitWeek', week)"
          >
            <i class="pi pi-check-circle" aria-hidden="true"></i>
          </button>
          <button
            v-if="week.status === 'draft'"
            class="timecard-export-saved-weeks__action timecard-export-saved-weeks__action--danger"
            type="button"
            aria-label="Delete Draft"
            title="Delete Draft"
            :disabled="actionLoading"
            :data-testid="`timecard-export-delete-week-${week.id}`"
            @click="emit('deleteWeek', week)"
          >
            <i class="pi pi-trash" aria-hidden="true"></i>
          </button>
          <button
            v-if="week.status === 'submitted' && canReopenSubmittedWeeks"
            class="timecard-export-saved-weeks__action"
            type="button"
            aria-label="Re-open for Corrections"
            title="Re-open for Corrections"
            :disabled="actionLoading"
            :data-testid="`timecard-export-reopen-week-${week.id}`"
            @click="emit('reopenWeek', week)"
          >
            <i class="pi pi-undo" aria-hidden="true"></i>
          </button>
        </div>
      </div>

      <div v-if="!weeks.length && !weeksLoading" class="timecard-export-saved-weeks__empty">
        No saved weeks match the current filters.
      </div>
    </div>
  </TimecardToolbarPanel>
</template>

<style scoped>
.timecard-export-saved-weeks__lead-spacer {
  display: block;
  height: calc(var(--timecards-toolbar-label-height) + var(--timecards-toolbar-label-gap));
  margin-bottom: calc(-1 * var(--timecards-toolbar-lead-overlap));
}

.timecard-export-saved-weeks__history {
  display: grid;
  gap: 0.28rem;
  max-height: 13.5rem;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding-right: 0.12rem;
  overscroll-behavior: contain;
}

.timecard-export-saved-weeks__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.28rem;
  min-width: 0;
  padding: 0.32rem 0.34rem;
  border: 1px solid var(--timecards-toolbar-control-border);
  border-radius: var(--timecards-toolbar-control-radius);
  background: var(--timecards-toolbar-control-bg);
  color: #243018;
  text-align: left;
  line-height: 1.18;
  box-shadow: none;
}

.timecard-export-saved-weeks__summary {
  min-width: 0;
}

.timecard-export-saved-weeks__heading {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  min-width: 0;
}

.timecard-export-saved-weeks__row strong {
  color: #243018;
  font-size: 0.86rem;
  line-height: 1.08;
}

.timecard-export-saved-weeks__subtitle,
.timecard-export-saved-weeks__empty {
  color: rgba(38, 43, 23, 0.76);
  font-size: 0.7rem;
}

.timecard-export-saved-weeks__subtitle {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.timecard-export-saved-weeks__status {
  flex: 0 0 auto;
  padding: 0.04rem 0.2rem;
  border: 1px solid rgba(142, 48, 39, 0.26);
  border-radius: 999px;
  color: #8f3027;
  font-size: 0.58rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  line-height: 1.2;
  text-transform: uppercase;
}

.timecard-export-saved-weeks__status--submitted {
  border-color: rgba(44, 96, 59, 0.3);
  color: #2f5f3b;
}

.timecard-export-saved-weeks__actions {
  display: flex;
  flex-wrap: nowrap;
  justify-content: flex-end;
  gap: 0.16rem;
  min-width: 0;
}

.timecard-export-saved-weeks__action {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.45rem;
  height: 1.45rem;
  padding: 0;
  border: 1px solid rgba(44, 96, 59, 0.38);
  border-radius: var(--timecards-toolbar-control-radius);
  background: rgba(238, 248, 232, 0.96);
  color: #2f5f3b;
  font: inherit;
  font-weight: 700;
  line-height: 1.1;
}

.timecard-export-saved-weeks__action .pi {
  font-size: 0.72rem;
}

.timecard-export-saved-weeks__action:hover:not(:disabled) {
  border-color: rgba(44, 96, 59, 0.58);
  background: rgba(228, 244, 218, 0.98);
}

.timecard-export-saved-weeks__action--danger {
  border-color: rgba(142, 48, 39, 0.42);
  background: rgba(255, 246, 243, 0.95);
  color: #8f3027;
}

.timecard-export-saved-weeks__action--danger:hover:not(:disabled) {
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
