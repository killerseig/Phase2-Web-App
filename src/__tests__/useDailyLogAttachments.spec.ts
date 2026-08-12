import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createEmptyDailyLogPayload } from '@/features/dailyLogs/schema'
import { useDailyLogAttachments } from '@/features/dailyLogs/useDailyLogAttachments'
import {
  deleteDailyLogAttachment,
  updateDailyLogRecord,
  uploadDailyLogAttachment,
} from '@/services/dailyLogs'
import type {
  DailyLogAttachmentRecord,
  DailyLogPayload,
  DailyLogRecord,
} from '@/types/domain'

vi.mock('@/services/dailyLogs', () => ({
  deleteDailyLogAttachment: vi.fn(),
  updateDailyLogRecord: vi.fn(),
  uploadDailyLogAttachment: vi.fn(),
}))

const deleteDailyLogAttachmentMock = vi.mocked(deleteDailyLogAttachment)
const updateDailyLogRecordMock = vi.mocked(updateDailyLogRecord)
const uploadDailyLogAttachmentMock = vi.mocked(uploadDailyLogAttachment)

function makeAttachment(overrides: Partial<DailyLogAttachmentRecord> = {}): DailyLogAttachmentRecord {
  return {
    description: 'Existing attachment',
    name: 'photo.jpg',
    path: 'dailyLogs/job-1/log-1/photo.jpg',
    type: 'photo',
    url: 'https://example.test/photo.jpg',
    ...overrides,
  }
}

function makePayload(overrides: Partial<DailyLogPayload> = {}): DailyLogPayload {
  return createEmptyDailyLogPayload({
    attachments: [
      makeAttachment(),
      makeAttachment({
        description: 'Other image',
        name: 'other.jpg',
        path: 'dailyLogs/job-1/log-1/other.jpg',
        type: 'other',
      }),
      makeAttachment({
        description: 'PTP image',
        name: 'ptp.jpg',
        path: 'dailyLogs/job-1/log-1/ptp.jpg',
        type: 'ptp',
      }),
      makeAttachment({
        description: 'QC image',
        name: 'qc.jpg',
        path: 'dailyLogs/job-1/log-1/qc.jpg',
        type: 'qc',
      }),
    ],
    projectName: 'Lucky 3 Ranch',
    ...overrides,
  })
}

function makeLog(payload = makePayload()): DailyLogRecord {
  return {
    id: 'daily-log-1',
    additionalRecipients: [],
    foremanName: 'Vince Hintz',
    foremanUserId: 'user-1',
    jobCode: '5229',
    jobId: 'job-1',
    jobName: 'Lucky 3 Ranch',
    logDate: '2026-07-15',
    payload,
    sequenceNumber: 1,
    status: 'draft',
  }
}

function makeImageFile(name = 'progress.png') {
  return new File(['image data'], name, { type: 'image/png' })
}

function makeOversizedImageFile() {
  const file = makeImageFile('large.png')
  Object.defineProperty(file, 'size', {
    configurable: true,
    value: 10 * 1024 * 1024 + 1,
  })
  return file
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, reject, resolve }
}

function mountAttachments(options: {
  canEdit?: boolean
  form?: DailyLogPayload
  jobId?: string
  selectedLog?: DailyLogRecord | null
} = {}) {
  const canEdit = ref(options.canEdit ?? true)
  const form = ref(options.form ?? makePayload())
  const jobId = ref(options.jobId ?? 'job-1')
  const selectedLog = ref<DailyLogRecord | null>(
    options.selectedLog === undefined ? makeLog(form.value) : options.selectedLog,
  )
  const actionErrors: string[] = []
  const actionInfos: string[] = []
  const preparePayload = vi.fn((payload = form.value) => createEmptyDailyLogPayload(payload))
  const setSavedPayloadSnapshot = vi.fn()

  const attachments = useDailyLogAttachments({
    canEditSelectedLog: computed(() => canEdit.value),
    clearActionError: () => {
      actionErrors.push('')
    },
    form,
    getActor: () => ({ userId: 'user-1', displayName: 'Vince Hintz' }),
    jobId: computed(() => jobId.value),
    preparePayload,
    selectedLog: computed(() => selectedLog.value),
    setActionError: (message) => {
      actionErrors.push(message)
    },
    setActionInfo: (message) => {
      actionInfos.push(message)
    },
    setSavedPayloadSnapshot,
  })

  return {
    actionErrors,
    actionInfos,
    attachments,
    canEdit,
    form,
    jobId,
    preparePayload,
    selectedLog,
    setSavedPayloadSnapshot,
  }
}

describe('useDailyLogAttachments', () => {
  beforeEach(() => {
    deleteDailyLogAttachmentMock.mockReset()
    updateDailyLogRecordMock.mockReset()
    uploadDailyLogAttachmentMock.mockReset()
    deleteDailyLogAttachmentMock.mockResolvedValue(undefined)
    updateDailyLogRecordMock.mockResolvedValue(undefined)
    uploadDailyLogAttachmentMock.mockResolvedValue(makeAttachment({
      description: 'Uploaded photo',
      name: 'uploaded.png',
      path: 'dailyLogs/job-1/log-1/uploaded.png',
      type: 'photo',
      url: 'https://example.test/uploaded.png',
    }))
  })

  it('groups saved attachments by section and updates descriptions locally', () => {
    const { attachments, form } = mountAttachments()

    expect(attachments.photoAttachments.value.map((attachment) => attachment.type)).toEqual([
      'photo',
      'other',
    ])
    expect(attachments.ptpAttachments.value.map((attachment) => attachment.type)).toEqual(['ptp'])
    expect(attachments.qcAttachments.value.map((attachment) => attachment.type)).toEqual(['qc'])

    attachments.handleAttachmentDescriptionUpdate({
      description: 'Updated local description',
      path: 'dailyLogs/job-1/log-1/photo.jpg',
    })

    expect(form.value.attachments[0]?.description).toBe('Updated local description')
    expect(updateDailyLogRecordMock).not.toHaveBeenCalled()
  })

  it('uploads valid photo attachments, persists the prepared payload, and refreshes the saved snapshot', async () => {
    const uploadDeferred = createDeferred<DailyLogAttachmentRecord>()
    const uploadedAttachment = makeAttachment({
      description: 'Progress photo',
      name: 'progress.png',
      path: 'dailyLogs/job-1/log-1/progress.png',
      type: 'photo',
      url: 'https://example.test/progress.png',
    })
    uploadDailyLogAttachmentMock.mockReturnValueOnce(uploadDeferred.promise)
    const {
      attachments,
      form,
      preparePayload,
      setSavedPayloadSnapshot,
    } = mountAttachments()

    const uploadPromise = attachments.uploadPhotoAttachments([
      {
        description: ' Progress photo ',
        file: makeImageFile('progress.png'),
      },
    ])

    await Promise.resolve()
    expect(attachments.photoAttachmentBusy.value).toBe(true)

    uploadDeferred.resolve(uploadedAttachment)
    await uploadPromise

    expect(uploadDailyLogAttachmentMock).toHaveBeenCalledWith(
      expect.any(File),
      'job-1',
      'daily-log-1',
      'photo',
      'Progress photo',
    )
    expect(form.value.attachments[form.value.attachments.length - 1]).toEqual(uploadedAttachment)
    expect(preparePayload).toHaveBeenCalledWith(form.value)
    expect(updateDailyLogRecordMock).toHaveBeenCalledWith(
      'daily-log-1',
      {
        payload: expect.objectContaining({
          attachments: expect.arrayContaining([uploadedAttachment]),
        }),
      },
      { userId: 'user-1', displayName: 'Vince Hintz' },
    )
    expect(setSavedPayloadSnapshot).toHaveBeenCalledWith(form.value)
    expect(attachments.photoAttachmentBusy.value).toBe(false)
  })

  it('uses the matching busy flag for PTP and QC uploads', async () => {
    const { attachments } = mountAttachments()

    await attachments.uploadPtpAttachments([
      {
        description: 'PTP',
        file: makeImageFile('ptp.png'),
      },
    ])
    expect(uploadDailyLogAttachmentMock).toHaveBeenLastCalledWith(
      expect.any(File),
      'job-1',
      'daily-log-1',
      'ptp',
      'PTP',
    )
    expect(attachments.ptpAttachmentBusy.value).toBe(false)

    await attachments.uploadQcAttachments([
      {
        description: 'QC',
        file: makeImageFile('qc.png'),
      },
    ])
    expect(uploadDailyLogAttachmentMock).toHaveBeenLastCalledWith(
      expect.any(File),
      'job-1',
      'daily-log-1',
      'qc',
      'QC',
    )
    expect(attachments.qcAttachmentBusy.value).toBe(false)
  })

  it('skips empty uploads and blocks uploads without an editable selected draft', async () => {
    const empty = mountAttachments()

    await empty.attachments.uploadPhotoAttachments([])

    expect(uploadDailyLogAttachmentMock).not.toHaveBeenCalled()
    expect(updateDailyLogRecordMock).not.toHaveBeenCalled()

    const noSelection = mountAttachments({ selectedLog: null })
    await expect(noSelection.attachments.uploadPhotoAttachments([
      {
        description: 'Photo',
        file: makeImageFile(),
      },
    ])).rejects.toThrow('Select your current draft before uploading attachments.')

    const readOnly = mountAttachments({ canEdit: false })
    await expect(readOnly.attachments.uploadPhotoAttachments([
      {
        description: 'Photo',
        file: makeImageFile(),
      },
    ])).rejects.toThrow('Select your current draft before uploading attachments.')

    expect(uploadDailyLogAttachmentMock).not.toHaveBeenCalled()
  })

  it('rejects unsupported or oversized uploads and clears the section busy flag', async () => {
    const wrongType = mountAttachments()

    await expect(wrongType.attachments.uploadPhotoAttachments([
      {
        description: 'PDF',
        file: new File(['pdf'], 'document.pdf', { type: 'application/pdf' }),
      },
    ])).rejects.toThrow('Only image attachments are supported.')
    expect(wrongType.attachments.photoAttachmentBusy.value).toBe(false)

    const oversized = mountAttachments()

    await expect(oversized.attachments.uploadPhotoAttachments([
      {
        description: 'Large photo',
        file: makeOversizedImageFile(),
      },
    ])).rejects.toThrow('Attachments must be smaller than 10 MB.')
    expect(oversized.attachments.photoAttachmentBusy.value).toBe(false)
    expect(uploadDailyLogAttachmentMock).not.toHaveBeenCalled()
  })

  it('deletes attachments, persists the remaining payload, and updates the saved snapshot', async () => {
    const deleteDeferred = createDeferred<void>()
    deleteDailyLogAttachmentMock.mockReturnValueOnce(deleteDeferred.promise)
    const {
      actionInfos,
      attachments,
      form,
      preparePayload,
      setSavedPayloadSnapshot,
    } = mountAttachments()

    const deletePromise = attachments.handleDeleteAttachment('dailyLogs/job-1/log-1/ptp.jpg')

    await Promise.resolve()
    expect(attachments.ptpAttachmentBusy.value).toBe(true)

    deleteDeferred.resolve(undefined)
    await deletePromise

    expect(deleteDailyLogAttachmentMock).toHaveBeenCalledWith('dailyLogs/job-1/log-1/ptp.jpg')
    expect(form.value.attachments.some((attachment) => attachment.path.endsWith('/ptp.jpg'))).toBe(false)
    expect(preparePayload).toHaveBeenCalledWith(form.value)
    expect(updateDailyLogRecordMock).toHaveBeenCalledWith(
      'daily-log-1',
      {
        payload: expect.objectContaining({
          attachments: expect.not.arrayContaining([
            expect.objectContaining({
              path: 'dailyLogs/job-1/log-1/ptp.jpg',
            }),
          ]),
        }),
      },
      { userId: 'user-1', displayName: 'Vince Hintz' },
    )
    expect(setSavedPayloadSnapshot).toHaveBeenCalledWith(form.value)
    expect(actionInfos).toContain('Attachment removed.')
    expect(attachments.ptpAttachmentBusy.value).toBe(false)
  })

  it('ignores delete requests without an editable selected draft', async () => {
    const noSelection = mountAttachments({ selectedLog: null })
    await noSelection.attachments.handleDeleteAttachment('dailyLogs/job-1/log-1/photo.jpg')

    const readOnly = mountAttachments({ canEdit: false })
    await readOnly.attachments.handleDeleteAttachment('dailyLogs/job-1/log-1/photo.jpg')

    expect(deleteDailyLogAttachmentMock).not.toHaveBeenCalled()
    expect(updateDailyLogRecordMock).not.toHaveBeenCalled()
  })

  it('reports delete failures without removing the local attachment', async () => {
    deleteDailyLogAttachmentMock.mockRejectedValueOnce(new Error('Storage unavailable'))
    const { actionErrors, attachments, form } = mountAttachments()

    await attachments.handleDeleteAttachment('dailyLogs/job-1/log-1/qc.jpg')

    expect(actionErrors).toContain('')
    expect(actionErrors).toContain('Storage unavailable')
    expect(form.value.attachments.some((attachment) => attachment.path.endsWith('/qc.jpg'))).toBe(true)
    expect(updateDailyLogRecordMock).not.toHaveBeenCalled()
    expect(attachments.qcAttachmentBusy.value).toBe(false)
  })
})
