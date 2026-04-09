import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createTimecard,
  createTimecardForRosterEmployee,
  createTimecardFromCopy,
  ensureWeekTimecardsForActiveRoster,
  exportAllSubmittedTimecardsToCsv,
  exportTimecardsToCsv,
  listTimecardsByJobAndWeek,
  listWorkspaceTimecardsByJobAndWeek,
  submitTimecard,
  submitAllWeekTimecards,
  updateTimecard,
} from '@/services/Timecards'
import type { Timecard } from '@/types/models'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { ROLES } from '@/constants/app'
import { requireUser } from '@/services/serviceGuards'
import { makeQuerySnapshot } from './helpers/firestoreMocks'
import { useAuthStore } from '@/stores/auth'


vi.mock('@/firebase', () => ({ db: {} }))

vi.mock('firebase/firestore', async () => (await import('./helpers/firestoreMocks')).createFirestoreMocks())

vi.mock('@/utils/modelValidation', () => ({
  calculateWeekStartDate: vi.fn(() => '2024-01-01'),
}))

vi.mock('@/services/serviceGuards', () => ({
  assertJobAccess: vi.fn(),
  requireUser: vi.fn(),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(),
}))

vi.mock('@/services/JobRoster', () => ({
  listActiveRosterEmployees: listActiveRosterEmployeesMock,
}))

vi.mock('@/services/Jobs', () => ({
  getJob: getJobMock,
}))

const addDocMock = addDoc as unknown as ReturnType<typeof vi.fn>
const getDocMock = getDoc as unknown as ReturnType<typeof vi.fn>
const getDocsMock = getDocs as unknown as ReturnType<typeof vi.fn>
const queryMock = query as unknown as ReturnType<typeof vi.fn>
const updateDocMock = updateDoc as unknown as ReturnType<typeof vi.fn>
const whereMock = where as unknown as ReturnType<typeof vi.fn>
const requireUserMock = requireUser as unknown as ReturnType<typeof vi.fn>
const useAuthStoreMock = useAuthStore as unknown as ReturnType<typeof vi.fn>
const { listActiveRosterEmployeesMock } = vi.hoisted(() => ({
  listActiveRosterEmployeesMock: vi.fn(),
}))
const { getJobMock } = vi.hoisted(() => ({
  getJobMock: vi.fn(),
}))

describe('Timecards service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireUserMock.mockReturnValue({ uid: 'u1' })
    useAuthStoreMock.mockReturnValue({ role: ROLES.ADMIN })
    getJobMock.mockResolvedValue({ id: 'job-1', productionBurden: 0.33 })
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
    const addDocCall = addDocMock.mock.calls[0]
    expect(addDocCall).toBeDefined()
    const [, payload] = addDocCall!
    expect(payload).toMatchObject({
      jobId: 'job-1',
      weekStartDate: '2024-01-01',
      weekEndingDate: '2024-02-10',
      status: 'draft',
      uid: 'u1',
      createdByUid: 'u1',
    })
    expect(payload.regularHoursOverride).toBeNull()
    expect(payload.overtimeHoursOverride).toBeNull()
    expect(payload.productionBurden).toBe(0.33)
    expect(payload.footerJobOrGl).toBe('')
    expect(payload.footerAccount).toBe('')
    expect(payload.footerOffice).toBe('')
    expect(payload.footerAmount).toBe('')
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
      regularHoursOverride: 4.5,
      overtimeHoursOverride: 0.5,
      productionBurden: 0.4,
      footerJobOrGl: '6428',
      footerAccount: '1101',
      footerOffice: 'Y',
      footerAmount: '80.5',
    })

    const updateCall = updateDocMock.mock.calls[0]
    expect(updateCall).toBeDefined()
    const [, payload] = updateCall!
    expect(payload.notes).toBe('updated')
    expect(payload.regularHoursOverride).toBe(4.5)
    expect(payload.overtimeHoursOverride).toBe(0.5)
    expect(payload.productionBurden).toBe(0.4)
    expect(payload.footerJobOrGl).toBe('6428')
    expect(payload.footerAccount).toBe('1101')
    expect(payload.footerOffice).toBe('Y')
    expect(payload.footerAmount).toBe('80.5')
    expect(payload.totals).toMatchObject({ hoursTotal: 5, productionTotal: 7, lineTotal: 9 })
    expect(payload.updatedAt).toBe('ts')
  })

  it('submits a timecard with status and timestamps', async () => {
    updateDocMock.mockResolvedValue(undefined)

    await submitTimecard('job-1', 'tc-1')

    const updateCall = updateDocMock.mock.calls[0]
    expect(updateCall).toBeDefined()
    const [, payload] = updateCall!
    expect(payload).toMatchObject({ status: 'submitted', submittedAt: 'ts', updatedAt: 'ts', uid: 'u1' })
  })

  it('submits only draft timecards for a week', async () => {
    // listTimecardsByJobAndWeek relies on getDocs; return one draft and one submitted
    getDocsMock.mockResolvedValueOnce(
      makeQuerySnapshot([
        { id: 'd1', data: { status: 'draft' } },
        { id: 's1', data: { status: 'submitted' } },
      ])
    )

    const count = await submitAllWeekTimecards('job-1', '2024-02-10')

    expect(count).toBe(1)
    expect(updateDocMock).toHaveBeenCalledTimes(1)
    const updateCall = updateDocMock.mock.calls[0]
    expect(updateCall).toBeDefined()
    const [, payload] = updateCall!
    expect(payload.status).toBe('submitted')
  })

  it('limits weekly timecard queries to the current foreman creator id', async () => {
    useAuthStoreMock.mockReturnValue({ role: ROLES.FOREMAN })
    getDocsMock.mockResolvedValueOnce(
      makeQuerySnapshot([
        { id: 'd1', data: { employeeNumber: '123', employeeName: 'Jane Doe', createdByUid: 'u1', status: 'draft', archived: false } },
      ]),
    )

    await listTimecardsByJobAndWeek('job-1', '2024-02-10')

    expect(queryMock).toHaveBeenCalledTimes(1)
    const queryCall = queryMock.mock.calls[0]
    expect(queryCall).toBeDefined()
    const constraints = queryCall?.slice(1) ?? []
    expect(constraints).toContainEqual(whereMock('weekEndingDate', '==', '2024-02-10'))
    expect(constraints).toContainEqual(whereMock('archived', '==', false))
    expect(constraints).toContainEqual(whereMock('createdByUid', '==', 'u1'))
  })

  it('lists workspace timecards for foremen without creator scoping', async () => {
    useAuthStoreMock.mockReturnValue({ role: ROLES.FOREMAN })
    getDocsMock.mockResolvedValueOnce(
      makeQuerySnapshot([
        {
          id: 'w1',
          data: {
            employeeNumber: '123',
            employeeName: 'Jane Doe',
            createdByUid: 'someone-else',
            status: 'draft',
            archived: false,
          },
        },
      ]),
    )

    await listWorkspaceTimecardsByJobAndWeek('job-1', '2024-02-10')

    expect(queryMock).toHaveBeenCalledTimes(1)
    const queryCall = queryMock.mock.calls[0]
    expect(queryCall).toBeDefined()
    const constraints = queryCall?.slice(1) ?? []
    expect(constraints).toContainEqual(whereMock('weekEndingDate', '==', '2024-02-10'))
    expect(constraints).toContainEqual(whereMock('archived', '==', false))
    expect(constraints).not.toContainEqual(whereMock('createdByUid', '==', 'u1'))
  })

  it('creates a roster-backed timecard using the fixed workbook template', async () => {
    addDocMock.mockResolvedValue({ id: 'tc-roster-1' })

    const id = await createTimecardForRosterEmployee(
      'job-1',
      {
        id: 'roster-1',
        jobId: 'job-1',
        employeeNumber: '8060',
        firstName: 'Anselmo',
        lastName: 'Gutierrez',
        occupation: 'Framer',
        wageRate: 30,
        contractor: { name: 'TERM', category: 'Labor' },
        active: true,
      },
      '2026-02-28',
    )

    expect(id).toBe('tc-roster-1')
    const addDocCall = addDocMock.mock.calls[0]
    expect(addDocCall).toBeDefined()
    const [, payload] = addDocCall!
    expect(payload.employeeRosterId).toBe('roster-1')
    expect(payload.employeeNumber).toBe('8060')
    expect(payload.employeeName).toBe('Anselmo Gutierrez')
    expect(payload.occupation).toBe('Framer')
    expect(payload.productionBurden).toBe(0.33)
    expect(payload.subcontractedEmployee).toBe(true)
    expect(payload.jobs).toHaveLength(13)
    expect(payload.jobs[0]).toMatchObject({
      jobNumber: '',
      subsectionArea: '',
      account: '',
      costCode: '',
      difH: '',
      difP: '',
      difC: '',
      offHours: 0,
      offProduction: 0,
      offCost: 0,
    })
    expect(payload.jobs[0].days).toHaveLength(7)
    expect(payload.footerJobOrGl).toBe('')
    expect(payload.footerAccount).toBe('')
    expect(payload.footerOffice).toBe('')
    expect(payload.footerAmount).toBe('')
  })

  it('ensures active roster employees have weekly timecards and skips existing matches', async () => {
    listActiveRosterEmployeesMock.mockResolvedValue([
      {
        id: 'roster-1',
        jobId: 'job-1',
        employeeNumber: '8060',
        firstName: 'Anselmo',
        lastName: 'Gutierrez',
        occupation: 'Framer',
        wageRate: 30,
        active: true,
      },
      {
        id: 'roster-2',
        jobId: 'job-1',
        employeeNumber: '8123',
        firstName: 'Juan',
        lastName: 'Aranda',
        occupation: 'Rocker',
        wageRate: 32,
        active: true,
      },
    ])
    getDocsMock.mockResolvedValueOnce(
      makeQuerySnapshot([
        {
          id: 'existing-1',
          data: {
            employeeRosterId: 'roster-1',
            employeeNumber: '8060',
            employeeName: 'Anselmo Gutierrez',
            status: 'draft',
            archived: false,
          },
        },
      ]),
    )
    addDocMock.mockResolvedValue({ id: 'created-2' })

    const result = await ensureWeekTimecardsForActiveRoster('job-1', '2026-02-28')

    expect(result).toEqual({
      activeEmployeeCount: 2,
      existingTimecardCount: 1,
      createdIds: ['created-2'],
    })
    expect(addDocMock).toHaveBeenCalledTimes(1)
    const addDocCall = addDocMock.mock.calls[0]
    expect(addDocCall).toBeDefined()
    const [, payload] = addDocCall!
    expect(payload.employeeRosterId).toBe('roster-2')
    expect(payload.employeeNumber).toBe('8123')
  })

  it('copies previous week metadata and resets day values', async () => {
    addDocMock.mockResolvedValue({ id: 'tc-copy-1' })

    const source: Timecard = {
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
      productionBurden: 0.33,
      subcontractedEmployee: true,
      footerJobOrGl: '6428',
      footerAccount: '1101',
      footerOffice: 'Y',
      footerAmount: '80',
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
    }

    const id = await createTimecardFromCopy('job-1', source, '2024-02-17')
    expect(id).toBe('tc-copy-1')

    const addDocCall = addDocMock.mock.calls[0]
    expect(addDocCall).toBeDefined()
    const [, payload] = addDocCall!
    expect(payload).toMatchObject({
      employeeNumber: '123',
      employeeName: 'Jane Doe',
      firstName: 'Jane',
      lastName: 'Doe',
      employeeWage: 42.5,
      productionBurden: 0.33,
      subcontractedEmployee: true,
      regularHoursOverride: null,
      overtimeHoursOverride: null,
      footerJobOrGl: '',
      footerAccount: '',
      footerOffice: '',
      footerAmount: '',
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

  it('exports weekly timecards using the office import CSV format', async () => {
    getDocsMock.mockResolvedValueOnce(
      makeQuerySnapshot([
        {
          id: 'tc-1',
          data: {
            employeeNumber: '8060',
            employeeName: 'Anselmo Gutierrez',
            firstName: 'Anselmo',
            lastName: 'Gutierrez',
            weekEndingDate: '2026-02-28',
            archived: false,
            status: 'submitted',
            jobs: [
              {
                jobNumber: '6428',
                subsectionArea: '2',
                account: '1101',
                days: [
                  { dayOfWeek: 1, hours: 8, production: 19, unitCost: 0, lineTotal: 0, date: '2026-02-23' },
                  { dayOfWeek: 2, hours: 8, production: 20, unitCost: 0, lineTotal: 0, date: '2026-02-24' },
                ],
              },
            ],
          },
        },
      ]),
    )

    const csv = await exportTimecardsToCsv('job-1', '2026-02-28')
    const rows = csv.split('\r\n')

    expect(rows[0]).toBe('Employee Name,Employee Code,Job Code,DETAIL_DATE,Sub-Section,Activity Code,Cost Code,H_Hours,P_HOURS,,')
    expect(rows[2]).toBe('"Gutierrez, Anselmo",8060,6428,2/23/2026,2,1101,,8,19,,')
    expect(rows[3]).toBe('"Gutierrez, Anselmo",8060,6428,2/24/2026,2,1101,,8,20,,')
  })

  it('returns an empty string when there are no submitted timecards to export', async () => {
    getDocsMock.mockResolvedValueOnce(makeQuerySnapshot([]))

    const csv = await exportAllSubmittedTimecardsToCsv('job-1')

    expect(csv).toBe('')
  })
})


