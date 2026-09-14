import { beforeAll, describe, expect, it, vi } from 'vitest'

import {
  SUBMITTED_EMAIL_ALREADY_SENT_MESSAGE,
  SUBMITTED_EMAIL_IN_PROGRESS_MESSAGE,
} from '../../functions/src/submittedEmailOperations'
import { ERROR_MESSAGES } from '../../functions/src/constants'

let handleSendDailyLogEmail: typeof import('../../functions/src/operationsFunctions').handleSendDailyLogEmail
let handleSendShopOrderEmail: typeof import('../../functions/src/operationsFunctions').handleSendShopOrderEmail

beforeAll(async () => {
  vi.doMock('../../functions/src/runtime', () => ({
    auth: {},
    db: {},
    storageBucket: {
      file: vi.fn(),
    },
  }))

  const operationsFunctions = await import('../../functions/src/operationsFunctions')
  handleSendDailyLogEmail = operationsFunctions.handleSendDailyLogEmail
  handleSendShopOrderEmail = operationsFunctions.handleSendShopOrderEmail
})

const job = {
  id: 'job-1',
  name: 'Lucky 3 Ranch',
  number: '5229',
}

const adminUser = {
  uid: 'admin-1',
  email: 'admin@phase2co.com',
  firstName: 'Admin',
  lastName: 'User',
  role: 'admin',
  active: true,
  assignedJobIds: [],
}

const assignedForeman = {
  uid: 'foreman-1',
  email: 'foreman@phase2co.com',
  firstName: 'Field',
  lastName: 'User',
  role: 'foreman',
  active: true,
  assignedJobIds: ['job-1'],
}

const assignedProjectManager = {
  ...assignedForeman,
  uid: 'project-manager-1',
  email: 'project.manager@phase2co.com',
  firstName: 'Project',
  lastName: 'Manager',
  role: 'project-manager',
}

function emailSettings(dailyLogs: string[] = [], shopOrders: string[] = []) {
  return {
    timecardSubmitRecipients: [],
    dailyLogSubmitRecipients: dailyLogs,
    shopOrderSubmitRecipients: shopOrders,
    globalNotificationRecipients: {
      dailyLogs,
      timecards: [],
      shopOrders,
    },
  }
}

function makeDailyLogDeps(overrides: Record<string, unknown> = {}) {
  const statusRefs = [{ id: 'daily-log-status' }]
  const inlinePhotos = {
    previews: [
      {
        section: 'photo',
        position: 1,
        contentId: 'daily-log-photo-1@phase2.local',
      },
    ],
    attachments: [
      {
        name: 'daily-log-photo-1.jpg',
        contentType: 'image/jpeg',
        contentBytes: 'inline-jpeg',
        contentId: 'daily-log-photo-1@phase2.local',
        isInline: true,
      },
    ],
  }
  return {
    getUserProfile: vi.fn(async () => assignedForeman),
    getJobDetails: vi.fn(async () => job),
    dailyLogEmailStatusRefs: vi.fn(() => statusRefs),
    claimSubmittedEmailOperation: vi.fn(async () => 'claimed'),
    isEmailEnabled: vi.fn(() => true),
    getDailyLog: vi.fn(async () => ({
      id: 'daily-log-1',
      jobId: 'job-1',
      status: 'submitted',
      logDate: '2026-06-17',
      foremanUserId: 'foreman-1',
      foremanName: 'Vince Hintz',
      jobCode: '5229',
      jobName: 'Lucky 3 Ranch',
      additionalRecipients: [],
      payload: {
        attachments: [
          {
            name: 'photo.jpg',
            path: 'daily-logs/daily-log-1/photo.jpg',
            type: 'photo',
          },
        ],
      },
    })),
    getEmailSettings: vi.fn(async () => emailSettings(['global-daily@phase2co.com'])),
    getJobNotificationRecipients: vi.fn(async () => ['job-daily@phase2co.com']),
    getAppBaseUrl: vi.fn(() => 'https://phase2-website.web.app'),
    ensureDailyLogGalleryShare: vi.fn(async () => 'gallery-share-id'),
    prepareDailyLogInlinePhotos: vi.fn(async () => inlinePhotos),
    buildDailyLogEmail: vi.fn(() => '<p>daily log</p>'),
    sendEmail: vi.fn(async () => undefined),
    recordSubmittedEmailStatus: vi.fn(async () => undefined),
    ...overrides,
  }
}

function makeShopOrderDeps(overrides: Record<string, unknown> = {}) {
  const statusRefs = [{ id: 'shop-order-status' }]
  return {
    getUserProfile: vi.fn(async () => assignedForeman),
    getJobDetails: vi.fn(async () => job),
    shopOrderEmailStatusRefs: vi.fn(() => statusRefs),
    claimSubmittedEmailOperation: vi.fn(async () => 'claimed'),
    isEmailEnabled: vi.fn(() => true),
    getEmailSettings: vi.fn(async () => emailSettings([], ['global-shop@phase2co.com'])),
    getJobNotificationRecipients: vi.fn(async () => ['job-shop@phase2co.com']),
    recordSubmittedEmailStatus: vi.fn(async () => undefined),
    getShopOrder: vi.fn(async () => ({
      id: 'order-1',
      jobId: 'job-1',
      foremanName: 'CJ Blanchard',
      jobCode: '5229',
      jobName: 'Lucky 3 Ranch',
      orderDate: '2026-06-17',
      items: [{ catalogItemId: 'item-1', name: 'AHA Book', quantity: 1 }],
    })),
    getJobScopedShopOrderSnapshot: vi.fn(async () => ({
      exists: false,
      id: 'order-1',
      data: () => ({}),
    })),
    getShopOrderCostCodesByCatalogItemId: vi.fn(async () => ({ 'item-1': '133/513' })),
    buildShopOrderEmail: vi.fn(() => '<p>shop order</p>'),
    buildShopOrderPdfBuffer: vi.fn(async () => Buffer.from('pdf-body')),
    buildShopOrderPdfFilename: vi.fn(() => 'Shop Order.pdf'),
    sendEmail: vi.fn(async () => undefined),
    ...overrides,
  }
}

describe('submitted field email callable handlers', () => {
  it('sends a submitted daily log email and records success status', async () => {
    const deps = makeDailyLogDeps()

    await expect(
      handleSendDailyLogEmail(
        {
          auth: { uid: 'foreman-1' },
          data: { jobId: 'job-1', dailyLogId: 'daily-log-1' },
        },
        deps as never,
      ),
    ).resolves.toEqual({ success: true, message: 'Email sent successfully' })

    expect(deps.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['global-daily@phase2co.com', 'job-daily@phase2co.com', 'foreman@phase2co.com'],
        replyTo: 'foreman@phase2co.com',
        subject: 'Daily Log Report | Vince Hintz | #5229 Lucky 3 Ranch | 6/17/2026',
        html: '<p>daily log</p>',
        dailyLogPhotoFallbackHtml: '<p>daily log</p>',
      }),
    )
    expect(deps.buildDailyLogEmail).toHaveBeenCalledWith(
      job,
      '2026-06-17',
      expect.objectContaining({ id: 'daily-log-1' }),
      {
        dailyLogUrl: 'https://phase2-website.web.app/daily-log-gallery/gallery-share-id',
        inlinePhotoPreviews: [
          {
            section: 'photo',
            position: 1,
            contentId: 'daily-log-photo-1@phase2.local',
          },
        ],
      },
    )
    expect(deps.ensureDailyLogGalleryShare).toHaveBeenCalledWith({
      dailyLogId: 'daily-log-1',
      jobId: 'job-1',
      jobDetails: job,
      log: expect.objectContaining({ id: 'daily-log-1' }),
    })
    expect(deps.buildDailyLogEmail).toHaveBeenCalledWith(
      job,
      '2026-06-17',
      expect.objectContaining({ id: 'daily-log-1' }),
      {
        dailyLogUrl: 'https://phase2-website.web.app/daily-log-gallery/gallery-share-id',
        inlinePhotoPreviews: [],
      },
    )
    expect(deps.prepareDailyLogInlinePhotos).toHaveBeenCalledWith(
      'daily-log-1',
      expect.objectContaining({ id: 'daily-log-1' }),
    )
    expect(deps.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          expect.objectContaining({
            contentId: 'daily-log-photo-1@phase2.local',
            isInline: true,
          }),
        ],
      }),
    )
    expect(deps.recordSubmittedEmailStatus).toHaveBeenLastCalledWith(
      expect.any(Array),
      expect.objectContaining({
        emailSent: true,
        emailMessage: 'Email sent successfully',
        operationId: 'dailyLogSubmittedEmail:daily-log-1',
      }),
      expect.objectContaining({
        operation: 'sendDailyLogEmail',
        operationId: 'dailyLogSubmittedEmail:daily-log-1',
      }),
    )
  })

  it('denies unassigned foremen before claiming or sending a daily log email', async () => {
    const deps = makeDailyLogDeps({
      getUserProfile: vi.fn(async () => ({
        ...assignedForeman,
        assignedJobIds: [],
      })),
    })

    await expect(
      handleSendDailyLogEmail(
        {
          auth: { uid: 'foreman-1' },
          data: { jobId: 'job-1', dailyLogId: 'daily-log-1' },
        },
        deps as never,
      ),
    ).rejects.toMatchObject({
      code: 'permission-denied',
    })

    expect(deps.claimSubmittedEmailOperation).not.toHaveBeenCalled()
    expect(deps.sendEmail).not.toHaveBeenCalled()
  })

  it('short-circuits duplicate and concurrent daily log sends before loading email data', async () => {
    const alreadySentDeps = makeDailyLogDeps({
      claimSubmittedEmailOperation: vi.fn(async () => 'already-sent'),
    })
    await expect(
      handleSendDailyLogEmail(
        {
          auth: { uid: 'foreman-1' },
          data: { jobId: 'job-1', dailyLogId: 'daily-log-1' },
        },
        alreadySentDeps as never,
      ),
    ).resolves.toEqual({ success: true, message: SUBMITTED_EMAIL_ALREADY_SENT_MESSAGE })
    expect(alreadySentDeps.getDailyLog).not.toHaveBeenCalled()
    expect(alreadySentDeps.sendEmail).not.toHaveBeenCalled()

    const inProgressDeps = makeDailyLogDeps({
      claimSubmittedEmailOperation: vi.fn(async () => 'in-progress'),
    })
    await expect(
      handleSendDailyLogEmail(
        {
          auth: { uid: 'foreman-1' },
          data: { jobId: 'job-1', dailyLogId: 'daily-log-1' },
        },
        inProgressDeps as never,
      ),
    ).resolves.toEqual({ success: true, message: SUBMITTED_EMAIL_IN_PROGRESS_MESSAGE })
    expect(inProgressDeps.getDailyLog).not.toHaveBeenCalled()
    expect(inProgressDeps.sendEmail).not.toHaveBeenCalled()
  })

  it('records skipped status when daily log email sending is disabled', async () => {
    const deps = makeDailyLogDeps({
      isEmailEnabled: vi.fn(() => false),
    })

    await expect(
      handleSendDailyLogEmail(
        {
          auth: { uid: 'foreman-1' },
          data: { jobId: 'job-1', dailyLogId: 'daily-log-1' },
        },
        deps as never,
      ),
    ).resolves.toEqual({ success: true, message: 'Email sending disabled. Skipped.' })

    expect(deps.getDailyLog).not.toHaveBeenCalled()
    expect(deps.sendEmail).not.toHaveBeenCalled()
    expect(deps.recordSubmittedEmailStatus).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        emailSent: false,
        emailMessage: 'Email sending disabled. Skipped.',
      }),
      expect.any(Object),
    )
  })

  it('records and rejects when a daily log has no recipients', async () => {
    const deps = makeDailyLogDeps({
      getUserProfile: vi.fn(async () => ({ ...assignedForeman, email: '' })),
      getEmailSettings: vi.fn(async () => emailSettings()),
      getJobNotificationRecipients: vi.fn(async () => []),
    })

    await expect(
      handleSendDailyLogEmail(
        {
          auth: { uid: 'foreman-1' },
          data: { jobId: 'job-1', dailyLogId: 'daily-log-1' },
        },
        deps as never,
      ),
    ).rejects.toMatchObject({
      code: 'failed-precondition',
      message: ERROR_MESSAGES.RECIPIENTS_REQUIRED,
    })

    expect(deps.sendEmail).not.toHaveBeenCalled()
    expect(deps.recordSubmittedEmailStatus).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        emailSent: false,
        emailMessage: ERROR_MESSAGES.RECIPIENTS_REQUIRED,
      }),
      expect.any(Object),
    )
  })

  it('records send failures for submitted daily logs', async () => {
    const deps = makeDailyLogDeps({
      sendEmail: vi.fn(async () => {
        throw new Error('SMTP offline')
      }),
    })

    await expect(
      handleSendDailyLogEmail(
        {
          auth: { uid: 'foreman-1' },
          data: { jobId: 'job-1', dailyLogId: 'daily-log-1' },
        },
        deps as never,
      ),
    ).rejects.toMatchObject({
      code: 'internal',
      message: 'SMTP offline',
    })

    expect(deps.recordSubmittedEmailStatus).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        emailSent: false,
        emailMessage: 'SMTP offline',
      }),
      expect.any(Object),
    )
  })

  it('sends a shop order email with the generated PDF attachment and records success status', async () => {
    const deps = makeShopOrderDeps({
      getUserProfile: vi.fn(async () => adminUser),
    })

    await expect(
      handleSendShopOrderEmail(
        {
          auth: { uid: 'admin-1' },
          data: {
            jobId: 'job-1',
            shopOrderId: 'order-1',
            recipients: ['requested-shop@phase2co.com'],
          },
        },
        deps as never,
      ),
    ).resolves.toEqual({ success: true, message: 'Email sent successfully' })

    expect(deps.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['requested-shop@phase2co.com', 'global-shop@phase2co.com', 'job-shop@phase2co.com', 'admin@phase2co.com'],
        replyTo: 'admin@phase2co.com',
        subject: 'Shop Order | CJ Blanchard | #5229 Lucky 3 Ranch | Order #20260617000000',
        html: '<p>shop order</p>',
        attachments: [
          {
            name: 'Shop Order.pdf',
            contentType: 'application/pdf',
            contentBytes: Buffer.from('pdf-body').toString('base64'),
          },
        ],
      }),
    )
    expect(deps.recordSubmittedEmailStatus).toHaveBeenLastCalledWith(
      expect.any(Array),
      expect.objectContaining({
        emailSent: true,
        emailMessage: 'Email sent successfully',
        operationId: 'shopOrderSubmittedEmail:order-1',
      }),
      expect.objectContaining({
        operation: 'sendShopOrderEmail',
        operationId: 'shopOrderSubmittedEmail:order-1',
      }),
    )
  })

  it('allows an assigned project manager to send a submitted shop order email', async () => {
    const deps = makeShopOrderDeps({
      getUserProfile: vi.fn(async () => assignedProjectManager),
    })

    await expect(
      handleSendShopOrderEmail(
        {
          auth: { uid: 'project-manager-1' },
          data: {
            jobId: 'job-1',
            shopOrderId: 'order-1',
          },
        },
        deps as never,
      ),
    ).resolves.toEqual({ success: true, message: 'Email sent successfully' })

    expect(deps.claimSubmittedEmailOperation).toHaveBeenCalled()
    expect(deps.sendEmail).toHaveBeenCalled()
  })

  it('denies an unassigned project manager before sending a shop order email', async () => {
    const deps = makeShopOrderDeps({
      getUserProfile: vi.fn(async () => ({
        ...assignedProjectManager,
        assignedJobIds: [],
      })),
    })

    await expect(
      handleSendShopOrderEmail(
        {
          auth: { uid: 'project-manager-1' },
          data: {
            jobId: 'job-1',
            shopOrderId: 'order-1',
          },
        },
        deps as never,
      ),
    ).rejects.toMatchObject({
      code: 'permission-denied',
    })

    expect(deps.claimSubmittedEmailOperation).not.toHaveBeenCalled()
    expect(deps.sendEmail).not.toHaveBeenCalled()
  })

  it('rejects shop orders that do not belong to the requested job', async () => {
    const deps = makeShopOrderDeps({
      getShopOrder: vi.fn(async () => ({
        id: 'order-1',
        jobId: 'other-job',
        items: [],
      })),
    })

    await expect(
      handleSendShopOrderEmail(
        {
          auth: { uid: 'foreman-1' },
          data: { jobId: 'job-1', shopOrderId: 'order-1' },
        },
        deps as never,
      ),
    ).rejects.toMatchObject({
      code: 'permission-denied',
      message: 'Shop order does not belong to the requested job',
    })

    expect(deps.sendEmail).not.toHaveBeenCalled()
  })
})
