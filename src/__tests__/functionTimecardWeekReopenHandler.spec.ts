import { beforeAll, describe, expect, it, vi } from 'vitest'

let handleReopenTimecardWeekRecord: typeof import('../../functions/src/timecardWeekFunctions').handleReopenTimecardWeekRecord

beforeAll(async () => {
  vi.doMock('../../functions/src/runtime', () => ({
    auth: {},
    db: {},
    storageBucket: {
      file: vi.fn(),
    },
  }))

  const timecardWeekFunctions = await import('../../functions/src/timecardWeekFunctions')
  handleReopenTimecardWeekRecord = timecardWeekFunctions.handleReopenTimecardWeekRecord
})

const submittedWeek = {
  jobId: 'job-1',
  status: 'submitted',
  submittedAt: new Date('2026-09-08T15:00:00Z'),
  submittedByName: 'Vince Hintz',
  submittedByUserId: 'foreman-1',
  submittedEmailOperationId: 'timecardWeekSubmittedEmail:week-1',
  submittedEmailAttemptedAt: new Date('2026-09-08T15:00:00Z'),
  submittedEmailSentAt: new Date('2026-09-08T15:00:05Z'),
}

function makeReopenDeps(options: {
  role?: string
  week?: Record<string, unknown>
  exists?: boolean
} = {}) {
  const weekRef = { id: 'week-1' }
  const update = vi.fn()
  const transaction = {
    get: vi.fn(async () => ({
      exists: options.exists !== false,
      data: () => options.week ?? submittedWeek,
    })),
    update,
  }
  const deps = {
    getWeekDoc: vi.fn(async () => ({
      weekRef,
      week: options.week ?? submittedWeek,
      jobId: 'job-1',
    })),
    getAuthorizedUser: vi.fn(async () => ({
      uid: options.role === 'payroll' ? 'payroll-1' : 'admin-1',
      role: options.role ?? 'admin',
      active: true,
      displayName: options.role === 'payroll' ? 'Payroll User' : 'Admin User',
      assignedJobIds: [],
    })),
    runTransaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)),
  }

  return { deps, transaction, update, weekRef }
}

describe('timecard week reopen handler', () => {
  it('re-opens the existing week for an admin and preserves its last submission details', async () => {
    const { deps, update, weekRef } = makeReopenDeps()

    await expect(handleReopenTimecardWeekRecord({
      auth: { uid: 'admin-1' },
      data: { weekId: 'week-1' },
    }, deps as never)).resolves.toEqual({ success: true, reopened: true })

    expect(update).toHaveBeenCalledWith(weekRef, expect.objectContaining({
      status: 'draft',
      lastSubmittedAt: submittedWeek.submittedAt,
      lastSubmittedByName: 'Vince Hintz',
      lastSubmittedByUserId: 'foreman-1',
      submittedAt: null,
      submittedByName: null,
      submittedByUserId: null,
      reopenedByName: 'Admin User',
      reopenedByUserId: 'admin-1',
      updatedByUserId: 'admin-1',
    }))
  })

  it('denies Payroll and other non-admin roles before changing the week', async () => {
    const { deps, update } = makeReopenDeps({ role: 'payroll' })

    await expect(handleReopenTimecardWeekRecord({
      auth: { uid: 'payroll-1' },
      data: { weekId: 'week-1' },
    }, deps as never)).rejects.toMatchObject({
      code: 'permission-denied',
      message: 'Only admins can re-open submitted timecard weeks.',
    })

    expect(deps.runTransaction).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('does not re-open while the submission email is still in progress', async () => {
    const { deps, update } = makeReopenDeps({
      week: {
        ...submittedWeek,
        submittedEmailInProgressAt: new Date(),
        submittedEmailSentAt: null,
      },
    })

    await expect(handleReopenTimecardWeekRecord({
      auth: { uid: 'admin-1' },
      data: { weekId: 'week-1' },
    }, deps as never)).rejects.toMatchObject({
      code: 'failed-precondition',
      message: 'The submission email is still being prepared. Wait for it to finish before re-opening this week.',
    })

    expect(update).not.toHaveBeenCalled()
  })

  it('leaves an already-draft week unchanged', async () => {
    const { deps, update } = makeReopenDeps({
      week: { ...submittedWeek, status: 'draft' },
    })

    await expect(handleReopenTimecardWeekRecord({
      auth: { uid: 'admin-1' },
      data: { weekId: 'week-1' },
    }, deps as never)).resolves.toEqual({ success: true, reopened: false })

    expect(update).not.toHaveBeenCalled()
  })
})
