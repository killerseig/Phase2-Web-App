<script setup lang="ts">
import AppSearchInput from '@/components/common/AppSearchInput.vue'
import TimecardSortModePicker from '@/components/timecards/TimecardSortModePicker.vue'
import TimecardToolbarPanel from '@/components/timecards/TimecardToolbarPanel.vue'
import type { TimecardExportSortMode } from '@/features/timecards/exportViewHelpers'

defineProps<{
  sortMode: TimecardExportSortMode
  cardSearch: string
  mobileActive: boolean
}>()

const emit = defineEmits<{
  updateSortMode: [value: TimecardExportSortMode]
  updateCardSearch: [value: string]
}>()
</script>

<template>
  <TimecardToolbarPanel
    panel-id="timecard-export-panel-sort"
    title="Sort Cards"
    labelled-by="timecard-export-tab-sort"
    :mobile-active="mobileActive"
    :modifiers="['sort']"
    collapse-at="960"
  >
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
          :model-value="cardSearch"
          placeholder="Search all matching cards"
          @update:model-value="emit('updateCardSearch', $event)"
        />
      </label>
    </div>
  </TimecardToolbarPanel>
</template>

<style src="./timecard-toolbar-content.css" scoped></style>
