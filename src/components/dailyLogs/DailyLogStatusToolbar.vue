<script setup lang="ts">
import { computed } from 'vue'
import AppAlert from '@/components/common/AppAlert.vue'
import AppBadge from '@/components/common/AppBadge.vue'
import DatePickerField from '@/components/common/DatePickerField.vue'
import AppToolbarCard from '@/components/common/AppToolbarCard.vue'
import AppToolbarMeta from '@/components/common/AppToolbarMeta.vue'
import AppToolbarSummary from '@/components/common/AppToolbarSummary.vue'
import DailyLogStatusBadge from '@/components/dailyLogs/DailyLogStatusBadge.vue'
import type { DailyLogStatus } from '@/services'

const props = defineProps<{
  logDate: string
  today: string
  currentStatus: DailyLogStatus
  currentSubmittedAt?: unknown
  logsCount: number
  saving: boolean
  creatingDraft: boolean
  isDatedDraft: boolean
  isSubmittedViewOnly: boolean
  datedDraftLabel: string
  datedDraftMessageTense: string
  datePickerConfig: Record<string, unknown>
  formatSubmittedAt: (value: unknown) => string
}>()

const emit = defineEmits<{
  'change-date': [value: string]
  'start-new-draft': []
}>()

const canCreateDraftForToday = computed(
  () => props.logDate === props.today && props.currentStatus === 'submitted'
)

function handleLogDateChange(dateStr: string) {
  if (!dateStr) return
  emit('change-date', dateStr)
}
</script>

<template>
  <div class="mb-4">
    <AppToolbarCard>
      <template #header>
        <div class="app-toolbar-split app-toolbar-split--center w-100">
          <AppToolbarMeta
            eyebrow="Daily Log Controls"
            title="Date and Status"
            subtitle="Change dates, review status, and create a fresh draft when today's log is already submitted."
            title-tag="h3"
            title-class="h5 mb-0"
          />

          <div class="app-toolbar-actions app-toolbar-actions--end">
            <button
              v-if="canCreateDraftForToday"
              type="button"
              class="btn btn-outline-primary btn-sm"
              :disabled="creatingDraft"
              @click="emit('start-new-draft')"
            >
              <span v-if="creatingDraft" class="spinner-border spinner-border-sm me-2"></span>
              New draft for today
            </button>
            <span v-if="saving" class="text-muted small d-flex align-items-center gap-1">
              <i class="bi bi-hourglass-split"></i>Saving...
            </span>
          </div>
        </div>
      </template>

      <div class="app-toolbar-split">
        <div class="app-toolbar-controls">
          <div class="app-toolbar-controls__field">
            <DatePickerField
              :model-value="logDate"
              :config="datePickerConfig"
              label="Date"
              label-class="form-label small text-muted mb-1"
              wrapper-class="mb-0"
              input-aria-label="Daily log date"
              prepend-icon="bi bi-calendar-date"
              size="sm"
              show-open-button
              open-on-focus
              @change="handleLogDateChange"
            />
          </div>
        </div>

        <AppToolbarSummary wrapper-class="flex-grow-1">
          <div class="app-toolbar-summary__line">
            <span class="app-toolbar-summary__kicker">Status</span>
            <DailyLogStatusBadge :status="currentStatus" :auto-saved="currentStatus === 'draft'" />
            <AppBadge v-if="isDatedDraft" variant-class="text-bg-danger">
              <i class="bi bi-exclamation-triangle me-1"></i>{{ datedDraftLabel }}
            </AppBadge>
            <AppBadge v-if="isSubmittedViewOnly" variant-class="text-bg-info">
              <i class="bi bi-eye me-1"></i>View only
            </AppBadge>
          </div>
          <div v-if="currentStatus === 'submitted' && currentSubmittedAt" class="app-toolbar-summary__line text-muted">
            <span class="app-toolbar-summary__kicker">Submitted</span>
            <span>{{ formatSubmittedAt(currentSubmittedAt) }}</span>
          </div>
          <div class="app-toolbar-summary__line text-muted">
            <span class="app-toolbar-summary__kicker">Logs</span>
            <span>{{ logsCount }} for {{ logDate }}</span>
          </div>
        </AppToolbarSummary>
      </div>
    </AppToolbarCard>

    <AppAlert v-if="isDatedDraft" variant="warning" class="mt-3">
      <i class="bi bi-exclamation-triangle-fill me-2"></i>
      <strong>{{ datedDraftLabel }}:</strong>
      This daily log is from a {{ datedDraftMessageTense }} date and cannot be edited.
    </AppAlert>
  </div>
</template>
