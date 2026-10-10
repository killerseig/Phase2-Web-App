const assert = require('node:assert/strict')
const { buildFormEmailHtml, buildFormEmailText } = require('../formEmailRender')
const field = (id, kind, label) => ({ id, kind, label, required: false, options: [] })
const record = {
  id: 'entry',
  ownerUid: 'owner',
  templateId: 'template',
  templateVersion: 4,
  definition: {
    title: 'Site visits',
    description: '',
    version: 4,
    recipients: [],
    fields: [
      {
        ...field('stops', 'repeat', 'Site stop'),
        fields: [
          field('site', 'text', 'Original site question'),
          field('photos', 'photo', 'Site photos'),
        ],
      },
    ],
  },
  answers: {
    stops: [
      { instanceId: 'one', answers: { site: 'First <site>', photos: ['asset-one'] } },
      { instanceId: 'two', answers: { site: 'Second site', photos: ['asset-two'] } },
    ],
  },
}
const previews = [
  {
    fieldId: 'photos',
    groupId: 'stops',
    instanceId: 'one',
    position: 1,
    contentId: 'entry-photo-asset-one',
  },
  {
    fieldId: 'photos',
    groupId: 'stops',
    instanceId: 'two',
    position: 1,
    contentId: 'entry-photo-asset-two',
  },
  { fieldId: 'photos', groupId: 'other', instanceId: 'one', position: 1, contentId: 'WRONG-GROUP' },
]
const html = buildFormEmailHtml(record, previews)
assert.match(html, /First &lt;site&gt;/)
assert.match(html, /Original site question/)
assert.equal(html.split('cid:entry-photo-asset-one').length, 2)
assert.equal(html.split('cid:entry-photo-asset-two').length, 2)
assert.ok(html.indexOf('cid:entry-photo-asset-one') < html.indexOf('Site stop 2'))
assert.ok(html.indexOf('cid:entry-photo-asset-two') > html.indexOf('Site stop 2'))
assert.ok(!html.includes('WRONG-GROUP'))
const text = buildFormEmailText(record)
assert.match(text, /Site stop 1: Original site question: First <site>/)
assert.match(text, /Site stop 2: Original site question: Second site/)
record.definition.output = { pdf: true, requireLogin: false, template: '{{stops}}' }
assert.match(buildFormEmailHtml(record, previews), /cid:entry-photo-asset-two/)
console.log('Repeated form email rendering passed; no email or network operations.')

// Preparation must reject a storage asset attached to the wrong repeat instance.
require.cache[require.resolve('../runtime')] = { exports: {db: {}, storageBucket: {}} }
const { prepareFormEmail } = require('../formEmailContent')
const sharp = require('sharp')
;(async () => {
  record.definition.output.pdf = false
  const jpeg = await sharp({create: {width: 8, height: 8, channels: 3, background: '#fff'}}).jpeg().toBuffer()
  const downloads = []
  const result = await prepareFormEmail(record, ['review@example.test'], {
    loadAsset: async id => ({recordId: 'entry', ownerUid: 'owner', fieldId: 'photos', groupId: 'stops', instanceId: 'one', path: `form-photos/entry/${id}.webp`}),
    download: async path => {downloads.push(path); return jpeg},
    ownerEmail: async () => 'owner@example.test',
    appBaseUrl: () => 'https://example.test',
  })
  assert.deepEqual(downloads, ['form-photos/entry/asset-one.webp'])
  assert.match(result.html, /cid:entry-photo-asset-one/)
  assert.ok(!result.html.includes('cid:entry-photo-asset-two'))
  console.log('Repeat photo ownership preparation passed; storage and delivery were stubbed.')
})().catch(error => {console.error(error); process.exitCode = 1})
