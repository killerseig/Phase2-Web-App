<script setup lang="ts">
import { computed } from 'vue'
import AppDetailField from '@/components/common/AppDetailField.vue'
import BaseCheckboxField from '@/components/common/BaseCheckboxField.vue'
import TimecardStatusBadge from '@/components/timecards/TimecardStatusBadge.vue'
import type { TimecardEmployeeEditorForm, TimecardModel } from '@/utils/timecardUtils'
import { getTimecardDisplayName, getTimecardFirstName, getTimecardLastName } from '@/utils/timecardUtils'
import { getTimecardOccupationOptions } from '@/constants/timecards'

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

const occupationOptions = computed(() => (
  getTimecardOccupationOptions(props.editForm.occupation || props.timecard.occupation)
))
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
      >
        <template #input>
          <select
            class="form-select form-select-sm"
            :value="editForm.occupation"
            @change="updateEditField('occupation', String(($event.target as HTMLSelectElement).value || ''))"
          >
            <option value="">Select occupation</option>
            <option
              v-for="occupation in occupationOptions"
              :key="occupation"
              :value="occupation"
            >
              {{ occupation }}
            </option>
          </select>
        </template>
      </AppDetailField>
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
