<script setup lang="ts">
import { computed } from 'vue'
import { DAY_NAMES_SHORT } from '@/constants/app'
import type { DiffField } from '@/components/timecards/timecardEditorTypes'
import type { TimecardModel } from '@/views/timecards/timecardUtils'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

const props = defineProps<{
  itemKey: string
  timecard: TimecardModel
  jobFieldsLocked: boolean
}>()

const emit = defineEmits<{
  (e: 'add-job-row'): void
  (e: 'remove-job-row', jobIndex: number): void
  (e: 'update-job-number', payload: { jobIndex: number; value: string }): void
  (e: 'update-subsection-area', payload: { jobIndex: number; value: string }): void
  (e: 'update-account', payload: { jobIndex: number; value: string }): void
  (e: 'update-diff-value', payload: { jobIndex: number; field: DiffField; value: string }): void
  (e: 'update-hours', payload: { jobIndex: number; dayIndex: number; value: number }): void
  (e: 'update-production', payload: { jobIndex: number; dayIndex: number; value: number }): void
}>()

const jobCount = computed(() => props.timecard.jobs?.length || 1)

function formatHours(value: number | null | undefined): string {
  const numeric = Number(value ?? 0)
  if (!Number.isFinite(numeric) || Number.isNaN(numeric)) return '0.00'
  return numeric.toFixed(2)
}
</script>

<template>
  <div>
    <div class="table-responsive">
      <table class="table table-sm table-striped mb-0 timecard-table">
        <thead>
          <tr>
            <th class="text-center small fw-semibold col-job">Job #</th>
            <th class="text-center small fw-semibold col-subarea">Sub/Area</th>
            <th class="text-center small fw-semibold col-acct">Acct</th>
            <th class="text-center small fw-semibold col-blank"></th>
            <th class="text-center small fw-semibold col-div">Dif</th>
            <th v-for="dayLabel in DAY_NAMES_SHORT" :key="dayLabel" class="text-center col-day">
              <div class="fw-semibold small">{{ dayLabel }}</div>
            </th>
            <th class="text-center small fw-semibold col-total">Total</th>
            <th class="col-actions"></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="(job, jobIdx) in (timecard.jobs || [])" :key="`${itemKey}-job-${jobIdx}`">
            <tr :class="['align-middle', 'timecard-job-row', jobIdx % 2 === 1 ? 'timecard-job-alt' : '']">
              <td :rowspan="3" class="tc-soft text-center px-2 py-0 align-middle">
                <input
                  type="text"
                  :value="job.jobNumber || ''"
                  :disabled="jobFieldsLocked"
                  class="form-control form-control-sm text-center"
                  placeholder="Job #"
                  :aria-label="`Job ${jobIdx + 1} number`"
                  @input="emit('update-job-number', { jobIndex: jobIdx, value: ($event.target as HTMLInputElement).value })"
                />
              </td>
              <td :rowspan="3" class="tc-soft text-center px-2 py-0 align-middle">
                <input
                  type="text"
                  :value="job.subsectionArea ?? job.area ?? ''"
                  :disabled="jobFieldsLocked"
                  class="form-control form-control-sm text-center"
                  placeholder="Sub/Area"
                  :aria-label="`Job ${jobIdx + 1} subsection area`"
                  @input="emit('update-subsection-area', { jobIndex: jobIdx, value: ($event.target as HTMLInputElement).value })"
                />
              </td>
              <td :rowspan="3" class="tc-soft text-center px-2 py-0 align-middle">
                <input
                  type="text"
                  :value="job.account ?? job.acct ?? ''"
                  :disabled="jobFieldsLocked"
                  class="form-control form-control-sm text-center"
                  placeholder="Acct"
                  :aria-label="`Job ${jobIdx + 1} account`"
                  @input="emit('update-account', { jobIndex: jobIdx, value: ($event.target as HTMLInputElement).value })"
                />
              </td>
              <td class="tc-soft small fw-semibold text-center">H</td>
              <td class="tc-soft text-center px-2 py-0">
                <input
                  type="text"
                  :value="job.difH || ''"
                  :disabled="jobFieldsLocked"
                  class="form-control form-control-sm text-center"
                  placeholder="Dif"
                  :aria-label="`Job ${jobIdx + 1} hours diff note`"
                  @input="emit('update-diff-value', { jobIndex: jobIdx, field: 'difH', value: ($event.target as HTMLInputElement).value })"
                />
              </td>
              <td v-for="dayIdx in 7" :key="`h-${itemKey}-${jobIdx}-${dayIdx}`" class="text-center px-2 py-0 day-cell">
                <template v-if="job.days?.[dayIdx - 1]">
                  <input
                    :value="job.days?.[dayIdx - 1]?.hours ?? 0"
                    type="number"
                    inputmode="decimal"
                    min="0"
                    max="24"
                    step="0.25"
                    :disabled="jobFieldsLocked"
                    class="form-control form-control-sm text-center w-100 day-input hours-input"
                    placeholder="0"
                    :aria-label="`Job ${jobIdx + 1} ${DAY_NAMES[dayIdx - 1]} hours`"
                    @input="emit('update-hours', { jobIndex: jobIdx, dayIndex: dayIdx - 1, value: Number(($event.target as HTMLInputElement).value) })"
                    @focus="($event.target as HTMLInputElement).select()"
                    @click.stop
                  />
                </template>
              </td>
              <td class="text-center fw-semibold small">{{ formatHours(timecard.totals.hoursTotal ?? 0) }}</td>
              <td :rowspan="3" class="text-center align-middle">
                <button
                  v-if="(timecard.jobs?.length || 0) > 1"
                  class="btn btn-sm btn-danger btn-icon"
                  title="Remove job"
                  :disabled="jobFieldsLocked"
                  :aria-label="`Remove job row ${jobIdx + 1}`"
                  @click="emit('remove-job-row', jobIdx)"
                >
                  <i class="bi bi-x"></i>
                </button>
              </td>
            </tr>

            <tr :class="['align-middle', 'tc-soft', 'timecard-job-row', jobIdx % 2 === 1 ? 'timecard-job-alt' : '']">
              <td class="tc-soft small fw-semibold text-center">P</td>
              <td class="tc-soft text-center px-2 py-0">
                <input
                  type="text"
                  :value="job.difP || ''"
                  :disabled="jobFieldsLocked"
                  class="form-control form-control-sm text-center"
                  placeholder="Dif"
                  :aria-label="`Job ${jobIdx + 1} production diff note`"
                  @input="emit('update-diff-value', { jobIndex: jobIdx, field: 'difP', value: ($event.target as HTMLInputElement).value })"
                />
              </td>
              <td v-for="dayIdx in 7" :key="`p-${itemKey}-${jobIdx}-${dayIdx}`" class="text-center px-2 py-0 day-cell">
                <template v-if="job.days?.[dayIdx - 1]">
                  <input
                    :value="job.days?.[dayIdx - 1]?.production ?? 0"
                    type="number"
                    inputmode="decimal"
                    min="0"
                    step="0.1"
                    :disabled="jobFieldsLocked"
                    class="form-control form-control-sm text-center w-100 day-input"
                    title="Production units"
                    placeholder="0"
                    :aria-label="`Job ${jobIdx + 1} ${DAY_NAMES[dayIdx - 1]} production`"
                    @input="emit('update-production', { jobIndex: jobIdx, dayIndex: dayIdx - 1, value: Number(($event.target as HTMLInputElement).value) })"
                    @focus="($event.target as HTMLInputElement).select()"
                    @click.stop
                  />
                </template>
              </td>
              <td class="text-center fw-semibold small">{{ formatHours(timecard.totals.productionTotal ?? 0) }}</td>
            </tr>

            <tr :class="['align-middle', 'timecard-job-row', jobIdx % 2 === 1 ? 'timecard-job-alt' : '']">
              <td class="tc-soft small fw-semibold text-center">C</td>
              <td class="tc-soft text-center px-2 py-0">
                <input
                  type="text"
                  :value="job.difC || ''"
                  :disabled="jobFieldsLocked"
                  class="form-control form-control-sm text-center"
                  placeholder="Dif"
                  :aria-label="`Job ${jobIdx + 1} cost diff note`"
                  @input="emit('update-diff-value', { jobIndex: jobIdx, field: 'difC', value: ($event.target as HTMLInputElement).value })"
                />
              </td>
              <td v-for="dayIdx in 7" :key="`c-${itemKey}-${jobIdx}-${dayIdx}`" class="text-center px-2 py-0 day-cell">
                <template v-if="job.days?.[dayIdx - 1]">
                  <input
                    :value="formatHours(job.days?.[dayIdx - 1]?.unitCost ?? 0)"
                    type="text"
                    class="form-control form-control-sm text-center text-xs day-input day-input-readonly"
                    title="Cost per unit auto-calculated from wage, hours, production, and burden"
                    :aria-label="`Job ${jobIdx + 1} ${DAY_NAMES[dayIdx - 1]} auto-calculated unit cost`"
                    readonly
                    disabled
                  />
                </template>
              </td>
              <td class="text-center fw-semibold small">${{ formatHours(timecard.totals.lineTotal ?? 0) }}</td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <div class="timecard-editor-card__job-footer d-flex justify-content-between align-items-center">
      <small class="text-muted">
        Showing {{ jobCount }} job{{ jobCount === 1 ? '' : 's' }}
      </small>
      <button
        class="btn btn-sm btn-outline-primary"
        title="Add another job row"
        :disabled="jobFieldsLocked"
        @click="emit('add-job-row')"
      >
        <i class="bi bi-plus-circle me-1"></i>
        Add Job Row
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;

$timecard-divider-color: rgba($primary, 0.18);

:deep(input[type='number']) {
  appearance: textfield;
  -moz-appearance: textfield;
}

:deep(input[type='number']::-webkit-outer-spin-button),
:deep(input[type='number']::-webkit-inner-spin-button) {
  -webkit-appearance: none;
  margin: 0;
}

.timecard-table {
  --bs-table-border-color: transparent;
  border-color: transparent;
}

.timecard-table th,
.timecard-table td {
  padding: 0.16rem 0.22rem;
}

.timecard-table > :not(caption) > * > * {
  border-color: transparent;
}

.timecard-table input {
  background: transparent;
  border: 0;
  box-shadow: none;
  padding: 0.05rem 0.14rem;
}

.timecard-table input:focus {
  background: transparent;
  border: 0;
  box-shadow: none;
  outline: none;
}

.col-job {
  min-width: 76px;
  width: 76px;
}

.col-subarea {
  min-width: 96px;
  width: 96px;
}

.col-acct {
  min-width: 72px;
  width: 72px;
}

.col-blank {
  width: 42px;
}

.col-div {
  min-width: 64px;
  width: 64px;
}

.col-day {
  width: 56px;
}

.col-total {
  width: 66px;
}

.col-actions {
  width: 40px;
}

.text-xs {
  font-size: 0.875rem;
}

.timecard-job-row td {
  transition: background-color 0.12s ease;
}

.timecard-job-row .day-cell {
  background-color: transparent;
}

.timecard-job-row:hover .day-cell {
  background-color: transparent;
}

.timecard-job-alt .day-cell {
  background-color: transparent;
}

.timecard-job-alt:hover .day-cell {
  background-color: transparent;
}

.day-input {
  background: transparent;
  color: $body-color;
  font-size: 0.84rem;
  min-width: 0;
  width: 100%;
}

.day-input-readonly:disabled {
  color: $body-color;
  opacity: 1;
}

.hours-input {
  margin: 0 auto;
  max-width: 4.6ch;
}

.tc-soft {
  background-color: rgba($secondary, 0.08);
}

.timecard-job-row td,
.timecard-job-row td.tc-soft {
  background-color: transparent;
}

.timecard-editor-card__job-footer {
  border-top: 1px solid $timecard-divider-color;
  padding: 0.65rem 0.9rem;
}

@media (max-width: 768px) {
  .day-input {
    font-size: 0.85rem;
    min-width: 68px;
  }

  .timecard-table th,
  .timecard-table td {
    padding: 0.2rem 0.24rem;
  }

  .col-job,
  .col-subarea,
  .col-acct,
  .col-div {
    min-width: 105px;
  }
}
</style>
