<script setup lang="ts">
import { computed } from 'vue'
import AppBadge from '@/components/common/AppBadge.vue'
import AppPageHeader from '@/components/layout/AppPageHeader.vue'
import DailyLogMainColumn from '@/components/dailyLogs/DailyLogMainColumn.vue'
import DailyLogSidebarColumn from '@/components/dailyLogs/DailyLogSidebarColumn.vue'
import DailyLogStatusBadge from '@/components/dailyLogs/DailyLogStatusBadge.vue'
import DailyLogStatusToolbar from '@/components/dailyLogs/DailyLogStatusToolbar.vue'
import { useDailyLog } from '@/composables/useDailyLog'
import { formatDateTime } from '@/utils/datetime'

const props = defineProps<{ jobId?: string }>()

const jobId = computed(() => String(props.jobId ?? ''))

const {
  auth,
  jobName,
  jobCode,
  today,
  saving,
  uploading,
  err,
  logDate,
  datePickerConfig,
  logsForSelectedDate,
  currentId,
  currentStatus,
  currentSubmittedAt,
  jobEmailRecipients,
  globalDailyLogRecipients,
  savingRecipients,
  canEditDraft,
  photoFileName,
  ptpFileName,
  qcFileName,
  form,
  creatingDraft,
  formatTimestamp,
  loadLogById,
  loadForDate,
  startNewDraftForToday,
  submit,
  deleteLogById,
  handleFileChange,
  addEmailRecipient,
  removeEmailRecipient,
  sendEmail,
  addManpowerLine,
  updateManpowerField,
  updateManpowerCount,
  removeManpowerLine,
  addIndoorClimateReading,
  updateIndoorClimateField,
  removeIndoorClimateReading,
  canDeleteManpowerLine,
  isAdminAddedLine,
  deleteAttachment,
  autoSave,
} = useDailyLog(jobId)

const hasEmailRecipients = computed(() =>
  Array.from(new Set([...globalDailyLogRecipients.value, ...jobEmailRecipients.value].filter(Boolean))).length > 0
)
const hasSubmittedLogToday = computed(() =>
  logsForSelectedDate.value.some((record) => record.logDate === today.value && record.status === 'submitted')
)
const isDatedDraft = computed(() => logDate.value !== today.value && currentStatus.value === 'draft')
const isSubmittedViewOnly = computed(() => logDate.value !== today.value && currentStatus.value === 'submitted')
const datedDraftLabel = computed(() => `${logDate.value > today.value ? 'Future' : 'Past'} draft`)
const datedDraftMessageTense = computed(() => (logDate.value > today.value ? 'future' : 'previous'))

type DailyLogEditableField =
  | 'jobSiteNumbers'
  | 'foremanOnSite'
  | 'siteForemanAssistant'
  | 'weeklySchedule'
  | 'manpowerAssessment'
  | 'safetyConcerns'
  | 'ahaReviewed'
  | 'scheduleConcerns'
  | 'budgetConcerns'
  | 'deliveriesReceived'
  | 'deliveriesNeeded'
  | 'newWorkAuthorizations'
  | 'qcAssignedTo'
  | 'qcAreasInspected'
  | 'qcIssuesIdentified'
  | 'qcIssuesResolved'
  | 'notesCorrespondence'
  | 'actionItems'

function handleLogDateChange(dateStr: string) {
  if (!dateStr) return
  void loadForDate(dateStr)
}

function updateEditableField({ key, value }: { key: DailyLogEditableField; value: string }) {
  ;(form.value as Record<DailyLogEditableField, string>)[key] = value
  autoSave()
}

function formatSubmittedAt(value: unknown): string {
  return formatDateTime(value)
}
</script>

<template>
  <div class="app-page">
    <!-- Header -->
    <AppPageHeader eyebrow="Job Daily Log" :title="jobName">
      <template #meta>
        <span v-if="jobCode">Job Number: {{ jobCode }}</span>
      </template>
      <template #badges>
        <AppBadge :label="`${logsForSelectedDate.length} for ${logDate}`" variant-class="text-bg-secondary" class="app-page-chip" />
        <DailyLogStatusBadge :status="currentStatus" class="app-page-chip" />
      </template>
    </AppPageHeader>

    <DailyLogStatusToolbar
      :log-date="logDate"
      :today="today"
      :current-status="currentStatus"
      :current-submitted-at="currentSubmittedAt"
      :logs-count="logsForSelectedDate.length"
      :saving="saving"
      :creating-draft="creatingDraft"
      :is-dated-draft="isDatedDraft"
      :is-submitted-view-only="isSubmittedViewOnly"
      :dated-draft-label="datedDraftLabel"
      :dated-draft-message-tense="datedDraftMessageTense"
      :date-picker-config="datePickerConfig"
      :format-submitted-at="formatSubmittedAt"
      @change-date="handleLogDateChange"
      @start-new-draft="startNewDraftForToday"
    />

    <div class="row g-4">
      <DailyLogMainColumn
        class="col-lg-8"
        :job-name="jobName"
        :form="form"
        :can-edit="canEditDraft"
        :uploading="uploading"
        :photo-file-name="photoFileName"
        :ptp-file-name="ptpFileName"
        :qc-file-name="qcFileName"
        :current-status="currentStatus"
        :saving="saving"
        :has-email-recipients="hasEmailRecipients"
        :has-submitted-today="hasSubmittedLogToday"
        :error="err"
        :can-delete-manpower-line="canDeleteManpowerLine"
        :is-admin-added-line="isAdminAddedLine"
        @update-field="updateEditableField"
        @add-manpower-line="addManpowerLine"
        @update-manpower-field="updateManpowerField"
        @update-manpower-count="updateManpowerCount"
        @remove-manpower-line="removeManpowerLine"
        @add-indoor-climate-reading="addIndoorClimateReading"
        @update-indoor-climate-field="updateIndoorClimateField"
        @remove-indoor-climate-reading="removeIndoorClimateReading"
        @upload="({ event, type }) => handleFileChange(event, type)"
        @delete-attachment="deleteAttachment"
        @submit="submit"
        @send-email="sendEmail"
      />

      <DailyLogSidebarColumn
        class="col-lg-4"
        :log-date="logDate"
        :logs="logsForSelectedDate"
        :current-user-id="auth.user?.uid || null"
        :format-timestamp="formatTimestamp"
        :selected-id="currentId"
        :saving="saving"
        :recipients="jobEmailRecipients"
        :global-recipients="globalDailyLogRecipients"
        :saving-recipients="savingRecipients"
        @select="loadLogById"
        @delete="deleteLogById"
        @add-recipient="addEmailRecipient"
        @remove-recipient="removeEmailRecipient"
      />
    </div>
  </div>
</template>
