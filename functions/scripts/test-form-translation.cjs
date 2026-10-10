const assert = require('node:assert/strict')
const {
  translationSource,
  translateFormRecord,
  translatedFormProjection,
  currentFormTranslation,
} = require('../formTranslation')
const field = (id, kind) => ({ id, kind, label: id, required: false, options: ['Seguro'] })
const record = {
  id: 'synthetic',
  definition: {
    version: 1,
    fields: [
      field('note', 'textarea'),
      field('email', 'email'),
      field('photos', 'photo'),
      {
        ...field('sites', 'repeat'),
        fields: [
          field('observation', 'text'),
          {
            ...field('ratings', 'matrix'),
            rows: [
              { id: 'one', label: 'PPE' },
              { id: 'two', label: 'Tools' },
            ],
          },
        ],
      },
    ],
  },
  answers: {
    note: 'Peligro de caída',
    email: 'private@example.test',
    photos: ['private-photo'],
    sites: [
      {
        instanceId: 'site-one',
        answers: { observation: 'Escalera suelta', ratings: ['Seguro', ''] },
      },
    ],
  },
}
const original = JSON.stringify(record)
;(async () => {
  let requests = []
  const translation = await translateFormRecord(record, {
    translate: async (texts) => {
      requests.push(...texts)
      return texts.map((text) => 'English: ' + text)
    },
  })
  assert.equal(translation.status, 'ready')
  assert.equal(currentFormTranslation(record, translation), translation)
  assert.equal(
    currentFormTranslation(record, {
      ...translation,
      segments: [
        { key: 'email', original: 'private@example.test', translated: 'Changed private address' },
      ],
    }),
    undefined,
  )
  assert.deepEqual(requests, ['Peligro de caída', 'Escalera suelta', 'Seguro'])
  const projected = translatedFormProjection(record, translation)
  assert.equal(projected.answers.note, 'English: Peligro de caída')
  assert.equal(projected.answers.sites[0].answers.observation, 'English: Escalera suelta')
  assert.deepEqual(projected.answers.sites[0].answers.ratings, ['English: Seguro', ''])
  assert.deepEqual(projected.answers.photos, ['private-photo'])
  assert.equal(projected.answers.email, 'private@example.test')
  assert.equal(JSON.stringify(record), original)
  assert.equal((await translateFormRecord(record)).status, 'disabled')
  const failed = await translateFormRecord(record, {
    translate: async () => {
      throw new Error('secret service error')
    },
  })
  assert.equal(failed.status, 'failed')
  assert.ok(!JSON.stringify(failed).includes('secret service error'))
  assert.equal(translatedFormProjection(record, failed), record)
  assert.equal(
    translatedFormProjection(
      { ...record, answers: { ...record.answers, note: 'Changed' } },
      translation,
    ).answers.note,
    'Changed',
  )
  assert.equal(
    translationSource(record).sourceHash,
    translationSource(structuredClone(record)).sourceHash,
  )
  const { formTranslationEmailContent } = require('../formTranslationEmail')
  const rendered = formTranslationEmailContent(record, translation)
  assert.match(rendered.text, /English: Peligro de caída/)
  assert.match(rendered.html, /English rendering/)
  assert.match(formTranslationEmailContent(record, failed).text, /translation failed/)
  require.cache[require.resolve('../runtime')] = { exports: { db: {}, storageBucket: {} } }
  const { prepareFormEmail, fitFormEmailPayload } = require('../formEmailContent')
  const email = await prepareFormEmail(
    { ...record, ownerUid: 'synthetic-owner', templateVersion: 1 },
    ['review@example.test'],
    {
      loadAsset: async () => undefined,
      download: async () => {
        throw new Error('No photos expected')
      },
      ownerEmail: async () => 'synthetic-owner@example.test',
      appBaseUrl: () => 'https://example.test',
      translate: async () => translation,
    },
  )
  assert.match(email.text, /English: Peligro de caída/)
  assert.match(email.text, /Original submission/)
  assert.match(email.text, /Peligro de caída/)
  assert.match(email.html, /English: Escalera suelta/)
  assert.match(email.dailyLogPhotoFallbackHtml, /English: Escalera suelta/)
  const fallback = fitFormEmailPayload({
    ...email,
    attachments: [
      {
        name: 'inline.jpg',
        contentType: 'image/jpeg',
        contentBytes: 'A'.repeat(1100000),
        isInline: true,
        contentId: 'preview',
      },
      {
        name: 'complete.pdf',
        contentType: 'application/pdf',
        contentBytes: 'AAAA',
        isInline: false,
      },
    ],
  })
  assert.match(fallback.html, /English: Escalera suelta/)
  assert.equal(fallback.attachments.length, 1)
  assert.equal(fallback.attachments[0].name, 'complete.pdf')
  assert.throws(
    () =>
      fitFormEmailPayload({
        ...email,
        attachments: [
          {
            name: 'complete.pdf',
            contentType: 'application/pdf',
            contentBytes: 'A'.repeat(1100000),
            isInline: false,
          },
        ],
      }),
    /submission is retained/,
  )
  const large = { ...record, answers: { ...record.answers, note: 'x'.repeat(30001) } }
  assert.equal(
    (await translateFormRecord(large)).status,
    'disabled',
    'Disabled processing does not reject existing large original answers',
  )
  let boundCalls = 0
  assert.equal(
    (
      await translateFormRecord(large, {
        translate: async () => {
          boundCalls++
          return []
        },
      })
    ).status,
    'failed',
  )
  assert.equal(boundCalls, 0)
  const many = {
    definition: {
      version: 1,
      fields: Array.from({ length: 51 }, (_, index) => field('f' + index, 'text')),
    },
    answers: Object.fromEntries(
      Array.from({ length: 51 }, (_, index) => ['f' + index, 'Sintético']),
    ),
  }
  const batchSizes = []
  assert.equal(
    (
      await translateFormRecord(many, {
        translate: async (texts) => {
          batchSizes.push(texts.length)
          return texts.map(() => 'Synthetic')
        },
      })
    ).status,
    'ready',
  )
  assert.deepEqual(batchSizes, [50, 1])
  let partialCalls = 0
  const partial = await translateFormRecord(many, {
    translate: async (texts) => {
      if (++partialCalls === 2) throw new Error('Partial failure')
      return texts.map(() => 'Synthetic')
    },
  })
  assert.equal(partial.status, 'failed')
  assert.ok(partial.segments.every((segment) => segment.translated === ''))
  console.log(
    'Synthetic translation, repeat/matrix provenance, privacy exclusions, disabled/failure states and original immutability passed; adapter mocked.',
  )
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
