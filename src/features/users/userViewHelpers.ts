import type { JobRecord, RoleKey, UserProfile } from '@/types/domain'
import { roleCanBeAssignedJobs, toEffectiveRole } from '@/types/domain'

export type EditableUserRole = Exclude<RoleKey, 'none'>

export type UserCreateFormState = {
  email: string
  firstName: string
  lastName: string
  role: EditableUserRole
  assignedJobIds: string[]
}

export type UserDetailFormState = {
  firstName: string
  lastName: string
  role: EditableUserRole
  active: boolean
  assignedJobIds: string[]
}

export type UserCreateTextField = 'email' | 'firstName' | 'lastName'
export type UserDetailTextField = 'firstName' | 'lastName'

export type UserDetailSnapshot = {
  firstName: string
  lastName: string
  role: EditableUserRole
  active: boolean
  assignedJobIds: string[]
}

export type UserDetailFormLike = Omit<UserDetailFormState, 'assignedJobIds'> & {
  assignedJobIds: readonly string[]
}

export function getUserDisplayName(user: UserProfile) {
  const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()
  return fullName || user.email || 'Unnamed User'
}

export function getRoleBadgeLabel(role: UserProfile['role']) {
  if (role === 'project-manager') return 'Project Manager'
  const effectiveRole = toEffectiveRole(role)
  if (effectiveRole === 'admin') return 'Admin'
  if (effectiveRole === 'foreman') return 'Foreman'
  return 'No Access'
}

export function getAssignedJobCode(job: JobRecord) {
  return job.code?.trim() || 'No Number'
}

export function getAssignedJobName(job: JobRecord) {
  return job.name.trim() || 'Untitled Job'
}

export function matchesAssignedJobSearch(job: JobRecord, query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return true

  return (
    getAssignedJobName(job).toLowerCase().includes(normalizedQuery) ||
    getAssignedJobCode(job).toLowerCase().includes(normalizedQuery)
  )
}

export function getAssignedJobsEmptyStateMessage(query: string) {
  return query.trim() ? 'No jobs match your search.' : 'No active jobs available.'
}

export function normalizeAssignedJobIds(jobIds: readonly string[]) {
  return Array.from(
    new Set(jobIds.filter((jobId) => typeof jobId === 'string' && jobId.trim().length > 0)),
  ).sort()
}

export function normalizeEditableUserRole(role: RoleKey): EditableUserRole {
  if (role === 'admin') return 'admin'
  if (role === 'project-manager') return 'project-manager'
  return 'foreman'
}

export function getUserDetailSnapshot(user: UserProfile | null): UserDetailSnapshot | null {
  if (!user) return null

  const role = normalizeEditableUserRole(user.role)
  return {
    firstName: (user.firstName ?? '').trim(),
    lastName: (user.lastName ?? '').trim(),
    role,
    active: user.active,
    assignedJobIds: roleCanBeAssignedJobs(role) ? normalizeAssignedJobIds(user.assignedJobIds) : [],
  }
}

export function getUserDetailFormSnapshot(form: UserDetailFormLike): UserDetailSnapshot {
  const role = normalizeEditableUserRole(form.role)
  return {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    role,
    active: form.active,
    assignedJobIds: roleCanBeAssignedJobs(role) ? normalizeAssignedJobIds(form.assignedJobIds) : [],
  }
}

export function areUserDetailSnapshotsEqual(
  left: UserDetailSnapshot | null,
  right: UserDetailSnapshot | null,
) {
  if (!left || !right) return false

  return (
    left.firstName === right.firstName &&
    left.lastName === right.lastName &&
    left.role === right.role &&
    left.active === right.active &&
    left.assignedJobIds.length === right.assignedJobIds.length &&
    left.assignedJobIds.every((jobId, index) => jobId === right.assignedJobIds[index])
  )
}
