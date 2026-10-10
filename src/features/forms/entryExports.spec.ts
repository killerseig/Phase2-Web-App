// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { unzipSync, strFromU8 } from '../../../functions/node_modules/fflate'
import {
  entryAnswerRows,
  entriesCsv,
  entriesXlsx,
  safeSpreadsheetCell,
} from '../../../functions/src/formEntryExport'
import type { FormRecord } from '../../../functions/src/formModel'
import { completedAnswers } from './completedAnswers'
const record: FormRecord = {
  id: 'entry1',
  ownerUid: 'owner',
  templateId: 'form1',
  templateVersion: 2,
  revision: 1,
  status: 'submitted',
  createdAt: 0,
  updatedAt: 0,
  submittedAt: 1000,
  definition: {
    title: 'Original form',
    description: '',
    recipients: [],
    version: 2,
    createdAt: '',
    fields: [
      { id: 'old', label: 'Deleted original question', kind: 'text', required: false, options: [] },
      {
        id: 'sites',
        label: 'Site',
        kind: 'repeat',
        required: false,
        options: [],
        fields: [
          { id: 'name', label: 'Original site name', kind: 'text', required: false, options: [] },
          { id: 'photos', label: 'Site photos', kind: 'photo', required: false, options: [] },
        ],
      },
    ],
  },
  answers: {
    old: '=HYPERLINK("https://attacker")',
    sites: [
      { instanceId: 'stopA', answers: { name: 'North', photos: ['photoA'] } },
      { instanceId: 'stopB', answers: { name: 'South', photos: ['photoB'] } },
    ],
  },
}
describe('historical entry exports', () => {
  it('retains original labels, versions, stable stop IDs and photo associations', () => {
    const rows = entryAnswerRows(record)
    expect(rows[0]?.label).toBe('Deleted original question')
    expect(rows.map((row) => row.version)).toEqual([2, 2, 2, 2, 2])
    expect(rows.find((row) => row.value === 'photoB')?.rowId).toBe('stopB')
    expect(
      completedAnswers(record.definition.fields, record.answers).find(
        (row) => row.photos[0] === 'photoB',
      )?.group,
    ).toBe('Site 2')
  })
  it('neutralizes executable CSV cells even with leading whitespace', () => {
    expect(safeSpreadsheetCell('  =1+2')).toBe("'  =1+2")
    expect(entriesCsv([record]).toString()).toContain("'=HYPERLINK")
  })
  it('produces genuine Excel package with strings instead of formulas', () => {
    const files = unzipSync(entriesXlsx([record]))
    const sheet = strFromU8(files['xl/worksheets/sheet1.xml']!)
    expect(sheet).toContain('Deleted original question')
    expect(sheet).toContain('stopB')
    expect(sheet).toContain('t="inlineStr"')
    expect(sheet).not.toContain('<f>')
    expect(files['[Content_Types].xml']).toBeDefined()
  })
})
it('exports matrix rows by immutable original row IDs/labels and keeps optional blanks', () => {
  const matrixRecord: FormRecord = {
    ...record,
    definition: {
      ...record.definition,
      fields: [
        {
          id: 'safety',
          kind: 'matrix',
          label: 'Original safety checks',
          required: false,
          options: ['Yes', 'No'],
          rows: [
            { id: 'tools', label: 'Original tools condition?' },
            { id: 'training', label: 'Original training complete?' },
          ],
        },
      ],
    },
    answers: { safety: ['Yes', ''] },
  }
  const rows = entryAnswerRows(matrixRecord)
  expect(rows.map((row) => row.fieldId)).toEqual(['safety/tools', 'safety/training'])
  expect(rows.map((row) => row.label)).toEqual([
    'Original safety checks: Original tools condition?',
    'Original safety checks: Original training complete?',
  ])
  expect(rows.map((row) => row.value)).toEqual(['Yes', ''])
  const details = completedAnswers(matrixRecord.definition.fields, matrixRecord.answers)
  expect(details.map((row) => row.key)).toEqual(['safety/tools', 'safety/training'])
  expect(details[1]?.value).toBe('Not provided')
  expect(entriesCsv([matrixRecord]).toString()).toContain('Original training complete?')
  expect(strFromU8(unzipSync(entriesXlsx([matrixRecord]))['xl/worksheets/sheet1.xml']!)).toContain(
    'safety/training',
  )
})
