export type DirectoryStatusFilter = 'active' | 'inactive' | 'both'

export interface ActiveDirectoryRecord {
  active: boolean
}

export function matchesDirectoryStatus(record: ActiveDirectoryRecord, statusFilter: DirectoryStatusFilter) {
  if (statusFilter === 'both') return true
  return statusFilter === 'active' ? record.active : !record.active
}

export function normalizeDirectoryQuery(value: string) {
  return value.trim().toLowerCase()
}

export function matchesDirectoryQuery(query: string, values: Array<string | null | undefined>) {
  const normalizedQuery = normalizeDirectoryQuery(query)
  if (!normalizedQuery) return true

  return values.some((value) => (value ?? '').toLowerCase().includes(normalizedQuery))
}

export function filterDirectoryRecords<TRecord extends ActiveDirectoryRecord>(
  records: TRecord[],
  statusFilter: DirectoryStatusFilter,
  query: string,
  getSearchValues: (record: TRecord) => Array<string | null | undefined>,
) {
  const normalizedQuery = normalizeDirectoryQuery(query)

  return records.filter((record) => (
    matchesDirectoryStatus(record, statusFilter)
    && (!normalizedQuery || matchesDirectoryQuery(normalizedQuery, getSearchValues(record)))
  ))
}
