<script setup lang="ts">
import BaseAccordionCard from '@/components/common/BaseAccordionCard.vue'
import TimecardEditorHeader from '@/components/timecards/TimecardEditorHeader.vue'
import TimecardSelectedMetaCard from '@/components/timecards/TimecardSelectedMetaCard.vue'
import TimecardWorkspaceCard from '@/components/timecards/TimecardWorkspaceCard.vue'
import type { DiffField, WorkbookFooterField, WorkbookOffField } from '@/types/timecards'
import { getTimecardDisplayName, type TimecardEmployeeEditorForm, type TimecardModel } from '@/utils/timecardUtils'

defineProps<{
  itemKey: string
  timecard: TimecardModel
  open: boolean
  compactWhenClosed?: boolean
  isEditing: boolean
  editForm: TimecardEmployeeEditorForm
  isAdmin: boolean
  jobFieldsLocked: boolean
  notesLocked: boolean
  editDisabled: boolean
  deleteDisabled: boolean
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
  (e: 'update-off-value', payload: { jobIndex: number; field: WorkbookOffField; value: number }): void
  (e: 'update-hours', payload: { jobIndex: number; dayIndex: number; value: number }): void
  (e: 'update-production', payload: { jobIndex: number; dayIndex: number; value: number }): void
  (e: 'update-unit-cost', payload: { jobIndex: number; dayIndex: number; value: number | null }): void
  (e: 'update-footer-field', payload: { field: WorkbookFooterField; value: string }): void
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
        :open="open"
        :compact-when-closed="compactWhenClosed"
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
    <div class="timecard-editor-card__workspace">
      <div class="timecard-editor-card__workspace-main">
        <TimecardWorkspaceCard
          :item-key="itemKey"
          :timecard="timecard"
          :job-fields-locked="jobFieldsLocked"
          :notes-locked="notesLocked"
          @update-job-number="emit('update-job-number', $event)"
          @update-subsection-area="emit('update-subsection-area', $event)"
          @update-account="emit('update-account', $event)"
          @update-diff-value="emit('update-diff-value', $event)"
          @update-off-value="emit('update-off-value', $event)"
          @update-hours="emit('update-hours', $event)"
          @update-production="emit('update-production', $event)"
          @update-unit-cost="emit('update-unit-cost', $event)"
          @update-footer-field="emit('update-footer-field', $event)"
          @update-notes="emit('update-notes', $event)"
        />
      </div>

      <div class="timecard-editor-card__workspace-side">
        <TimecardSelectedMetaCard :timecard="timecard" />
      </div>
    </div>
  </BaseAccordionCard>
</template>
