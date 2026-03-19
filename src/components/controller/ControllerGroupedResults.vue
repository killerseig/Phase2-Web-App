<script setup lang="ts">
import { computed } from 'vue'
import AppBadge from '@/components/common/AppBadge.vue'
import ControllerTimecardSummary from '@/components/controller/ControllerTimecardSummary.vue'
import TimecardEditorCard from '@/components/timecards/TimecardEditorCard.vue'
import type {
  ControllerGroupedTimecard,
  ControllerJobGroup,
} from '@/components/controller/controllerTypes'
import type {
  TimecardEmployeeEditorForm,
  TimecardModel,
} from '@/views/timecards/timecardUtils'

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
  'update-hours': [payload: { timecard: TimecardModel; jobIndex: number; dayIndex: number; value: number }]
  'update-production': [payload: { timecard: TimecardModel; jobIndex: number; dayIndex: number; value: number }]
  'update-mileage': [payload: { timecard: TimecardModel; value: string }]
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
    <section v-for="group in groupedTimecards" :key="group.jobId" class="card controller-job-group">
      <div class="card-header controller-job-group__header">
        <div>
          <div class="small text-muted text-uppercase fw-semibold">Job</div>
          <h4 class="h6 mb-1">{{ group.jobName }}</h4>
          <div class="small text-muted">
            <span v-if="group.jobCode">{{ group.jobCode }}</span>
            <span v-if="group.jobCode"> | </span>
            {{ group.totalCount }} matching timecard{{ group.totalCount === 1 ? '' : 's' }} | {{ group.creatorGroups.length }} creator{{ group.creatorGroups.length === 1 ? '' : 's' }}
          </div>
        </div>

        <ControllerTimecardSummary
          class="controller-job-group__summary"
          :draft-count="group.draftCount"
          :submitted-count="group.submittedCount"
          :total-hours="group.totalHours"
          :total-production="group.totalProduction"
          :total-line="group.totalLine"
        />
      </div>

      <div class="card-body p-0">
        <div class="timecards-accordion controller-timecards-accordion">
          <section
            v-for="creatorGroup in group.creatorGroups"
            :key="`${group.jobId}-${creatorGroup.creatorKey}`"
            class="controller-creator-group"
          >
            <div class="controller-creator-group__header">
              <div>
                <div class="small text-muted text-uppercase fw-semibold">Created By</div>
                <div class="fw-semibold">{{ creatorGroup.creatorName }}</div>
              </div>

              <ControllerTimecardSummary
                :draft-count="creatorGroup.draftCount"
                :submitted-count="creatorGroup.submittedCount"
                :total-count="creatorGroup.totalCount"
              />
            </div>

            <TimecardEditorCard
              v-for="entry in creatorGroup.timecards"
              :key="entry.key"
              v-model:edit-form="editFormModel"
              :item-key="entry.key"
              :timecard="entry.timecard"
              :open="expandedId === entry.key"
              :is-editing="editingTimecardId === entry.key"
              :is-admin="isAdmin"
              :job-fields-locked="isTimecardLocked(entry.timecard)"
              :notes-locked="isTimecardLocked(entry.timecard)"
              :edit-disabled="isTimecardLocked(entry.timecard)"
              :delete-disabled="isTimecardDeleteDisabled(entry.timecard)"
              :mileage-disabled="isTimecardLocked(entry.timecard)"
              @update:open="(open) => emit('toggle-open', { key: entry.key, open })"
              @toggle-edit="emit('toggle-edit', entry)"
              @delete="emit('delete', entry)"
              @add-job-row="emit('add-job-row', entry.timecard)"
              @remove-job-row="(jobIndex) => emit('remove-job-row', { timecard: entry.timecard, jobIndex })"
              @update-job-number="({ jobIndex, value }) => emit('update-job-number', { timecard: entry.timecard, jobIndex, value })"
              @update-subsection-area="({ jobIndex, value }) => emit('update-subsection-area', { timecard: entry.timecard, jobIndex, value })"
              @update-account="({ jobIndex, value }) => emit('update-account', { timecard: entry.timecard, jobIndex, value })"
              @update-diff-value="({ jobIndex, field, value }) => emit('update-diff-value', { timecard: entry.timecard, jobIndex, field, value })"
              @update-hours="({ jobIndex, dayIndex, value }) => emit('update-hours', { timecard: entry.timecard, jobIndex, dayIndex, value })"
              @update-production="({ jobIndex, dayIndex, value }) => emit('update-production', { timecard: entry.timecard, jobIndex, dayIndex, value })"
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
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;

$controller-group-border: mix($surface-3, $primary, 82%);
$controller-divider: rgba($primary, 0.18);

.controller-job-groups {
  display: grid;
  gap: 1rem;
}

.controller-job-group {
  background: $surface;
  border: 1px solid $controller-group-border;
  overflow: hidden;
}

.controller-job-group__header {
  align-items: center;
  background: linear-gradient(180deg, rgba($primary, 0.08) 0%, rgba($primary, 0.02) 100%);
  border-bottom: 1px solid $controller-divider;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.5rem;
  justify-content: space-between;
}

.controller-job-group__summary {
  text-align: right;
}

.controller-timecards-accordion :deep(.timecard-editor-card) {
  border-radius: 0;
  margin-bottom: 0 !important;
}

.controller-creator-group + .controller-creator-group {
  border-top: 1px solid $controller-divider;
}

.controller-creator-group__header {
  align-items: center;
  background: rgba($primary, 0.04);
  border-bottom: 1px solid $controller-divider;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  justify-content: space-between;
  padding: 0.9rem 1rem;
}

.controller-week-badge {
  letter-spacing: 0.01em;
}

@media (max-width: 991px) {
  .controller-job-group__summary {
    text-align: left;
  }

  .controller-creator-group__header {
    align-items: flex-start;
  }
}
</style>
