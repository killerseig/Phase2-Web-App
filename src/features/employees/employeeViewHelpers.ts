import type { EmployeeRecord } from '@/types/domain'

export interface EmployeeFormState {
  employeeNumber: string
  firstName: string
  lastName: string
  occupation: string
  active: boolean
  isContractor: boolean
}

export type EmployeeTextField = 'employeeNumber' | 'firstName' | 'lastName' | 'occupation'
export type EmployeeBooleanField = 'active' | 'isContractor'
export type EmployeeDetailSnapshot = EmployeeFormState

export function buildEmployeeSearchTokens(employee: EmployeeRecord) {
  return [
    `${employee.firstName} ${employee.lastName}`.trim(),
    employee.employeeNumber,
    employee.occupation,
  ]
}

export function buildEmployeeOccupationSuggestions(employees: readonly EmployeeRecord[]) {
  const unique = new Set(
    employees
      .map((employee) => employee.occupation.trim())
      .filter(Boolean),
  )

  return Array.from(unique).sort((left, right) => left.localeCompare(right))
}

export function getEmployeeStatusCounts(employees: readonly EmployeeRecord[]) {
  return {
    active: employees.filter((employee) => employee.active).length,
    inactive: employees.filter((employee) => !employee.active).length,
  }
}

export function validateEmployeeForm(form: EmployeeFormState) {
  if (!form.employeeNumber.trim()) return 'Enter the employee number.'
  if (!form.firstName.trim()) return 'Enter the first name.'
  if (!form.lastName.trim()) return 'Enter the last name.'
  if (!form.occupation.trim()) return 'Enter the occupation.'
  return ''
}

export function getEmployeeDisplayName(employee: Pick<EmployeeRecord, 'employeeNumber' | 'firstName' | 'lastName'>) {
  return `${employee.firstName} ${employee.lastName}`.trim() || employee.employeeNumber || 'Unnamed Employee'
}

export function getEmployeeTypeLabel(employee: Pick<EmployeeRecord, 'isContractor'> | Pick<EmployeeFormState, 'isContractor'>) {
  return employee.isContractor ? 'Contractor' : 'Employee'
}

export function getEmployeeOccupation(employee: Pick<EmployeeRecord, 'occupation'>) {
  return employee.occupation.trim() || 'No occupation'
}

export function getEmployeeCode(employee: Pick<EmployeeRecord, 'employeeNumber'>) {
  return employee.employeeNumber.trim() || 'No Number'
}

export function getEmployeeRecordSnapshot(employee: EmployeeRecord | null): EmployeeDetailSnapshot | null {
  if (!employee) return null

  return {
    employeeNumber: employee.employeeNumber.trim(),
    firstName: employee.firstName.trim(),
    lastName: employee.lastName.trim(),
    occupation: employee.occupation.trim(),
    active: employee.active,
    isContractor: employee.isContractor,
  }
}

export function getEmployeeFormSnapshot(form: EmployeeFormState): EmployeeDetailSnapshot {
  return {
    employeeNumber: form.employeeNumber.trim(),
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    occupation: form.occupation.trim(),
    active: form.active,
    isContractor: form.isContractor,
  }
}

export function areEmployeeSnapshotsEqual(
  left: EmployeeDetailSnapshot | null,
  right: EmployeeDetailSnapshot | null,
) {
  if (!left || !right) return false

  return (
    left.employeeNumber === right.employeeNumber
    && left.firstName === right.firstName
    && left.lastName === right.lastName
    && left.occupation === right.occupation
    && left.active === right.active
    && left.isContractor === right.isContractor
  )
}
