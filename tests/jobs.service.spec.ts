import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  assignForemanToJob,
  createJob,
  listAllJobs,
  updateDailyLogRecipients,
} from '@/services/Jobs'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'

vi.mock('@/firebase', () => ({ db: {} }))

vi.mock('firebase/firestore', () => {
  const addDoc = vi.fn()
  const getDoc = vi.fn()
  const getDocs = vi.fn()
  const updateDoc = vi.fn()
  const deleteDoc = vi.fn()
  const orderBy = vi.fn((field: string, dir?: any) => ({ field, dir }))
  const where = vi.fn((field: string, op: any, value: any) => ({ field, op, value }))
  const collection = vi.fn((_db: any, path: string) => ({ path }))
  const doc = vi.fn((_db: any, path: string, id?: string) => ({ path, id }))
  const query = vi.fn((col: any, ...constraints: any[]) => ({ col, constraints }))
  const serverTimestamp = vi.fn(() => 'ts')

  return {
    addDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    orderBy,
    where,
    collection,
    doc,
    query,
    serverTimestamp,
  }
})

vi.mock('@/services/serviceGuards', () => ({
  assertJobAccess: vi.fn(),
}))

type MockFn = ReturnType<typeof vi.fn>
const addDocMock = addDoc as unknown as MockFn
const getDocMock = getDoc as unknown as MockFn
const getDocsMock = getDocs as unknown as MockFn
const updateDocMock = updateDoc as unknown as MockFn

const snap = (docs: Array<{ id: string; data: any }>) => ({
  docs: docs.map((d) => ({ id: d.id, data: () => d.data })),
})

describe('Jobs service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a job with trimmed fields and defaults', async () => {
    addDocMock.mockResolvedValue({ id: 'job-1' })

    const id = await createJob('  Alpha  ', { code: ' 123 ' })

    expect(id).toBe('job-1')
    const [, payload] = addDocMock.mock.calls[0]
    expect(payload).toMatchObject({
      name: 'Alpha',
      code: '123',
      type: 'general',
      active: true,
      timecardStatus: 'pending',
    })
    expect(serverTimestamp).toHaveBeenCalled()
  })

  it('filters archived jobs when includeArchived is false', async () => {
    getDocsMock.mockResolvedValue(
      snap([
        { id: 'a', data: { name: 'A', active: true } },
        { id: 'b', data: { name: 'B', active: false } },
      ])
    )

    const jobs = await listAllJobs(false)

    expect(jobs.map((j) => j.id)).toEqual(['a'])
  })

  it('assigns a foreman by updating unique list', async () => {
    getDocMock.mockResolvedValue({ exists: () => true, data: () => ({ assignedForemanIds: ['f1'] }) })
    updateDocMock.mockResolvedValue(undefined)

    await assignForemanToJob('job-1', 'f2')

    expect(updateDocMock).toHaveBeenCalledWith(expect.anything(), { assignedForemanIds: ['f1', 'f2'] })
  })

  it('updates daily log recipients', async () => {
    updateDocMock.mockResolvedValue(undefined)

    await updateDailyLogRecipients('job-1', ['a@example.com'])

    expect(updateDocMock).toHaveBeenCalledWith(expect.anything(), { dailyLogRecipients: ['a@example.com'] })
  })
})
