<script setup lang="ts">
import AppDateInput from '@/components/common/AppDateInput.vue'
import TimecardToolbarPanel from '@/components/timecards/TimecardToolbarPanel.vue'

defineProps<{
  displayJobCode: string
  displayJobName: string
  selectedWeekEndDate: string
  mobileActive: boolean
}>()

const emit = defineEmits<{
  weekEndingInput: [event: Event]
  weekEndingPickerOpen: [event: Event]
}>()
</script>

<template>
  <TimecardToolbarPanel
    panel-id="timecards-toolbar-panel-week"
    title="Week Filters"
    labelled-by="timecards-toolbar-tab-week"
    :mobile-active="mobileActive"
    :modifiers="['details']"
  >
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
        <AppDateInput
          :model-value="selectedWeekEndDate"
          data-testid="timecards-week-ending"
          @change="emit('weekEndingInput', $event)"
          @click="emit('weekEndingPickerOpen', $event)"
        />
      </label>
    </div>
  </TimecardToolbarPanel>
</template>

<style src="./timecard-toolbar-content.css" scoped></style>

<style scoped>
.timecards-toolbar__display-field {
  display: flex;
  align-items: center;
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
</style>
