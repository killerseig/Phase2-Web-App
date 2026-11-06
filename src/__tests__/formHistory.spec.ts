import { describe, expect, it, vi } from 'vitest'
import { loadFormHistory } from '@/features/forms/formHistory'
import type { FormRecord } from '../../functions/src/formModel'

const record = (index: number) =>
  ({
    id: String(index).padStart(3, '0'),
    updatedAt: index,
  }) as FormRecord

describe('scoped form history', () => {
  it('loads beyond 100 records and orders newest first', async () => {
    const fetch = vi.fn<Parameters<typeof loadFormHistory>[0]>()
    fetch
      .mockResolvedValueOnce({
        records: Array.from({ length: 100 }, (_, i) => record(i)),
        nextCursor: '099',
      })
      .mockResolvedValueOnce({ records: [record(100), record(101)], nextCursor: null })
    const result = await loadFormHistory(fetch, () => true)
    expect(result).toHaveLength(102)
    expect(result[0]?.id).toBe('101')
    expect(fetch).toHaveBeenNthCalledWith(2, '099')
  })
  it('continues through an empty authorization-filtered page', async () => {
    const fetch = vi.fn<Parameters<typeof loadFormHistory>[0]>()
    fetch
      .mockResolvedValueOnce({ records: [], nextCursor: '099' })
      .mockResolvedValueOnce({ records: [record(100)] })
    expect(await loadFormHistory(fetch, () => true)).toEqual([record(100)])
  })
  it('stops stale requests after navigation without fetching another page', async () => {
    const fetch = vi
      .fn<Parameters<typeof loadFormHistory>[0]>()
      .mockResolvedValue({ records: [record(1)], nextCursor: '099' })
    expect(await loadFormHistory(fetch, () => false)).toEqual([])
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('accepts an older backend response without a cursor', async () => {
    expect(
      await loadFormHistory(
        async () => ({ records: [record(1)] }),
        () => true,
      ),
    ).toEqual([record(1)])
  })
  it('rejects a nonadvancing cursor instead of looping', async () => {
    await expect(
      loadFormHistory(
        async () => ({ records: [], nextCursor: '099' }),
        () => true,
      ),
    ).rejects.toThrow('Please reload')
  })
})
