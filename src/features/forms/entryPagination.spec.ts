// @vitest-environment node
import { expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({
  documents: [] as { id: string; data: () => Record<string, unknown> }[],
}))
vi.mock('../../../functions/src/runtime', () => ({
  db: {
    doc: (path: string) => ({
      get: async () => ({
        exists: true,
        data: () =>
          path.startsWith('users/')
            ? { role: 'admin', active: true }
            : { draft: {}, latestVersion: 0 },
      }),
    }),
    collection: () => {
      let after = '',
        limit = 0
      const query = {
        where: () => query,
        orderBy: () => query,
        limit: (value: number) => {
          limit = value
          return query
        },
        startAfter: (value: string) => {
          after = value
          return query
        },
        get: async () => ({
          docs: state.documents.filter((doc) => doc.id > after).slice(0, limit),
        }),
      }
      return query
    },
  },
}))
import { authorizeFormEntriesPage } from '../../../functions/src/formEntryAccess'
it('paginates more than 1,000 entries without duplication and excludes newer submissions from the snapshot', async () => {
  state.documents = Array.from({ length: 1105 }, (_, index) => {
    const id = 'entry' + String(index).padStart(5, '0')
    return {
      id,
      data: () => ({
        id,
        templateId: 'form1',
        ownerUid: 'owner',
        status: 'submitted',
        submittedAt: index === 1002 ? 3000 : 1000,
        definition: {},
      }),
    }
  })
  const ids: string[] = []
  let cursor: string | null = null
  let pages = 0
  do {
    const result = await authorizeFormEntriesPage('form1', 'admin', cursor, 2000)
    ids.push(...result.records.map((record) => record.id))
    cursor = result.nextCursor
    pages++
    expect(result.complete).toBe(cursor === null)
  } while (cursor)
  expect(pages).toBe(12)
  expect(ids).toHaveLength(1104)
  expect(new Set(ids).size).toBe(1104)
  expect(ids).not.toContain('entry01002')
})
it('rejects absent authentication and invalid cursors', async () => {
  await expect(authorizeFormEntriesPage('form1', undefined)).rejects.toThrow()
  await expect(authorizeFormEntriesPage('form1', 'admin', '../../private')).rejects.toThrow()
})
it('continues after a page containing no eligible submitted entries', async () => {
  state.documents = Array.from({ length: 101 }, (_, index) => {
    const id = 'entry' + String(index).padStart(5, '0')
    return {
      id,
      data: () => ({
        id,
        templateId: 'form1',
        ownerUid: 'owner',
        status: index < 100 ? 'draft' : 'submitted',
        submittedAt: 1000,
        definition: {},
      }),
    }
  })
  const first = await authorizeFormEntriesPage('form1', 'admin', null, 2000)
  expect(first.records).toEqual([])
  expect(first.nextCursor).toBe('entry00099')
  const final = await authorizeFormEntriesPage('form1', 'admin', first.nextCursor, 2000)
  expect(final.records.map((record) => record.id)).toEqual(['entry00100'])
  expect(final.complete).toBe(true)
})
import { collectAllEntryPages } from '../../../functions/src/formEntryPagination'
import { entriesCsv } from '../../../functions/src/formEntryExport'
import type { FormRecord } from '../../../functions/src/formModel'
it('merges a complete 1,105-entry export with original labels and versions', async () => {
  const records = Array.from(
    { length: 1105 },
    (_, index) =>
      ({
        id: 'export' + index,
        templateVersion: 2,
        ownerUid: 'owner',
        templateId: 'form1',
        revision: 1,
        status: 'submitted',
        createdAt: 0,
        updatedAt: 0,
        definition: {
          title: 'Original',
          description: '',
          recipients: [],
          version: 2,
          createdAt: '',
          fields: [
            {
              id: 'original',
              kind: 'text',
              label: 'Original deleted question',
              required: false,
              options: [],
            },
          ],
        },
        answers: { original: 'answer' + index },
      }) as FormRecord,
  )
  let calls = 0
  const result = await collectAllEntryPages(async (cursor, boundary) => {
    calls++
    const offset = Number(cursor || 0)
    const page = records.slice(offset, offset + 100)
    const next = offset + 100 < records.length ? String(offset + 100) : null
    return {
      records: page,
      nextCursor: next,
      snapshotBefore: boundary || 2000,
      complete: next === null,
    }
  }, 2000)
  expect(calls).toBe(12)
  expect(result).toHaveLength(1105)
  const csv = entriesCsv(result).toString()
  expect(csv).toContain('Original deleted question')
  expect(csv).toContain('export1104')
  expect(csv).toContain('answer1104')
})
it('fails all-export without returning partial results when record cap is exceeded', async () => {
  await expect(
    collectAllEntryPages(async () => ({
      records: Array.from({ length: 10001 }, () => ({ id: 'x' }) as FormRecord),
      nextCursor: null,
      snapshotBefore: 2000,
      complete: true,
    })),
  ).rejects.toThrow('10,000-entry')
})
