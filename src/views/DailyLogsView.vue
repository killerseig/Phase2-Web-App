<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute } from 'vue-router'
import BuilderConfirmDialog from '@/components/builder/BuilderConfirmDialog.vue'
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
import { getDailyLogRouteSelection } from '@/features/dailyLogs/routeSelection'
import { useAuthStore } from '@/stores/auth'
import { normalizeError } from '@/utils/normalizeError'

const auth = useAuthStore()
const route = useRoute()
const { job, jobId, subscribeRouteJob, stopRouteJobSubscription } = useRouteJobContext()

const { form, getTodayDateString, selectedDate, selectedLogId, updateDailyLogTextField } =
  useDailyLogFormState()
const routeSelection = getDailyLogRouteSelection(route.query)
if (routeSelection.date) selectedDate.value = routeSelection.date
if (routeSelection.logId) selectedLogId.value = routeSelection.logId
const {
  pageError: actionError,
  pageInfo: actionInfo,
  clearPageError: clearActionError,
  setPageErrorMessage: setActionError,
  setPageInfo: setActionInfo,
} = usePageMessages()

const { currentUserId, getActor } = useCurrentActor({
  getUserId: () => auth.currentUser?.uid ?? null,
  getDisplayName: () => auth.displayName,
  getEmail: () => auth.currentUser?.email ?? null,
})
const navigationConfirm = ref<InstanceType<typeof BuilderConfirmDialog>>()
const navigationBusy = ref(false)
const navigationEpoch = ref(0)
const navigationContext = () => navigationEpoch.value
function invalidateNavigation() {
  navigationEpoch.value += 1
  navigationConfirm.value?.cancel()
}
watch([currentUserId, jobId, selectedLogId, selectedDate,
  () => auth.rawRole, () => auth.hasWorkspaceAccess, () => [...auth.assignedJobIds].sort().join('|'),
  () => [...(job.value?.assignedForemanIds ?? [])].sort().join('|')], invalidateNavigation, { flush: 'sync' })
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
watch(() => selectedLog.value?.status, invalidateNavigation, { flush: 'sync' })
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

const { clonePreparedPayload } = useDailyLogPayloadPreparer({ form, siteInfo })

const {
  handleDailyLogTextFieldBlur,
  hasUnsavedDraftChanges,
  hydrateForm,
  lastSavedSignature,
  prepareDraftNavigation,
  saveDraftImmediately,
  savingDraft,
  serializePayload,
  setSavedPayloadSnapshot,
} = useDailyLogDraftSave({
  canEditSelectedLog,
  form,
  getActor,
  getContextEpoch: navigationContext,
  normalizeError,
  preparePayload: clonePreparedPayload,
  selectedLog,
  setActionError,
})
const { resetForm } = useDailyLogFormHydration({
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
const { setSelectedDateToToday } = useDailyLogDateNavigation({
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

const mutationBusy = () => creatingDraft.value || deletingDraft.value || submittingLog.value || recipientSaving.value ||
  photoAttachmentBusy.value || ptpAttachmentBusy.value || qcAttachmentBusy.value
async function prepareNavigation() {
  if (navigationBusy.value) return false
  if (mutationBusy()) {
    setActionError('Wait for the daily log change to finish before leaving.')
    return false
  }
  const context = navigationContext()
  navigationBusy.value = true
  try {
    const saved = await prepareDraftNavigation()
    if (context !== navigationContext()) return false
    if (saved && !recipientInput.value.trim()) return true
    const discard = await navigationConfirm.value?.ask({
      title: 'Keep unsaved daily log changes?',
      message: saved
        ? 'This recipient address has not been added. Discard it to continue?'
        : 'Daily log changes could not finish saving. Keep editing to retry, or discard the unsaved changes.',
      confirmLabel: 'Discard changes', cancelLabel: 'Keep editing', destructive: true,
    })
    if (!discard || context !== navigationContext()) return false
    clearRecipientInput()
    resetForm(selectedLog.value)
    return true
  } finally { navigationBusy.value = false }
}
async function selectDateSafely(date: string) {
  if (date !== selectedDate.value && await prepareNavigation()) selectedDate.value = date
}
async function selectLogSafely(logId: string) {
  if (logId !== selectedLogId.value && await prepareNavigation()) selectedLogId.value = logId
}
async function selectTodaySafely() {
  if (selectedDate.value !== getTodayDateString() && await prepareNavigation()) setSelectedDateToToday()
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (hasUnsavedDraftChanges.value || savingDraft.value || mutationBusy() || recipientInput.value.trim()) {
    event.preventDefault()
    event.returnValue = ''
  }
}
onBeforeRouteLeave(prepareNavigation)
onBeforeRouteUpdate((to, from) => to.params.jobId === from.params.jobId || prepareNavigation())
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => { invalidateNavigation(); window.removeEventListener('beforeunload', beforeUnload) })

let handledPhotoLinkKey = ''
watch(
  [selectedLog, logsLoading, () => route.hash],
  async ([currentLog, loading, routeHash]) => {
    const photoLinkKey = `${selectedLogId.value}:${routeHash}`
    if (
      handledPhotoLinkKey === photoLinkKey ||
      loading ||
      !currentLog ||
      routeHash !== '#daily-log-photos'
    ) {
      return
    }

    await nextTick()
    const photoSection = document.getElementById('daily-log-photos')
    if (!photoSection) return

    photoSection.scrollIntoView({ behavior: 'auto', block: 'start' })
    handledPhotoLinkKey = photoLinkKey
  },
  { immediate: true },
)
</script>

<template>
  <DailyLogPageShell test-id="daily-logs-page" :before-sign-out="prepareNavigation" :inert="navigationBusy">
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
        :selected-date="selectedDate"
        @update:selected-date="selectDateSafely"
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
        @select-log="selectLogSafely"
        @today="selectTodaySafely"
      />
    </template>

    <DailyLogConfirmDialogs
      :delete-draft-busy="deletingDraft"
      :delete-draft-open="deleteDraftConfirmOpen"
      @confirm-delete-draft="confirmDeleteSelectedLog"
      @update-delete-draft-open="deleteDraftConfirmOpen = $event"
    />
    <BuilderConfirmDialog ref="navigationConfirm" />
  </DailyLogPageShell>
</template>
