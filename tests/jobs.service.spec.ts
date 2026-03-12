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
import { makeQuerySnapshot } from './helpers/firestoreMocks'


vi.mock('@/firebase', () => ({ db: {} }))

vi.mock('firebase/firestore', async () => (await import('./helpers/firestoreMocks')).createFirestoreMocks())

vi.mock('@/services/serviceGuards', () => ({
  assertJobAccess: vi.fn(),
}))

type MockFn = ReturnType<typeof vi.fn>
const addDocMock = addDoc as unknown as MockFn
const getDocMock = getDoc as unknown as MockFn
const getDocsMock = getDocs as unknown as MockFn
const updateDocMock = updateDoc as unknown as MockFn

describe('Jobs service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a job with trimmed fields and defaults', async () => {
    addDocMock.mockResolvedValue({ id: 'job-1' })

    const id = await createJob('  Alpha  ', { code: ' 123 ' })

    expect(id).toBe('job-1')
    const addDocCall = addDocMock.mock.calls[0]
    expect(addDocCall).toBeDefined()
    const [, payload] = addDocCall!
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
      makeQuerySnapshot([
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


