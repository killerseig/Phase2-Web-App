<script setup lang="ts">
import AppDetailField from '@/components/common/AppDetailField.vue'
import BaseCheckboxField from '@/components/common/BaseCheckboxField.vue'
import TimecardStatusBadge from '@/components/timecards/TimecardStatusBadge.vue'
import type { TimecardEmployeeEditorForm, TimecardModel } from '@/utils/timecardUtils'
import { getTimecardDisplayName, getTimecardFirstName, getTimecardLastName } from '@/utils/timecardUtils'

const props = withDefaults(defineProps<{
  itemKey: string
  timecard: TimecardModel
  open?: boolean
  compactWhenClosed?: boolean
  isEditing: boolean
  editForm: TimecardEmployeeEditorForm
  editDisabled: boolean
  deleteDisabled: boolean
  showEditButton?: boolean
  showDeleteButton?: boolean
}>(), {
  open: false,
  compactWhenClosed: false,
  showEditButton: true,
  showDeleteButton: true,
})

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

function formatCompactMeta(): string {
  const parts = [
    props.timecard.employeeNumber ? `#${props.timecard.employeeNumber}` : null,
    props.timecard.occupation || null,
    props.timecard.subcontractedEmployee ? 'Sub' : 'Direct',
  ].filter(Boolean)

  return parts.join(' | ')
}
</script>

<template>
  <div v-if="compactWhenClosed && !open && !isEditing" class="timecard-header-compact">
    <div class="timecard-header-compact__identity">
      <div class="timecard-header-compact__name">{{ getTimecardDisplayName(timecard) }}</div>
      <div class="timecard-header-compact__meta">{{ formatCompactMeta() }}</div>
    </div>

    <div class="timecard-header-compact__status">
      <slot name="badges" />
      <TimecardStatusBadge :status="timecard.status" variant="editor" />
    </div>

    <div v-if="showEditButton" class="timecard-header-compact__actions">
      <button
        class="btn btn-sm btn-outline-secondary"
        :disabled="editDisabled"
        title="Edit employee details"
        aria-label="Edit employee details"
        @click.stop="emit('toggle-edit')"
      >
        <i class="bi bi-pencil"></i>
      </button>
    </div>
  </div>

  <div v-else class="timecard-header-row">
    <div class="timecard-header-row__item">
      <AppDetailField
        :editing="isEditing"
        label="First Name"
        :model-value="editForm.firstName"
        :display-value="getTimecardFirstName(timecard)"
        placeholder="First name"
        input-class="form-control form-control-sm"
        @update:model-value="updateEditField('firstName', $event)"
      />
    </div>

    <div class="timecard-header-row__item">
      <AppDetailField
        :editing="isEditing"
        label="Last Name"
        :model-value="editForm.lastName"
        :display-value="getTimecardLastName(timecard)"
        placeholder="Last name"
        input-class="form-control form-control-sm"
        @update:model-value="updateEditField('lastName', $event)"
      />
    </div>

    <div class="timecard-header-row__item">
      <AppDetailField
        :editing="isEditing"
        label="Employee #"
        :model-value="editForm.employeeNumber"
        :display-value="timecard.employeeNumber"
        placeholder="Employee #"
        input-class="form-control form-control-sm"
        @update:model-value="updateEditField('employeeNumber', $event)"
      />
    </div>

    <div class="timecard-header-row__item">
      <AppDetailField
        :editing="isEditing"
        label="Occupation"
        :model-value="editForm.occupation"
        :display-value="timecard.occupation"
        placeholder="Occupation"
        input-class="form-control form-control-sm"
        @update:model-value="updateEditField('occupation', $event)"
      />
    </div>

    <div class="timecard-header-row__item">
      <div class="d-flex align-items-end gap-2 w-100">
        <AppDetailField
          :editing="isEditing"
          label="Wage"
          :model-value="editForm.employeeWage"
          :display-value="formatWage(timecard.employeeWage)"
          field-class="tc-inline-field flex-grow-1"
          type="number"
          min="0"
          step="0.01"
          placeholder="Wage"
          input-class="form-control form-control-sm"
          @update:model-value="updateEditField('employeeWage', $event)"
        />
        <AppDetailField
          :editing="isEditing"
          label="Sub"
          :display-value="timecard.subcontractedEmployee ? 'Yes' : 'No'"
          field-class="tc-inline-field"
        >
          <template #input>
            <BaseCheckboxField
              :id="`timecard-subcontracted-${itemKey}`"
              :model-value="editForm.subcontractedEmployee"
              label="Yes"
              label-class="ms-2 small"
              wrapper-class="m-0 d-flex align-items-center tc-sub-check"
              input-class="mt-0"
              @update:model-value="updateEditField('subcontractedEmployee', $event)"
            />
          </template>
        </AppDetailField>
      </div>
    </div>

    <div class="timecard-header-row__actions tc-header-actions">
      <div class="tc-header-actions__row">
        <div v-if="showEditButton || (isEditing && showDeleteButton)" class="tc-header-actions__buttons">
          <div
            v-if="isEditing && showDeleteButton"
            class="btn-group btn-group-sm flex-nowrap"
            role="group"
          >
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
            v-if="showEditButton"
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
  padding-top: 0.1rem;
}

.tc-header-actions__row {
  align-items: center;
  display: flex;
  gap: 0.4rem;
  justify-content: flex-end;
  min-width: 0;
  white-space: nowrap;
}

.tc-header-actions__buttons,
.tc-header-actions__badges {
  align-items: center;
  display: flex;
  gap: 0.4rem;
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

.tc-inline-field {
  min-width: 0;
}

.timecard-header-compact {
  align-items: center;
  display: grid;
  gap: 0.5rem 0.75rem;
  grid-template-columns: minmax(0, 1fr) auto auto;
  min-width: 0;
  width: 100%;
}

.timecard-header-compact__identity {
  min-width: 0;
}

.timecard-header-compact__name {
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.1;
}

.timecard-header-compact__meta {
  color: $text-muted;
  font-size: 0.84rem;
  margin-top: 0.12rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.timecard-header-compact__status {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  justify-content: flex-end;
}

.timecard-header-compact__actions {
  flex-shrink: 0;
}

.tc-sub-check {
  min-height: 31px;
  white-space: nowrap;
}

.timecard-header-row {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem 0.65rem;
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
  .timecard-header-compact {
    grid-template-columns: 1fr;
  }

  .timecard-header-compact__status {
    justify-content: flex-start;
  }

  .timecard-header-row {
    row-gap: 0.25rem;
  }

  .tc-header-actions {
    padding-top: 0.05rem;
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
