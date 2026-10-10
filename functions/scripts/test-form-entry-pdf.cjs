const assert = require('node:assert/strict')
const sharp = require('sharp')
const { PDFDocument, PDFName } = require('pdf-lib')
const { buildFormSubmissionPdf } = require('../formSubmissionPdf.js')
;(async () => {
  const photo = await sharp({
    create: { width: 40, height: 40, channels: 3, background: '#336699' },
  })
    .jpeg()
    .toBuffer()
  const child = {
    id: 'photos',
    label: 'Original stop photos',
    kind: 'photo',
    required: false,
    options: [],
  }
  const record = {
    id: 'test',
    templateVersion: 3,
    definition: {
      title: 'Historical report',
      description: '',
      fields: [
        {
          id: 'checks',
          kind: 'matrix',
          label: 'Original matrix questions',
          required: false,
          options: ['Yes', 'No'],
          rows: Array.from({ length: 30 }, (_, index) => ({
            id: 'row' + index,
            label:
              'Original safety question ' +
              index +
              ' about equipment, task conditions and protective measures at this site.',
          })),
        },
        { id: 'sites', kind: 'repeat', label: 'Visit stop', fields: [child] },
      ],
    },
    answers: {
      checks: Array.from({ length: 30 }, (_, index) => (index % 2 ? '' : 'Yes')),
      sites: [
        { instanceId: 'A', answers: { photos: ['photoA'] } },
        { instanceId: 'B', answers: { photos: ['photoB'] } },
      ],
    },
  }
  const pdf = await buildFormSubmissionPdf(record, [
    { contentId: 'entry-photo-photoA', contentBytes: photo.toString('base64') },
    { contentId: 'entry-photo-photoB', contentBytes: photo.toString('base64') },
  ])
  const doc = await PDFDocument.load(pdf)
  assert.ok(
    doc.getPageCount() >= 2,
    'Full original matrix rows must paginate legibly alongside photos',
  )
  let images = 0
  for (const page of doc.getPages()) {
    const resources = page.node.Resources()
    const objects = resources && resources.lookup(PDFName.of('XObject'))
    if (objects) images += objects.keys().length
  }
  assert.equal(images, 2, 'PDF must embed both private per-stop attachments')
  console.log(
    'PASS historical matrix+repeat-group PDF paginates and embeds both attached photos (' +
      pdf.length +
      ' bytes)',
  )
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
