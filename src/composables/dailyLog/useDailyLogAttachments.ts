import { ref, type Ref } from 'vue'
import {
  deleteAttachmentFile,
  updateDailyLog,
  uploadAttachment as uploadPhotoToStorage,
  type DailyLogDraftInput,
} from '@/services'
import { normalizeError } from '@/services/serviceUtils'
import { logError } from '@/utils/logger'
import type { ToastNotifier } from '@/composables/useToast'

type AttachmentUploadType = 'photo' | 'ptp' | 'qc' | 'other'
type FilePickerType = Exclude<AttachmentUploadType, 'other'>
type ValueRef<T> = Readonly<{ value: T }>

type UseDailyLogAttachmentsOptions = {
  jobId: ValueRef<string>
  currentId: ValueRef<string | null>
  canEditDraft: ValueRef<boolean>
  form: Ref<DailyLogDraftInput>
  toast: ToastNotifier
  setError: (message: string) => void
}

const DEFAULT_FILE_NAME = 'No file selected'

export function useDailyLogAttachments({
  jobId,
  currentId,
  canEditDraft,
  form,
  toast,
  setError,
}: UseDailyLogAttachmentsOptions) {
  const uploading = ref(false)
  const photoFileName = ref(DEFAULT_FILE_NAME)
  const ptpFileName = ref(DEFAULT_FILE_NAME)
  const qcFileName = ref(DEFAULT_FILE_NAME)

  const setFileName = (type: FilePickerType, label = DEFAULT_FILE_NAME) => {
    if (type === 'photo') photoFileName.value = label
    else if (type === 'ptp') ptpFileName.value = label
    else qcFileName.value = label
  }

  const resetFileNames = () => {
    photoFileName.value = DEFAULT_FILE_NAME
    ptpFileName.value = DEFAULT_FILE_NAME
    qcFileName.value = DEFAULT_FILE_NAME
  }

  const uploadLabel = (type: AttachmentUploadType) => {
    if (type === 'ptp') return 'PTP Photo'
    if (type === 'qc') return 'QC Photo'
    return 'Photo'
  }

  const uploadAttachment = async (files: File[], type: AttachmentUploadType) => {
    if (!files.length || !currentId.value) {
      if (!files.length) toast.show('Please select a file', 'error')
      if (!currentId.value) toast.show('Please save the daily log first', 'error')
      return
    }
    if (!canEditDraft.value) {
      toast.show('Attachments can only be changed on your active draft for today', 'warning')
      return
    }

    const maxSize = 10 * 1024 * 1024

    uploading.value = true
    try {
      for (const file of files) {
        if (file.size > maxSize) {
          toast.show('File size must be less than 10MB', 'error')
          continue
        }
        if (!file.type.startsWith('image/')) {
          toast.show('Please select an image file', 'error')
          continue
        }

        const attachment = await uploadPhotoToStorage(file, jobId.value, currentId.value, type)
        if (!form.value.attachments) form.value.attachments = []
        form.value.attachments.push(attachment)
        await updateDailyLog(jobId.value, currentId.value, { ...form.value })
        toast.show(`${uploadLabel(type)} uploaded: ${file.name}`, 'success')
      }
    } catch (error) {
      logError('DailyLogs', 'Upload attachment failed', error)
      const errorMsg = normalizeError(error, 'Failed to upload file')
      setError(errorMsg)
      toast.show(`Upload failed: ${errorMsg}`, 'error')
    } finally {
      uploading.value = false
    }
  }

  const handleFileChange = async (event: Event, type: FilePickerType) => {
    const input = event.target as HTMLInputElement
    const files = Array.from(input.files || [])

    if (!files.length) {
      setFileName(type)
      return
    }

    const firstFile = files[0]
    const label = files.length === 1 && firstFile ? firstFile.name : `${files.length} files selected`
    setFileName(type, label)

    await uploadAttachment(files, type)
    input.value = ''
  }

  const deleteAttachment = async (path: string) => {
    if (!currentId.value || !canEditDraft.value) {
      toast.show('Attachments can only be changed on your active draft for today', 'warning')
      return
    }

    uploading.value = true
    try {
      await deleteAttachmentFile(path)
      form.value.attachments = form.value.attachments?.filter((attachment) => attachment.path !== path) || []
      await updateDailyLog(jobId.value, currentId.value, { ...form.value })
      toast.show('Photo removed', 'success')
    } catch (error) {
      setError(normalizeError(error, 'Failed to delete photo'))
      toast.show('Failed to delete photo', 'error')
    } finally {
      uploading.value = false
    }
  }

  return {
    uploading,
    photoFileName,
    ptpFileName,
    qcFileName,
    resetFileNames,
    handleFileChange,
    deleteAttachment,
  }
}
