<script setup lang="ts">
import { computed } from 'vue'
import { calculateRegularAndOvertimeHours, type TimecardModel } from '@/views/timecards/timecardUtils'

const props = defineProps<{
  timecard: TimecardModel
  notesLocked: boolean
  mileageDisabled: boolean
}>()

const emit = defineEmits<{
  (e: 'update-mileage', value: string): void
  (e: 'update-notes', value: string): void
}>()

const hoursBreakdown = computed(() => calculateRegularAndOvertimeHours(
  props.timecard.totals?.hoursTotal ?? 0,
  null,
  null,
))

function formatHours(value: number | null | undefined): string {
  const numeric = Number(value ?? 0)
  if (!Number.isFinite(numeric) || Number.isNaN(numeric)) return '0.00'
  return numeric.toFixed(2)
}

function getMileageInputValue(value: number | null | undefined): string {
  return value == null ? '' : String(value)
}
</script>

<template>
  <div class="timecard-editor-card__details">
    <div class="row g-3">
      <div class="col-md-2">
        <div class="timecard-detail-stat">
          <div class="form-label small text-muted">Overtime</div>
          <div class="timecard-detail-stat__number">{{ formatHours(hoursBreakdown.overtimeHours) }}</div>
        </div>
      </div>

      <div class="col-md-2">
        <div class="timecard-detail-stat">
          <div class="form-label small text-muted">Regular</div>
          <div class="timecard-detail-stat__number">{{ formatHours(hoursBreakdown.regularHours) }}</div>
        </div>
      </div>

      <div class="col-md-2">
        <label class="form-label small text-muted">Mileage</label>
        <input
          type="number"
          min="0"
          step="0.1"
          :value="getMileageInputValue(timecard.mileage)"
          class="form-control form-control-sm"
          :disabled="mileageDisabled"
          placeholder="0"
          @change="emit('update-mileage', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="col-md-6">
        <label class="form-label small text-muted">Notes</label>
        <textarea
          :value="timecard.notes"
          rows="2"
          class="form-control form-control-sm"
          placeholder="Additional notes"
          :disabled="notesLocked"
          :aria-label="`Notes for ${timecard.employeeName}`"
          @input="emit('update-notes', ($event.target as HTMLTextAreaElement).value)"
        ></textarea>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;

$timecard-divider-color: rgba($primary, 0.18);

.timecard-editor-card__details {
  border-top: 1px solid $timecard-divider-color;
  padding: 1rem 0.9rem 0.95rem;
}

.timecard-detail-stat {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.timecard-detail-stat__number {
  color: $body-color;
  display: flex;
  flex: 1 1 auto;
  font-weight: 600;
  line-height: 1.1;
  min-height: calc(1.5em + 0.5rem + 2px);
  padding: 0.2rem 0 0;
}
</style>
