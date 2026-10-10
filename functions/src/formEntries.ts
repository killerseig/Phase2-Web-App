import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { authorizeFormEntriesPage } from './formEntryAccess'
import { entriesCsv, entriesXlsx } from './formEntryExport'
import { collectAllEntryPages } from './formEntryPagination'
export const formEntries = onCall({ timeoutSeconds: 120, memory: '512MiB' }, async (request) => {
  const { templateId, action, format, cursor, snapshotBefore } = request.data || {}
  if (!['list', 'export', 'export-all'].includes(action))
    throw new HttpsError('invalid-argument', 'Choose a supported entry action.')
  const page = await authorizeFormEntriesPage(templateId, request.auth?.uid, cursor, snapshotBefore)
  const records =
    action === 'export-all'
      ? await collectAllEntryPages(
          (next, boundary) =>
            authorizeFormEntriesPage(templateId, request.auth?.uid, next, boundary),
          page.snapshotBefore,
        )
      : page.records
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
    }
  if (!['csv', 'xlsx'].includes(format))
    throw new HttpsError('invalid-argument', 'Choose Excel or CSV.')
  const bytes = format === 'csv' ? entriesCsv(records) : entriesXlsx(records)
  if (bytes.length > 7 * 1024 * 1024)
    throw new HttpsError('resource-exhausted', 'The export exceeds the download size limit.')
  return {
    base64: bytes.toString('base64'),
    contentType:
      format === 'csv'
        ? 'text/csv;charset=utf-8'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename:
      'form-entries-' + (action === 'export-all' ? 'all' : cursor || 'start') + '.' + format,
    nextCursor: action === 'export-all' ? null : page.nextCursor,
    snapshotBefore: page.snapshotBefore,
    complete: action === 'export-all' || page.complete,
    entryCount: records.length,
  }
})
