import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { useTimecardWorkflow } from '@/views/timecards/useTimecardWorkflow'
import type { TimecardModel } from '@/views/timecards/timecardUtils'

const {
  autoGenerateTimecardsMock,
  createTimecardMock,
  deleteTimecardMock,
  listTimecardsByJobAndWeekMock,
  markTimecardsSentMock,
  sendTimecardEmailMock,
  submitAllWeekTimecardsMock,
  subscribeEmailSettingsMock,
  updateTimecardMock,
  watchTimecardsByWeekMock,
} = vi.hoisted(() => ({
  autoGenerateTimecardsMock: vi.fn(),
  createTimecardMock: vi.fn(),
  deleteTimecardMock: vi.fn(),
  listTimecardsByJobAndWeekMock: vi.fn(),
  markTimecardsSentMock: vi.fn(),
  sendTimecardEmailMock: vi.fn(),
  submitAllWeekTimecardsMock: vi.fn(),
  subscribeEmailSettingsMock: vi.fn(),
  updateTimecardMock: vi.fn(),
  watchTimecardsByWeekMock: vi.fn(),
}))

vi.mock('@/services/Timecards', () => ({
  autoGenerateTimecards: autoGenerateTimecardsMock,
  createTimecard: createTimecardMock,
  deleteTimecard: deleteTimecardMock,
  listTimecardsByJobAndWeek: listTimecardsByJobAndWeekMock,
  submitAllWeekTimecards: submitAllWeekTimecardsMock,
  updateTimecard: updateTimecardMock,
  watchTimecardsByWeek: watchTimecardsByWeekMock,
}))

vi.mock('@/services/Email', () => ({
  sendTimecardEmail: sendTimecardEmailMock,
  subscribeEmailSettings: subscribeEmailSettingsMock,
}))

vi.mock('@/services/Jobs', () => ({
  markTimecardsSent: markTimecardsSentMock,
}))

function createTimecard(overrides: Partial<TimecardModel> = {}): TimecardModel {
  return {
    id: overrides.id ?? 'tc-1',
    jobId: overrides.jobId ?? 'job-1',
    weekStartDate: overrides.weekStartDate ?? '2026-03-08',
    weekEndingDate: overrides.weekEndingDate ?? '2026-03-14',
    status: overrides.status ?? 'draft',
    createdByUid: overrides.createdByUid ?? 'creator-1',
    employeeRosterId: overrides.employeeRosterId ?? 'roster-1',
    employeeNumber: overrides.employeeNumber ?? '100',
    employeeName: overrides.employeeName ?? 'Casey Stone',
    firstName: overrides.firstName ?? 'Casey',
    lastName: overrides.lastName ?? 'Stone',
    occupation: overrides.occupation ?? 'Carpenter',
    employeeWage: overrides.employeeWage ?? 30,
    subcontractedEmployee: overrides.subcontractedEmployee ?? false,
    mileage: overrides.mileage ?? 0,
    jobs: overrides.jobs ?? [],
    days: overrides.days ?? [],
    totals: overrides.totals ?? {
      hours: [0, 0, 0, 0, 0, 0, 0],
      production: [0, 0, 0, 0, 0, 0, 0],
      hoursTotal: 0,
      productionTotal: 0,
      lineTotal: 0,
    },
    notes: overrides.notes ?? '',
    archived: overrides.archived ?? false,
  }
}

function createWorkflow() {
  const selectedDate = ref('2026-03-14')
  const editingTimecardId = ref<string | null>(null)
  const expandedId = ref<string | null>(null)
  const showCreateForm = ref(false)
  const subscribeJob = vi.fn()
  const stopCurrentJobSubscription = vi.fn()
  const navigateUnauthorized = vi.fn().mockResolvedValue(undefined)
  const initAuth = vi.fn().mockResolvedValue(undefined)
  const confirm = vi.fn().mockResolvedValue(true)
  const toast = { show: vi.fn() }
  const subscriptions = {
    replace: vi.fn(),
    clear: vi.fn(),
    clearAll: vi.fn(),
  }

  const workflow = useTimecardWorkflow({
    jobId: computed(() => 'job-1'),
    selectedDate,
    weekStartDate: computed(() => '2026-03-08'),
    weekEndingDate: computed(() => '2026-03-14'),
    weekRange: computed(() => 'Mar 8 to Mar 14'),
    editingTimecardId,
    expandedId,
    showCreateForm,
    canAccessJob: computed(() => true),
    authReady: () => false,
    initAuth,
    subscribeJob,
    stopCurrentJobSubscription,
    navigateUnauthorized,
    subscriptions,
    toast,
    confirm,
    recalcTotals: vi.fn(),
  })

  return {
    workflow,
    selectedDate,
    editingTimecardId,
    expandedId,
    showCreateForm,
    subscribeJob,
    stopCurrentJobSubscription,
    navigateUnauthorized,
    initAuth,
    subscriptions,
    toast,
    confirm,
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('useTimecardWorkflow', () => {
  it('initializes subscriptions and hydrates timecards', async () => {
    watchTimecardsByWeekMock.mockImplementation((jobId, weekEnding, onSnapshot) => {
      onSnapshot([
        createTimecard({
          id: 'tc-100',
          jobId,
          weekEndingDate: weekEnding,
        }),
      ])
      return vi.fn()
    })
    subscribeEmailSettingsMock.mockImplementation((onSettings) => {
      onSettings({ timecardSubmitRecipients: ['ops@example.com'] })
      return vi.fn()
    })

    const { workflow, initAuth, subscribeJob } = createWorkflow()

    await workflow.init()

    expect(initAuth).toHaveBeenCalled()
    expect(subscribeJob).toHaveBeenCalledWith('job-1')
    expect(watchTimecardsByWeekMock).toHaveBeenCalledWith(
      'job-1',
      '2026-03-14',
      expect.any(Function),
      expect.any(Function),
    )
    expect(workflow.timecards.value).toHaveLength(1)
    expect(workflow.timecardRecipients.value).toEqual(['ops@example.com'])
  })

  it('creates a persisted timecard from a temp draft and updates ui ids', async () => {
    createTimecardMock.mockResolvedValue('tc-200')

    const {
      workflow,
      editingTimecardId,
      expandedId,
    } = createWorkflow()
    const draft = createTimecard({
      id: 'temp-1',
      employeeName: 'Jordan Smith',
      firstName: 'Jordan',
      lastName: 'Smith',
    })

    workflow.draftTimecards.value.set(draft.id, draft)
    editingTimecardId.value = draft.id
    expandedId.value = draft.id

    await workflow.saveTimecard(draft, false)

    expect(createTimecardMock).toHaveBeenCalledWith('job-1', expect.objectContaining({
      firstName: 'Jordan',
      lastName: 'Smith',
      employeeName: 'Jordan Smith',
    }))
    expect(draft.id).toBe('tc-200')
    expect(editingTimecardId.value).toBe('tc-200')
    expect(expandedId.value).toBe('tc-200')
    expect(workflow.draftTimecards.value.size).toBe(0)
    expect(workflow.timecards.value.map((timecard) => timecard.id)).toContain('tc-200')
  })

  it('submits the week and emails recipients for submitted timecards', async () => {
    submitAllWeekTimecardsMock.mockResolvedValue(1)
    markTimecardsSentMock.mockResolvedValue(undefined)
    listTimecardsByJobAndWeekMock.mockResolvedValue([
      createTimecard({
        id: 'tc-1',
        status: 'submitted',
      }),
    ])
    sendTimecardEmailMock.mockResolvedValue(undefined)

    const { workflow, confirm, toast } = createWorkflow()
    workflow.timecards.value = [
      createTimecard({
        id: 'tc-1',
        status: 'draft',
      }),
    ]
    workflow.timecardRecipients.value = ['ops@example.com']

    await workflow.submitAllTimecards()

    expect(confirm).toHaveBeenCalledWith('Submit all timecards for the week of Mar 8 to Mar 14?', expect.any(Object))
    expect(submitAllWeekTimecardsMock).toHaveBeenCalledWith('job-1', '2026-03-14')
    expect(markTimecardsSentMock).toHaveBeenCalledWith('job-1', '2026-03-14')
    expect(sendTimecardEmailMock).toHaveBeenCalledWith(
      'job-1',
      ['tc-1'],
      '2026-03-08',
      ['ops@example.com'],
    )
    expect(toast.show).toHaveBeenCalledWith('Submitted 1 timecard(s)', 'success')
  })
})
