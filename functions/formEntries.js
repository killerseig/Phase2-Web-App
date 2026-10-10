"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formEntries = void 0;
const https_1 = require("firebase-functions/v2/https");
const formEntryAccess_1 = require("./formEntryAccess");
const formEntryExport_1 = require("./formEntryExport");
const formEntryPagination_1 = require("./formEntryPagination");
exports.formEntries = (0, https_1.onCall)({ timeoutSeconds: 120, memory: '512MiB' }, async (request) => {
    const { templateId, action, format, cursor, snapshotBefore } = request.data || {};
    if (!['list', 'export', 'export-all'].includes(action))
        throw new https_1.HttpsError('invalid-argument', 'Choose a supported entry action.');
    const page = await (0, formEntryAccess_1.authorizeFormEntriesPage)(templateId, request.auth?.uid, cursor, snapshotBefore);
    const records = action === 'export-all'
        ? await (0, formEntryPagination_1.collectAllEntryPages)((next, boundary) => (0, formEntryAccess_1.authorizeFormEntriesPage)(templateId, request.auth?.uid, next, boundary), page.snapshotBefore)
        : page.records;
    if (action === 'list')
        return {
            nextCursor: action === 'export-all' ? null : page.nextCursor,
            snapshotBefore: page.snapshotBefore,
            complete: action === 'export-all' || page.complete,
            entries: records.map((record) => ({
                id: record.id,
                title: record.definition.title,
                templateVersion: record.templateVersion,
                submittedAt: record.submittedAt,
                jobId: record.jobId || '',
            })),
        };
    if (!['csv', 'xlsx'].includes(format))
        throw new https_1.HttpsError('invalid-argument', 'Choose Excel or CSV.');
    const bytes = format === 'csv' ? (0, formEntryExport_1.entriesCsv)(records) : (0, formEntryExport_1.entriesXlsx)(records);
    if (bytes.length > 7 * 1024 * 1024)
        throw new https_1.HttpsError('resource-exhausted', 'The export exceeds the download size limit.');
    return {
        base64: bytes.toString('base64'),
        contentType: format === 'csv'
            ? 'text/csv;charset=utf-8'
            : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: 'form-entries-' + (action === 'export-all' ? 'all' : cursor || 'start') + '.' + format,
        nextCursor: action === 'export-all' ? null : page.nextCursor,
        snapshotBefore: page.snapshotBefore,
        complete: action === 'export-all' || page.complete,
        entryCount: records.length,
    };
});
//# sourceMappingURL=formEntries.js.map