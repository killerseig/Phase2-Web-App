export interface IdentifiedRecord {
  id: string
}

export function replaceRecordById<TRecord extends IdentifiedRecord>(
  records: readonly TRecord[],
  replacement: TRecord,
) {
  const index = records.findIndex((record) => record.id === replacement.id)
  if (index === -1) return records.slice()

  const nextRecords = records.slice()
  nextRecords[index] = replacement
  return nextRecords
}

export function upsertRecordById<TRecord extends IdentifiedRecord>(
  records: readonly TRecord[],
  replacement: TRecord,
) {
  const index = records.findIndex((record) => record.id === replacement.id)
  if (index === -1) return [...records, replacement]

  const nextRecords = records.slice()
  nextRecords[index] = replacement
  return nextRecords
}

export function removeRecordById<TRecord extends IdentifiedRecord>(
  records: readonly TRecord[],
  recordId: string,
) {
  return records.filter((record) => record.id !== recordId)
}
