import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createDailyLog,
  listDailyLogsForDate,
  submitDailyLog,
  type DailyLogDraftInput,
  updateDailyLog,
} from '@/services/DailyLogs'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { requireUser } from '@/services/serviceGuards'
import { makeQuerySnapshot } from './helpers/firestoreMocks'


vi.mock('@/firebase', () => ({ db: {} }))

vi.mock('firebase/firestore', async () => (await import('./helpers/firestoreMocks')).createFirestoreMocks())

vi.mock('@/services/serviceGuards', () => ({
  assertJobAccess: vi.fn(),
  requireUser: vi.fn(),
}))

type MockFn = ReturnType<typeof vi.fn>
const addDocMock = addDoc as unknown as MockFn
const getDocsMock = getDocs as unknown as MockFn
const getDocMock = getDoc as unknown as MockFn
const updateDocMock = updateDoc as unknown as MockFn
const requireUserMock = requireUser as unknown as MockFn

const baseDraft: DailyLogDraftInput = {
  jobSiteNumbers: '',
  foremanOnSite: '',
  siteForemanAssistant: '',
  projectName: 'Project X',
  manpower: '',
  weeklySchedule: '',
  manpowerAssessment: '',
  manpowerLines: [],
  safetyConcerns: '',
  ahaReviewed: '',
  scheduleConcerns: '',
  budgetConcerns: '',
  deliveriesReceived: '',
  deliveriesNeeded: '',
  newWorkAuthorizations: '',
  qcInspection: '',
  notesCorrespondence: '',
  actionItems: '',
  attachments: [],
}

describe('DailyLogs service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireUserMock.mockReturnValue({ uid: 'user-1' })
  })

  it('merges submitted and draft logs for a date with correct ordering', async () => {
    getDocsMock
      .mockResolvedValueOnce(
        makeQuerySnapshot([
          {
            id: 'submitted-1',
            data: {
              logDate: '2024-01-01',
              status: 'submitted',
              submittedAt: { toMillis: () => 200 },
              updatedAt: null,
              createdAt: null,
              uid: 'user-1',
            },
          },
        ])
      )
      .mockResolvedValueOnce(
        makeQuerySnapshot([
          {
            id: 'draft-1',
            data: {
              logDate: '2024-01-01',
              status: 'draft',
              submittedAt: null,
              updatedAt: { toMillis: () => 300 },
              createdAt: null,
              uid: 'user-1',
            },
          },
        ])
      )

    const result = await listDailyLogsForDate('job-1', '2024-01-01')

    expect(result.map((r) => r.id)).toEqual(['submitted-1', 'draft-1'])
    expect(getDocsMock).toHaveBeenCalledTimes(2)
  })

  it('creates a daily log with draft defaults', async () => {
    addDocMock.mockResolvedValue({ id: 'new-log' })

    const newId = await createDailyLog('job-1', '2024-02-01', baseDraft)

    expect(newId).toBe('new-log')
    const addDocCall = addDocMock.mock.calls[0]
    expect(addDocCall).toBeDefined()
    const [, payload] = addDocCall!
    expect(payload).toMatchObject({
      jobId: 'job-1',
      uid: 'user-1',
      status: 'draft',
      logDate: '2024-02-01',
      submittedAt: null,
    })
    expect(serverTimestamp).toHaveBeenCalled()
  })

  it('updates a daily log and stamps updatedAt', async () => {
    updateDocMock.mockResolvedValue(undefined)

    await updateDailyLog('job-1', 'log-1', { notesCorrespondence: 'Updated' })

    expect(updateDocMock).toHaveBeenCalledTimes(1)
    const updateCall = updateDocMock.mock.calls[0]
    expect(updateCall).toBeDefined()
    const [, updates] = updateCall!
    expect(updates).toMatchObject({ notesCorrespondence: 'Updated', updatedAt: 'ts' })
  })

  it('submits a daily log and sets submittedAt', async () => {
    getDocMock.mockResolvedValue({ exists: () => true, data: () => ({}) })
    updateDocMock.mockResolvedValue(undefined)

    await submitDailyLog('job-1', 'log-1')

    expect(updateDocMock).toHaveBeenCalledTimes(1)
    const updateCall = updateDocMock.mock.calls[0]
    expect(updateCall).toBeDefined()
    const [, updates] = updateCall!
    expect(updates).toMatchObject({ status: 'submitted', submittedAt: 'ts', updatedAt: 'ts' })
  })
})


