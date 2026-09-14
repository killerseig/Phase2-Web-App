import { beforeAll, describe, expect, it, vi } from 'vitest'

import {
  SUBMITTED_EMAIL_ALREADY_SENT_MESSAGE,
  SUBMITTED_EMAIL_IN_PROGRESS_MESSAGE,
} from '../../functions/src/submittedEmailOperations'

let handleSubmitTimecardWeekRecord: typeof import('../../functions/src/timecardWeekFunctions').handleSubmitTimecardWeekRecord

beforeAll(async () => {
  vi.doMock('../../functions/src/runtime', () => ({
    auth: {},
    db: {},
    storageBucket: {
      file: vi.fn(),
    },
  }))

  const timecardWeekFunctions = await import('../../functions/src/timecardWeekFunctions')
  handleSubmitTimecardWeekRecord = timecardWeekFunctions.handleSubmitTimecardWeekRecord
})

const ownerForeman = {
  uid: 'foreman-1',
  email: 'foreman@phase2co.com',
  role: 'foreman',
  active: true,
  displayName: 'Vince Hintz',
  assignedJobIds: ['job-1'],
}

function makeWeekRef() {
  return {
    update: vi.fn(async () => undefined),
  }
}

function makeSubmitDeps(overrides: Record<string, unknown> = {}) {
  const weekRef = makeWeekRef()
  const week = {
    id: 'week-1',
    jobId: 'job-1',
    jobCode: '5229',
    jobName: 'Lucky 3 Ranch',
    ownerForemanUserId: 'foreman-1',
    weekStartDate: '2026-06-14',
    weekEndDate: '2026-06-20',
    status: 'draft',
  }

  const deps = {
    getWeekDoc: vi.fn(async () => ({
      weekRef,
      week,
      jobId: 'job-1',
    })),
    getAuthorizedUser: vi.fn(async () => ownerForeman),
    getJobDetails: vi.fn(async () => ({
      assignedForemanIds: ['foreman-1'],
      name: 'Lucky 3 Ranch',
      number: '5229',
    })),
    listWeekCards: vi.fn(async () => []),
    claimSubmittedEmailOperation: vi.fn(async () => 'claimed'),
    sendSubmittedWeekEmail: vi.fn(async () => ({
      success: true,
      emailSent: true,
      emailMessage: 'Week submitted and emailed to 1 recipient.',
    })),
    buildSubmittedEmailStatusUpdate: vi.fn((result: Record<string, unknown>) => ({
      submittedEmailStatus: result,
    })),
    ...overrides,
  }

  return {
    deps,
    weekRef,
    week,
  }
}

describe('timecard week submit handler', () => {
  it('submits the week, sends the notification, and records email status', async () => {
    const { deps, weekRef } = makeSubmitDeps()

    await expect(
      handleSubmitTimecardWeekRecord({
        auth: { uid: 'foreman-1' },
        data: {
          weekId: 'week-1',
          actor: {
            userId: 'foreman-1',
            displayName: 'Vince Hintz',
          },
        },
      }, deps as never),
    ).resolves.toEqual({
      success: true,
      emailSent: true,
      emailMessage: 'Week submitted and emailed to 1 recipient.',
    })

    expect(deps.claimSubmittedEmailOperation).toHaveBeenCalledWith(
      expect.any(Object),
      [weekRef],
      'timecardWeekSubmittedEmail:week-1',
      expect.objectContaining({
        weekId: 'week-1',
        jobId: 'job-1',
        operation: 'submitTimecardWeekRecord',
        operationId: 'timecardWeekSubmittedEmail:week-1',
      }),
    )
    expect(weekRef.update).toHaveBeenNthCalledWith(1, expect.objectContaining({
      status: 'submitted',
      submittedByUserId: 'foreman-1',
      submittedByName: 'Vince Hintz',
      updatedByUserId: 'foreman-1',
    }))
    expect(deps.sendSubmittedWeekEmail).toHaveBeenCalledWith(
      'week-1',
      expect.objectContaining({
        status: 'submitted',
        submittedByUserId: 'foreman-1',
        submittedByName: 'Vince Hintz',
      }),
      'job-1',
      'Vince Hintz',
      'foreman@phase2co.com',
    )
    expect(deps.buildSubmittedEmailStatusUpdate).toHaveBeenCalledWith(
      {
        emailSent: true,
        emailMessage: 'Week submitted and emailed to 1 recipient.',
        operationId: 'timecardWeekSubmittedEmail:week-1',
      },
      expect.anything(),
    )
    expect(weekRef.update).toHaveBeenNthCalledWith(2, {
      submittedEmailStatus: {
        emailSent: true,
        emailMessage: 'Week submitted and emailed to 1 recipient.',
        operationId: 'timecardWeekSubmittedEmail:week-1',
      },
    })
  })

  it('records skipped email status when notification sending returns a non-sent result', async () => {
    const { deps, weekRef } = makeSubmitDeps({
      sendSubmittedWeekEmail: vi.fn(async () => ({
        success: true,
        emailSent: false,
        emailMessage: 'Week submitted. Notification email is disabled in system settings.',
      })),
    })

    await expect(
      handleSubmitTimecardWeekRecord({
        auth: { uid: 'foreman-1' },
        data: { weekId: 'week-1' },
      }, deps as never),
    ).resolves.toEqual({
      success: true,
      emailSent: false,
      emailMessage: 'Week submitted. Notification email is disabled in system settings.',
    })

    expect(weekRef.update).toHaveBeenNthCalledWith(2, {
      submittedEmailStatus: {
        emailSent: false,
        emailMessage: 'Week submitted. Notification email is disabled in system settings.',
        operationId: 'timecardWeekSubmittedEmail:week-1',
      },
    })
  })

  it('short-circuits already-sent and in-progress operations before submitting the week', async () => {
    const alreadySent = makeSubmitDeps({
      claimSubmittedEmailOperation: vi.fn(async () => 'already-sent'),
    })

    await expect(
      handleSubmitTimecardWeekRecord({
        auth: { uid: 'foreman-1' },
        data: { weekId: 'week-1' },
      }, alreadySent.deps as never),
    ).resolves.toEqual({
      success: true,
      emailSent: true,
      emailMessage: SUBMITTED_EMAIL_ALREADY_SENT_MESSAGE,
    })
    expect(alreadySent.weekRef.update).not.toHaveBeenCalled()
    expect(alreadySent.deps.sendSubmittedWeekEmail).not.toHaveBeenCalled()

    const inProgress = makeSubmitDeps({
      claimSubmittedEmailOperation: vi.fn(async () => 'in-progress'),
    })

    await expect(
      handleSubmitTimecardWeekRecord({
        auth: { uid: 'foreman-1' },
        data: { weekId: 'week-1' },
      }, inProgress.deps as never),
    ).resolves.toEqual({
      success: true,
      emailSent: false,
      emailMessage: SUBMITTED_EMAIL_IN_PROGRESS_MESSAGE,
    })
    expect(inProgress.weekRef.update).not.toHaveBeenCalled()
    expect(inProgress.deps.sendSubmittedWeekEmail).not.toHaveBeenCalled()
  })

  it('allows assigned foremen to submit shared job weeks owned by another foreman', async () => {
    const { deps, weekRef } = makeSubmitDeps({
      getWeekDoc: vi.fn(async () => ({
        weekRef,
        week: {
          ownerForemanUserId: 'other-foreman',
        },
        jobId: 'job-1',
      })),
    })

    await expect(
      handleSubmitTimecardWeekRecord({
        auth: { uid: 'foreman-1' },
        data: { weekId: 'week-1' },
      }, deps as never),
    ).resolves.toEqual({
      success: true,
      emailSent: true,
      emailMessage: 'Week submitted and emailed to 1 recipient.',
    })

    expect(deps.claimSubmittedEmailOperation).toHaveBeenCalled()
    expect(weekRef.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'submitted',
      updatedByUserId: 'foreman-1',
    }))
  })

  it('denies unassigned users before claiming email operations', async () => {
    const { deps, weekRef } = makeSubmitDeps({
      getAuthorizedUser: vi.fn(async () => ({
        ...ownerForeman,
        assignedJobIds: [],
      })),
      getJobDetails: vi.fn(async () => ({
        assignedForemanIds: ['other-foreman'],
        name: 'Lucky 3 Ranch',
        number: '5229',
      })),
      getWeekDoc: vi.fn(async () => ({
        weekRef,
        week: {
          ownerForemanUserId: 'other-foreman',
        },
        jobId: 'job-1',
      })),
    })

    await expect(
      handleSubmitTimecardWeekRecord({
        auth: { uid: 'foreman-1' },
        data: { weekId: 'week-1' },
      }, deps as never),
    ).rejects.toMatchObject({
      code: 'permission-denied',
      message: 'You can only change timecard weeks for jobs assigned to you.',
    })

    expect(deps.claimSubmittedEmailOperation).not.toHaveBeenCalled()
    expect(weekRef.update).not.toHaveBeenCalled()
  })

  it('rejects lines with daily hours when Job #, Area, or Acct is blank', async () => {
    const { deps, weekRef } = makeSubmitDeps({
      listWeekCards: vi.fn(async () => [{
        id: 'card-1',
        fullName: 'Rosa Toruno Castellon',
        lines: [{
          jobNumber: '7539',
          subsectionArea: '   ',
          account: '',
          offHours: 0,
          days: [{ hours: 4 }, { hours: 0 }],
        }],
      }]),
    })

    await expect(
      handleSubmitTimecardWeekRecord({
        auth: { uid: 'foreman-1' },
        data: { weekId: 'week-1' },
      }, deps as never),
    ).rejects.toMatchObject({
      code: 'failed-precondition',
      message: 'Rosa Toruno Castellon, line 1 is missing Area and Acct. Complete Job #, Area, and Acct for every line with hours before submitting.',
      details: {
        issues: [{
          cardId: 'card-1',
          employeeName: 'Rosa Toruno Castellon',
          lineNumber: 1,
          missingFields: ['Area', 'Acct'],
        }],
      },
    })

    expect(deps.claimSubmittedEmailOperation).not.toHaveBeenCalled()
    expect(deps.sendSubmittedWeekEmail).not.toHaveBeenCalled()
    expect(weekRef.update).not.toHaveBeenCalled()
  })

  it('treats OFF hours as hours and allows blank rows without hours', async () => {
    const invalidOffHours = makeSubmitDeps({
      listWeekCards: vi.fn(async () => [{
        id: 'card-off',
        employeeNumber: '20090',
        lines: [
          { jobNumber: '', subsectionArea: '', account: '', offHours: 0, days: [] },
          { jobNumber: '7539', subsectionArea: '2', account: '', offHours: 2, days: [] },
        ],
      }]),
    })

    await expect(
      handleSubmitTimecardWeekRecord({
        auth: { uid: 'foreman-1' },
        data: { weekId: 'week-1' },
      }, invalidOffHours.deps as never),
    ).rejects.toMatchObject({
      code: 'failed-precondition',
      message: 'Employee #20090, line 2 is missing Acct. Complete Job #, Area, and Acct for every line with hours before submitting.',
    })

    const complete = makeSubmitDeps({
      listWeekCards: vi.fn(async () => [{
        id: 'card-complete',
        fullName: 'Rosa Toruno Castellon',
        lines: [
          { jobNumber: '', subsectionArea: '', account: '', offHours: 0, days: [] },
          { jobNumber: '7539', subsectionArea: '2', account: '712', offHours: 1, days: [] },
        ],
      }]),
    })

    await expect(
      handleSubmitTimecardWeekRecord({
        auth: { uid: 'foreman-1' },
        data: { weekId: 'week-1' },
      }, complete.deps as never),
    ).resolves.toMatchObject({ success: true })
    expect(complete.deps.claimSubmittedEmailOperation).toHaveBeenCalledTimes(1)
  })

  it('keeps the week submitted and records a failure result when notification sending fails', async () => {
    const { deps, weekRef } = makeSubmitDeps({
      sendSubmittedWeekEmail: vi.fn(async () => {
        throw new Error('SMTP offline')
      }),
    })

    await expect(
      handleSubmitTimecardWeekRecord({
        auth: { uid: 'foreman-1' },
        data: { weekId: 'week-1' },
      }, deps as never),
    ).resolves.toEqual({
      success: true,
      emailSent: false,
      emailMessage: 'Week submitted, but the notification email failed: SMTP offline',
    })

    expect(weekRef.update).toHaveBeenNthCalledWith(1, expect.objectContaining({
      status: 'submitted',
    }))
    expect(weekRef.update).toHaveBeenNthCalledWith(2, {
      submittedEmailStatus: {
        emailSent: false,
        emailMessage: 'Week submitted, but the notification email failed: SMTP offline',
        operationId: 'timecardWeekSubmittedEmail:week-1',
      },
    })
  })
})
