// @vitest-environment node
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { reportingStarter } from './reportingStarters'
import { validateFormDefinition, type FormRecord } from '../../../functions/src/formModel'
import { buildFormEmailHtml, buildFormEmailText } from '../../../functions/src/formEmailRender'
import { buildFormSubmissionPdf } from '../../../functions/src/formSubmissionPdf'
import { entryAnswerRows, entriesCsv, entriesXlsx } from '../../../functions/src/formEntryExport'
import { completedAnswers } from './completedAnswers'
import bbs from '../../../functions/src/behavior-based-safety-observation-native.json'
import visit from '../../../functions/src/general-site-visit-native.json'
const require = createRequire(import.meta.url)
const PDFDocument = require('../../../functions/node_modules/pdfkit')
const { PDFDocument: ParsedPdf } = require('../../../functions/node_modules/pdf-lib')
const { unzipSync, strFromU8 } = require('../../../functions/node_modules/fflate')
function record(): FormRecord {
  const definition = validateFormDefinition(reportingStarter('committee'))
  return {
    id: 'committee-output',
    ownerUid: 'owner',
    templateId: 'committee',
    templateVersion: 2,
    revision: 1,
    status: 'submitted',
    createdAt: 0,
    updatedAt: 1,
    submittedAt: 1,
    definition: { ...definition, version: 2, createdAt: '' },
    answers: {
      'committee-1': '2026-10-20',
      'committee-2': 'Synthetic site',
      // Stale answers cannot restore fields absent from the immutable definition.
      'committee-5': 'REMOVED_ASSISTANT',
      'committee-20': 'REMOVED_SIGNATURE',
      'committee-21': 'REMOVED_DATE',
    },
  }
}
const removed = ['Site Safety assistant', 'Signature', 'Date']
afterEach(() => vi.restoreAllMocks())
describe('corrected Committee completed output', () => {
  it('uses retained inspection date without removed fields in HTML and text', () => {
    const saved = record(),
      original = JSON.stringify(saved)
    const html = buildFormEmailHtml(saved),
      text = buildFormEmailText(saved)
    for (const output of [html, text]) {
      expect(output).toContain('Date of Inspection')
      expect(output).toContain('2026-10-20')
      expect(output).not.toMatch(/Site Safety assistant|Signature|REMOVED_/)
    }
    expect(text).not.toMatch(/^Date\s*:/m)
    expect(html).not.toMatch(/>Date<|>Date:</)
    expect(JSON.stringify(saved)).toBe(original)
    expect(saved.definition.output?.pdf).toBe(false)
  })
  it('generates a real PDF using corrected labels and ignores stale removed answers', async () => {
    const saved = record(),
      original = JSON.stringify(saved)
    // Observe actual PDFKit rendering calls without replacing PDF generation.
    const text = vi.spyOn(PDFDocument.prototype, 'text')
    const bytes = await buildFormSubmissionPdf(saved)
    expect((await ParsedPdf.load(bytes)).getPageCount()).toBeGreaterThan(0)
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false })
    const pdf = await task.promise
    let extracted = ''
    try {
      for (let index = 1; index <= pdf.numPages; index++) {
        const content = await (await pdf.getPage(index)).getTextContent()
        extracted += content.items.map((item) => ('str' in item ? item.str : '')).join('\n') + '\n'
      }
    } finally {
      await task.destroy()
    }
    expect(extracted).toContain('Date of Inspection')
    expect(extracted).toContain('2026-10-20')
    expect(extracted).not.toMatch(/Site Safety assistant|Signature|REMOVED_/)
    expect(extracted).not.toMatch(/^Date$/m)
    const rendered = text.mock.calls.map((call) => String(call[0]))
    expect(rendered).toContain('Date of Inspection')
    expect(rendered).toContain('2026-10-20')
    for (const label of removed) expect(rendered).not.toContain(label)
    expect(rendered.join('\n')).not.toContain('REMOVED_')
    expect(JSON.stringify(saved)).toBe(original)
  })
  it('exports corrected immutable questions consistently in completed rows, CSV and XLSX', () => {
    const saved = record(),
      original = JSON.stringify(saved),
      rows = entryAnswerRows(saved)
    const labels = rows.map((row) => row.label)
    expect(labels).toEqual(saved.definition.fields.map((field) => field.label))
    expect(
      completedAnswers(saved.definition.fields, saved.answers).map((row) => row.label),
    ).toEqual(labels)
    expect(rows.find((row) => row.label === 'Date of Inspection')?.value).toBe('2026-10-20')
    for (const label of removed) expect(labels).not.toContain(label)
    expect(rows.every((row) => row.version === 2)).toBe(true)
    const csv = entriesCsv([saved]).toString()
    const xlsx = strFromU8(unzipSync(entriesXlsx([saved]))['xl/worksheets/sheet1.xml'])
    for (const output of [csv, xlsx]) {
      expect(output).toContain('Date of Inspection')
      expect(output).toContain('2026-10-20')
      expect(output).not.toMatch(/Site Safety assistant|Signature|REMOVED_/)
    }
    expect(csv).not.toMatch(/,"?Date"?,/)
    expect(xlsx).not.toContain('>Date<')
    expect(JSON.stringify(saved)).toBe(original)
  })
})
describe('unchanged companion content', () => {
  // Full-definition fingerprints pinned to the verified October 14 source.
  for (const [kind, source, hash] of [
    ['bbs', bbs, '21fed8eb68e17ccfb97da7eb164c466a4d79df0fe43bebfe4129b7b9ca525c9b'],
    ['general-visit', visit, '64106293b225f8e19e0813b135354a8638e465ae77ec2ce3d5917c7df40c0ab9'],
  ] as const)
    it(kind + ' retains all source content and adds only delivery controls', () => {
      expect(createHash('sha256').update(JSON.stringify(source)).digest('hex')).toBe(hash)
      const draft = reportingStarter(kind)
      expect(draft.title).toBe(source.title)
      expect(draft.description).toBe(source.description)
      expect(draft.fields.slice(0, -1)).toEqual(source.fields)
      expect(draft.access).toEqual(source.access)
      expect(draft.recipients).toEqual(source.recipients)
      expect(draft.fields.at(-1)?.kind).toBe('recipients')
      expect(draft.output?.pdf).toBe(false)
    })
})
