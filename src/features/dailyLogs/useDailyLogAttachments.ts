import {
  computed,
  ref,
  type ComputedRef,
  type Ref,
} from 'vue'
import {
  getDailyLogAttachmentsByType,
  toDailyLogAttachmentSection,
  type DailyLogAttachmentSectionKey,
} from '@/features/dailyLogs/viewHelpers'
import {
  deleteDailyLogAttachment,
  updateDailyLogRecord,
  uploadDailyLogAttachment,
  type DailyLogActor,
} from '@/services/dailyLogs'
import type {
  DailyLogAttachmentType,
  DailyLogPayload,
  DailyLogRecord,
} from '@/types/domain'
import { normalizeError } from '@/utils/normalizeError'

interface UseDailyLogAttachmentsOptions {
  canEditSelectedLog: ComputedRef<boolean>
  clearActionError: () => void
  form: Ref<DailyLogPayload>
  getActor: () => DailyLogActor
  jobId: ComputedRef<string>
  preparePayload: (payload?: DailyLogPayload) => DailyLogPayload
  selectedLog: ComputedRef<DailyLogRecord | null>
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
  const photoAttachments = computed(() => getDailyLogAttachmentsByType(form.value.attachments, ['photo', 'other']))
  const ptpAttachments = computed(() => getDailyLogAttachmentsByType(form.value.attachments, ['ptp']))
  const qcAttachments = computed(() => getDailyLogAttachmentsByType(form.value.attachments, ['qc']))
  const photoAttachmentBusy = computed(() => activeAttachmentSection.value === 'photo')
  const ptpAttachmentBusy = computed(() => activeAttachmentSection.value === 'ptp')
  const qcAttachmentBusy = computed(() => activeAttachmentSection.value === 'qc')

  function updateAttachmentDescription(path: string, description: string) {
    const target = form.value.attachments.find((attachment) => attachment.path === path)
    if (!target) return
    target.description = description
  }

  async function uploadAttachmentFiles(
    entries: Array<{ file: File; description: string }>,
    type: DailyLogAttachmentType,
  ) {
    if (!selectedLog.value || !canEditSelectedLog.value) {
      throw new Error('Select your current draft before uploading attachments.')
    }

    if (!entries.length) return

    activeAttachmentSection.value = toDailyLogAttachmentSection(type)

    try {
      const nextAttachments = [...form.value.attachments]

      for (const entry of entries) {
        if (entry.file.size > 10 * 1024 * 1024) {
          throw new Error('Attachments must be smaller than 10 MB.')
        }

        if (!entry.file.type.startsWith('image/')) {
          throw new Error('Only image attachments are supported.')
        }

        nextAttachments.push(
          await uploadDailyLogAttachment(
            entry.file,
            jobId.value,
            selectedLog.value.id,
            type,
            entry.description.trim(),
          ),
        )
      }

      form.value.attachments = nextAttachments
      await updateDailyLogRecord(selectedLog.value.id, { payload: preparePayload(form.value) }, getActor())
      setSavedPayloadSnapshot(form.value)
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
    activeAttachmentSection.value = targetAttachment ? toDailyLogAttachmentSection(targetAttachment.type) : null
    clearActionError()

    try {
      await deleteDailyLogAttachment(path)
      form.value.attachments = form.value.attachments.filter((attachment) => attachment.path !== path)
      await updateDailyLogRecord(selectedLog.value.id, { payload: preparePayload(form.value) }, getActor())
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
