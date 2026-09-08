import { beforeEach, describe, expect, it, vi } from 'vitest'

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
