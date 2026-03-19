import type { TimecardModel } from '@/views/timecards/timecardUtils'

export type TimecardCreateForm = {
  employeeNumber: string
  firstName: string
  lastName: string
  occupation: string
  employeeWage: string
  subcontractedEmployee: 'no' | 'yes'
}

export type TimecardSummaryRow = {
  id: string
  employeeName: string
  employeeNumber: string
  status: TimecardModel['status']
  hours: number
  production: number
  lineTotal: number
}

export function createEmptyTimecardCreateForm(): TimecardCreateForm {
  return {
    employeeNumber: '',
    firstName: '',
    lastName: '',
    occupation: '',
    employeeWage: '',
    subcontractedEmployee: 'no',
  }
}
