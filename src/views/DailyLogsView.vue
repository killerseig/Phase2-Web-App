<script setup lang="ts">
import { useCurrentActor } from '@/composables/useCurrentActor'
import { usePageMessages } from '@/composables/usePageMessages'
import { useRouteJobContext } from '@/composables/useRouteJobContext'
import { useToastMessages } from '@/composables/useToastMessages'
import DailyLogConfirmDialogs from '@/components/dailyLogs/DailyLogConfirmDialogs.vue'
import DailyLogMainColumn from '@/components/dailyLogs/DailyLogMainColumn.vue'
import DailyLogPageShell from '@/components/dailyLogs/DailyLogPageShell.vue'
import DailyLogPageHeader from '@/components/dailyLogs/DailyLogPageHeader.vue'
import DailyLogSidebar from '@/components/dailyLogs/DailyLogSidebar.vue'
import { getDailyLogLabel } from '@/features/dailyLogs/format'
import { useDailyLogActions } from '@/features/dailyLogs/useDailyLogActions'
import { useDailyLogAttachments } from '@/features/dailyLogs/useDailyLogAttachments'
import { useDailyLogDateNavigation } from '@/features/dailyLogs/useDailyLogDateNavigation'
import { useDailyLogDraftSave } from '@/features/dailyLogs/useDailyLogDraftSave'
import { useDailyLogFormState } from '@/features/dailyLogs/useDailyLogFormState'
import { useDailyLogFormHydration } from '@/features/dailyLogs/useDailyLogFormHydration'
import { useDailyLogRecipients } from '@/features/dailyLogs/useDailyLogRecipients'
import { useDailyLogRepeaters } from '@/features/dailyLogs/useDailyLogRepeaters'
import { useDailyLogPayloadPreparer } from '@/features/dailyLogs/useDailyLogPayloadPreparer'
import { useDailyLogSelectionState } from '@/features/dailyLogs/useDailyLogSelectionState'
import { useDailyLogSubscriptionLifecycle } from '@/features/dailyLogs/useDailyLogSubscriptionLifecycle'
import { useDailyLogSubscriptions } from '@/features/dailyLogs/useDailyLogSubscriptions'
import { useAuthStore } from '@/stores/auth'
import { normalizeError } from '@/utils/normalizeError'

const auth = useAuthStore()
const {
  job,
  jobId,
  subscribeRouteJob,
  stopRouteJobSubscription,
} = useRouteJobContext()

const {
  form,
  getTodayDateString,
  selectedDate,
  selectedLogId,
  updateDailyLogTextField,
} = useDailyLogFormState()
const {
  pageError: actionError,
  pageInfo: actionInfo,
  clearPageError: clearActionError,
  setPageErrorMessage: setActionError,
  setPageInfo: setActionInfo,
} = usePageMessages()

const {
  currentUserId,
  getActor,
} = useCurrentActor({
  getUserId: () => auth.currentUser?.uid ?? null,
  getDisplayName: () => auth.displayName,
  getEmail: () => auth.currentUser?.email ?? null,
})
const {
  globalNotificationRecipients,
  logs,
  logsError,
  logsLoading,
  startRecipientDefaultsSubscription,
  stopLogsSubscription,
  stopRecipientDefaultsSubscription,
  subscribeLogsForSelectedDate,
} = useDailyLogSubscriptions({
  currentUserId,
  getCanViewAllDailyLogs: () => auth.canViewAllDailyLogs,
  jobId,
  selectedDate,
  selectedLogId,
  setActionError,
  setActionInfo,
})
const {
  canCreateDailyLogForToday,
  canDeleteSelectedLog,
  canEditSelectedLog,
  createDailyLogButtonLabel,
  dailyLogsTitle,
  selectedDateIsFuture,
  selectedDateIsToday,
  selectedLog,
  siteInfo,
  visibleLogs,
} = useDailyLogSelectionState({
  currentUserId,
  form,
  getAuthDisplayName: () => auth.displayName,
  getCanViewAllDailyLogs: () => auth.canViewAllDailyLogs,
  getTodayDateString,
  job,
  logs,
  selectedDate,
  selectedLogId,
})
const {
  additionalDailyLogRecipients,
  adminDailyLogRecipients,
  clearRecipientInput,
  handleAddRecipient,
  handleRemoveRecipient,
  recipientInput,
  recipientSaving,
} = useDailyLogRecipients({
  canEditSelectedLog,
  clearActionError,
  getActor,
  globalNotificationRecipients,
  job,
  logs,
  selectedLog,
  setActionError,
  setActionInfo,
})
useToastMessages([
  { source: logsError, severity: 'error', summary: 'Daily Logs' },
  { source: actionError, severity: 'error', summary: 'Daily Logs' },
  { source: actionInfo, severity: 'success', summary: 'Daily Logs' },
])

const {
  clonePreparedPayload,
} = useDailyLogPayloadPreparer({ form, siteInfo })

const {
  handleDailyLogTextFieldBlur,
  hasUnsavedDraftChanges,
  hydrateForm,
  lastSavedSignature,
  saveDraftImmediately,
  savingDraft,
  serializePayload,
  setSavedPayloadSnapshot,
} = useDailyLogDraftSave({
  canEditSelectedLog,
  form,
  getActor,
  normalizeError,
  preparePayload: clonePreparedPayload,
  selectedLog,
  setActionError,
})
const {
  resetForm,
} = useDailyLogFormHydration({
  canEditSelectedLog,
  clearRecipientInput,
  form,
  getAuthDisplayName: () => auth.displayName,
  hydrateForm,
  job,
  lastSavedSignature,
  selectedLog,
  serializePayload,
  setSavedPayloadSnapshot,
  siteInfo,
})
const {
  setSelectedDateToToday,
} = useDailyLogDateNavigation({
  getTodayDateString,
  jobId,
  logs,
  resetForm,
  selectedDate,
  selectedLogId,
  stopLogsSubscription,
  subscribeLogsForSelectedDate,
  subscribeRouteJob,
})

const {
  handleAttachmentDescriptionUpdate,
  handleDeleteAttachment,
  photoAttachmentBusy,
  photoAttachments,
  ptpAttachmentBusy,
  ptpAttachments,
  qcAttachmentBusy,
  qcAttachments,
  uploadPhotoAttachments,
  uploadPtpAttachments,
  uploadQcAttachments,
} = useDailyLogAttachments({
  canEditSelectedLog,
  clearActionError,
  form,
  getActor,
  jobId,
  preparePayload: clonePreparedPayload,
  selectedLog,
  setActionError,
  setActionInfo,
  setSavedPayloadSnapshot,
})

const {
  addIndoorClimateReading,
  addManpowerLine,
  removeIndoorClimateReading,
  removeManpowerLine,
  updateIndoorClimateReadingField,
  updateManpowerLineField,
} = useDailyLogRepeaters({
  canEditSelectedLog,
  currentUserId,
  form,
})

const {
  confirmDeleteSelectedLog,
  creatingDraft,
  deletingDraft,
  deleteDraftConfirmOpen,
  handleCreateDraft,
  handleDeleteSelectedLog,
  handleSaveDraft,
  handleSubmit,
  submittingLog,
} = useDailyLogActions({
  canDeleteSelectedLog,
  canEditSelectedLog,
  clonePreparedPayload,
  currentUserId,
  form,
  getActor,
  hasUnsavedDraftChanges,
  job,
  jobId,
  resetForm,
  saveDraftImmediately,
  selectedDate,
  selectedDateIsFuture,
  selectedLog,
  selectedLogId,
  setActionError,
  setActionInfo,
  setSavedPayloadSnapshot,
  visibleLogs,
})

useDailyLogSubscriptionLifecycle({
  jobId,
  startRecipientDefaultsSubscription,
  stopLogsSubscription,
  stopRecipientDefaultsSubscription,
  stopRouteJobSubscription,
  subscribeLogsForSelectedDate,
  subscribeRouteJob,
})
</script>

<template>
  <DailyLogPageShell test-id="daily-logs-page">
    <template #header>
      <DailyLogPageHeader
        :can-create-daily-log="canCreateDailyLogForToday"
        :can-edit-selected-log="canEditSelectedLog"
        :create-button-label="createDailyLogButtonLabel"
        :creating-draft="creatingDraft"
        :deleting-draft="deletingDraft"
        :has-unsaved-draft-changes="hasUnsavedDraftChanges"
        :saving-draft="savingDraft"
        :selected-date="selectedDate"
        :selected-date-is-future="selectedDateIsFuture"
        :selected-date-is-today="selectedDateIsToday"
        :selected-log-label="getDailyLogLabel(selectedLog)"
        :submitting-log="submittingLog"
        :title="dailyLogsTitle"
        :visible-log-count="visibleLogs.length"
        @create-draft="handleCreateDraft()"
        @save-draft="handleSaveDraft"
      />
    </template>

    <template #main>
      <DailyLogMainColumn
        :can-edit-selected-log="canEditSelectedLog"
        :form="form"
        :photo-attachment-busy="photoAttachmentBusy"
        :photo-attachments="photoAttachments"
        :ptp-attachment-busy="ptpAttachmentBusy"
        :ptp-attachments="ptpAttachments"
        :qc-attachment-busy="qcAttachmentBusy"
        :qc-attachments="qcAttachments"
        :saving-draft="savingDraft"
        :selected-log="selectedLog"
        :site-info="siteInfo"
        :submitting-log="submittingLog"
        :upload-photo-attachments="uploadPhotoAttachments"
        :upload-ptp-attachments="uploadPtpAttachments"
        :upload-qc-attachments="uploadQcAttachments"
        @add-indoor-climate-reading="addIndoorClimateReading"
        @add-manpower-line="addManpowerLine"
        @blur-text-field="handleDailyLogTextFieldBlur"
        @remove-attachment="handleDeleteAttachment"
        @remove-indoor-climate-reading="removeIndoorClimateReading"
        @remove-manpower-line="removeManpowerLine"
        @submit="handleSubmit"
        @update-attachment-description="handleAttachmentDescriptionUpdate"
        @update-indoor-climate-field="updateIndoorClimateReadingField"
        @update-manpower-field="updateManpowerLineField"
        @update-text-field="updateDailyLogTextField"
      />
    </template>

    <template #sidebar>
      <DailyLogSidebar
        v-model:recipient-input="recipientInput"
        v-model:selected-date="selectedDate"
        :additional-recipients="additionalDailyLogRecipients"
        :admin-recipients="adminDailyLogRecipients"
        :can-delete-selected-log="canDeleteSelectedLog"
        :can-edit-selected-log="canEditSelectedLog"
        :deleting-draft="deletingDraft"
        :logs="visibleLogs"
        :logs-loading="logsLoading"
        :recipient-saving="recipientSaving"
        :selected-date-is-today="selectedDateIsToday"
        :selected-log="selectedLog"
        :selected-log-id="selectedLogId"
        @add-recipient="handleAddRecipient"
        @delete-selected-log="handleDeleteSelectedLog"
        @remove-recipient="handleRemoveRecipient"
        @select-log="selectedLogId = $event"
        @today="setSelectedDateToToday"
      />
    </template>

    <DailyLogConfirmDialogs
      :delete-draft-busy="deletingDraft"
      :delete-draft-open="deleteDraftConfirmOpen"
      @confirm-delete-draft="confirmDeleteSelectedLog"
      @update-delete-draft-open="deleteDraftConfirmOpen = $event"
    />
  </DailyLogPageShell>
</template>
