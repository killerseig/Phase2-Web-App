<script setup lang="ts">
import TimecardToolbarPanel from '@/components/timecards/TimecardToolbarPanel.vue'
import type { TimecardWeekRecord } from '@/types/domain'

defineProps<{
  recentWeeks: readonly TimecardWeekRecord[]
  activeWeekId: string | null
  weeksLoading: boolean
  mobileActive: boolean
}>()

const emit = defineEmits<{
  selectWeek: [week: TimecardWeekRecord]
}>()

function formatToolbarDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return `${parsed.getMonth() + 1}/${parsed.getDate()}/${parsed.getFullYear()}`
}
</script>

<template>
  <TimecardToolbarPanel
    panel-id="timecards-toolbar-panel-history"
    title="Saved Weeks"
    labelled-by="timecards-toolbar-tab-history"
    :mobile-active="mobileActive"
    :modifiers="['history']"
  >
    <div class="timecards-toolbar__lead-spacer" aria-hidden="true"></div>
    <div class="job-timecard-saved-weeks__history">
      <button
        v-for="week in recentWeeks"
        :key="week.id"
        class="job-timecard-saved-weeks__row"
        :class="{ 'job-timecard-saved-weeks__row--active': week.id === activeWeekId }"
        type="button"
        :data-testid="`timecards-history-${week.id}`"
        @click="emit('selectWeek', week)"
      >
        <strong>{{ formatToolbarDate(week.weekEndDate) }}</strong>
        <span>{{ week.status === 'submitted' ? 'Submitted' : 'Draft' }}</span>
      </button>

      <div v-if="!recentWeeks.length && !weeksLoading" class="job-timecard-saved-weeks__empty">
        No saved weeks yet.
      </div>
    </div>
  </TimecardToolbarPanel>
</template>

<style src="./timecard-toolbar-content.css" scoped></style>

<style scoped>
.job-timecard-saved-weeks__history {
  display: grid;
  gap: 0.4rem;
  max-height: 13.5rem;
  overflow: auto;
  min-height: 0;
  padding-right: 0.2rem;
  overscroll-behavior: contain;
}

.job-timecard-saved-weeks__row {
  display: grid;
  gap: 0.18rem;
  padding: 0.65rem 0.7rem;
  border: 1px solid rgba(71, 82, 41, 0.28);
  background: rgba(255, 255, 255, 0.84);
  color: #243018;
  text-align: left;
}

.job-timecard-saved-weeks__row--active {
  border-color: rgba(48, 121, 68, 0.56);
  background: rgba(224, 238, 212, 0.95);
}

.job-timecard-saved-weeks__row strong {
  color: #243018;
  font-size: 1rem;
}

.job-timecard-saved-weeks__row--active strong {
  color: #1b2b17;
}

.job-timecard-saved-weeks__row--active span {
  color: rgba(27, 43, 23, 0.82);
}

.job-timecard-saved-weeks__row span,
.job-timecard-saved-weeks__empty {
  color: rgba(38, 43, 23, 0.76);
  font-size: 0.84rem;
}
</style>
