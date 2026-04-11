import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addEmployeeToTimecardRoster,
  listTimecardStaffingEmployees,
} from '@/services/TimecardStaffing'
import { httpsCallable } from 'firebase/functions'

vi.mock('@/firebase', () => ({ functions: {} }))

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(),
}))

type MockFn = ReturnType<typeof vi.fn>
const httpsCallableMock = httpsCallable as unknown as MockFn

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Timecard staffing service', () => {
  it('loads the safe employee directory through the callable', async () => {
    const callable = vi.fn().mockResolvedValue({
      data: {
        employees: [
          {
            id: 'employee-1',
            employeeNumber: '9001',
            firstName: 'Mateo',
            lastName: 'Silva',
            occupation: 'Laborer',
            active: true,
          },
        ],
      },
    })
    httpsCallableMock.mockReturnValue(callable)

    const employees = await listTimecardStaffingEmployees('job-1')

    expect(callable).toHaveBeenCalledWith({ jobId: 'job-1' })
    expect(employees).toEqual([
      {
        id: 'employee-1',
        employeeNumber: '9001',
        firstName: 'Mateo',
        lastName: 'Silva',
        occupation: 'Laborer',
        active: true,
      },
    ])
  })

  it('adds a selected employee to the timecard roster through the callable', async () => {
    const callable = vi.fn().mockResolvedValue({
      data: {
        success: true,
        action: 'added',
        rosterEmployeeId: 'roster-1',
        employee: {
          id: 'employee-1',
          employeeNumber: '9001',
          firstName: 'Mateo',
          lastName: 'Silva',
          occupation: 'Laborer',
          active: true,
        },
      },
    })
    httpsCallableMock.mockReturnValue(callable)

    const result = await addEmployeeToTimecardRoster('job-1', 'employee-1')

    expect(callable).toHaveBeenCalledWith({ jobId: 'job-1', employeeId: 'employee-1' })
    expect(result.action).toBe('added')
    expect(result.rosterEmployeeId).toBe('roster-1')
  })
})
