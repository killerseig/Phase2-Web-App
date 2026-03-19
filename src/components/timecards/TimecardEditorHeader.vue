<script setup lang="ts">
import TimecardStatusBadge from '@/components/timecards/TimecardStatusBadge.vue'
import type { TimecardEmployeeEditorForm, TimecardModel } from '@/views/timecards/timecardUtils'
import { getTimecardFirstName, getTimecardLastName } from '@/views/timecards/timecardUtils'

const props = defineProps<{
  itemKey: string
  timecard: TimecardModel
  isEditing: boolean
  editForm: TimecardEmployeeEditorForm
  editDisabled: boolean
  deleteDisabled: boolean
}>()

const emit = defineEmits<{
  (e: 'update:editForm', value: TimecardEmployeeEditorForm): void
  (e: 'toggle-edit'): void
  (e: 'delete'): void
}>()

function updateEditField<K extends keyof TimecardEmployeeEditorForm>(
  field: K,
  value: TimecardEmployeeEditorForm[K],
) {
  emit('update:editForm', {
    ...props.editForm,
    [field]: value,
  })
}

function formatWage(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return '-'
  return `$${Number(value).toFixed(2)}`
}
</script>

<template>
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
          <div class="tc-meta-value">{{ formatWage(timecard.employeeWage) }}</div>
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
          <TimecardStatusBadge :status="timecard.status" variant="editor" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;

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
  .timecard-header-row {
    row-gap: 0.35rem;
  }

  .tc-header-actions {
    padding-top: 0.15rem;
  }

  .tc-header-actions__row {
    justify-content: space-between;
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
