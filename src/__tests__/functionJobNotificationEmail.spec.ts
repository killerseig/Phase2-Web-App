import { describe, expect, it, vi } from 'vitest'

import {
  classifyEmailDeliveryError,
  EmailDeliveryError,
} from '../../functions/src/emailDeliveryErrors'
import {
  buildFieldUserAssignmentNotificationEmail,
  buildNewJobNotificationEmail,
  getJobNotificationClaimDisposition,
  getNewlyAssignedFieldUserIds,
  handleFieldUserAssignmentNotification,
  handleNewJobNotification,
  normalizeJobNotificationRecord,
  type JobNotificationHandlerDependencies,
} from '../../functions/src/jobNotificationEmail'

function makeJobData(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Lucky 3 Ranch',
    code: '5229',
    type: 'small-jobs',
    gc: 'Summit Builders',
    jobAddress: '100 Main St',
    startDate: '2026-09-01',
    finishDate: '2026-12-15',
    assignedForemanIds: ['field-1', 'field-2'],
    ...overrides,
  }
}

function makeDependencies(
  overrides: Partial<JobNotificationHandlerDependencies> = {},
): JobNotificationHandlerDependencies {
  return {
    isEmailEnabled: vi.fn(() => true),
    getGlobalRecipients: vi.fn(async () => [' Office@Example.com ', 'office@example.com']),
    getFieldUserNames: vi.fn(async (userIds) => userIds.map((id: string) => `Name for ${id}`)),
    claimEvent: vi.fn(async () => true),
    classifySendError: classifyEmailDeliveryError,
    completeEvent: vi.fn(async () => undefined),
    failEvent: vi.fn(async () => undefined),
    releaseEvent: vi.fn(async () => undefined),
    sendEmail: vi.fn(async () => undefined),
    ...overrides,
  }
}

describe('job event notification emails', () => {
  it('sends a new-job notice with job details and all initial field users', async () => {
    const deps = makeDependencies()

    await expect(
      handleNewJobNotification(
        {
          eventId: 'event-create-1',
          jobId: 'job-1',
          jobData: makeJobData(),
        },
        deps,
      ),
    ).resolves.toBe('sent')

    expect(deps.getGlobalRecipients).toHaveBeenCalledWith('newJobs')
    expect(deps.getFieldUserNames).toHaveBeenCalledWith(['field-1', 'field-2'])
    expect(deps.claimEvent).toHaveBeenCalledWith('newJobs:event-create-1', {
      notificationKey: 'newJobs',
      jobId: 'job-1',
    })
    expect(deps.sendEmail).toHaveBeenCalledWith({
      to: ['office@example.com'],
      subject: 'New Job | #5229 Lucky 3 Ranch',
      html: expect.stringContaining('Initial Assigned Field Users'),
    })

    const sentHtml = vi.mocked(deps.sendEmail).mock.calls[0]?.[0].html ?? ''
    expect(sentHtml).toContain('Name for field-1')
    expect(sentHtml).toContain('Name for field-2')
    expect(sentHtml).toContain('Summit Builders')
    expect(sentHtml).toContain('100 Main St')
    expect(deps.completeEvent).toHaveBeenCalledWith('newJobs:event-create-1')
  })

  it('emails only users newly added by a job update', async () => {
    const deps = makeDependencies()

    await expect(
      handleFieldUserAssignmentNotification(
        {
          eventId: 'event-update-1',
          jobId: 'job-1',
          beforeData: makeJobData({ assignedForemanIds: ['field-1', 'field-2'] }),
          afterData: makeJobData({ assignedForemanIds: ['field-2', 'field-3', 'field-4'] }),
        },
        deps,
      ),
    ).resolves.toBe('sent')

    expect(deps.getGlobalRecipients).toHaveBeenCalledWith('fieldUserAssignments')
    expect(deps.getFieldUserNames).toHaveBeenCalledWith(['field-3', 'field-4'])
    expect(deps.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['office@example.com'],
        subject: 'Field User Assignment | #5229 Lucky 3 Ranch',
        html: expect.stringContaining('Newly Assigned Field Users'),
      }),
    )
  })

  it('does not send for removals or ordinary job autosaves', async () => {
    const removalDeps = makeDependencies()
    await expect(
      handleFieldUserAssignmentNotification(
        {
          eventId: 'event-removal',
          jobId: 'job-1',
          beforeData: makeJobData({ assignedForemanIds: ['field-1', 'field-2'] }),
          afterData: makeJobData({ assignedForemanIds: ['field-2'] }),
        },
        removalDeps,
      ),
    ).resolves.toBe('skipped-no-new-assignments')

    const autosaveDeps = makeDependencies()
    await expect(
      handleFieldUserAssignmentNotification(
        {
          eventId: 'event-autosave',
          jobId: 'job-1',
          beforeData: makeJobData({ name: 'Old Name' }),
          afterData: makeJobData({ name: 'Updated Name' }),
        },
        autosaveDeps,
      ),
    ).resolves.toBe('skipped-no-new-assignments')

    expect(removalDeps.getGlobalRecipients).not.toHaveBeenCalled()
    expect(removalDeps.sendEmail).not.toHaveBeenCalled()
    expect(autosaveDeps.getGlobalRecipients).not.toHaveBeenCalled()
    expect(autosaveDeps.sendEmail).not.toHaveBeenCalled()
  })

  it('uses the event claim to skip duplicate delivery and releases failed sends for retry', async () => {
    const duplicateDeps = makeDependencies({
      claimEvent: vi.fn(async () => false),
    })
    await expect(
      handleNewJobNotification(
        {
          eventId: 'event-duplicate',
          jobId: 'job-1',
          jobData: makeJobData(),
        },
        duplicateDeps,
      ),
    ).resolves.toBe('skipped-duplicate')
    expect(duplicateDeps.sendEmail).not.toHaveBeenCalled()

    const sendError = new Error('Graph unavailable')
    const failureDeps = makeDependencies({
      sendEmail: vi.fn(async () => {
        throw sendError
      }),
    })
    await expect(
      handleNewJobNotification(
        {
          eventId: 'event-retry',
          jobId: 'job-1',
          jobData: makeJobData(),
        },
        failureDeps,
      ),
    ).rejects.toThrow('Graph unavailable')
    expect(failureDeps.releaseEvent).toHaveBeenCalledWith('newJobs:event-retry')
    expect(failureDeps.failEvent).not.toHaveBeenCalled()
    expect(failureDeps.completeEvent).not.toHaveBeenCalled()
  })

  it('acknowledges a successful send without releasing the claim when completion persistence fails', async () => {
    const completionError = new Error('Firestore unavailable after send')
    const deps = makeDependencies({
      completeEvent: vi.fn(async () => {
        throw completionError
      }),
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    try {
      await expect(
        handleNewJobNotification(
          {
            eventId: 'event-completion-failure',
            jobId: 'job-1',
            jobData: makeJobData(),
          },
          deps,
        ),
      ).resolves.toBe('sent')
    } finally {
      consoleError.mockRestore()
    }

    expect(deps.sendEmail).toHaveBeenCalledTimes(1)
    expect(deps.completeEvent).toHaveBeenCalledWith('newJobs:event-completion-failure')
    expect(deps.releaseEvent).not.toHaveBeenCalled()
    expect(deps.failEvent).not.toHaveBeenCalled()
  })

  it('records permanent delivery failures and acknowledges them without retrying', async () => {
    const permanentError = new EmailDeliveryError('Graph rejected the request', {
      httpStatus: 400,
    })
    const deps = makeDependencies({
      sendEmail: vi.fn(async () => {
        throw permanentError
      }),
    })

    await expect(
      handleNewJobNotification(
        {
          eventId: 'event-permanent-failure',
          jobId: 'job-1',
          jobData: makeJobData(),
        },
        deps,
      ),
    ).resolves.toBe('failed-permanent')

    expect(deps.failEvent).toHaveBeenCalledWith('newJobs:event-permanent-failure', {
      httpStatus: 400,
      retryable: false,
    })
    expect(deps.releaseEvent).not.toHaveBeenCalled()
    expect(deps.completeEvent).not.toHaveBeenCalled()
  })

  it('does not acknowledge a permanent failure until its terminal state is persisted', async () => {
    const stateError = new Error('Firestore unavailable')
    const deps = makeDependencies({
      sendEmail: vi.fn(async () => {
        throw new EmailDeliveryError('Graph rejected the request', { httpStatus: 403 })
      }),
      failEvent: vi.fn(async () => {
        throw stateError
      }),
    })

    await expect(
      handleNewJobNotification(
        {
          eventId: 'event-terminal-write-failure',
          jobId: 'job-1',
          jobData: makeJobData(),
        },
        deps,
      ),
    ).rejects.toThrow('Firestore unavailable')
    expect(deps.releaseEvent).not.toHaveBeenCalled()
  })

  it('drops malformed stored recipients before claiming or sending', async () => {
    const deps = makeDependencies({
      getGlobalRecipients: vi.fn(async () => [
        ' Valid@Example.com ',
        'missing-at.example.com',
        'missing-domain@',
        '',
      ]),
    })

    await expect(
      handleNewJobNotification(
        {
          eventId: 'event-valid-recipient',
          jobId: 'job-1',
          jobData: makeJobData(),
        },
        deps,
      ),
    ).resolves.toBe('sent')
    expect(deps.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['valid@example.com'],
      }),
    )

    const malformedOnlyDeps = makeDependencies({
      getGlobalRecipients: vi.fn(async () => ['invalid', 'missing-domain@']),
    })
    await expect(
      handleNewJobNotification(
        {
          eventId: 'event-invalid-recipients',
          jobId: 'job-1',
          jobData: makeJobData(),
        },
        malformedOnlyDeps,
      ),
    ).resolves.toBe('skipped-no-recipients')
    expect(malformedOnlyDeps.claimEvent).not.toHaveBeenCalled()
    expect(malformedOnlyDeps.sendEmail).not.toHaveBeenCalled()
  })

  it('distinguishes sent, active, and stale notification claims', () => {
    const now = Date.parse('2026-09-08T16:00:00.000Z')

    expect(getJobNotificationClaimDisposition({ status: 'sent' }, now)).toBe('sent')
    expect(getJobNotificationClaimDisposition({ status: 'failed-permanent' }, now)).toBe(
      'failed-permanent',
    )
    expect(
      getJobNotificationClaimDisposition(
        {
          status: 'processing',
          leaseExpiresAt: new Date(now + 1_000),
        },
        now,
      ),
    ).toBe('in-progress')
    expect(
      getJobNotificationClaimDisposition(
        {
          status: 'processing',
          leaseExpiresAt: new Date(now - 1),
        },
        now,
      ),
    ).toBe('claim')
    expect(
      getJobNotificationClaimDisposition(
        {
          status: 'processing',
          claimedAt: new Date(now - 9 * 60 * 1000),
        },
        now,
      ),
    ).toBe('in-progress')
    expect(
      getJobNotificationClaimDisposition(
        {
          status: 'processing',
          claimedAt: new Date(now - 11 * 60 * 1000),
        },
        now,
      ),
    ).toBe('claim')
    expect(getJobNotificationClaimDisposition({ status: 'retryable-error' }, now)).toBe('claim')
  })

  it('normalizes assignment differences and escapes job and user text in HTML', () => {
    expect(
      getNewlyAssignedFieldUserIds(
        { assignedForemanIds: [' field-1 ', 'field-2'] },
        { assignedForemanIds: ['field-2', 'field-3', 'field-3'] },
      ),
    ).toEqual(['field-3'])

    const job = normalizeJobNotificationRecord(
      'job-1',
      makeJobData({
        name: '<script>unsafe()</script>',
      }),
    )
    if (!job) throw new Error('Expected normalized job')

    const newJobHtml = buildNewJobNotificationEmail(job, ['A & B'])
    const assignmentHtml = buildFieldUserAssignmentNotificationEmail(job, ['<Field User>'])

    expect(newJobHtml).toContain('&lt;script&gt;unsafe()&lt;/script&gt;')
    expect(newJobHtml).not.toContain('<script>unsafe()</script>')
    expect(newJobHtml).toContain('A &amp; B')
    expect(assignmentHtml).toContain('&lt;Field User&gt;')
  })
})
