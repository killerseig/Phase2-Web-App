import { beforeEach, describe, expect, it, vi } from 'vitest'
import axios from '../../functions/node_modules/axios/index.js'
import { buildSubmissionEmailRouting, sendEmail } from '../../functions/src/emailService'

vi.mock('../../functions/node_modules/axios/index.js', () => ({ default: { post: vi.fn() } }))
vi.mock('../../functions/src/functionConfig', () => ({
  emailEnabled: { value: () => true },
  outlookSenderEmail: { value: () => 'app@example.com' },
  graphClientId: { value: () => 'test-client' },
  graphClientSecret: { value: () => 'test-secret' },
  graphTenantId: { value: () => 'test-tenant' },
  getAppBaseUrl: () => 'https://example.com',
  getGraphSecretExpirationDate: () => '2027-01-01',
}))

beforeEach(() => {
  vi.mocked(axios.post).mockReset()
  vi.mocked(axios.post).mockImplementation(async (url) => (
    String(url).includes('/token')
      ? { data: { access_token: 'test-token', expires_in: 3600 }, status: 200 }
      : { status: 202 }
  ))
})

describe('submission email routing', () => {
  it('copies the sender once and routes replies to them, preserving existing recipients', () => {
    expect(buildSubmissionEmailRouting(
      ['office@example.com', ' Sender@example.com ', 'OFFICE@example.com'],
      ' sender@example.com ',
    )).toEqual({
      to: ['OFFICE@example.com', 'sender@example.com'],
      replyTo: 'sender@example.com',
    })
  })

  it.each([undefined, null, '', 'invalid', 'sender@example.com\r\nBcc: other@example.com'])(
    'preserves configured delivery when the sender address is unavailable or invalid: %s',
    (email) => {
      expect(buildSubmissionEmailRouting(['office@example.com'], email)).toEqual({ to: ['office@example.com'] })
    },
  )

  it('can send a copy when the sender is the only recipient', () => {
    expect(buildSubmissionEmailRouting([], 'sender@example.com')).toEqual({
      to: ['sender@example.com'], replyTo: 'sender@example.com',
    })
  })

  it('sends the recipient and reply address through Microsoft Graph', async () => {
    await sendEmail({
      ...buildSubmissionEmailRouting(['office@example.com'], 'sender@example.com'),
      subject: 'Daily Log', html: '<p>Submitted</p>',
    })
    expect(axios.post).toHaveBeenCalledWith(
      'https://graph.microsoft.com/v1.0/users/app@example.com/sendMail',
      expect.objectContaining({ message: expect.objectContaining({
        from: { emailAddress: { address: 'app@example.com', name: 'Phase 2' } },
        toRecipients: [
          { emailAddress: { address: 'office@example.com' } },
          { emailAddress: { address: 'sender@example.com' } },
        ],
        replyTo: [{ emailAddress: { address: 'sender@example.com' } }],
      }) }),
      expect.any(Object),
    )
  })

  it('keeps reply routing absent for emails that do not request it', async () => {
    await sendEmail({ to: 'office@example.com', subject: 'Account email', html: '<p>Account</p>' })
    const sent = vi.mocked(axios.post).mock.calls.find(([url]) => String(url).endsWith('/sendMail'))
    expect(sent?.[1]).toHaveProperty('message')
    expect(sent?.[1]).not.toHaveProperty('message.replyTo')
  })
})
