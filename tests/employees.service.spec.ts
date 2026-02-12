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

vi.mock('@/firebase', () => ({ db: {} }))

vi.mock('firebase/firestore', () => {
  const addDoc = vi.fn()
  const getDocs = vi.fn()
  const orderBy = vi.fn((field: string, dir?: any) => ({ field, dir }))
  const where = vi.fn((field: string, op: any, value: any) => ({ field, op, value }))
  const collection = vi.fn((_db: any, path: string) => ({ path }))
  const query = vi.fn((col: any, ...constraints: any[]) => ({ col, constraints }))
  const serverTimestamp = vi.fn(() => 'ts')

  return { addDoc, getDocs, orderBy, where, collection, query, serverTimestamp }
})

const addDocMock = addDoc as unknown as ReturnType<typeof vi.fn>
const getDocsMock = getDocs as unknown as ReturnType<typeof vi.fn>

const snap = (docs: Array<{ id: string; data: any }>) => ({
  docs: docs.map((d) => ({ id: d.id, data: () => d.data })),
})

describe('Employees service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('falls back to client-side sort when index missing', async () => {
    getDocsMock
      .mockRejectedValueOnce(Object.assign(new Error('no index'), { code: 'failed-precondition' }))
      .mockResolvedValueOnce(
        snap([
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
    const [, payload] = addDocMock.mock.calls[0]
    expect(payload).toMatchObject({ jobId: 'job-1', firstName: 'A', lastName: 'B', employeeNumber: '123', occupation: 'Foreman' })
    expect(serverTimestamp).toHaveBeenCalled()
  })
})
