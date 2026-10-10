const assert = require('node:assert/strict')
require.cache[require.resolve('../runtime')] = { exports: { db: {}, storageBucket: {} } }
const {
  prepareFormEmail,
  FormEmailPreparationError,
  fitFormEmailPayload,
} = require('../formEmailContent')
const sharp = require('sharp')
const { PDFDocument, PDFName } = require('pdf-lib')
;(async () => {
  const source = await sharp({
    create: { width: 80, height: 80, channels: 3, background: '#447799' },
  })
    .jpeg()
    .toBuffer()
  const photoField = {
    id: 'photos',
    kind: 'photo',
    label: 'Original photos',
    required: false,
    options: [],
  }
  const record = {
    id: 'email-pdf',
    ownerUid: 'owner',
    templateId: 'form',
    templateVersion: 3,
    definition: {
      title: 'Original completed visit',
      description: '',
      fields: [{ id: 'stops', kind: 'repeat', label: 'Site stop', fields: [photoField] }],
      output: { pdf: true, template: '', requireLogin: true },
    },
    answers: {
      stops: [
        { instanceId: 'first', answers: { photos: ['a1', 'a2', 'a3'] } },
        { instanceId: 'second', answers: { photos: ['b1', 'b2', 'b3'] } },
      ],
    },
  }
  const asset = (id) => ({
    recordId: record.id,
    ownerUid: 'owner',
    fieldId: 'photos',
    groupId: 'stops',
    instanceId: id[0] === 'a' ? 'first' : 'second',
    path: `form-photos/${record.id}/${id}.webp`,
  })
  const deps = {
    loadAsset: async (id) => asset(id),
    download: async () => source,
    ownerEmail: async () => undefined,
    appBaseUrl: () => 'https://example.test',
  }
  const email = await prepareFormEmail(record, ['review@example.test'], deps)
  const pdfAttachment = email.attachments.find((item) => item.contentType === 'application/pdf')
  assert.ok(pdfAttachment, 'Requested PDF must remain attached')
  const doc = await PDFDocument.load(Buffer.from(pdfAttachment.contentBytes, 'base64'))
  let imageCount = 0
  for (const page of doc.getPages()) {
    const objects = page.node.Resources()?.lookup(PDFName.of('XObject'))
    if (objects) imageCount += objects.keys().length
  }
  assert.equal(imageCount, 6, 'PDF includes all six attachments despite inline limit two per site')
  assert.equal(
    email.attachments.filter((item) => item.isInline).length,
    4,
    'HTML thumbnails retain their bounded per-site behavior',
  )
  await assert.rejects(
    prepareFormEmail(record, ['review@example.test'], {
      ...deps,
      loadAsset: async (id) => (id === 'a3' ? { ...asset(id), instanceId: 'wrong' } : asset(id)),
    }),
    (error) => error instanceof FormEmailPreparationError && /verified/.test(error.message),
  )
  await assert.rejects(
    prepareFormEmail(record, ['review@example.test'], {
      ...deps,
      download: async (path) => (path.endsWith('/b3.webp') ? Buffer.from('corrupt') : source),
    }),
    (error) => error instanceof FormEmailPreparationError && /prepared/.test(error.message),
  )
  const oversized = {
    to: ['review@example.test'],
    subject: 'Complete report',
    html: 'answers',
    text: 'answers',
    dailyLogPhotoFallbackHtml: 'answers',
    attachments: [
      {
        name: 'completed-form.pdf',
        contentType: 'application/pdf',
        contentBytes: 'x'.repeat(1000000),
        isInline: false,
      },
    ],
  }
  assert.throws(
    () => fitFormEmailPayload(oversized),
    (error) => error instanceof FormEmailPreparationError && /retained/.test(error.message),
  )
  assert.equal(
    oversized.attachments.length,
    1,
    'Payload reduction must not silently discard the requested complete PDF',
  )
  console.log(
    'PASS email PDF all six photos, bounded four inline previews, wrong-instance/corrupt-photo atomic failures; no emails sent.',
  )
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
