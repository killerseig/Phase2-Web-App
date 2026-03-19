<script setup lang="ts">
import BaseAccordionCard from '@/components/common/BaseAccordionCard.vue'
import TimecardDetailPanel from '@/components/timecards/TimecardDetailPanel.vue'
import TimecardEditorHeader from '@/components/timecards/TimecardEditorHeader.vue'
import TimecardJobTable from '@/components/timecards/TimecardJobTable.vue'
import type { DiffField } from '@/components/timecards/timecardEditorTypes'
import { getTimecardDisplayName, type TimecardEmployeeEditorForm, type TimecardModel } from '@/views/timecards/timecardUtils'

defineProps<{
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
}>()

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
      <TimecardEditorHeader
        :item-key="itemKey"
        :timecard="timecard"
        :is-editing="isEditing"
        :edit-form="editForm"
        :edit-disabled="editDisabled"
        :delete-disabled="deleteDisabled"
        @update:edit-form="emit('update:editForm', $event)"
        @toggle-edit="emit('toggle-edit')"
        @delete="emit('delete')"
      >
        <template #badges>
          <slot name="badges" />
        </template>
      </TimecardEditorHeader>
    </template>

    <TimecardJobTable
      :item-key="itemKey"
      :timecard="timecard"
      :job-fields-locked="jobFieldsLocked"
      @add-job-row="emit('add-job-row')"
      @remove-job-row="emit('remove-job-row', $event)"
      @update-job-number="emit('update-job-number', $event)"
      @update-subsection-area="emit('update-subsection-area', $event)"
      @update-account="emit('update-account', $event)"
      @update-diff-value="emit('update-diff-value', $event)"
      @update-hours="emit('update-hours', $event)"
      @update-production="emit('update-production', $event)"
    />

    <TimecardDetailPanel
      :timecard="timecard"
      :notes-locked="notesLocked"
      :mileage-disabled="mileageDisabled"
      @update-mileage="emit('update-mileage', $event)"
      @update-notes="emit('update-notes', $event)"
    />
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

@media (max-width: 768px) {
  .timecard-editor-card :deep(.accordion-card__header) {
    padding: 0.65rem 0.95rem;
  }
}
</style>
