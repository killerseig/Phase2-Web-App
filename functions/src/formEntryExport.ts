import { strToU8, zipSync } from 'fflate'
import type { FormRecord, FormField } from './formModel'
export interface EntryAnswerRow {
  submissionId: string
  version: number
  submittedAt: number
  groupLabel: string
  groupId: string
  rowId: string
  fieldId: string
  label: string
  kind: string
  value: string
}
/** Traverse the immutable submitted definition, never today's editor draft. */
export function entryAnswerRows(record: FormRecord): EntryAnswerRow[] {
  const result: EntryAnswerRow[] = []
  function walk(
    fields: FormField[],
    answers: Record<string, unknown>,
    groupId = '',
    rowId = '',
    groupLabel = '',
  ) {
    for (const field of fields) {
      const shape = field as FormField & { fields?: FormField[]; children?: FormField[] }
      const value = answers[field.id]
      if (field.kind === 'matrix') {
        for (const [index, row] of (field.rows || []).entries()) {
          result.push({
            submissionId: record.id,
            version: record.templateVersion,
            submittedAt: record.submittedAt || 0,
            groupId,
            groupLabel,
            rowId,
            fieldId: field.id + '/' + row.id,
            label: field.label + ': ' + row.label,
            kind: 'matrix',
            value: Array.isArray(value) ? String(value[index] || '') : '',
          })
        }
      } else if (shape.fields || shape.children) {
        if (Array.isArray(value))
          value.forEach((row, index) => {
            if (row && typeof row === 'object') {
              const item = row as Record<string, unknown>
              walk(
                shape.fields || shape.children || [],
                (item.answers || item) as Record<string, unknown>,
                field.id,
                String(item.instanceId || item.id || index + 1),
                field.label,
              )
            }
          })
      } else
        result.push({
          submissionId: record.id,
          version: record.templateVersion,
          submittedAt: record.submittedAt || 0,
          groupId,
          groupLabel,
          rowId,
          fieldId: field.id,
          label: field.label,
          kind: field.kind,
          value: Array.isArray(value) ? value.join('; ') : value == null ? '' : String(value),
        })
    }
  }
  walk(record.definition.fields, record.answers)
  return result
}
export const entryExportHeaders = [
  'Submission ID',
  'Issued version',
  'Submitted at',
  'Group ID',
  'Original group question',
  'Site / row ID',
  'Field ID',
  'Original question',
  'Kind',
  'Answer',
]
export function entryExportCells(records: FormRecord[]): string[][] {
  return [
    entryExportHeaders,
    ...records
      .flatMap(entryAnswerRows)
      .map((row) => [
        row.submissionId,
        String(row.version),
        row.submittedAt ? new Date(row.submittedAt).toISOString() : '',
        row.groupId,
        row.groupLabel,
        row.rowId,
        row.fieldId,
        row.label,
        row.kind,
        row.value,
      ]),
  ]
}
/** Quoted CSV is insufficient to stop spreadsheet formulas; neutralize each cell. */
export function safeSpreadsheetCell(value: string): string {
  return /^[\s]*[=+@-]/.test(value) || /^[\t\r\n]/.test(value) ? "'" + value : value
}
export function entriesCsv(records: FormRecord[]): Buffer {
  return Buffer.from(
    '\ufeff' +
      entryExportCells(records)
        .map((row) =>
          row.map((value) => '"' + safeSpreadsheetCell(value).replace(/"/g, '""') + '"').join(','),
        )
        .join('\r\n'),
    'utf8',
  )
}
const xml = (value: string) =>
  value
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
export function entriesXlsx(records: FormRecord[]): Buffer {
  const files: Record<string, Uint8Array> = {}
  const add = (path: string, text: string) => {
    files[path] = strToU8(text)
  }
  add(
    '[Content_Types].xml',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
  )
  add(
    '_rels/.rels',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  )
  add(
    'xl/workbook.xml',
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Original answers" sheetId="1" r:id="rId1"/></sheets></workbook>',
  )
  add(
    'xl/_rels/workbook.xml.rels',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
  )
  add(
    'xl/worksheets/sheet1.xml',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
      entryExportCells(records)
        .map(
          (row, i) =>
            '<row r="' +
            (i + 1) +
            '">' +
            row
              .map(
                (cell, j) =>
                  '<c r="' +
                  String.fromCharCode(65 + j) +
                  (i + 1) +
                  '" t="inlineStr"><is><t xml:space="preserve">' +
                  xml(cell) +
                  '</t></is></c>',
              )
              .join('') +
            '</row>',
        )
        .join('') +
      '</sheetData></worksheet>',
  )
  return Buffer.from(zipSync(files))
}
