<script setup lang="ts">
import Select from 'primevue/select'
import AppDateInput from '@/components/common/AppDateInput.vue'
import AppSearchInput from '@/components/common/AppSearchInput.vue'
import TimecardToolbarPanel from '@/components/timecards/TimecardToolbarPanel.vue'
import type {
  TimecardExportDateFilterMode,
  TimecardExportFilterState,
} from '@/features/timecards/exportViewHelpers'
import { openNativeDatePicker, readInputValue } from '@/utils/domEvents'

type WeekFilterField = 'weekSearch' | 'dateMode' | 'singleWeekEndDate' | 'rangeStartDate' | 'rangeEndDate'

defineProps<{
  filters: Pick<TimecardExportFilterState, WeekFilterField>
  dateModeOptions: { label: string; value: TimecardExportDateFilterMode }[]
  mobileActive: boolean
}>()

const emit = defineEmits<{
  updateFilter: [field: WeekFilterField, value: string]
}>()

function updateTextFilter(field: WeekFilterField, event: Event) {
  emit('updateFilter', field, readInputValue(event))
}

function updateSelectFilter(field: WeekFilterField, value: unknown) {
  emit('updateFilter', field, String(value))
}
</script>

<template>
  <TimecardToolbarPanel
    panel-id="timecard-export-panel-weeks"
    title="Week Filters"
    labelled-by="timecard-export-tab-weeks"
    :mobile-active="mobileActive"
    :modifiers="['filters', 'weeks']"
    collapse-at="960"
  >
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
          <AppDateInput
            :model-value="filters.singleWeekEndDate"
            @change="updateTextFilter('singleWeekEndDate', $event)"
            @click="openNativeDatePicker"
          />
        </label>

        <template v-else>
          <label class="timecards-toolbar__search">
            <span>Start Date</span>
            <AppDateInput
              :model-value="filters.rangeStartDate"
              @change="updateTextFilter('rangeStartDate', $event)"
              @click="openNativeDatePicker"
            />
          </label>

          <label class="timecards-toolbar__search">
            <span>End Date</span>
            <AppDateInput
              :model-value="filters.rangeEndDate"
              @change="updateTextFilter('rangeEndDate', $event)"
              @click="openNativeDatePicker"
            />
          </label>
        </template>
      </div>
    </div>
  </TimecardToolbarPanel>
</template>

<style src="./timecard-toolbar-content.css" scoped></style>
<style src="./timecard-primevue-select.css" scoped></style>

<style scoped>
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
</style>
