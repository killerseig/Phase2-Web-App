import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listRosterEmployees, updateRosterEmployee } from '@/services/JobRoster'
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import * as JobRoster from '@/services/JobRoster'

vi.mock('@/firebase', () => ({ db: {} }))

vi.mock('firebase/firestore', () => {
  const getDocs = vi.fn()
  const updateDoc = vi.fn()
  const deleteDoc = vi.fn()
  const orderBy = vi.fn((field: string, dir?: any) => ({ field, dir }))
  const collection = vi.fn((_db: any, path: string) => ({ path }))
  const doc = vi.fn((_db: any, path: string, id?: string) => ({ path, id }))
  const query = vi.fn((col: any, ...constraints: any[]) => ({ col, constraints }))
  const serverTimestamp = vi.fn(() => 'ts')
  return { getDocs, updateDoc, deleteDoc, orderBy, collection, doc, query, serverTimestamp }
})

vi.mock('@/services/serviceGuards', () => ({
  assertJobAccess: vi.fn(),
  requireUser: vi.fn(() => ({ uid: 'user-1' })),
}))

type MockFn = ReturnType<typeof vi.fn>
const getDocsMock = getDocs as unknown as MockFn
const updateDocMock = updateDoc as unknown as MockFn

const snap = (docs: Array<{ id: string; data: any }>) => ({
  docs: docs.map((d) => ({ id: d.id, data: () => d.data })),
})

describe('JobRoster service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('falls back to client-side sort when composite index missing', async () => {
    getDocsMock
      .mockRejectedValueOnce(Object.assign(new Error('missing index'), { code: 'failed-precondition' }))
      .mockResolvedValueOnce(
        snap([
          { id: '1', data: { firstName: 'B', lastName: 'Z' } },
          { id: '2', data: { firstName: 'A', lastName: 'A' } },
        ])
      )

    const employees = await listRosterEmployees('job-1')

    expect(employees.map((e) => e.id)).toEqual(['2', '1'])
  })

  it('prevents duplicate employeeNumber on update', async () => {
    getDocsMock.mockResolvedValue(
      snap([
        { id: 'existing', data: { employeeNumber: '123', lastName: 'Z', firstName: 'B' } },
        { id: 'target', data: { employeeNumber: '999', lastName: 'A', firstName: 'A' } },
      ])
    )

    await expect(updateRosterEmployee('job-1', 'target', { employeeNumber: '123' })).rejects.toThrow(
      /already exists/
    )
  })

  it('updates roster employee and stamps updatedAt', async () => {
    const listSpy = vi.spyOn(JobRoster, 'listRosterEmployees')
    listSpy.mockResolvedValue([{ id: 'target', employeeNumber: '999' } as any])
    updateDocMock.mockResolvedValue(undefined)

    await updateRosterEmployee('job-1', 'target', { firstName: 'Jane' })

    const [, payload] = updateDocMock.mock.calls[0]
    expect(payload).toMatchObject({ firstName: 'Jane', updatedAt: 'ts' })
  })
})
