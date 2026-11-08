<script setup lang="ts">
import TimecardToolbarPanel from '@/components/timecards/TimecardToolbarPanel.vue'
import TimecardToolbarSignal from '@/components/timecards/TimecardToolbarSignal.vue'

defineProps<{
  weekRangeLabel: string
  weekStatusLabel: string
  selectedWeekSubmitted: boolean
  cardCount: number
  saveError: string
  saveStateLabel: string
}>()
</script>

<template>
  <TimecardToolbarPanel title="Status" mobile-always-visible :modifiers="['status-bar']">
    <div class="job-timecard-status-bar__strip">
      <TimecardToolbarSignal>{{ weekRangeLabel }}</TimecardToolbarSignal>
      <TimecardToolbarSignal :tone="selectedWeekSubmitted ? 'success' : 'default'">
        {{ weekStatusLabel }}
      </TimecardToolbarSignal>
      <TimecardToolbarSignal>{{ cardCount }} Cards</TimecardToolbarSignal>
      <TimecardToolbarSignal :tone="saveError ? 'error' : 'default'">
        {{ saveStateLabel }}
      </TimecardToolbarSignal>
    </div>
  </TimecardToolbarPanel>
</template>

<style scoped>
.job-timecard-status-bar__strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: 0.55rem;
}

@media (max-width: 900px) {
  .job-timecard-status-bar__strip {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 8rem), 1fr));
    gap: 0.45rem;
  }
}
</style>
