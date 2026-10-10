const assert = require('node:assert/strict')
require.cache[require.resolve('../runtime')] = { exports: { db: {}, storageBucket: {} } }
const { prepareFormEmail } = require('../formEmailContent')
const { translateFormRecord } = require('../formTranslation')
const { PDFDocument, PDFName } = require('pdf-lib')
const sharp = require('sharp')
;(async () => {
  const record = {
    id: 'bilingual-synthetic',
    ownerUid: 'owner',
    templateId: 'form',
    templateVersion: 3,
    definition: {
      title: 'Site visit',
      description: '',
      version: 3,
      fields: [
        {
          id: 'stops',
          kind: 'repeat',
          label: 'Original site stop',
          fields: [
            {
              id: 'note',
              kind: 'textarea',
              label: 'Original observation question',
              required: false,
              options: [],
            },
            {
              id: 'rating',
              kind: 'matrix',
              label: 'Original rating question',
              required: false,
              options: ['Seguro'],
              rows: [{ id: 'tools', label: 'Original tools row' }],
            },
            {
              id: 'photos',
              kind: 'photo',
              label: 'Original site photos',
              required: false,
              options: [],
            },
          ],
        },
      ],
      output: { pdf: true, requireLogin: false, template: '' },
    },
    answers: {
      stops: [
        {
          instanceId: 'first',
          answers: { note: 'Escalera suelta', rating: ['Seguro'], photos: ['a1', 'a2', 'a3'] },
        },
        {
          instanceId: 'second',
          answers: { note: 'Peligro de caída', rating: ['Seguro'], photos: ['b1', 'b2', 'b3'] },
        },
      ],
    },
  }
  const original = JSON.stringify(record)
  const translation = await translateFormRecord(record, {
    translate: async (texts) =>
      texts.map(
        (text) =>
          ({
            'Escalera suelta': 'Loose ladder',
            'Peligro de caída': 'Fall hazard',
            Seguro: 'Safe',
          })[text],
      ),
  })
  translation.correction = { by: 'reviewer', at: 1000 }
  translation.revision = 2
  const image = await sharp({
    create: { width: 40, height: 40, channels: 3, background: '#5599aa' },
  })
    .jpeg()
    .toBuffer()
  const email = await prepareFormEmail(record, ['review@example.test'], {
    appBaseUrl: () => 'https://example.test',
    ownerEmail: async () => undefined,
    loadAsset: async (id) => ({
      recordId: record.id,
      ownerUid: 'owner',
      fieldId: 'photos',
      groupId: 'stops',
      instanceId: id[0] === 'a' ? 'first' : 'second',
      path: `form-photos/${record.id}/${id}.webp`,
    }),
    download: async () => image,
    translate: async () => translation,
  })
  const bytes = Buffer.from(
    email.attachments.find((item) => item.contentType === 'application/pdf').contentBytes,
    'base64',
  )
  const pdf = await PDFDocument.load(bytes)
  let images = 0
  for (const page of pdf.getPages())
    images += page.node.Resources()?.lookup(PDFName.of('XObject'))?.keys().length || 0
  assert.equal(
    images,
    6,
    'All six original site photos included once, not inline-preview limited or duplicated in appendix',
  )
  const { getDocument } = await import('../../node_modules/pdfjs-dist/legacy/build/pdf.mjs')
  const loading = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false })
  const reader = await loading.promise
  let text = ''
  for (let index = 1; index <= reader.numPages; index++)
    text +=
      (await (await reader.getPage(index)).getTextContent()).items
        .map((item) => item.str)
        .join('\n') + '\n'
  await loading.destroy()
  for (const expected of [
    'Original submission',
    'Escalera suelta',
    'Peligro de caída',
    'English rendering',
    'Loose ladder',
    'Fall hazard',
    'Original tools row',
    'Safe',
    'Human correction:',
    'reviewer',
    translation.sourceHash,
  ])
    assert.ok(text.includes(expected), expected)
  assert.ok(text.indexOf('Escalera suelta') < text.indexOf('English rendering'))
  assert.ok(text.indexOf('Peligro de caída') < text.indexOf('English rendering'))
  assert.ok(text.indexOf('Loose ladder') > text.indexOf('English rendering'))
  assert.ok(text.indexOf('Fall hazard') > text.indexOf('Loose ladder'))
  assert.equal(JSON.stringify(record), original)
  console.log(
    'Bilingual attached PDF extracted text, immutable originals, site/row associations, correction provenance and all six photos passed; synthetic adapter/storage only.',
  )
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
