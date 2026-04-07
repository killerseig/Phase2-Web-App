<script setup lang="ts">
import { computed } from 'vue'
import AppToolbarCard from '@/components/common/AppToolbarCard.vue'
import DatePickerField from '@/components/common/DatePickerField.vue'
import SubmissionCountBadges from '@/components/common/SubmissionCountBadges.vue'

defineOptions({
  name: 'TimecardWeekToolbar',
})

const props = defineProps<{
  selectedDate: string
  weekPickerConfig: Record<string, unknown>
  loading: boolean
  employeeCount: number
  draftCount: number
  submittedCount: number
  submittingAll: boolean
}>()

const emit = defineEmits<{
  (e: 'update:selectedDate', value: string): void
  (e: 'changeWeek', value: string): void
  (e: 'submitAll'): void
}>()

const selectedDateModel = computed({
  get: () => props.selectedDate,
  set: (value: string) => emit('update:selectedDate', value),
})

function handleWeekChange(value: string) {
  emit('changeWeek', value)
}
</script>

<template>
  <AppToolbarCard
    class="timecard-week-toolbar mb-3"
    body-class="timecard-week-toolbar__body"
  >
    <div class="app-toolbar-split app-toolbar-split--center">
      <div class="app-toolbar-actions">
        <DatePickerField
          v-model="selectedDateModel"
          :config="weekPickerConfig"
          input-aria-label="Select week date"
          group-class="date-input-group"
          input-class="date-input"
          size="sm"
          show-open-button
          open-on-focus
          @change="handleWeekChange"
        />
        <div class="app-toolbar-note ms-1">
          Select any day in the week to load that job's Sunday-Saturday timecards.
        </div>
      </div>

      <div class="app-toolbar-actions app-toolbar-actions--end">
        <div class="small text-muted">
          {{ employeeCount }} employee{{ employeeCount === 1 ? '' : 's' }}
        </div>
        <SubmissionCountBadges
          :draft-count="draftCount"
          :submitted-count="submittedCount"
          wrapper-class="small text-muted"
        />
        <button
          class="btn btn-success btn-sm"
          :disabled="submittingAll || loading || draftCount === 0"
          @click="emit('submitAll')"
        >
          <i class="bi bi-send me-1"></i>
          {{ submittingAll ? 'Submitting...' : `Submit Week (${draftCount})` }}
        </button>
      </div>
    </div>
  </AppToolbarCard>
</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;

.timecard-week-toolbar {
  box-shadow: $box-shadow-sm;
}

.timecard-week-toolbar :deep(.timecard-week-toolbar__body) {
  padding: 0.9rem 1rem;
}

.timecard-week-toolbar :deep(.app-toolbar-split) {
  gap: 0.6rem 1rem;
}

.timecard-week-toolbar :deep(.app-toolbar-actions) {
  gap: 0.45rem;
}

.timecard-week-toolbar :deep(.app-toolbar-note) {
  font-size: 0.8rem;
  line-height: 1.45;
  max-width: 19rem;
}

.timecard-week-toolbar :deep(.submission-count-badges) {
  display: inline-flex;
  align-items: center;
}

:deep(.date-input-group) {
  max-width: 190px;
}

:deep(.date-input) {
  -webkit-appearance: none;
  appearance: none;
}

:deep(.date-input::-webkit-calendar-picker-indicator) {
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;
}

@media (max-width: 991.98px) {
  .timecard-week-toolbar :deep(.app-toolbar-note) {
    max-width: none;
  }
}
</style>
