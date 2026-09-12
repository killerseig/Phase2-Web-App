import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EMAIL } from '../src/constants'
import type { SendEmailOptions } from '../src/emailService'

const axiosPostMock = vi.hoisted(() => vi.fn())

vi.mock('axios', () => ({
  default: {
    post: axiosPostMock,
  },
}))

vi.mock('../src/functionConfig', () => ({
  emailEnabled: { value: () => true },
  getAppBaseUrl: () => 'https://phase2-website.web.app',
  getGraphSecretExpirationDate: () => '2027-02-09',
  graphClientId: { value: () => 'graph-client-id' },
  graphClientSecret: { value: () => 'graph-client-secret' },
  graphTenantId: { value: () => 'graph-tenant-id' },
  outlookSenderEmail: { value: () => 'no-reply@phase2co.com' },
}))

interface AxiosFailureCase {
  label: string
  status?: number
  retryable: boolean
}

const axiosFailureCases: AxiosFailureCase[] = [
  { label: 'HTTP 400', status: 400, retryable: false },
  { label: 'HTTP 429', status: 429, retryable: true },
  { label: 'HTTP 503', status: 503, retryable: true },
  { label: 'a network failure', retryable: true },
]

function createAxiosFailure(testCase: AxiosFailureCase): Error & { response?: { status: number } } {
  return Object.assign(
    new Error(`${testCase.label} from Axios`),
    testCase.status === undefined ? {} : { response: { status: testCase.status } },
  )
}

async function loadFreshEmailSender() {
  vi.resetModules()
  const [emailService, deliveryErrors] = await Promise.all([
    import('../src/emailService'),
    import('../src/emailDeliveryErrors'),
  ])
  return {
    EmailDeliveryError: deliveryErrors.EmailDeliveryError,
    sendEmail: emailService.sendEmail,
    buildDailyLogEmail: emailService.buildDailyLogEmail,
  }
}

async function captureRejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
    throw new Error('Expected promise to reject.')
  } catch (error) {
    return error
  }
}

describe('emailService Axios failure classification', () => {
  beforeEach(() => {
    axiosPostMock.mockReset()
  })

  it.each(axiosFailureCases)(
    'wraps token endpoint $label as an EmailDeliveryError with retryable=$retryable',
    async (testCase) => {
      axiosPostMock.mockRejectedValueOnce(createAxiosFailure(testCase))
      const { EmailDeliveryError, sendEmail } = await loadFreshEmailSender()

      const failure = await captureRejection(
        sendEmail({
          to: 'recipient@example.com',
          subject: 'Daily Log',
          html: '<p>Daily Log</p>',
        }),
      )

      expect(failure).toBeInstanceOf(EmailDeliveryError)
      expect(failure).toMatchObject({
        retryable: testCase.retryable,
        ...(testCase.status === undefined ? {} : { httpStatus: testCase.status }),
      })
      expect((failure as Error).message).toContain('Failed to get Graph API token')
      expect(axiosPostMock).toHaveBeenCalledTimes(1)
      expect(axiosPostMock.mock.calls[0]?.[0]).toContain('login.microsoftonline.com')
    },
  )

  it.each(axiosFailureCases)(
    'wraps Graph send $label as an EmailDeliveryError with retryable=$retryable',
    async (testCase) => {
      axiosPostMock
        .mockResolvedValueOnce({ data: { access_token: 'graph-token', expires_in: 3600 } })
        .mockRejectedValueOnce(createAxiosFailure(testCase))
      const { EmailDeliveryError, sendEmail } = await loadFreshEmailSender()

      const failure = await captureRejection(
        sendEmail({
          to: 'recipient@example.com',
          subject: 'Daily Log',
          html: '<p>Daily Log</p>',
        }),
      )

      expect(failure).toBeInstanceOf(EmailDeliveryError)
      expect(failure).toMatchObject({
        retryable: testCase.retryable,
        ...(testCase.status === undefined ? {} : { httpStatus: testCase.status }),
      })
      expect((failure as Error).message).toContain('Failed to send email')
      expect(axiosPostMock).toHaveBeenCalledTimes(2)
      expect(axiosPostMock.mock.calls[1]?.[0]).toContain('graph.microsoft.com')
    },
  )
})

describe('daily log email size budget', () => {
  beforeEach(() => {
    axiosPostMock.mockReset()
    axiosPostMock
      .mockResolvedValueOnce({ data: { access_token: 'graph-token', expires_in: 3600 } })
      .mockResolvedValueOnce({ status: 202 })
  })

  async function dailyLogMessage(photoBytes: number) {
    const sender = await loadFreshEmailSender()
    const sections = ['photo', 'ptp', 'qc'] as const
    const previews = sections.flatMap((section) =>
      [1, 2].map((position) => ({
        section,
        position,
        contentId: `daily-log-${section}-${position}@phase2.local`,
      })),
    )
    const log = {
      weeklySchedule: 'Complete lobby framing.\nCoordinate ceiling inspection.',
      attachments: sections.flatMap((type) =>
        [1, 2, 3].map((position) => ({ name: `${type}-${position}.jpg`, type })),
      ),
    }
    const job = { id: 'job-1', name: 'Gallery test job', number: '100' }
    const dailyLogUrl = 'https://phase2.example/daily-log-gallery/share-1'
    const options: SendEmailOptions = {
      to: ['first@example.com', 'second@example.com'],
      subject: 'Daily Log Report | Gallery test job',
      html: sender.buildDailyLogEmail(job, '2026-09-10', log, {
        dailyLogUrl,
        inlinePhotoPreviews: previews,
      }),
      dailyLogPhotoFallbackHtml: sender.buildDailyLogEmail(job, '2026-09-10', log, {
        dailyLogUrl,
        inlinePhotoPreviews: [],
      }),
      attachments: previews.map((preview) => ({
        name: `${preview.section}-${preview.position}.jpg`,
        contentType: 'image/jpeg',
        contentBytes: Buffer.alloc(photoBytes).toString('base64'),
        contentId: preview.contentId,
        isInline: true,
      })),
    }
    return { ...sender, options, dailyLogUrl }
  }

  it('sends all six bounded previews when the complete request fits the budget', async () => {
    const { sendEmail, options } = await dailyLogMessage(96 * 1024)
    await sendEmail(options)

    expect(axiosPostMock).toHaveBeenCalledTimes(2)
    const payload = axiosPostMock.mock.calls[1]![1]
    expect(payload.message.attachments).toHaveLength(6)
    expect(payload.message.body.content).toBe(options.html)
    expect(Buffer.byteLength(JSON.stringify(payload), 'utf8')).toBeLessThanOrEqual(
      EMAIL.DAILY_LOG_MAX_PAYLOAD_BYTES,
    )
    expect(payload).not.toHaveProperty('dailyLogPhotoFallbackHtml')
  })

  it('uses gallery links when encoded photos exceed the budget, preserving the report and recipients', async () => {
    // Raw images fit below 900 KB; their base64 encoding makes the full request too large.
    const { sendEmail, options, dailyLogUrl } = await dailyLogMessage(128 * 1024)
    await sendEmail(options)

    expect(axiosPostMock).toHaveBeenCalledTimes(2)
    const payload = axiosPostMock.mock.calls[1]![1]
    const html = payload.message.body.content
    expect(payload.message.attachments).toBeUndefined()
    expect(html).toBe(options.dailyLogPhotoFallbackHtml)
    expect(html).toContain('Complete lobby framing.<br>Coordinate ceiling inspection.')
    expect(html).not.toContain('src="cid:')
    for (const section of ['photo', 'ptp', 'qc']) {
      expect(html).toContain(`${dailyLogUrl}#gallery-${section}-1`)
      expect(html).toContain(`${dailyLogUrl}#gallery-${section}-2`)
    }
    for (const title of ['Photos', 'PTP Photos', 'QC Photos']) {
      expect(html).toContain(`View All 3 ${title}`)
    }
    expect(payload.message.subject).toBe(options.subject)
    expect(payload.message.toRecipients).toEqual([
      { emailAddress: { address: 'first@example.com' } },
      { emailAddress: { address: 'second@example.com' } },
    ])
    expect(Buffer.byteLength(JSON.stringify(payload), 'utf8')).toBeLessThanOrEqual(
      EMAIL.DAILY_LOG_MAX_PAYLOAD_BYTES,
    )
  })

  it('counts UTF-8 report bytes and stops an oversized text-only email before any network request', async () => {
    const { EmailDeliveryError, sendEmail } = await loadFreshEmailSender()
    const report = '<p>' + '界'.repeat(310_000) + '</p>'
    expect(report.length).toBeLessThan(EMAIL.DAILY_LOG_MAX_PAYLOAD_BYTES)
    const failure = await captureRejection(
      sendEmail({
        to: 'recipient@example.com',
        subject: 'Daily Log Report',
        html: report,
        dailyLogPhotoFallbackHtml: report,
      }),
    )

    expect(failure).toBeInstanceOf(EmailDeliveryError)
    expect(failure).toMatchObject({ retryable: false })
    expect((failure as Error).message).toContain('too large to send, even with photos linked')
    expect(axiosPostMock).not.toHaveBeenCalled()
  })

  it('preserves non-inline attachments when switching photos to gallery links', async () => {
    const { sendEmail, options } = await dailyLogMessage(128 * 1024)
    const document = {
      name: 'report.pdf',
      contentType: 'application/pdf',
      contentBytes: Buffer.from('report').toString('base64'),
    }
    options.attachments!.push(document)
    await sendEmail(options)

    expect(axiosPostMock.mock.calls[1]![1].message.attachments).toEqual([
      { '@odata.type': '#microsoft.graph.fileAttachment', ...document },
    ])
  })

  it('keeps the daily log budget separate from other email workflows', async () => {
    const { sendEmail } = await loadFreshEmailSender()
    const pdf = { name: 'timecards.pdf', contentBytes: Buffer.alloc(900_000).toString('base64') }
    await sendEmail({
      to: 'recipient@example.com',
      subject: 'Timecard Report',
      html: '<p>Timecards</p>',
      attachments: [pdf],
    })

    expect(axiosPostMock).toHaveBeenCalledTimes(2)
    expect(axiosPostMock.mock.calls[1]![1].message.attachments[0].contentBytes).toBe(
      pdf.contentBytes,
    )
  })
})
