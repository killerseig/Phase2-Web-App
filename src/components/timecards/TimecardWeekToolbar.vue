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
    class="timecard-week-toolbar"
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
          Pick any day in the target week to load the Sunday-Saturday workbook.
        </div>
      </div>

      <div class="app-toolbar-actions app-toolbar-actions--end">
        <div class="timecard-week-toolbar__metric small text-muted">
          {{ employeeCount }} employee{{ employeeCount === 1 ? '' : 's' }}
        </div>
        <SubmissionCountBadges
          :draft-count="draftCount"
          :submitted-count="submittedCount"
          wrapper-class="timecard-week-toolbar__badges small text-muted"
        />
        <button
          class="btn btn-success btn-sm"
          :disabled="submittingAll || loading || draftCount === 0"
          @click="emit('submitAll')"
        >
          <i class="bi bi-send me-1"></i>
          {{ submittingAll ? 'Submitting...' : `Submit Drafts (${draftCount})` }}
        </button>
      </div>
    </div>
  </AppToolbarCard>
</template>
