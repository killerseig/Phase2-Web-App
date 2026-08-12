import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createEmptyDailyLogPayload } from '@/features/dailyLogs/schema'
import { useDailyLogRecipients } from '@/features/dailyLogs/useDailyLogRecipients'
import { updateDailyLogRecord } from '@/services/dailyLogs'
import type {
  DailyLogRecord,
  JobRecord,
  NotificationRecipients,
} from '@/types/domain'

vi.mock('@/services/dailyLogs', () => ({
  updateDailyLogRecord: vi.fn(),
}))

const updateDailyLogRecordMock = vi.mocked(updateDailyLogRecord)

function makeNotificationRecipients(overrides: Partial<NotificationRecipients> = {}): NotificationRecipients {
  return {
    dailyLogs: [],
    shopOrders: [],
    timecards: [],
    ...overrides,
  }
}

function makeJob(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    id: 'job-1',
    active: true,
    assignedForemanIds: [],
    code: '5229',
    gc: 'Phase 2',
    name: 'Lucky 3 Ranch',
    type: 'general',
    ...overrides,
  }
}

function makeLog(overrides: Partial<DailyLogRecord> = {}): DailyLogRecord {
  return {
    id: 'daily-log-1',
    additionalRecipients: [],
    foremanName: 'Vince Hintz',
    foremanUserId: 'user-1',
    jobCode: '5229',
    jobId: 'job-1',
    jobName: 'Lucky 3 Ranch',
    logDate: '2026-07-15',
    payload: createEmptyDailyLogPayload(),
    sequenceNumber: 1,
    status: 'draft',
    ...overrides,
  }
}

function mountRecipients(options: {
  canEdit?: boolean
  globalRecipients?: NotificationRecipients
  job?: JobRecord | null
  logs?: DailyLogRecord[]
  selectedLogId?: string | null
} = {}) {
  const canEdit = ref(options.canEdit ?? true)
  const globalNotificationRecipients = ref(
    options.globalRecipients ?? makeNotificationRecipients(),
  )
  const job = ref<JobRecord | null>(options.job === undefined ? makeJob() : options.job)
  const logs = ref<DailyLogRecord[]>(options.logs ?? [makeLog()])
  const selectedLogId = ref<string | null>(
    options.selectedLogId === undefined ? logs.value[0]?.id ?? null : options.selectedLogId,
  )
  const actionErrors: string[] = []
  const actionInfos: string[] = []

  const recipients = useDailyLogRecipients({
    canEditSelectedLog: computed(() => canEdit.value),
    clearActionError: () => {
      actionErrors.push('')
    },
    getActor: () => ({ userId: 'user-1', displayName: 'Vince Hintz' }),
    globalNotificationRecipients,
    job: computed(() => job.value),
    logs,
    selectedLog: computed(() => (
      logs.value.find((log) => log.id === selectedLogId.value) ?? null
    )),
    setActionError: (message) => {
      actionErrors.push(message)
    },
    setActionInfo: (message) => {
      actionInfos.push(message)
    },
  })

  return {
    actionErrors,
    actionInfos,
    canEdit,
    globalNotificationRecipients,
    job,
    logs,
    recipients,
    selectedLogId,
  }
}

describe('useDailyLogRecipients', () => {
  beforeEach(() => {
    updateDailyLogRecordMock.mockReset()
    updateDailyLogRecordMock.mockResolvedValue(undefined)
  })

  it('merges normalized global, job, and legacy daily-log recipients as admin defaults', () => {
    const { recipients } = mountRecipients({
      globalRecipients: makeNotificationRecipients({
        dailyLogs: ['Office@Example.com ', 'shared@example.com'],
      }),
      job: makeJob({
        adminDailyLogRecipients: [' Legacy@Example.com '],
        dailyLogRecipients: ['legacy-job@example.com'],
        notificationRecipients: makeNotificationRecipients({
          dailyLogs: ['PM@Example.com', 'shared@example.com'],
        }),
      }),
      logs: [
        makeLog({
          additionalRecipients: [
            'pm@example.com',
            'foreman@example.com',
            'legacy@example.com',
          ],
        }),
      ],
    })

    expect(recipients.adminDailyLogRecipients.value).toEqual([
      'office@example.com',
      'shared@example.com',
      'pm@example.com',
      'legacy@example.com',
    ])
    expect(recipients.additionalDailyLogRecipients.value).toEqual([
      'foreman@example.com',
    ])
  })

  it('validates empty, invalid, and duplicate recipient add attempts before persistence', async () => {
    const { actionErrors, actionInfos, recipients } = mountRecipients({
      globalRecipients: makeNotificationRecipients({
        dailyLogs: ['admin@example.com'],
      }),
      logs: [
        makeLog({
          additionalRecipients: ['extra@example.com'],
        }),
      ],
    })

    await recipients.handleAddRecipient()
    expect(actionErrors).toContain('Enter an email address before adding a recipient.')

    recipients.recipientInput.value = 'not-an-email'
    await recipients.handleAddRecipient()
    expect(actionErrors).toContain('Enter a valid email address.')

    recipients.recipientInput.value = 'ADMIN@example.com'
    await recipients.handleAddRecipient()
    expect(actionInfos).toContain('That recipient is already on the list.')
    expect(recipients.recipientInput.value).toBe('')

    recipients.recipientInput.value = ' extra@example.com '
    await recipients.handleAddRecipient()
    expect(actionInfos).toContain('That recipient is already on the list.')
    expect(updateDailyLogRecordMock).not.toHaveBeenCalled()
  })

  it('adds a normalized recipient, persists it, and updates the local selected log row', async () => {
    const { actionInfos, logs, recipients } = mountRecipients({
      logs: [
        makeLog({
          additionalRecipients: ['existing@example.com'],
        }),
      ],
    })

    recipients.recipientInput.value = ' NEW.Person@Example.com '

    await recipients.handleAddRecipient()

    expect(updateDailyLogRecordMock).toHaveBeenCalledWith(
      'daily-log-1',
      {
        additionalRecipients: ['existing@example.com', 'new.person@example.com'],
      },
      { userId: 'user-1', displayName: 'Vince Hintz' },
    )
    expect(logs.value[0]?.additionalRecipients).toEqual([
      'existing@example.com',
      'new.person@example.com',
    ])
    expect(recipients.recipientInput.value).toBe('')
    expect(actionInfos).toContain('Recipient added.')
    expect(recipients.recipientSaving.value).toBe(false)
  })

  it('removes recipients with normalized comparisons and keeps admin defaults untouched', async () => {
    const { actionInfos, logs, recipients } = mountRecipients({
      globalRecipients: makeNotificationRecipients({
        dailyLogs: ['admin@example.com'],
      }),
      logs: [
        makeLog({
          additionalRecipients: [
            'admin@example.com',
            'extra@example.com',
            'second@example.com',
          ],
        }),
      ],
    })

    await recipients.handleRemoveRecipient(' EXTRA@example.com ')

    expect(updateDailyLogRecordMock).toHaveBeenCalledWith(
      'daily-log-1',
      {
        additionalRecipients: ['second@example.com'],
      },
      { userId: 'user-1', displayName: 'Vince Hintz' },
    )
    expect(logs.value[0]?.additionalRecipients).toEqual(['second@example.com'])
    expect(actionInfos).toContain('Recipient removed.')
    expect(recipients.recipientSaving.value).toBe(false)
  })

  it('does not persist recipient changes when no editable daily log is selected', async () => {
    const readOnly = mountRecipients({ canEdit: false })
    readOnly.recipients.recipientInput.value = 'new@example.com'

    await readOnly.recipients.handleAddRecipient()
    await readOnly.recipients.handleRemoveRecipient('extra@example.com')

    const noSelection = mountRecipients({ selectedLogId: null })
    noSelection.recipients.recipientInput.value = 'new@example.com'

    await noSelection.recipients.handleAddRecipient()
    await noSelection.recipients.handleRemoveRecipient('extra@example.com')

    expect(updateDailyLogRecordMock).not.toHaveBeenCalled()
  })

  it('reports add and remove persistence failures while resetting the busy flag', async () => {
    updateDailyLogRecordMock.mockRejectedValueOnce(new Error('Add denied'))
    const addFailure = mountRecipients()
    addFailure.recipients.recipientInput.value = 'new@example.com'

    await addFailure.recipients.handleAddRecipient()

    expect(addFailure.actionErrors).toContain('Add denied')
    expect(addFailure.recipients.recipientSaving.value).toBe(false)

    updateDailyLogRecordMock.mockRejectedValueOnce(new Error('Remove denied'))
    const removeFailure = mountRecipients({
      logs: [
        makeLog({
          additionalRecipients: ['extra@example.com'],
        }),
      ],
    })

    await removeFailure.recipients.handleRemoveRecipient('extra@example.com')

    expect(removeFailure.actionErrors).toContain('Remove denied')
    expect(removeFailure.recipients.recipientSaving.value).toBe(false)
  })
})
