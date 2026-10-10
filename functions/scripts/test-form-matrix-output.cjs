const assert = require('node:assert/strict')
const { buildFormEmailHtml, buildFormEmailText } = require('../formEmailRender')
const { buildFormSubmissionPdf } = require('../formSubmissionPdf')
const { formAnswerSummary } = require('../formModel')
const matrix = {
  id: 'assessment',
  kind: 'matrix',
  label: 'Original assessment',
  required: false,
  options: ['Safe', 'At risk', 'Not observed'],
  rows: [
    { id: 'tools', label: 'Original tools <question>' },
    { id: 'ppe', label: 'Original PPE question' },
    { id: 'access', label: 'Original access question' },
  ],
}
const record = {
  id: 'matrix-entry',
  ownerUid: 'owner',
  templateId: 'matrix-template',
  templateVersion: 2,
  definition: {
    title: 'Observation',
    description: '',
    version: 2,
    recipients: [],
    fields: [matrix],
  },
  answers: { assessment: ['At risk', '', 'Safe'] },
}
const summary = formAnswerSummary(matrix, record.answers.assessment)
assert.match(summary, /Original tools <question>: At risk/)
assert.match(summary, /Original PPE question: Not provided/)
assert.match(summary, /Original access question: Safe/)
assert.ok(summary.indexOf('tools') < summary.indexOf('PPE'))
assert.ok(summary.indexOf('PPE') < summary.indexOf('access'))
for (const custom of [false, true]) {
  record.definition.output = {
    requireLogin: false,
    pdf: true,
    template: custom ? '{{assessment}}' : '',
  }
  const html = buildFormEmailHtml(record)
  assert.match(html, /Original tools &lt;question&gt;: At risk/)
  assert.match(html, /Original PPE question: Not provided/)
  assert.match(html, /Original access question: Safe/)
  const text = buildFormEmailText(record)
  assert.match(text, /Original tools <question>: At risk/)
  assert.match(text, /Original PPE question: Not provided/)
}
;(async () => {
  const pdf = await buildFormSubmissionPdf(record)
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF')
  assert.ok(pdf.length > 1000)
  console.log(
    'Matrix original labels, ordered selections, blank row, template outputs and PDF generation passed; no delivery operations.',
  )
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
