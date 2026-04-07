<script setup lang="ts">
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import BaseCard from '@/components/common/BaseCard.vue'
import TimecardSelectedMetaCard from '@/components/timecards/TimecardSelectedMetaCard.vue'
import TimecardStatusBadge from '@/components/timecards/TimecardStatusBadge.vue'
import TimecardWorkspaceCard from '@/components/timecards/TimecardWorkspaceCard.vue'
import type { ControllerGroupedTimecard } from '@/types/controller'
import type { DiffField, WorkbookFooterField, WorkbookOffField } from '@/types/timecards'
import {
  getTimecardDisplayName,
  type TimecardEmployeeEditorForm,
  type TimecardModel,
} from '@/utils/timecardUtils'

defineOptions({
  name: 'ControllerTimecardDetailPane',
})

const props = withDefaults(defineProps<{
  selectedEntry: ControllerGroupedTimecard | null
  editForm: TimecardEmployeeEditorForm
  isEditing: boolean
  jobFieldsLocked: boolean
  notesLocked: boolean
  editDisabled: boolean
  deleteDisabled: boolean
  showMetaCard?: boolean
  formatTimecardWeek: (timecard: TimecardModel) => string
}>(), {
  showMetaCard: true,
})

const emit = defineEmits<{
  'update:editForm': [value: TimecardEmployeeEditorForm]
  'toggle-edit': []
  delete: []
  'update-job-number': [payload: { jobIndex: number; value: string }]
  'update-subsection-area': [payload: { jobIndex: number; value: string }]
  'update-account': [payload: { jobIndex: number; value: string }]
  'update-diff-value': [payload: { jobIndex: number; field: DiffField; value: string }]
  'update-off-value': [payload: { jobIndex: number; field: WorkbookOffField; value: number }]
  'update-hours': [payload: { jobIndex: number; dayIndex: number; value: number }]
  'update-production': [payload: { jobIndex: number; dayIndex: number; value: number }]
  'update-unit-cost': [payload: { jobIndex: number; dayIndex: number; value: number | null }]
  'update-footer-field': [payload: { field: WorkbookFooterField; value: string }]
  'update-notes': [value: string]
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

function formatWage(value: string | number | null | undefined): string {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) return '-'
  return `$${parsed.toFixed(2)}`
}

function splitEmployeeName(value: string): { firstName: string; lastName: string } {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) {
    return { firstName: '', lastName: '' }
  }

  const [firstName, ...rest] = trimmed.split(/\s+/)
  return {
    firstName: firstName ?? '',
    lastName: rest.join(' '),
  }
}

function handleEmployeeNameUpdate(value: string) {
  const { firstName, lastName } = splitEmployeeName(value)
  emit('update:editForm', {
    ...props.editForm,
    firstName,
    lastName,
  })
}
</script>

<template>
  <AppEmptyState
    v-if="!selectedEntry"
    icon="bi bi-layout-text-window-reverse"
    icon-class="fs-2"
    title="Select a timecard"
    message="Choose a card from the browser to review or edit it here."
  />

  <div v-else class="controller-timecard-detail-pane">
    <BaseCard
      card-class="controller-timecard-detail-pane__header-card"
      body-class="controller-timecard-detail-pane__header-body"
    >
      <div class="controller-timecard-detail-pane__hero">
        <div class="controller-timecard-detail-pane__hero-main">
          <div class="controller-timecard-detail-pane__hero-title">
            {{ getTimecardDisplayName(selectedEntry.timecard) }}
          </div>
          <div class="controller-timecard-detail-pane__hero-meta">
            Employee #{{ selectedEntry.timecard.employeeNumber || '-' }}
            <span aria-hidden="true">|</span>
            {{ selectedEntry.timecard.occupation || 'No occupation' }}
            <span aria-hidden="true">|</span>
            Wage {{ formatWage(selectedEntry.timecard.employeeWage) }}
          </div>
          <div class="controller-timecard-detail-pane__hero-secondary">
            <span>{{ selectedEntry.row.jobName }}</span>
            <span aria-hidden="true">|</span>
            <span>Code {{ selectedEntry.row.jobCode }}</span>
            <span aria-hidden="true">|</span>
            <span>By {{ selectedEntry.row.createdByName || 'Unknown Creator' }}</span>
          </div>
        </div>

        <div class="controller-timecard-detail-pane__hero-actions">
          <div class="controller-timecard-detail-pane__hero-badges">
            <span class="badge text-bg-secondary">
              {{ formatTimecardWeek(selectedEntry.timecard) }}
            </span>
            <TimecardStatusBadge :status="selectedEntry.timecard.status" variant="editor" />
          </div>

          <div class="controller-timecard-detail-pane__hero-buttons">
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary"
              :disabled="editDisabled"
              @click="emit('toggle-edit')"
            >
              <i class="bi bi-pencil me-2"></i>
              {{ isEditing ? 'Save Details' : 'Edit Details' }}
            </button>

            <button
              type="button"
              class="btn btn-sm btn-outline-danger"
              :disabled="deleteDisabled"
              @click="emit('delete')"
            >
              <i class="bi bi-trash me-2"></i>
              Delete
            </button>
          </div>
        </div>
      </div>
    </BaseCard>

    <TimecardWorkspaceCard
      :item-key="selectedEntry.key"
      :timecard="selectedEntry.timecard"
      :job-fields-locked="jobFieldsLocked"
      :notes-locked="notesLocked"
      :header-editable="isEditing"
      :header-employee-name="`${editForm.firstName} ${editForm.lastName}`.trim()"
      :header-employee-number="editForm.employeeNumber"
      :header-occupation="editForm.occupation"
      :header-employee-wage="editForm.employeeWage"
      @update-employee-name="handleEmployeeNameUpdate"
      @update-employee-number="updateEditField('employeeNumber', $event)"
      @update-occupation="updateEditField('occupation', $event)"
      @update-employee-wage="updateEditField('employeeWage', $event)"
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

    <TimecardSelectedMetaCard
      v-if="showMetaCard !== false"
      :timecard="selectedEntry.timecard"
    />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;

.controller-timecard-detail-pane {
  display: grid;
  gap: 0.8rem;
}

.controller-timecard-detail-pane__header-card {
  background: $surface;
}

.controller-timecard-detail-pane__header-body {
  padding: 0.7rem 0.85rem;
}

.controller-timecard-detail-pane__hero {
  align-items: start;
  display: grid;
  gap: 0.55rem 0.8rem;
  grid-template-columns: minmax(0, 1fr) auto;
}

.controller-timecard-detail-pane__hero-main {
  min-width: 0;
}

.controller-timecard-detail-pane__hero-title {
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1.05;
}

.controller-timecard-detail-pane__hero-meta {
  color: $text-muted;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.2rem;
  font-size: 0.8rem;
}

.controller-timecard-detail-pane__hero-secondary {
  color: $text-muted;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.12rem;
  font-size: 0.74rem;
}

.controller-timecard-detail-pane__hero-actions {
  align-content: start;
  display: grid;
  gap: 0.4rem;
  justify-items: end;
}

.controller-timecard-detail-pane__hero-badges,
.controller-timecard-detail-pane__hero-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  justify-content: flex-end;
}

.controller-timecard-detail-pane__hero-buttons :deep(.btn),
.controller-timecard-detail-pane__hero-badges :deep(.badge),
.controller-timecard-detail-pane__hero-badges :deep(.app-badge-pill) {
  min-height: 2.1rem;
}

@media (max-width: 767px) {
  .controller-timecard-detail-pane {
    gap: 0.7rem;
  }

  .controller-timecard-detail-pane__header-body {
    padding: 0.65rem 0.75rem;
  }

  .controller-timecard-detail-pane__hero {
    grid-template-columns: 1fr;
  }

  .controller-timecard-detail-pane__hero-actions,
  .controller-timecard-detail-pane__hero-badges,
  .controller-timecard-detail-pane__hero-buttons {
    justify-items: start;
    justify-content: flex-start;
  }

  .controller-timecard-detail-pane__hero-title {
    font-size: 1rem;
  }

  .controller-timecard-detail-pane__hero-meta,
  .controller-timecard-detail-pane__hero-secondary {
    font-size: 0.72rem;
    margin-top: 0.15rem;
  }

  .controller-timecard-detail-pane__hero-buttons {
    width: 100%;
  }

  .controller-timecard-detail-pane__hero-buttons .btn {
    flex: 1 1 auto;
  }
}

@media (max-width: 1199px) {
  .controller-timecard-detail-pane__hero {
    grid-template-columns: 1fr;
  }

  .controller-timecard-detail-pane__hero-actions,
  .controller-timecard-detail-pane__hero-badges,
  .controller-timecard-detail-pane__hero-buttons {
    justify-items: start;
    justify-content: flex-start;
  }
}
</style>
