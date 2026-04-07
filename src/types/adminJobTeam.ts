import type { EmployeeDirectoryEmployee, JobRosterEmployee } from '@/types/models'

export type JobRosterFormInput = {
  selectedEmployeeId: string
  wageRate: string
  subcontracted: boolean
  contractorName: string
  contractorCategory: string
}

export type JobAssignedForemanItem = {
  id: string
  label: string
  email: string
  active: boolean
  isDisplayForeman: boolean
  missing: boolean
}

export type JobForemanOption = {
  id: string
  label: string
}

export type EmployeeDirectoryOption = {
  id: string
  label: string
}

export type JobRosterTableRow = JobRosterEmployee & Record<string, unknown>
export type EmployeeDirectoryTableRow = EmployeeDirectoryEmployee & Record<string, unknown>

export function createJobRosterForm(): JobRosterFormInput {
  return {
    selectedEmployeeId: '',
    wageRate: '',
    subcontracted: false,
    contractorName: '',
    contractorCategory: '',
  }
}
