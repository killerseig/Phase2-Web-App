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
import { makeQuerySnapshot } from './helpers/firestoreMocks'


vi.mock('@/firebase', () => ({ db: {} }))

vi.mock('firebase/firestore', async () => (await import('./helpers/firestoreMocks')).createFirestoreMocks())

vi.mock('@/services/serviceGuards', () => ({
  assertJobAccess: vi.fn(),
  requireUser: vi.fn(() => ({ uid: 'user-1' })),
}))

type MockFn = ReturnType<typeof vi.fn>
const getDocsMock = getDocs as unknown as MockFn
const updateDocMock = updateDoc as unknown as MockFn

describe('JobRoster service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('falls back to client-side sort when composite index missing', async () => {
    getDocsMock
      .mockRejectedValueOnce(Object.assign(new Error('missing index'), { code: 'failed-precondition' }))
      .mockResolvedValueOnce(
        makeQuerySnapshot([
          { id: '1', data: { firstName: 'B', lastName: 'Z' } },
          { id: '2', data: { firstName: 'A', lastName: 'A' } },
        ])
      )

    const employees = await listRosterEmployees('job-1')

    expect(employees.map((e) => e.id)).toEqual(['2', '1'])
  })

  it('prevents duplicate employeeNumber on update', async () => {
    getDocsMock.mockResolvedValue(
      makeQuerySnapshot([
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
    listSpy.mockResolvedValue([
      {
        id: 'target',
        jobId: 'job-1',
        employeeNumber: '999',
        firstName: 'Jane',
        lastName: 'Doe',
        occupation: 'Foreman',
        active: true,
      },
    ])
    updateDocMock.mockResolvedValue(undefined)

    await updateRosterEmployee('job-1', 'target', { firstName: 'Jane' })

    const updateCall = updateDocMock.mock.calls[0]
    expect(updateCall).toBeDefined()
    const [, payload] = updateCall!
    expect(payload).toMatchObject({ firstName: 'Jane', updatedAt: 'ts' })
  })
})


