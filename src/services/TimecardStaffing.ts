import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase'
import { normalizeError } from './serviceUtils'

export type TimecardStaffingEmployee = {
  id: string
  employeeNumber: string
  firstName: string
  lastName: string
  occupation: string
  active: boolean
}

type ListTimecardStaffingEmployeesResult = {
  employees: TimecardStaffingEmployee[]
}

type AddEmployeeToTimecardRosterResult = {
  success: boolean
  action: 'added' | 'reactivated'
  rosterEmployeeId: string
  employee: TimecardStaffingEmployee
}

export async function listTimecardStaffingEmployees(jobId: string): Promise<TimecardStaffingEmployee[]> {
  const callable = httpsCallable<{ jobId: string }, ListTimecardStaffingEmployeesResult>(
    functions,
    'listTimecardStaffingEmployees',
  )

  try {
    const result = await callable({ jobId })
    return Array.isArray(result.data?.employees) ? result.data.employees : []
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to load employees for timecards'))
  }
}

export async function addEmployeeToTimecardRoster(
  jobId: string,
  employeeId: string,
): Promise<AddEmployeeToTimecardRosterResult> {
  const callable = httpsCallable<
    { jobId: string; employeeId: string },
    AddEmployeeToTimecardRosterResult
  >(functions, 'addEmployeeToTimecardRoster')

  try {
    const result = await callable({ jobId, employeeId })
    return result.data
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to add employee to timecards'))
  }
}
