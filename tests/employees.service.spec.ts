import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createEmployee,
  listEmployeesByJob,
} from '@/services/Employees'
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { makeQuerySnapshot } from './helpers/firestoreMocks'


vi.mock('@/firebase', () => ({ db: {} }))

vi.mock('firebase/firestore', async () => (await import('./helpers/firestoreMocks')).createFirestoreMocks())

const addDocMock = addDoc as unknown as ReturnType<typeof vi.fn>
const getDocsMock = getDocs as unknown as ReturnType<typeof vi.fn>

describe('Employees service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('falls back to client-side sort when index missing', async () => {
    getDocsMock
      .mockRejectedValueOnce(Object.assign(new Error('no index'), { code: 'failed-precondition' }))
      .mockResolvedValueOnce(
        makeQuerySnapshot([
          { id: '1', data: { lastName: 'Z', firstName: 'B' } },
          { id: '2', data: { lastName: 'A', firstName: 'A' } },
        ])
      )

    const employees = await listEmployeesByJob('job-1')

    expect(employees.map((e) => e.id)).toEqual(['2', '1'])
  })

  it('creates employee with timestamps and jobId', async () => {
    addDocMock.mockResolvedValue({ id: 'emp-1' })

    const id = await createEmployee('job-1', {
      firstName: 'A',
      lastName: 'B',
      employeeNumber: '123',
      occupation: 'Foreman',
      active: true,
    })

    expect(id).toBe('emp-1')
    const addDocCall = addDocMock.mock.calls[0]
    expect(addDocCall).toBeDefined()
    const [, payload] = addDocCall!
    expect(payload).toMatchObject({ jobId: 'job-1', firstName: 'A', lastName: 'B', employeeNumber: '123', occupation: 'Foreman' })
    expect(serverTimestamp).toHaveBeenCalled()
  })
})


