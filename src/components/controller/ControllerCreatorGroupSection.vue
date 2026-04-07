<script setup lang="ts">
import AppBadge from '@/components/common/AppBadge.vue'
import AppDataGroupHeader from '@/components/common/AppDataGroupHeader.vue'
import ControllerTimecardSummary from '@/components/controller/ControllerTimecardSummary.vue'
import TimecardEditorCard from '@/components/timecards/TimecardEditorCard.vue'
import type {
  ControllerCreatorGroup,
  ControllerGroupedTimecard,
} from '@/types/controller'
import type {
  TimecardEmployeeEditorForm,
  TimecardModel,
} from '@/utils/timecardUtils'
import type { WorkbookFooterField, WorkbookOffField } from '@/types/timecards'

type DiffField = 'difH' | 'difP' | 'difC'

defineProps<{
  creatorGroup: ControllerCreatorGroup
  editForm: TimecardEmployeeEditorForm
  expandedId: string | null
  editingTimecardId: string | null
  isAdmin: boolean
  formatTimecardWeek: (timecard: TimecardModel) => string
  isTimecardLocked: (timecard: TimecardModel) => boolean
  isTimecardDeleteDisabled: (timecard: TimecardModel) => boolean
}>()

const emit = defineEmits<{
  'update:editForm': [value: TimecardEmployeeEditorForm]
  'toggle-open': [payload: { key: string; open: boolean }]
  'toggle-edit': [entry: ControllerGroupedTimecard]
  delete: [entry: ControllerGroupedTimecard]
  'add-job-row': [timecard: TimecardModel]
  'remove-job-row': [payload: { timecard: TimecardModel; jobIndex: number }]
  'update-job-number': [payload: { timecard: TimecardModel; jobIndex: number; value: string }]
  'update-subsection-area': [payload: { timecard: TimecardModel; jobIndex: number; value: string }]
  'update-account': [payload: { timecard: TimecardModel; jobIndex: number; value: string }]
  'update-diff-value': [payload: { timecard: TimecardModel; jobIndex: number; field: DiffField; value: string }]
  'update-off-value': [payload: { timecard: TimecardModel; jobIndex: number; field: WorkbookOffField; value: number }]
  'update-hours': [payload: { timecard: TimecardModel; jobIndex: number; dayIndex: number; value: number }]
  'update-production': [payload: { timecard: TimecardModel; jobIndex: number; dayIndex: number; value: number }]
  'update-unit-cost': [payload: { timecard: TimecardModel; jobIndex: number; dayIndex: number; value: number | null }]
  'update-footer-field': [payload: { timecard: TimecardModel; field: WorkbookFooterField; value: string }]
  'update-mileage': [payload: { timecard: TimecardModel; value: string }]
  'update-notes': [payload: { timecard: TimecardModel; value: string }]
}>()
</script>

<template>
  <section class="controller-creator-group">
    <AppDataGroupHeader
      class="controller-creator-group__header"
      eyebrow="Creator"
      :title="creatorGroup.creatorName"
      title-tag="div"
      title-class="fw-semibold mb-0"
      compact
      tone="subtle"
    >
      <template #summary>
        <ControllerTimecardSummary
          :draft-count="creatorGroup.draftCount"
          :submitted-count="creatorGroup.submittedCount"
          :total-count="creatorGroup.totalCount"
        />
      </template>
    </AppDataGroupHeader>

    <TimecardEditorCard
      v-for="entry in creatorGroup.timecards"
      :key="entry.key"
      :edit-form="editForm"
      :item-key="entry.key"
      :timecard="entry.timecard"
      :open="expandedId === entry.key"
      compact-when-closed
      :is-editing="editingTimecardId === entry.key"
      :is-admin="isAdmin"
      :job-fields-locked="isTimecardLocked(entry.timecard)"
      :notes-locked="isTimecardLocked(entry.timecard)"
      :edit-disabled="isTimecardLocked(entry.timecard)"
      :delete-disabled="isTimecardDeleteDisabled(entry.timecard)"
      :mileage-disabled="isTimecardLocked(entry.timecard)"
      @update:edit-form="emit('update:editForm', $event)"
      @update:open="(open) => emit('toggle-open', { key: entry.key, open })"
      @toggle-edit="emit('toggle-edit', entry)"
      @delete="emit('delete', entry)"
      @add-job-row="emit('add-job-row', entry.timecard)"
      @remove-job-row="(jobIndex) => emit('remove-job-row', { timecard: entry.timecard, jobIndex })"
      @update-job-number="({ jobIndex, value }) => emit('update-job-number', { timecard: entry.timecard, jobIndex, value })"
      @update-subsection-area="({ jobIndex, value }) => emit('update-subsection-area', { timecard: entry.timecard, jobIndex, value })"
      @update-account="({ jobIndex, value }) => emit('update-account', { timecard: entry.timecard, jobIndex, value })"
      @update-diff-value="({ jobIndex, field, value }) => emit('update-diff-value', { timecard: entry.timecard, jobIndex, field, value })"
      @update-off-value="({ jobIndex, field, value }) => emit('update-off-value', { timecard: entry.timecard, jobIndex, field, value })"
      @update-hours="({ jobIndex, dayIndex, value }) => emit('update-hours', { timecard: entry.timecard, jobIndex, dayIndex, value })"
      @update-production="({ jobIndex, dayIndex, value }) => emit('update-production', { timecard: entry.timecard, jobIndex, dayIndex, value })"
      @update-unit-cost="({ jobIndex, dayIndex, value }) => emit('update-unit-cost', { timecard: entry.timecard, jobIndex, dayIndex, value })"
      @update-footer-field="({ field, value }) => emit('update-footer-field', { timecard: entry.timecard, field, value })"
      @update-mileage="(value) => emit('update-mileage', { timecard: entry.timecard, value })"
      @update-notes="(value) => emit('update-notes', { timecard: entry.timecard, value })"
    >
      <template #badges>
        <AppBadge
          :label="formatTimecardWeek(entry.timecard)"
          variant-class="text-bg-secondary"
          class="controller-week-badge"
        />
      </template>
    </TimecardEditorCard>
  </section>
</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;

$controller-divider: rgba($primary, 0.18);

.controller-creator-group + .controller-creator-group {
  border-top: 1px solid $controller-divider;
}

.controller-creator-group__header {
  padding: 0.55rem 0.85rem;
}

.controller-creator-group__header :deep(.app-toolbar-meta__eyebrow) {
  margin-bottom: 0.08rem;
}

.controller-creator-group__header :deep(.app-toolbar-meta__subtitle) {
  margin-top: 0.12rem;
}

.controller-creator-group__header :deep(.controller-timecard-summary) {
  gap: 0.2rem;
}

.controller-week-badge {
  letter-spacing: 0.01em;
}

@media (max-width: 991px) {
  .controller-creator-group__header {
    align-items: flex-start;
  }
}
</style>
