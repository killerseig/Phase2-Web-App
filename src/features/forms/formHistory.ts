import type { FormRecord } from '../../../functions/src/formModel'

export interface FormHistoryPage {
  records: FormRecord[]
  // Optional for compatibility with the previous callable response.
  nextCursor?: string | null
}

export async function loadFormHistory(
  fetchPage: (cursor?: string) => Promise<FormHistoryPage>,
  isCurrent: () => boolean,
): Promise<FormRecord[]> {
  const records = new Map<string, FormRecord>()
  let cursor: string | undefined
  do {
    const page = await fetchPage(cursor)
    if (!isCurrent()) return []
    for (const record of page.records) records.set(record.id, record)
    if (page.nextCursor && cursor && page.nextCursor <= cursor)
      throw new Error('Saved records could not finish loading. Please reload.')
    cursor = page.nextCursor || undefined
  } while (cursor)
  return [...records.values()].sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))
}
