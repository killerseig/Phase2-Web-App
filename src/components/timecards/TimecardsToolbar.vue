<script setup lang="ts">
import { computed } from 'vue'
import AppToolbarCard from '@/components/common/AppToolbarCard.vue'
import DatePickerField from '@/components/common/DatePickerField.vue'
import SubmissionCountBadges from '@/components/common/SubmissionCountBadges.vue'

const props = defineProps<{
  selectedDate: string
  weekPickerConfig: Record<string, unknown>
  loading: boolean
  showCreateForm: boolean
  allTimecardCount: number
  draftCount: number
  submittedCount: number
  submittingAll: boolean
}>()

const emit = defineEmits<{
  (e: 'update:selectedDate', value: string): void
  (e: 'changeWeek', value: string): void
  (e: 'create'): void
  (e: 'openSummary'): void
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
  <AppToolbarCard class="timecards-toolbar mb-3">
    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
      <div class="d-flex gap-2 flex-wrap">
        <button class="btn btn-primary btn-sm" :disabled="loading || showCreateForm" @click="emit('create')">
          <i class="bi bi-plus-circle me-1"></i>
          Create New
        </button>
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
        <div class="text-muted small ms-1 align-self-center">
          Select any date in the week to load or edit timecards.
        </div>
      </div>

      <div class="d-flex gap-2 align-items-center">
        <button
          class="btn btn-outline-secondary btn-sm"
          :disabled="loading || allTimecardCount === 0"
          @click="emit('openSummary')"
        >
          <i class="bi bi-clipboard-data me-1"></i>
          Summary
        </button>
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
          {{ submittingAll ? 'Submitting...' : `Submit All (${draftCount})` }}
        </button>
      </div>
    </div>
  </AppToolbarCard>
</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;

.timecards-toolbar {
  box-shadow: $box-shadow-sm;
}

:deep(.date-input-group) {
  max-width: 210px;
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
</style>
