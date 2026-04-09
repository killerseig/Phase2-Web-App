export type SortDir = 'asc' | 'desc'

export type EmployeeSortKey =
  | 'employeeNumber'
  | 'firstName'
  | 'lastName'
  | 'occupation'
  | 'status'

export type EmployeeFormInput = {
  employeeNumber: string
  firstName: string
  lastName: string
  occupation: string
  wageRate: string
  active: boolean
}

export function createEmployeeForm(): EmployeeFormInput {
  return {
    employeeNumber: '',
    firstName: '',
    lastName: '',
    occupation: '',
    wageRate: '',
    active: true,
  }
}
