import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getForemanTimecardWorkspace,
  saveForemanTimecard,
  submitForemanTimecardsForWeek,
} from '@/services/ForemanTimecards'
import { httpsCallable } from 'firebase/functions'

vi.mock('@/firebase', () => ({ functions: {} }))

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(),
}))

type MockFn = ReturnType<typeof vi.fn>
const httpsCallableMock = httpsCallable as unknown as MockFn

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ForemanTimecards service', () => {
  it('loads the sanitized workspace through the callable', async () => {
    const callable = vi.fn().mockResolvedValue({
      data: {
        rosterEmployees: [
          {
            id: 'roster-1',
            jobId: 'job-1',
            employeeNumber: '9001',
            firstName: 'Mateo',
            lastName: 'Silva',
            occupation: 'Laborer',
            active: true,
          },
        ],
        timecards: [
          {
            id: 'tc-1',
            jobId: 'job-1',
            weekStartDate: '2026-04-05',
            weekEndingDate: '2026-04-11',
            status: 'draft',
            createdByUid: '',
            employeeRosterId: 'roster-1',
            employeeNumber: '9001',
            employeeName: 'Mateo Silva',
            occupation: 'Laborer',
            employeeWage: null,
            jobs: [],
            days: [],
            totals: {
              hours: [0, 0, 0, 0, 0, 0, 0],
              production: [0, 0, 0, 0, 0, 0, 0],
              hoursTotal: 0,
              productionTotal: 0,
              lineTotal: 0,
            },
            notes: '',
            archived: false,
          },
        ],
      },
    })
    httpsCallableMock.mockReturnValue(callable)

    const result = await getForemanTimecardWorkspace('job-1', '2026-04-11')

    expect(callable).toHaveBeenCalledWith({ jobId: 'job-1', weekEndingDate: '2026-04-11' })
    expect(result.rosterEmployees).toHaveLength(1)
    expect(result.timecards[0]?.employeeWage ?? null).toBeNull()
  })

  it('saves a foreman timecard through the callable', async () => {
    const callable = vi.fn().mockResolvedValue({
      data: {
        success: true,
        timecard: {
          id: 'tc-1',
          jobId: 'job-1',
          weekStartDate: '2026-04-05',
          weekEndingDate: '2026-04-11',
          status: 'draft',
          createdByUid: '',
          employeeRosterId: 'roster-1',
          employeeNumber: '9001',
          employeeName: 'Mateo Silva',
          occupation: 'Laborer',
          employeeWage: null,
          jobs: [],
          days: [],
          totals: {
            hours: [0, 0, 0, 0, 0, 0, 0],
            production: [0, 0, 0, 0, 0, 0, 0],
            hoursTotal: 0,
            productionTotal: 0,
            lineTotal: 0,
          },
          notes: 'Saved',
          archived: false,
        },
      },
    })
    httpsCallableMock.mockReturnValue(callable)

    const result = await saveForemanTimecard({
      jobId: 'job-1',
      timecardId: 'tc-1',
      jobs: [],
      notes: 'Saved',
      footerJobOrGl: '6428',
      footerAccount: '1101',
      footerOffice: 'HQ',
      footerAmount: '40',
    })

    expect(callable).toHaveBeenCalledWith({
      jobId: 'job-1',
      timecardId: 'tc-1',
      jobs: [],
      notes: 'Saved',
      footerJobOrGl: '6428',
      footerAccount: '1101',
      footerOffice: 'HQ',
      footerAmount: '40',
    })
    expect(result.notes).toBe('Saved')
  })

  it('submits a foreman week through the callable', async () => {
    const callable = vi.fn().mockResolvedValue({
      data: {
        success: true,
        count: 2,
        submittedIds: ['tc-1', 'tc-2'],
      },
    })
    httpsCallableMock.mockReturnValue(callable)

    const result = await submitForemanTimecardsForWeek('job-1', '2026-04-11')

    expect(callable).toHaveBeenCalledWith({ jobId: 'job-1', weekEndingDate: '2026-04-11' })
    expect(result).toEqual({ count: 2, submittedIds: ['tc-1', 'tc-2'] })
  })
})
