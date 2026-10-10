"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.entryExportHeaders = void 0;
exports.entryAnswerRows = entryAnswerRows;
exports.entryExportCells = entryExportCells;
exports.safeSpreadsheetCell = safeSpreadsheetCell;
exports.entriesCsv = entriesCsv;
exports.entriesXlsx = entriesXlsx;
const fflate_1 = require("fflate");
/** Traverse the immutable submitted definition, never today's editor draft. */
function entryAnswerRows(record) {
    const result = [];
    function walk(fields, answers, groupId = '', rowId = '', groupLabel = '') {
        for (const field of fields) {
            const shape = field;
            const value = answers[field.id];
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
                    });
                }
            }
            else if (shape.fields || shape.children) {
                if (Array.isArray(value))
                    value.forEach((row, index) => {
                        if (row && typeof row === 'object') {
                            const item = row;
                            walk(shape.fields || shape.children || [], (item.answers || item), field.id, String(item.instanceId || item.id || index + 1), field.label);
                        }
                    });
            }
            else
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
                });
        }
    }
    walk(record.definition.fields, record.answers);
    return result;
}
exports.entryExportHeaders = [
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
];
function entryExportCells(records) {
    return [
        exports.entryExportHeaders,
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
    ];
}
/** Quoted CSV is insufficient to stop spreadsheet formulas; neutralize each cell. */
function safeSpreadsheetCell(value) {
    return /^[\s]*[=+@-]/.test(value) || /^[\t\r\n]/.test(value) ? "'" + value : value;
}
function entriesCsv(records) {
    return Buffer.from('\ufeff' +
        entryExportCells(records)
            .map((row) => row.map((value) => '"' + safeSpreadsheetCell(value).replace(/"/g, '""') + '"').join(','))
            .join('\r\n'), 'utf8');
}
const xml = (value) => value
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
function entriesXlsx(records) {
    const files = {};
    const add = (path, text) => {
        files[path] = (0, fflate_1.strToU8)(text);
    };
    add('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
    add('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
    add('xl/workbook.xml', '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Original answers" sheetId="1" r:id="rId1"/></sheets></workbook>');
    add('xl/_rels/workbook.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
    add('xl/worksheets/sheet1.xml', '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
        entryExportCells(records)
            .map((row, i) => '<row r="' +
            (i + 1) +
            '">' +
            row
                .map((cell, j) => '<c r="' +
                String.fromCharCode(65 + j) +
                (i + 1) +
                '" t="inlineStr"><is><t xml:space="preserve">' +
                xml(cell) +
                '</t></is></c>')
                .join('') +
            '</row>')
            .join('') +
        '</sheetData></worksheet>');
    return Buffer.from((0, fflate_1.zipSync)(files));
}
//# sourceMappingURL=formEntryExport.js.map