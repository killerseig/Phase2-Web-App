<script setup lang="ts">
import { computed } from 'vue'
import ControllerJobGroupCard from '@/components/controller/ControllerJobGroupCard.vue'
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

defineOptions({
  name: 'ControllerGroupedResults',
})

interface Props {
  groupedTimecards: ControllerJobGroup[]
  editForm: TimecardEmployeeEditorForm
  expandedId: string | null
  editingTimecardId: string | null
  isAdmin: boolean
  formatTimecardWeek: (timecard: TimecardModel) => string
  isTimecardLocked: (timecard: TimecardModel) => boolean
  isTimecardDeleteDisabled: (timecard: TimecardModel) => boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:editForm': [value: TimecardEmployeeEditorForm]
  'toggle-open': [payload: { key: string; open: boolean }]
  'toggle-edit': [entry: ControllerGroupedTimecard]
  'delete': [entry: ControllerGroupedTimecard]
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
  'update-notes': [payload: { timecard: TimecardModel; value: string }]
}>()

const editFormModel = computed({
  get: () => props.editForm,
  set: (value: TimecardEmployeeEditorForm) => {
    emit('update:editForm', value)
  },
})
</script>

<template>
  <div class="controller-job-groups">
    <ControllerJobGroupCard
      v-for="group in groupedTimecards"
      :key="group.jobId"
      v-model:edit-form="editFormModel"
      :group="group"
      :expanded-id="expandedId"
      :editing-timecard-id="editingTimecardId"
      :is-admin="isAdmin"
      :format-timecard-week="formatTimecardWeek"
      :is-timecard-locked="isTimecardLocked"
      :is-timecard-delete-disabled="isTimecardDeleteDisabled"
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
      @update-notes="emit('update-notes', $event)"
    />
  </div>
</template>
