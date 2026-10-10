// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FormRecord } from '../src/formModel'
const post = vi.hoisted(() => vi.fn())
vi.mock('axios', () => ({ default: { post } }))
vi.mock('../src/runtime', () => ({ db: {}, storageBucket: {} }))
vi.mock('../src/functionConfig', () => ({
  emailEnabled: { value: () => true },
  getAppBaseUrl: () => 'https://local.invalid',
  getGraphEmailSecrets: () => [],
  getGraphSecretExpirationDate: () => '2027-02-09',
  graphClientId: { value: () => 'mock-client' },
  graphClientSecret: { value: () => 'mock-secret' },
  graphTenantId: { value: () => 'mock-tenant' },
  outlookSenderEmail: { value: () => 'sender@example.com' },
}))
const record: FormRecord = {
  id: 'entry',
  ownerUid: 'owner',
  templateId: 'template',
  templateVersion: 1,
  revision: 1,
  status: 'submitted',
  createdAt: 0,
  updatedAt: 0,
  definition: {
    title: 'Full audit',
    description: 'Completed form',
    version: 1,
    createdAt: '',
    recipients: [],
    fields: [
      { id: 'notes', kind: 'textarea', label: 'Full notes', required: false, options: [] },
      { id: 'photos', kind: 'photo', label: 'Site photos', required: false, options: [] },
    ],
  },
  answers: {
    notes: 'First <&> line\nSecond full line',
    photos: ['photo-one', 'photo-two', 'photo-three'],
  },
}
describe('Forms output through the unchanged Graph transport', () => {
  beforeEach(() => {
    vi.resetModules()
    post.mockReset()
    post
      .mockResolvedValueOnce({ data: { access_token: 'mock-token', expires_in: 3600 } })
      .mockResolvedValue({ status: 202 })
  })
  it('sends complete escaped HTML, matching text and bounded inline JPEG attachments', async () => {
    const { prepareFormEmail } = await import('../src/formEmailContent'),
      { sendEmail } = await import('../src/emailService'),
      sharp = (await import('sharp')).default
    const image = await sharp({
      create: { width: 720, height: 480, channels: 3, background: '#2470aa' },
    })
      .webp()
      .toBuffer()
    const prepared = await prepareFormEmail(record, ['recipient@example.com'], {
      loadAsset: async (id) => ({
        recordId: 'entry',
        ownerUid: 'owner',
        fieldId: 'photos',
        path: 'form-photos/entry/' + id + '.webp',
      }),
      download: async () => image,
      ownerEmail: async () => 'owner@example.com',
      appBaseUrl: () => 'http://127.0.0.1:5173',
    })
    await sendEmail(prepared)
    expect(post).toHaveBeenCalledTimes(2)
    const payload = post.mock.calls[1]![1]
    expect(payload.message.body.contentType).toBe('HTML')
    expect(payload.message.body.content).toContain('First &lt;&amp;&gt; line<br>Second full line')
    expect(prepared.text).toContain(record.answers.notes)
    expect(payload.message.attachments).toHaveLength(2)
    expect(payload.message.attachments[0]).toMatchObject({
      '@odata.type': '#microsoft.graph.fileAttachment',
      isInline: true,
      contentType: 'image/jpeg',
    })
    expect(payload.message.body.content).toContain('View all 3 photos')
    expect(payload.message.toRecipients).toHaveLength(2)
    expect(payload.message.replyTo[0].emailAddress.address).toBe('owner@example.com')
    expect(Buffer.byteLength(JSON.stringify(payload))).toBeLessThan(900000)
  })
  it('omitted photo fields add no stray email attachments while the PDF remains complete', async () => {
    const { prepareFormEmail } = await import('../src/formEmailContent')
    const image = await (
      await import('sharp')
    )
      .default({ create: { width: 20, height: 20, channels: 3, background: '#2470aa' } })
      .webp()
      .toBuffer()
    const prepared = await prepareFormEmail(
      {
        ...record,
        definition: {
          ...record.definition,
          output: { requireLogin: true, pdf: true, template: 'Notes: {{notes}}' },
        },
      },
      ['recipient@example.com'],
      {
        loadAsset: async (id) => ({
          recordId: 'entry',
          ownerUid: 'owner',
          fieldId: 'photos',
          path: 'form-photos/entry/' + id + '.webp',
        }),
        download: async () => image,
        ownerEmail: async () => '',
        appBaseUrl: () => 'http://127.0.0.1:5173',
      },
    )
    expect(prepared.html).not.toContain('cid:')
    expect(prepared.attachments).toHaveLength(1)
    expect(prepared.attachments![0]!.contentType).toBe('application/pdf')
    expect(
      Buffer.from(prepared.attachments![0]!.contentBytes, 'base64').subarray(0, 5).toString(),
    ).toBe('%PDF-')
  })
  it('retains the optional PDF and replaces oversized inline images with viewer links before transport', async () => {
    const { prepareFormEmail, fitFormEmailPayload } = await import('../src/formEmailContent'),
      { sendEmail } = await import('../src/emailService')
    const image = await (await import('sharp')).default({ create: { width: 20, height: 20, channels: 3, background: '#2470aa' } }).webp().toBuffer()
    const prepared = await prepareFormEmail(
      {
        ...record,
        definition: {
          ...record.definition,
          output: { requireLogin: true, pdf: true, template: '' },
        },
      },
      ['recipient@example.com'],
      {
        loadAsset: async (id) => ({ recordId: record.id, ownerUid: record.ownerUid, fieldId: 'photos', path: 'form-photos/' + record.id + '/' + id + '.webp' }),
        download: async () => image,
        ownerEmail: async () => undefined,
        appBaseUrl: () => 'http://127.0.0.1:5173',
      },
    )
    const pdf = prepared.attachments!.find(attachment => attachment.contentType === 'application/pdf')!
    const fitted = fitFormEmailPayload({
      ...prepared,
      html: prepared.html + '<img src="cid:large"/>',
      attachments: [
        pdf,
        {
          name: 'large.jpg',
          isInline: true,
          contentBytes: Buffer.alloc(900000).toString('base64'),
          contentId: 'large',
        },
      ],
    })
    await sendEmail(fitted)
    const payload = post.mock.calls[1]![1]
    expect(payload.message.attachments).toHaveLength(1)
    expect(payload.message.attachments[0].contentType).toBe('application/pdf')
    expect(payload.message.body.content).not.toContain('cid:large')
    expect(payload.message.body.content).toContain('View all 3 photos')
    expect(payload.message.body.content).toContain('Second full line')
  })
})
