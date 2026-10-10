import { HttpsError } from 'firebase-functions/v2/https'
import type { FormRecord } from './formModel'
import type { FormEntryPage } from './formEntryAccess'
/** Fail atomically instead of returning a partial all-entry export. Every page reauthorizes. */
export async function collectAllEntryPages(
  fetchPage: (cursor: string | null, snapshotBefore?: number) => Promise<FormEntryPage>,
  snapshotBefore?: number,
): Promise<FormRecord[]> {
  const records: FormRecord[] = []
  let cursor: string | null = null
  let pages = 0
  let bytes = 0
  const started = Date.now()
  do {
    if (++pages > 100 || Date.now() - started > 90000)
      throw new HttpsError(
        'resource-exhausted',
        'All-entry export exceeds the scan/time limit. Download page ranges instead.',
      )
    const page = await fetchPage(cursor, snapshotBefore)
    snapshotBefore = page.snapshotBefore
    for (const record of page.records) {
      bytes += Buffer.byteLength(JSON.stringify(record))
      records.push(record)
    }
    if (records.length > 10000 || bytes > 32 * 1024 * 1024)
      throw new HttpsError(
        'resource-exhausted',
        'All-entry export exceeds the 10,000-entry or memory limit. Download page ranges instead.',
      )
    if (page.nextCursor === cursor && page.nextCursor !== null)
      throw new HttpsError('internal', 'Entry pagination did not advance.')
    cursor = page.nextCursor
  } while (cursor)
  return records
}
