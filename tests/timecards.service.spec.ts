import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createTimecard,
  createTimecardFromCopy,
  submitTimecard,
  submitAllWeekTimecards,
  updateTimecard,
} from '@/services/Timecards'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { requireUser } from '@/services/serviceGuards'

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

vi.mock('@/utils/modelValidation', () => ({
  calculateWeekStartDate: vi.fn(() => '2024-01-01'),
}))

vi.mock('@/services/serviceGuards', () => ({
  assertJobAccess: vi.fn(),
  requireUser: vi.fn(),
}))

const addDocMock = addDoc as unknown as ReturnType<typeof vi.fn>
const getDocMock = getDoc as unknown as ReturnType<typeof vi.fn>
const getDocsMock = getDocs as unknown as ReturnType<typeof vi.fn>
const updateDocMock = updateDoc as unknown as ReturnType<typeof vi.fn>
const requireUserMock = requireUser as unknown as ReturnType<typeof vi.fn>

const snap = (docs: Array<{ id: string; data: any }>) => ({
  docs: docs.map((d) => ({ id: d.id, data: () => d.data })),
})

describe('Timecards service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireUserMock.mockReturnValue({ uid: 'u1' })
  })

  it('creates timecard with totals, weekStartDate, and timestamps', async () => {
    addDocMock.mockResolvedValue({ id: 'tc-1' })

    const id = await createTimecard('job-1', {
      weekEndingDate: '2024-02-10',
      employeeRosterId: 'er1',
      employeeNumber: '123',
      employeeName: 'Jane Doe',
      occupation: 'Foreman',
      notes: 'Hi',
      days: [
        { dayOfWeek: 0, hours: 1, production: 0, lineTotal: 0, date: '2024-02-04', unitCost: 0 },
        { dayOfWeek: 1, hours: 2, production: 0, lineTotal: 0, date: '2024-02-05', unitCost: 0 },
        { dayOfWeek: 2, hours: 0, production: 0, lineTotal: 0, date: '2024-02-06', unitCost: 0 },
        { dayOfWeek: 3, hours: 0, production: 0, lineTotal: 0, date: '2024-02-07', unitCost: 0 },
        { dayOfWeek: 4, hours: 0, production: 0, lineTotal: 0, date: '2024-02-08', unitCost: 0 },
        { dayOfWeek: 5, hours: 0, production: 0, lineTotal: 0, date: '2024-02-09', unitCost: 0 },
        { dayOfWeek: 6, hours: 0, production: 0, lineTotal: 0, date: '2024-02-10', unitCost: 0 },
      ],
    })

    expect(id).toBe('tc-1')
    const [, payload] = addDocMock.mock.calls[0]
    expect(payload).toMatchObject({
      jobId: 'job-1',
      weekStartDate: '2024-01-01',
      weekEndingDate: '2024-02-10',
      status: 'draft',
      uid: 'u1',
      createdByUid: 'u1',
    })
    expect(payload.totals.hoursTotal).toBe(3)
    expect(serverTimestamp).toHaveBeenCalled()
  })

  it('recalculates totals on updateTimecard when days change', async () => {
    updateDocMock.mockResolvedValue(undefined)

    await updateTimecard('job-1', 'tc-1', {
      days: [
        { dayOfWeek: 0, hours: 1, production: 2, lineTotal: 3, date: 'x', unitCost: 0 },
        { dayOfWeek: 1, hours: 4, production: 5, lineTotal: 6, date: 'y', unitCost: 0 },
        { dayOfWeek: 2, hours: 0, production: 0, lineTotal: 0, date: 'z', unitCost: 0 },
        { dayOfWeek: 3, hours: 0, production: 0, lineTotal: 0, date: 'z', unitCost: 0 },
        { dayOfWeek: 4, hours: 0, production: 0, lineTotal: 0, date: 'z', unitCost: 0 },
        { dayOfWeek: 5, hours: 0, production: 0, lineTotal: 0, date: 'z', unitCost: 0 },
        { dayOfWeek: 6, hours: 0, production: 0, lineTotal: 0, date: 'z', unitCost: 0 },
      ],
      notes: 'updated',
    })

    const [, payload] = updateDocMock.mock.calls[0]
    expect(payload.notes).toBe('updated')
    expect(payload.totals).toMatchObject({ hoursTotal: 5, productionTotal: 7, lineTotal: 9 })
    expect(payload.updatedAt).toBe('ts')
  })

  it('submits a timecard with status and timestamps', async () => {
    updateDocMock.mockResolvedValue(undefined)

    await submitTimecard('job-1', 'tc-1')

    const [, payload] = updateDocMock.mock.calls[0]
    expect(payload).toMatchObject({ status: 'submitted', submittedAt: 'ts', updatedAt: 'ts', uid: 'u1' })
  })

  it('submits only draft timecards for a week', async () => {
    // listTimecardsByJobAndWeek relies on getDocs; return one draft and one submitted
    getDocsMock.mockResolvedValueOnce(
      snap([
        { id: 'd1', data: { status: 'draft' } },
        { id: 's1', data: { status: 'submitted' } },
      ])
    )

    const count = await submitAllWeekTimecards('job-1', '2024-02-10')

    expect(count).toBe(1)
    expect(updateDocMock).toHaveBeenCalledTimes(1)
    const [, payload] = updateDocMock.mock.calls[0]
    expect(payload.status).toBe('submitted')
  })

  it('copies previous week metadata and resets day values', async () => {
    addDocMock.mockResolvedValue({ id: 'tc-copy-1' })

    const source = {
      id: 'old-1',
      jobId: 'job-1',
      weekStartDate: '2024-02-04',
      weekEndingDate: '2024-02-10',
      status: 'submitted',
      createdByUid: 'u1',
      employeeRosterId: 'er1',
      employeeNumber: '123',
      employeeName: 'Jane Doe',
      firstName: 'Jane',
      lastName: 'Doe',
      occupation: 'Foreman',
      employeeWage: 42.5,
      subcontractedEmployee: true,
      jobs: [
        {
          jobNumber: 'J-01',
          subsectionArea: 'A1',
          account: '4000',
          days: Array.from({ length: 7 }, (_, idx) => ({
            date: `2024-02-0${idx + 4}`,
            dayOfWeek: idx,
            hours: 8,
            production: 10,
            unitCost: 2.5,
            lineTotal: 25,
            notes: 'old',
          })),
        },
      ],
      days: Array.from({ length: 7 }, (_, idx) => ({
        date: `2024-02-0${idx + 4}`,
        dayOfWeek: idx,
        hours: 8,
        production: 10,
        unitCost: 0,
        lineTotal: 80,
        notes: 'old',
      })),
      totals: { hours: Array(7).fill(8), production: Array(7).fill(10), hoursTotal: 56, productionTotal: 70, lineTotal: 560 },
      notes: 'old note',
      archived: false,
    } as any

    const id = await createTimecardFromCopy('job-1', source, '2024-02-17')
    expect(id).toBe('tc-copy-1')

    const [, payload] = addDocMock.mock.calls[0]
    expect(payload).toMatchObject({
      employeeNumber: '123',
      employeeName: 'Jane Doe',
      firstName: 'Jane',
      lastName: 'Doe',
      employeeWage: 42.5,
      subcontractedEmployee: true,
      notes: '',
    })

    expect(payload.days).toHaveLength(7)
    expect(payload.days[0]).toMatchObject({ dayOfWeek: 0, hours: 0, production: 0, lineTotal: 0, notes: '' })

    expect(payload.jobs).toHaveLength(1)
    expect(payload.jobs[0]).toMatchObject({
      jobNumber: 'J-01',
      subsectionArea: 'A1',
      area: 'A1',
      account: '4000',
      acct: '4000',
    })
    expect(payload.jobs[0].days).toHaveLength(7)
    expect(payload.jobs[0].days[0]).toMatchObject({
      dayOfWeek: 0,
      hours: 0,
      production: 0,
      unitCost: 2.5,
      lineTotal: 0,
      notes: '',
    })
  })
})
