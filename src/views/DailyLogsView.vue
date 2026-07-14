<script setup lang="ts">
import { computed } from 'vue'
import { usePageMessages } from '@/composables/usePageMessages'
import { useRouteJobContext } from '@/composables/useRouteJobContext'
import { useToastMessages } from '@/composables/useToastMessages'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import DailyLogAttachmentCard from '@/components/dailyLogs/DailyLogAttachmentCard.vue'
import DailyLogAttachmentSections from '@/components/dailyLogs/DailyLogAttachmentSections.vue'
import DailyLogIndoorClimateCard from '@/components/dailyLogs/DailyLogIndoorClimateCard.vue'
import DailyLogManpowerCard from '@/components/dailyLogs/DailyLogManpowerCard.vue'
import DailyLogPageHeader from '@/components/dailyLogs/DailyLogPageHeader.vue'
import DailyLogSidebar from '@/components/dailyLogs/DailyLogSidebar.vue'
import DailyLogSiteInfoCard from '@/components/dailyLogs/DailyLogSiteInfoCard.vue'
import DailyLogTextSectionCard from '@/components/dailyLogs/DailyLogTextSectionCard.vue'
import AppButton from '@/components/common/AppButton.vue'
import AppShell from '@/layouts/AppShell.vue'
import {
  DAILY_LOG_INDOOR_CLIMATE_COLUMNS,
  DAILY_LOG_MANPOWER_COLUMNS,
  DAILY_LOG_SITE_INFO_FIELDS,
  getDailyLogTextSection,
} from '@/features/dailyLogs/schema'
import { getDailyLogLabel } from '@/features/dailyLogs/format'
import { useDailyLogActions } from '@/features/dailyLogs/useDailyLogActions'
import { useDailyLogAttachments } from '@/features/dailyLogs/useDailyLogAttachments'
import { useDailyLogDateNavigation } from '@/features/dailyLogs/useDailyLogDateNavigation'
import { useDailyLogDraftSave } from '@/features/dailyLogs/useDailyLogDraftSave'
import { useDailyLogFormState } from '@/features/dailyLogs/useDailyLogFormState'
import { useDailyLogFormHydration } from '@/features/dailyLogs/useDailyLogFormHydration'
import { useDailyLogRecipients } from '@/features/dailyLogs/useDailyLogRecipients'
import { useDailyLogRepeaters } from '@/features/dailyLogs/useDailyLogRepeaters'
import { useDailyLogSelectionState } from '@/features/dailyLogs/useDailyLogSelectionState'
import { useDailyLogSubscriptionLifecycle } from '@/features/dailyLogs/useDailyLogSubscriptionLifecycle'
import { useDailyLogSubscriptions } from '@/features/dailyLogs/useDailyLogSubscriptions'
import {
  getSavedDailyLogFieldValue,
  prepareDailyLogPayload,
  savedDailyLogFieldKeys,
  type SavedDailyLogFieldKey,
} from '@/features/dailyLogs/viewHelpers'
import { useAuthStore } from '@/stores/auth'
import type {
  DailyLogPayload,
} from '@/types/domain'
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
  setPageErrorMessage: setActionError,
  setPageInfo: setActionInfo,
} = usePageMessages()

const scheduleSection = getDailyLogTextSection('schedule-assessment')
const safetySection = getDailyLogTextSection('safety-concerns')
const deliveriesSection = getDailyLogTextSection('deliveries-materials')
const qualityControlSection = getDailyLogTextSection('quality-control')
const notesSection = getDailyLogTextSection('notes-actions')

const currentUserId = computed(() => auth.currentUser?.uid ?? null)
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
  getIsAdmin: () => auth.isAdmin,
  jobId,
  selectedDate,
  selectedLogId,
  setActionError,
  setActionInfo,
})
const {
  canCreateDailyLogForToday,
  canEditSelectedLog,
  createDailyLogButtonLabel,
  dailyLogsTitle,
  selectedDateIsToday,
  selectedLog,
  siteInfo,
  visibleLogs,
} = useDailyLogSelectionState({
  currentUserId,
  form,
  getAuthDisplayName: () => auth.displayName,
  getIsAdmin: () => auth.isAdmin,
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
  clearActionError: () => {
    actionError.value = ''
  },
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

function getSavedFieldValue(fieldKey: SavedDailyLogFieldKey) {
  return getSavedDailyLogFieldValue(selectedLog.value, fieldKey)
}

function clonePreparedPayload(payload: DailyLogPayload = form.value) {
  return prepareDailyLogPayload(payload, siteInfo.value)
}

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
  clearActionError: () => {
    actionError.value = ''
  },
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

function getActor() {
  return {
    userId: currentUserId.value,
    displayName: auth.displayName || auth.currentUser?.email || null,
  }
}

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
  selectedDateIsToday,
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
  <AppShell>
    <div class="daily-logs-page" data-testid="daily-logs-page">
      <DailyLogPageHeader
        :can-create-daily-log="canCreateDailyLogForToday"
        :can-edit-selected-log="canEditSelectedLog"
        :create-button-label="createDailyLogButtonLabel"
        :creating-draft="creatingDraft"
        :deleting-draft="deletingDraft"
        :has-unsaved-draft-changes="hasUnsavedDraftChanges"
        :saving-draft="savingDraft"
        :selected-date="selectedDate"
        :selected-date-is-today="selectedDateIsToday"
        :selected-log-label="getDailyLogLabel(selectedLog)"
        :submitting-log="submittingLog"
        :title="dailyLogsTitle"
        :visible-log-count="visibleLogs.length"
        @create-draft="handleCreateDraft()"
        @save-draft="handleSaveDraft"
      />

      <div class="daily-logs-layout">
        <section class="daily-logs-main">
          <DailyLogSiteInfoCard
            :fields="DAILY_LOG_SITE_INFO_FIELDS"
            :site-info="siteInfo"
          />

          <DailyLogManpowerCard
            :columns="DAILY_LOG_MANPOWER_COLUMNS"
            :disabled="!canEditSelectedLog"
            :lines="form.manpowerLines"
            @add="addManpowerLine"
            @remove="removeManpowerLine"
            @update-field="updateManpowerLineField"
          />

          <DailyLogTextSectionCard
            eyebrow="Schedule"
            :disabled="!canEditSelectedLog"
            :section="scheduleSection"
            :values="form"
            @update-field="updateDailyLogTextField"
            @blur-field="handleDailyLogTextFieldBlur"
          />

          <DailyLogIndoorClimateCard
            :columns="DAILY_LOG_INDOOR_CLIMATE_COLUMNS"
            :disabled="!canEditSelectedLog"
            :readings="form.indoorClimateReadings"
            @add="addIndoorClimateReading"
            @remove="removeIndoorClimateReading"
            @update-field="updateIndoorClimateReadingField"
          />

          <DailyLogTextSectionCard
            eyebrow="Safety"
            :disabled="!canEditSelectedLog"
            :section="safetySection"
            :values="form"
            @update-field="updateDailyLogTextField"
            @blur-field="handleDailyLogTextFieldBlur"
          />

          <DailyLogAttachmentSections
            :disabled="!canEditSelectedLog"
            :photo-attachments="photoAttachments"
            :photo-busy="photoAttachmentBusy"
            :ptp-attachments="ptpAttachments"
            :ptp-busy="ptpAttachmentBusy"
            :upload-photo="uploadPhotoAttachments"
            :upload-ptp="uploadPtpAttachments"
            @update-description="handleAttachmentDescriptionUpdate"
            @remove="handleDeleteAttachment"
          />

          <DailyLogTextSectionCard
            eyebrow="Deliveries"
            :disabled="!canEditSelectedLog"
            :section="deliveriesSection"
            :values="form"
            @update-field="updateDailyLogTextField"
            @blur-field="handleDailyLogTextFieldBlur"
          />

          <DailyLogTextSectionCard
            eyebrow="QC"
            :disabled="!canEditSelectedLog"
            :section="qualityControlSection"
            :values="form"
            @update-field="updateDailyLogTextField"
            @blur-field="handleDailyLogTextFieldBlur"
          />

          <DailyLogAttachmentCard
            title="QC Photos"
            choose-label="Choose QC Photos"
            description-label="Description"
            empty-label="Drag and drop QC photos here to upload."
            helper-text="Choose one or more QC photos. Photos upload right away. Click Save Draft after editing descriptions."
            :attachments="qcAttachments"
            :disabled="!canEditSelectedLog"
            :busy="qcAttachmentBusy"
            :upload-handler="uploadQcAttachments"
            @update-description="handleAttachmentDescriptionUpdate"
            @remove="handleDeleteAttachment"
          />

          <DailyLogTextSectionCard
            eyebrow="Notes"
            :disabled="!canEditSelectedLog"
            :section="notesSection"
            :values="form"
            @update-field="updateDailyLogTextField"
            @blur-field="handleDailyLogTextFieldBlur"
          />

          <div class="daily-logs-submit-row">
            <AppButton
              class="daily-logs-submit-button"
              variant="success"
              :disabled="!canEditSelectedLog || submittingLog || savingDraft"
              @click="handleSubmit"
            >
              {{ submittingLog ? 'Submitting...' : 'Submit Daily Log' }}
            </AppButton>
          </div>

          <div v-if="selectedLog" class="sr-only" aria-hidden="true">
            <div
              v-for="fieldKey in savedDailyLogFieldKeys"
              :key="fieldKey"
              :data-testid="`dailylog-saved-${fieldKey}`"
            >
              {{ getSavedFieldValue(fieldKey) }}
            </div>
          </div>
        </section>

        <DailyLogSidebar
          v-model:recipient-input="recipientInput"
          v-model:selected-date="selectedDate"
          :additional-recipients="additionalDailyLogRecipients"
          :admin-recipients="adminDailyLogRecipients"
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
      </div>
    </div>

    <ConfirmDialog
      v-model:open="deleteDraftConfirmOpen"
      title="Delete daily log draft?"
      message="Delete this daily log draft and its attachments? This cannot be undone."
      confirm-label="Delete Draft"
      destructive
      :busy="deletingDraft"
      @confirm="confirmDeleteSelectedLog"
    />
  </AppShell>
</template>

<style scoped>
.daily-logs-page {
  display: grid;
  gap: 1rem;
  min-height: 0;
}

.daily-logs-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(320px, 0.85fr);
  gap: 1rem;
  min-height: 0;
}

.daily-logs-main {
  display: grid;
  gap: 1rem;
  align-content: start;
  min-height: 0;
}

.daily-logs-submit-row {
  display: block;
}

.daily-logs-submit-button {
  width: 100%;
  min-height: 3.4rem;
  border-radius: 16px;
  font-weight: 700;
  font-size: 1rem;
}

@media (max-width: 1360px) {
  .daily-logs-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 920px) {
  .daily-logs-submit-button {
    width: 100%;
  }
}
</style>
