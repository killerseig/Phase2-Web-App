<script setup lang="ts">
import { computed } from 'vue'
import BaseAccordionCard from '@/components/common/BaseAccordionCard.vue'
import { DAY_NAMES_SHORT } from '@/constants/app'
import {
  calculateRegularAndOvertimeHours,
  getTimecardDisplayName,
  getTimecardFirstName,
  getTimecardLastName,
  type TimecardEmployeeEditorForm,
  type TimecardModel,
} from '@/views/timecards/timecardUtils'

type DiffField = 'difH' | 'difP' | 'difC'

interface Props {
  itemKey: string
  timecard: TimecardModel
  open: boolean
  isEditing: boolean
  editForm: TimecardEmployeeEditorForm
  isAdmin: boolean
  jobFieldsLocked: boolean
  notesLocked: boolean
  editDisabled: boolean
  deleteDisabled: boolean
  mileageDisabled: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'update:editForm', value: TimecardEmployeeEditorForm): void
  (e: 'toggle-edit'): void
  (e: 'delete'): void
  (e: 'add-job-row'): void
  (e: 'remove-job-row', jobIndex: number): void
  (e: 'update-job-number', payload: { jobIndex: number; value: string }): void
  (e: 'update-subsection-area', payload: { jobIndex: number; value: string }): void
  (e: 'update-account', payload: { jobIndex: number; value: string }): void
  (e: 'update-diff-value', payload: { jobIndex: number; field: DiffField; value: string }): void
  (e: 'update-hours', payload: { jobIndex: number; dayIndex: number; value: number }): void
  (e: 'update-production', payload: { jobIndex: number; dayIndex: number; value: number }): void
  (e: 'update-mileage', value: string): void
  (e: 'update-notes', value: string): void
}>()

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

const hoursBreakdown = computed(() => calculateRegularAndOvertimeHours(
  props.timecard.totals?.hoursTotal ?? 0,
  null,
  null,
))

const jobCount = computed(() => props.timecard.jobs?.length || 1)
const statusBadgeClass = computed(() => (
  props.timecard.status === 'submitted'
    ? 'badge app-badge-pill app-badge-pill--sm bg-success'
    : 'badge app-badge-pill app-badge-pill--sm bg-warning text-dark'
))

function updateEditField<K extends keyof TimecardEmployeeEditorForm>(
  field: K,
  value: TimecardEmployeeEditorForm[K],
) {
  emit('update:editForm', {
    ...props.editForm,
    [field]: value,
  })
}

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
  <BaseAccordionCard
    class="timecard-editor-card"
    :title="getTimecardDisplayName(timecard)"
    :open="open"
    body-class="p-0"
    @update:open="(value) => emit('update:open', value)"
  >
    <template #header>
      <div class="timecard-header-row">
        <div class="timecard-header-row__item">
          <div v-if="isEditing" class="d-flex align-items-center gap-2 w-100" @click.stop>
            <div class="w-100">
              <div class="tc-meta-label mb-1">First Name</div>
              <input
                :value="editForm.firstName"
                type="text"
                class="form-control form-control-sm"
                placeholder="First name"
                @input="updateEditField('firstName', ($event.target as HTMLInputElement).value)"
              />
            </div>
          </div>
          <div v-else class="tc-meta">
            <div class="tc-meta-label">First Name</div>
            <div class="tc-meta-value">{{ getTimecardFirstName(timecard) || '-' }}</div>
          </div>
        </div>

        <div class="timecard-header-row__item">
          <div v-if="isEditing" class="d-flex align-items-center gap-2 w-100" @click.stop>
            <div class="w-100">
              <div class="tc-meta-label mb-1">Last Name</div>
              <input
                :value="editForm.lastName"
                type="text"
                class="form-control form-control-sm"
                placeholder="Last name"
                @input="updateEditField('lastName', ($event.target as HTMLInputElement).value)"
              />
            </div>
          </div>
          <div v-else class="tc-meta">
            <div class="tc-meta-label">Last Name</div>
            <div class="tc-meta-value">{{ getTimecardLastName(timecard) || '-' }}</div>
          </div>
        </div>

        <div class="timecard-header-row__item">
          <div v-if="isEditing" class="d-flex align-items-center gap-2 w-100" @click.stop>
            <div class="w-100">
              <div class="tc-meta-label mb-1">Employee #</div>
              <input
                :value="editForm.employeeNumber"
                type="text"
                class="form-control form-control-sm"
                placeholder="Employee #"
                @input="updateEditField('employeeNumber', ($event.target as HTMLInputElement).value)"
              />
            </div>
          </div>
          <div v-else class="tc-meta">
            <div class="tc-meta-label">Employee #</div>
            <div class="tc-meta-value">{{ timecard.employeeNumber || '-' }}</div>
          </div>
        </div>

        <div class="timecard-header-row__item">
          <div v-if="isEditing" class="d-flex align-items-center gap-2 w-100" @click.stop>
            <div class="w-100">
              <div class="tc-meta-label mb-1">Occupation</div>
              <input
                :value="editForm.occupation"
                type="text"
                class="form-control form-control-sm"
                placeholder="Occupation"
                @input="updateEditField('occupation', ($event.target as HTMLInputElement).value)"
              />
            </div>
          </div>
          <div v-else class="tc-meta">
            <div class="tc-meta-label">Occupation</div>
            <div class="tc-meta-value">{{ timecard.occupation || '-' }}</div>
          </div>
        </div>

        <div class="timecard-header-row__item">
          <div v-if="isEditing" class="d-flex align-items-center gap-2 w-100" @click.stop>
            <div class="d-flex align-items-start gap-2 w-100 tc-inline-edit">
              <div class="tc-inline-field flex-grow-1">
                <div class="tc-meta-label mb-1">Wage</div>
                <input
                  :value="editForm.employeeWage"
                  type="number"
                  min="0"
                  step="0.01"
                  class="form-control form-control-sm"
                  placeholder="Wage"
                  @input="updateEditField('employeeWage', ($event.target as HTMLInputElement).value)"
                />
              </div>
              <div class="tc-inline-field">
                <div class="tc-meta-label mb-1">Sub</div>
                <div class="form-check form-check-sm m-0 d-flex align-items-center tc-sub-check">
                  <input
                    :checked="editForm.subcontractedEmployee"
                    class="form-check-input mt-0"
                    type="checkbox"
                    :id="`timecard-subcontracted-${itemKey}`"
                    @change="updateEditField('subcontractedEmployee', ($event.target as HTMLInputElement).checked)"
                  />
                  <label class="form-check-label ms-2 small" :for="`timecard-subcontracted-${itemKey}`">Yes</label>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="d-flex align-items-end gap-2 w-100 tc-inline-display">
            <div class="tc-meta tc-inline-field flex-grow-1">
              <div class="tc-meta-label">Wage</div>
              <div class="tc-meta-value">{{ timecard.employeeWage != null ? `$${Number(timecard.employeeWage).toFixed(2)}` : '-' }}</div>
            </div>
            <div class="tc-meta tc-inline-field">
              <div class="tc-meta-label">Sub</div>
              <div class="tc-meta-value">{{ timecard.subcontractedEmployee ? 'Yes' : 'No' }}</div>
            </div>
          </div>
        </div>

        <div class="timecard-header-row__actions tc-header-actions">
          <div class="tc-header-actions__row">
            <div class="tc-header-actions__buttons">
              <div v-if="isEditing" class="btn-group btn-group-sm flex-nowrap" role="group">
                <button
                  class="btn btn-outline-danger"
                  :disabled="deleteDisabled"
                  title="Delete timecard"
                  :aria-label="`Delete timecard for ${timecard.employeeName}`"
                  @click.stop="emit('delete')"
                >
                  <i class="bi bi-trash text-danger"></i>
                </button>
              </div>

              <button
                class="btn btn-sm btn-outline-secondary"
                :aria-pressed="isEditing"
                :disabled="editDisabled"
                title="Toggle edit mode"
                :aria-label="isEditing ? 'Save employee details' : 'Edit employee details'"
                @click.stop="emit('toggle-edit')"
              >
                <i class="bi bi-pencil"></i>
              </button>
            </div>

            <div class="tc-header-actions__badges">
              <slot name="badges" />
              <span :class="statusBadgeClass">{{ timecard.status }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>

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
  </BaseAccordionCard>
</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;

$timecard-border-color: mix($surface-3, $primary, 78%);
$timecard-divider-color: rgba($primary, 0.18);
$timecard-shadow: 0 10px 24px rgba(0, 0, 0, 0.22);

.timecard-editor-card :deep(.accordion-card) {
  background: $surface;
  border-color: $timecard-border-color;
  box-shadow: $timecard-shadow;
}

.timecard-editor-card :deep(.accordion-card__header) {
  background: $surface-2;
  color: $body-color;
  border-bottom: 1px solid transparent;
  padding: 0.75rem 1rem;
  transition: background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.timecard-editor-card :deep(.accordion-card--open .accordion-card__header) {
  background: linear-gradient(180deg, rgba($primary, 0.16) 0%, rgba($primary-200, 0.55) 60%, $surface-2 100%);
}

.timecard-editor-card :deep(.accordion-card__header:focus) {
  box-shadow: 0 0 0 0.2rem rgba($primary, 0.22);
}

.timecard-editor-card :deep(.accordion-card__body) {
  border-top-color: $timecard-divider-color;
}

.timecard-editor-card :deep(.accordion-card__inner) {
  padding: 0;
}

.timecard-editor-card :deep(input[type='number']) {
  appearance: textfield;
  -moz-appearance: textfield;
}

.timecard-editor-card :deep(input[type='number']::-webkit-outer-spin-button),
.timecard-editor-card :deep(input[type='number']::-webkit-inner-spin-button) {
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

.tc-header-actions {
  padding-top: 0.25rem;
}

.tc-header-actions__row {
  align-items: center;
  display: flex;
  gap: 0.55rem;
  justify-content: flex-end;
  min-width: 0;
  white-space: nowrap;
}

.tc-header-actions__buttons,
.tc-header-actions__badges {
  align-items: center;
  display: flex;
  gap: 0.55rem;
}

.tc-header-actions__buttons {
  flex-shrink: 0;
}

.tc-header-actions__badges {
  justify-content: flex-end;
  min-width: 0;
}

.tc-header-actions__badges :deep(.badge),
.tc-header-actions__badges .badge {
  flex-shrink: 0;
}

.tc-meta {
  min-height: 2.25rem;
}

.tc-meta-label {
  color: rgba($body-color, 0.65);
  font-size: 0.75rem;
  letter-spacing: 0.02em;
  line-height: 1;
  margin-bottom: 0.15rem;
  text-transform: uppercase;
}

.tc-meta-value {
  color: $body-color;
  font-weight: 600;
  line-height: 1.1;
}

.tc-inline-field {
  min-width: 0;
}

.tc-sub-check {
  min-height: 31px;
  white-space: nowrap;
}

.tc-soft {
  background-color: rgba($secondary, 0.08);
}

.timecard-job-row td,
.timecard-job-row td.tc-soft {
  background-color: transparent;
}

.timecard-editor-card__job-footer,
.timecard-editor-card__details {
  border-top: 1px solid $timecard-divider-color;
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

.timecard-editor-card__job-footer {
  padding: 0.65rem 0.9rem;
}

.timecard-editor-card__details {
  padding: 1rem 0.9rem 0.95rem;
}

.timecard-header-row {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.9rem;
  width: 100%;
}

.timecard-header-row__item {
  flex: 1 1 calc(50% - 0.45rem);
  min-width: 0;
}

.timecard-header-row__actions {
  flex: 1 1 100%;
  min-width: 0;
}

@media (max-width: 768px) {
  .day-input {
    font-size: 0.85rem;
    min-width: 68px;
  }

  .timecard-header-row {
    row-gap: 0.35rem;
  }

  .tc-header-actions {
    padding-top: 0.15rem;
  }

  .tc-header-actions__row {
    justify-content: space-between;
  }

  .timecard-table th,
  .timecard-table td {
    padding: 0.2rem 0.24rem;
  }

  .timecard-editor-card :deep(.accordion-card__header) {
    padding: 0.65rem 0.95rem;
  }

  .col-job,
  .col-subarea,
  .col-acct,
  .col-div {
    min-width: 105px;
  }
}

@media (min-width: 768px) {
  .timecard-header-row {
    flex-wrap: nowrap;
  }

  .timecard-header-row__item {
    flex: 1 1 0;
  }

  .timecard-header-row__actions {
    display: flex;
    flex: 0 0 auto;
    justify-content: flex-end;
    margin-left: auto;
  }
}
</style>
