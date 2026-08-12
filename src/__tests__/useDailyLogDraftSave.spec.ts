import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createEmptyDailyLogPayload,
  type DailyLogTextFieldKey,
} from '@/features/dailyLogs/schema'
import { useDailyLogDraftSave } from '@/features/dailyLogs/useDailyLogDraftSave'
import { updateDailyLogRecord } from '@/services/dailyLogs'
import type { DailyLogPayload, DailyLogRecord } from '@/types/domain'

vi.mock('@/services/dailyLogs', () => ({
  updateDailyLogRecord: vi.fn(),
}))

const updateDailyLogRecordMock = vi.mocked(updateDailyLogRecord)

function makePayload(overrides: Partial<DailyLogPayload> = {}): DailyLogPayload {
  return createEmptyDailyLogPayload({
    projectName: 'Lucky 3 Ranch',
    jobSiteNumbers: '5229',
    foremanOnSite: 'Vince Hintz',
    weeklySchedule: 'Original schedule',
    safetyConcerns: 'Original safety note',
    qcAreasInspected: 'Original inspected areas',
    qcInspection: 'Original inspected areas',
    ...overrides,
  })
}

function makeLog(payload = makePayload()): DailyLogRecord {
  return {
    id: 'daily-log-1',
    jobId: 'job-1',
    jobCode: '5229',
    jobName: 'Lucky 3 Ranch',
    logDate: '2026-06-17',
    sequenceNumber: 1,
    status: 'draft',
    foremanUserId: 'user-1',
    foremanName: 'Vince Hintz',
    additionalRecipients: [],
    payload,
  }
}

function mountDraftSave(options: {
  canEdit?: boolean
  form?: DailyLogPayload
  selectedLog?: DailyLogRecord | null
} = {}) {
  const canEdit = ref(options.canEdit ?? true)
  const form = ref(options.form ?? makePayload())
  const selectedLog = ref<DailyLogRecord | null>(
    options.selectedLog === undefined ? makeLog(form.value) : options.selectedLog,
  )
  const actionErrors: string[] = []

  const draftSave = useDailyLogDraftSave({
    canEditSelectedLog: computed(() => canEdit.value),
    form,
    getActor: () => ({ userId: 'user-1', displayName: 'Vince Hintz' }),
    normalizeError: (error, fallback) => error instanceof Error ? error.message : fallback,
    preparePayload: (payload = form.value) => createEmptyDailyLogPayload(payload),
    selectedLog: computed(() => selectedLog.value),
    setActionError: (message) => {
      actionErrors.push(message)
    },
  })

  return {
    actionErrors,
    canEdit,
    draftSave,
    form,
    selectedLog,
  }
}

describe('useDailyLogDraftSave', () => {
  beforeEach(() => {
    updateDailyLogRecordMock.mockReset()
    updateDailyLogRecordMock.mockResolvedValue(undefined)
  })

  it('tracks dirty state and saves the full prepared draft payload on explicit save', async () => {
    const { actionErrors, draftSave, form } = mountDraftSave()

    expect(draftSave.hasUnsavedDraftChanges.value).toBe(false)

    form.value.weeklySchedule = 'Typed words with spaces preserved'

    expect(draftSave.hasUnsavedDraftChanges.value).toBe(true)

    await expect(draftSave.saveDraftImmediately()).resolves.toBe(true)

    expect(updateDailyLogRecordMock).toHaveBeenCalledWith(
      'daily-log-1',
      {
        payload: expect.objectContaining({
          weeklySchedule: 'Typed words with spaces preserved',
        }),
      },
      { userId: 'user-1', displayName: 'Vince Hintz' },
    )
    expect(actionErrors).toContain('')
    expect(draftSave.savingDraft.value).toBe(false)
    expect(draftSave.hasUnsavedDraftChanges.value).toBe(false)
    expect(draftSave.lastSavedPayload.value.weeklySchedule).toBe('Typed words with spaces preserved')
  })

  it('saves only a changed text field on blur and refreshes the saved snapshot', async () => {
    const { draftSave, form } = mountDraftSave()

    form.value.safetyConcerns = 'User typed several words with spaces'

    await expect(draftSave.handleDailyLogTextFieldBlur('safetyConcerns')).resolves.toBeUndefined()

    expect(updateDailyLogRecordMock).toHaveBeenCalledTimes(1)
    expect(updateDailyLogRecordMock).toHaveBeenCalledWith(
      'daily-log-1',
      {
        payloadFields: {
          safetyConcerns: 'User typed several words with spaces',
        },
      },
      { userId: 'user-1', displayName: 'Vince Hintz' },
    )
    expect(draftSave.lastSavedPayload.value.safetyConcerns).toBe('User typed several words with spaces')
    expect(draftSave.hasUnsavedDraftChanges.value).toBe(false)
  })

  it('does not save unchanged fields, missing logs, or read-only logs', async () => {
    const unchanged = mountDraftSave()
    await unchanged.draftSave.saveDailyLogTextField('weeklySchedule')

    const missingLog = mountDraftSave({ selectedLog: null })
    missingLog.form.value.weeklySchedule = 'No selected log'
    await missingLog.draftSave.saveDailyLogTextField('weeklySchedule')

    const readOnly = mountDraftSave({ canEdit: false })
    readOnly.form.value.weeklySchedule = 'Read only draft'
    await readOnly.draftSave.saveDraftImmediately()

    expect(updateDailyLogRecordMock).not.toHaveBeenCalled()
  })

  it('keeps the legacy QC inspection snapshot aligned when QC areas are saved', async () => {
    const { draftSave, form } = mountDraftSave()
    const fieldKey: DailyLogTextFieldKey = 'qcAreasInspected'

    form.value[fieldKey] = 'Level 2 corridor and stairwell'

    await expect(draftSave.saveDailyLogTextField(fieldKey)).resolves.toBe(true)

    expect(updateDailyLogRecordMock).toHaveBeenCalledWith(
      'daily-log-1',
      {
        payloadFields: {
          qcAreasInspected: 'Level 2 corridor and stairwell',
        },
      },
      { userId: 'user-1', displayName: 'Vince Hintz' },
    )
    expect(draftSave.lastSavedPayload.value.qcAreasInspected).toBe('Level 2 corridor and stairwell')
    expect(draftSave.lastSavedPayload.value.qcInspection).toBe('Level 2 corridor and stairwell')
  })

  it('reports save errors without replacing the local draft form', async () => {
    updateDailyLogRecordMock.mockRejectedValueOnce(new Error('Network unavailable'))
    const { actionErrors, draftSave, form } = mountDraftSave()

    form.value.weeklySchedule = 'Local text should stay visible'

    await expect(draftSave.saveDailyLogTextField('weeklySchedule')).resolves.toBe(false)

    expect(actionErrors).toEqual(['', 'Network unavailable'])
    expect(draftSave.savingDraft.value).toBe(false)
    expect(form.value.weeklySchedule).toBe('Local text should stay visible')
    expect(draftSave.lastSavedPayload.value.weeklySchedule).toBe('Original schedule')
    expect(draftSave.hasUnsavedDraftChanges.value).toBe(true)
  })
})
