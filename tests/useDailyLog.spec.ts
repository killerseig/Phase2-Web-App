import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { useDailyLog } from '@/composables/useDailyLog'

const mockCleanupDeletedLogs = vi.fn()
const mockCreateDailyLog = vi.fn()
const mockGetMyDailyLogByDate = vi.fn()
const mockSubscribeDailyLogsForDate = vi.fn()
const mockSubscribeDailyLogRecipients = vi.fn()
const mockSubscribeToDailyLog = vi.fn()
const mockSubscribeEmailSettings = vi.fn()
const mockJobsSubscribeJob = vi.fn()
const mockJobsStopCurrentJobSubscription = vi.fn()

const mockSubscriptions = {
  replace: vi.fn(),
  clear: vi.fn(),
  clearAll: vi.fn(),
}

vi.mock('@/services', () => ({
  cleanupDeletedLogs: (...args: unknown[]) => mockCleanupDeletedLogs(...args),
  createDailyLog: (...args: unknown[]) => mockCreateDailyLog(...args),
  deleteAttachmentFile: vi.fn(),
  deleteDailyLog: vi.fn(),
  formatTimestamp: vi.fn(),
  getDailyLogById: vi.fn(),
  getMyDailyLogByDate: (...args: unknown[]) => mockGetMyDailyLogByDate(...args),
  sendDailyLogEmail: vi.fn(),
  submitDailyLog: vi.fn(),
  subscribeDailyLogRecipients: (...args: unknown[]) => mockSubscribeDailyLogRecipients(...args),
  subscribeDailyLogsForDate: (...args: unknown[]) => mockSubscribeDailyLogsForDate(...args),
  subscribeEmailSettings: (...args: unknown[]) => mockSubscribeEmailSettings(...args),
  subscribeToDailyLog: (...args: unknown[]) => mockSubscribeToDailyLog(...args),
  toMillis: (value: { toMillis?: () => number } | null | undefined) => value?.toMillis?.() ?? 0,
  updateDailyLog: vi.fn(),
  updateDailyLogRecipients: vi.fn(),
  uploadAttachment: vi.fn(),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: { uid: 'user-1' },
  }),
}))

vi.mock('@/stores/jobs', () => ({
  useJobsStore: () => ({
    currentJob: { name: 'Job Alpha', code: '111A1' },
    subscribeJob: mockJobsSubscribeJob,
    stopCurrentJobSubscription: mockJobsStopCurrentJobSubscription,
  }),
}))

vi.mock('@/composables/useConfirmDialog', () => ({
  useConfirmDialog: () => ({
    confirm: vi.fn().mockResolvedValue(true),
  }),
}))

vi.mock('@/composables/useSubscriptionRegistry', () => ({
  useSubscriptionRegistry: () => mockSubscriptions,
}))

describe('useDailyLog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-16T12:00:00Z'))

    mockCleanupDeletedLogs.mockResolvedValue(undefined)
    mockCreateDailyLog.mockResolvedValue('new-draft')
    mockGetMyDailyLogByDate.mockResolvedValue(null)
    mockSubscribeDailyLogsForDate.mockImplementation((_jobId, _date, onData) => {
      onData([])
      return vi.fn()
    })
    mockSubscribeDailyLogRecipients.mockImplementation((_jobId, onData) => {
      onData([])
      return vi.fn()
    })
    mockSubscribeEmailSettings.mockImplementation((onData) => {
      onData({ dailyLogSubmitRecipients: [] })
      return vi.fn()
    })
    mockSubscribeToDailyLog.mockImplementation(() => vi.fn())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reuses the existing draft for today instead of creating a duplicate', async () => {
    const existingDraft = {
      id: 'draft-1',
      jobId: 'job-1',
      uid: 'user-1',
      status: 'draft',
      logDate: '2026-03-16',
      jobSiteNumbers: '',
      foremanOnSite: '',
      siteForemanAssistant: '',
      projectName: 'Job Alpha',
      manpower: '',
      weeklySchedule: '',
      manpowerAssessment: '',
      indoorClimateReadings: [],
      manpowerLines: [],
      safetyConcerns: '',
      ahaReviewed: '',
      scheduleConcerns: '',
      budgetConcerns: '',
      deliveriesReceived: '',
      deliveriesNeeded: '',
      newWorkAuthorizations: '',
      qcInspection: '',
      qcAssignedTo: '',
      qcAreasInspected: '',
      qcIssuesIdentified: '',
      qcIssuesResolved: '',
      notesCorrespondence: '',
      actionItems: '',
      attachments: [],
      createdAt: { toMillis: () => 1 },
      updatedAt: { toMillis: () => 1 },
      submittedAt: null,
    }

    mockGetMyDailyLogByDate.mockResolvedValue(existingDraft)

    let state: ReturnType<typeof useDailyLog> | null = null
    const Harness = defineComponent({
      setup() {
        const jobId = ref('job-1')
        state = useDailyLog(jobId, { toastRef: { value: null } })
        return {}
      },
      template: '<div />',
    })

    mount(Harness)
    await flushPromises()

    expect(mockGetMyDailyLogByDate).toHaveBeenCalledWith('job-1', '2026-03-16')
    expect(mockCreateDailyLog).not.toHaveBeenCalled()
    expect(state).not.toBeNull()
    const dailyLogState = state!
    expect(dailyLogState.currentId.value).toBe('draft-1')
    expect(dailyLogState.currentStatus.value).toBe('draft')
  })
})
