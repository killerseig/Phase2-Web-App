<script setup lang="ts">
import { computed } from 'vue'
import AppDataGroupCard from '@/components/common/AppDataGroupCard.vue'
import ControllerCreatorGroupSection from '@/components/controller/ControllerCreatorGroupSection.vue'
import ControllerTimecardSummary from '@/components/controller/ControllerTimecardSummary.vue'
import type {
  ControllerGroupedTimecard,
  ControllerJobGroup,
} from '@/types/controller'
import type {
  TimecardEmployeeEditorForm,
  TimecardModel,
} from '@/utils/timecardUtils'
import type { WorkbookFooterField, WorkbookOffField } from '@/types/timecards'

type DiffField = 'difH' | 'difP' | 'difC'

const props = defineProps<{
  group: ControllerJobGroup
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

const subtitle = computed(() => (
  `${props.group.jobCode ? `${props.group.jobCode} | ` : ''}${props.group.totalCount} matching timecard${props.group.totalCount === 1 ? '' : 's'} | ${props.group.creatorGroups.length} creator${props.group.creatorGroups.length === 1 ? '' : 's'}`
))
</script>

<template>
  <AppDataGroupCard
    card-class="controller-job-group"
    body-class="p-0"
    eyebrow="Job"
    :title="group.jobName"
    :subtitle="subtitle"
    title-tag="h4"
    title-class="h6 mb-0"
    compact-header
    tone="accent"
  >
    <template #summary>
      <ControllerTimecardSummary
        class="controller-job-group__summary"
        :draft-count="group.draftCount"
        :submitted-count="group.submittedCount"
        :total-hours="group.totalHours"
        :total-production="group.totalProduction"
        :total-line="group.totalLine"
      />
    </template>

    <div class="timecards-accordion controller-timecards-accordion">
      <ControllerCreatorGroupSection
        v-for="creatorGroup in group.creatorGroups"
        :key="`${group.jobId}-${creatorGroup.creatorKey}`"
        :creator-group="creatorGroup"
        :edit-form="editForm"
        :expanded-id="expandedId"
      :editing-timecard-id="editingTimecardId"
      :is-admin="isAdmin"
      :format-timecard-week="formatTimecardWeek"
      :is-timecard-locked="isTimecardLocked"
      :is-timecard-delete-disabled="isTimecardDeleteDisabled"
        @update:edit-form="emit('update:editForm', $event)"
        @toggle-open="emit('toggle-open', $event)"
        @toggle-edit="emit('toggle-edit', $event)"
        @delete="emit('delete', $event)"
        @add-job-row="emit('add-job-row', $event)"
        @remove-job-row="emit('remove-job-row', $event)"
        @update-job-number="emit('update-job-number', $event)"
        @update-subsection-area="emit('update-subsection-area', $event)"
        @update-account="emit('update-account', $event)"
        @update-diff-value="emit('update-diff-value', $event)"
        @update-off-value="emit('update-off-value', $event)"
        @update-hours="emit('update-hours', $event)"
        @update-production="emit('update-production', $event)"
        @update-unit-cost="emit('update-unit-cost', $event)"
        @update-footer-field="emit('update-footer-field', $event)"
        @update-mileage="emit('update-mileage', $event)"
        @update-notes="emit('update-notes', $event)"
      />
    </div>
  </AppDataGroupCard>
</template>

<style scoped lang="scss">
.controller-job-group__summary {
  text-align: right;
}

.controller-job-group :deep(.card-header) {
  padding: 0.85rem 1rem;
}

.controller-job-group :deep(.app-toolbar-meta__eyebrow) {
  margin-bottom: 0.2rem;
}

.controller-job-group :deep(.app-toolbar-meta__subtitle) {
  font-size: 0.9rem;
  margin-top: 0.2rem;
}

.controller-job-group :deep(.controller-timecard-summary) {
  gap: 0.35rem;
}

.controller-timecards-accordion :deep(.timecard-editor-card) {
  border-radius: 0;
  margin-bottom: 0 !important;
}

@media (max-width: 991px) {
  .controller-job-group__summary {
    text-align: left;
  }
}
</style>
