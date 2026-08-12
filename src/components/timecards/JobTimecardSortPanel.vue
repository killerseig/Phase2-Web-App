<script setup lang="ts">
import TimecardButton from '@/components/timecards/TimecardButton.vue'
import TimecardSortModePicker from '@/components/timecards/TimecardSortModePicker.vue'
import TimecardToolbarPanel from '@/components/timecards/TimecardToolbarPanel.vue'

type WorkbookSortMode = 'name' | 'number'

defineProps<{
  sortMode: WorkbookSortMode
  actionLoading: boolean
  canEditWeek: boolean
  cardCount: number
  mobileActive: boolean
}>()

const emit = defineEmits<{
  updateSortMode: [value: WorkbookSortMode]
  sortCards: []
}>()
</script>

<template>
  <TimecardToolbarPanel
    panel-id="timecards-toolbar-panel-sort"
    title="Sort Cards"
    labelled-by="timecards-toolbar-tab-sort"
    :mobile-active="mobileActive"
    :modifiers="['sort']"
  >
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
  </TimecardToolbarPanel>
</template>

<style src="./timecard-toolbar-content.css" scoped></style>
