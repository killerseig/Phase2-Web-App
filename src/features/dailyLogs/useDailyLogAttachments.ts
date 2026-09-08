import { computed, ref } from 'vue'
import {
  getDailyLogAttachmentsByType,
  toDailyLogAttachmentSection,
  type DailyLogAttachmentSectionKey,
} from '@/features/dailyLogs/viewHelpers'
import { isSupportedDailyLogPhotoFile } from '@/features/dailyLogs/photoUpload'
import {
  deleteDailyLogAttachment,
  updateDailyLogRecord,
  uploadDailyLogAttachment,
  type DailyLogActor,
} from '@/services/dailyLogs'
import type {
  DailyLogAttachmentRecord,
  DailyLogAttachmentType,
  DailyLogPayload,
  DailyLogRecord,
} from '@/types/domain'
import type { ReadonlyRef, WritableRef } from '@/types/reactivity'
import { normalizeError } from '@/utils/normalizeError'

const ATTACHMENT_PERSIST_BATCH_SIZE = 10

interface UseDailyLogAttachmentsOptions {
  canEditSelectedLog: ReadonlyRef<boolean>
  clearActionError: () => void
  form: WritableRef<DailyLogPayload>
  getActor: () => DailyLogActor
  jobId: ReadonlyRef<string>
  preparePayload: (payload?: DailyLogPayload) => DailyLogPayload
  selectedLog: ReadonlyRef<DailyLogRecord | null>
  setActionError: (message: string) => void
  setActionInfo: (message: string) => void
  setSavedPayloadSnapshot: (payload?: DailyLogPayload) => void
}

export function useDailyLogAttachments({
  canEditSelectedLog,
  clearActionError,
  form,
  getActor,
  jobId,
  preparePayload,
  selectedLog,
  setActionError,
  setActionInfo,
  setSavedPayloadSnapshot,
}: UseDailyLogAttachmentsOptions) {
  const activeAttachmentSection = ref<DailyLogAttachmentSectionKey | null>(null)
  const photoAttachments = computed(() =>
    getDailyLogAttachmentsByType(form.value.attachments, ['photo', 'other']),
  )
  const ptpAttachments = computed(() =>
    getDailyLogAttachmentsByType(form.value.attachments, ['ptp']),
  )
  const qcAttachments = computed(() => getDailyLogAttachmentsByType(form.value.attachments, ['qc']))
  const photoAttachmentBusy = computed(() => activeAttachmentSection.value === 'photo')
  const ptpAttachmentBusy = computed(() => activeAttachmentSection.value === 'ptp')
  const qcAttachmentBusy = computed(() => activeAttachmentSection.value === 'qc')

  function updateAttachmentDescription(path: string, description: string) {
    const target = form.value.attachments.find((attachment) => attachment.path === path)
    if (!target) return
    target.description = description
  }

  function formatFailedUploadMessage(
    failedFileNames: string[],
    failureType: 'photo' | 'unsupported' = 'photo',
    failureMessages: string[] = [],
  ) {
    const visibleNames = failedFileNames.slice(0, 3).join(', ')
    const remainingCount = failedFileNames.length - 3
    const nameSummary =
      remainingCount > 0 ? `${visibleNames}, and ${remainingCount} more` : visibleNames
    const photoLabel = failedFileNames.length === 1 ? 'photo' : 'photos'

    if (failureType === 'unsupported') {
      return `${failedFileNames.length} file${failedFileNames.length === 1 ? '' : 's'} could not be uploaded (${nameSummary}). Please choose photo files only.`
    }

    const combinedFailureMessage = failureMessages.join(' ').toLowerCase()
    if (
      combinedFailureMessage.includes('permission denied') ||
      combinedFailureMessage.includes('storage access is not allowed') ||
      combinedFailureMessage.includes('do not have permission')
    ) {
      return `${failedFileNames.length} ${photoLabel} could not be uploaded (${nameSummary}) because this account does not have photo access. Please contact an administrator.`
    }

    if (
      combinedFailureMessage.includes('network') ||
      combinedFailureMessage.includes('retry') ||
      combinedFailureMessage.includes('connection')
    ) {
      return `${failedFileNames.length} ${photoLabel} could not be uploaded (${nameSummary}) because the connection was interrupted. The app already retried automatically; tap the photo button to try again.`
    }

    return `${failedFileNames.length} ${photoLabel} could not be uploaded (${nameSummary}). The app resized and retried ${failedFileNames.length === 1 ? 'it' : 'them'} automatically; tap the photo button to try again.`
  }

  async function uploadAttachmentFiles(
    entries: Array<{ file: File; description: string }>,
    type: DailyLogAttachmentType,
  ) {
    if (!selectedLog.value || !canEditSelectedLog.value) {
      throw new Error('Select your current draft before uploading attachments.')
    }

    if (!entries.length) return

    const targetDailyLogId = selectedLog.value.id
    const targetJobId = jobId.value
    activeAttachmentSection.value = toDailyLogAttachmentSection(type)

    try {
      let pendingAttachments: DailyLogAttachmentRecord[] = []
      const failedFileNames: string[] = []
      const failedUploadMessages: string[] = []
      const unsupportedFileNames: string[] = []

      const persistPendingAttachments = async () => {
        if (!pendingAttachments.length) return

        const attachmentsToPersist = pendingAttachments
        const previousAttachments = form.value.attachments
        form.value.attachments = [...previousAttachments, ...attachmentsToPersist]

        try {
          await updateDailyLogRecord(
            targetDailyLogId,
            { payload: preparePayload(form.value) },
            getActor(),
          )
          setSavedPayloadSnapshot(form.value)
          pendingAttachments = []
        } catch (error) {
          form.value.attachments = previousAttachments
          await Promise.allSettled(
            attachmentsToPersist.map((attachment) =>
              deleteDailyLogAttachment(attachment.path, attachment.thumbnailPath),
            ),
          )
          throw error
        }
      }

      for (const entry of entries) {
        if (!isSupportedDailyLogPhotoFile(entry.file)) {
          unsupportedFileNames.push(entry.file.name)
          continue
        }

        let uploadedAttachment: DailyLogAttachmentRecord
        try {
          uploadedAttachment = await uploadDailyLogAttachment(
            entry.file,
            targetJobId,
            targetDailyLogId,
            type,
            entry.description.trim(),
          )
        } catch (error) {
          failedFileNames.push(entry.file.name)
          failedUploadMessages.push(normalizeError(error, 'Photo upload did not complete.'))
          continue
        }

        pendingAttachments.push(uploadedAttachment)
        if (pendingAttachments.length >= ATTACHMENT_PERSIST_BATCH_SIZE) {
          await persistPendingAttachments()
        }
      }

      await persistPendingAttachments()

      if (unsupportedFileNames.length && !failedFileNames.length) {
        throw new Error(formatFailedUploadMessage(unsupportedFileNames, 'unsupported'))
      }

      if (failedFileNames.length) {
        throw new Error(
          formatFailedUploadMessage(
            [...failedFileNames, ...unsupportedFileNames],
            'photo',
            failedUploadMessages,
          ),
        )
      }
    } catch (error) {
      throw new Error(normalizeError(error, 'Failed to upload the attachment.'))
    } finally {
      activeAttachmentSection.value = null
    }
  }

  function handleAttachmentDescriptionUpdate(payload: { path: string; description: string }) {
    updateAttachmentDescription(payload.path, payload.description)
  }

  async function uploadPhotoAttachments(entries: Array<{ file: File; description: string }>) {
    await uploadAttachmentFiles(entries, 'photo')
  }

  async function uploadPtpAttachments(entries: Array<{ file: File; description: string }>) {
    await uploadAttachmentFiles(entries, 'ptp')
  }

  async function uploadQcAttachments(entries: Array<{ file: File; description: string }>) {
    await uploadAttachmentFiles(entries, 'qc')
  }

  async function handleDeleteAttachment(path: string) {
    if (!selectedLog.value || !canEditSelectedLog.value) return

    const targetAttachment = form.value.attachments.find((attachment) => attachment.path === path)
    activeAttachmentSection.value = targetAttachment
      ? toDailyLogAttachmentSection(targetAttachment.type)
      : null
    clearActionError()

    try {
      await deleteDailyLogAttachment(path, targetAttachment?.thumbnailPath)
      form.value.attachments = form.value.attachments.filter(
        (attachment) => attachment.path !== path,
      )
      await updateDailyLogRecord(
        selectedLog.value.id,
        { payload: preparePayload(form.value) },
        getActor(),
      )
      setSavedPayloadSnapshot(form.value)
      setActionInfo('Attachment removed.')
    } catch (error) {
      setActionError(normalizeError(error, 'Failed to delete the attachment.'))
    } finally {
      activeAttachmentSection.value = null
    }
  }

  return {
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
  }
}
