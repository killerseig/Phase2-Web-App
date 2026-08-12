import { describe, expect, it } from 'vitest'

import {
  removeRecordById,
  replaceRecordById,
  upsertRecordById,
} from '@/utils/optimisticRecords'

interface TestRecord {
  id: string
  label: string
}

describe('optimistic record helpers', () => {
  it('replaces an existing record without changing list order', () => {
    const records: TestRecord[] = [
      { id: 'alpha', label: 'Alpha' },
      { id: 'bravo', label: 'Bravo' },
      { id: 'charlie', label: 'Charlie' },
    ]

    const nextRecords = replaceRecordById(records, { id: 'bravo', label: 'Updated Bravo' })

    expect(nextRecords).toEqual([
      { id: 'alpha', label: 'Alpha' },
      { id: 'bravo', label: 'Updated Bravo' },
      { id: 'charlie', label: 'Charlie' },
    ])
    expect(records[1]).toEqual({ id: 'bravo', label: 'Bravo' })
  })

  it('returns a shallow copy when replacing a missing record', () => {
    const records: TestRecord[] = [{ id: 'alpha', label: 'Alpha' }]

    const nextRecords = replaceRecordById(records, { id: 'missing', label: 'Missing' })

    expect(nextRecords).toEqual(records)
    expect(nextRecords).not.toBe(records)
  })

  it('upserts by replacing existing records and appending new records', () => {
    const records: TestRecord[] = [{ id: 'alpha', label: 'Alpha' }]

    expect(upsertRecordById(records, { id: 'alpha', label: 'Updated Alpha' })).toEqual([
      { id: 'alpha', label: 'Updated Alpha' },
    ])
    expect(upsertRecordById(records, { id: 'bravo', label: 'Bravo' })).toEqual([
      { id: 'alpha', label: 'Alpha' },
      { id: 'bravo', label: 'Bravo' },
    ])
  })

  it('removes matching records and leaves the original list untouched', () => {
    const records: TestRecord[] = [
      { id: 'alpha', label: 'Alpha' },
      { id: 'bravo', label: 'Bravo' },
    ]

    const nextRecords = removeRecordById(records, 'alpha')

    expect(nextRecords).toEqual([{ id: 'bravo', label: 'Bravo' }])
    expect(records).toEqual([
      { id: 'alpha', label: 'Alpha' },
      { id: 'bravo', label: 'Bravo' },
    ])
  })
})
