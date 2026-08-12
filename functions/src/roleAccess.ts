import { VALID_ROLES, type UserRole } from './constants'

export type CurrentFunctionRole = UserRole

export interface FunctionUserRoleProfile {
  role?: unknown
  active?: unknown
  assignedJobIds?: unknown
  firstName?: unknown
  lastName?: unknown
  email?: unknown
}

export interface CurrentFunctionUser {
  uid: string
  role: CurrentFunctionRole
  active: boolean
  assignedJobIds: string[]
  displayName: string | null
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function textOrNull(value: unknown) {
  const normalized = text(value)
  return normalized || null
}

export function isValidStoredRole(value: unknown): value is UserRole {
  return typeof value === 'string' && VALID_ROLES.includes(value as UserRole)
}

export function normalizeStoredRole(value: unknown): UserRole {
  const role = normalizeRoleAlias(text(value))
  return isValidStoredRole(role) ? role : 'none'
}

function normalizeRoleAlias(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[\s_]+/g, '-')
  if (normalized === 'shopforeman') return 'shop-foreman'
  if (normalized === 'projectmanager') return 'project-manager'
  return normalized
}

export function getCurrentFunctionRole(value: unknown): CurrentFunctionRole {
  return normalizeStoredRole(value)
}

export function getFunctionAssignedJobIds(user: FunctionUserRoleProfile): string[] {
  if (!Array.isArray(user.assignedJobIds)) return []

  return user.assignedJobIds
    .filter((value: unknown): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean)
}

export function getFunctionDisplayName(user: FunctionUserRoleProfile): string | null {
  return [text(user.firstName), text(user.lastName)].filter(Boolean).join(' ') || textOrNull(user.email)
}

export function buildCurrentFunctionUser(uid: string, user: FunctionUserRoleProfile): CurrentFunctionUser {
  return {
    uid,
    role: getCurrentFunctionRole(user.role),
    active: user.active !== false,
    assignedJobIds: getFunctionAssignedJobIds(user),
    displayName: getFunctionDisplayName(user),
  }
}

export function currentFunctionUserHasAnyRole(
  user: CurrentFunctionUser,
  roles: readonly CurrentFunctionRole[],
): boolean {
  return roles.includes(user.role)
}

export function currentFunctionUserCanAccessAssignedJob(user: CurrentFunctionUser, jobId: unknown): boolean {
  if (user.role === 'admin') return true
  if (!(user.role === 'foreman' || user.role === 'shop-foreman' || user.role === 'project-manager')) return false

  const normalizedJobId = text(jobId)
  return normalizedJobId.length > 0 && user.assignedJobIds.includes(normalizedJobId)
}

export function canSendInviteForStoredRole(value: unknown): boolean {
  return normalizeStoredRole(value) !== 'none'
}
