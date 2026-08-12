import type { EffectiveRoleKey, RawRoleKey } from '@/types/domain'
import { targetRoleCanBeAssignedJobs } from '@/auth/targetRoleCapabilities'

export type EditableUserRole = Exclude<RawRoleKey, 'none'>

export const CURRENT_STORED_ROLE_KEYS = [
  'admin',
  'payroll',
  'shop-foreman',
  'project-manager',
  'foreman',
  'none',
] as const satisfies readonly RawRoleKey[]

export const CURRENT_EDITABLE_USER_ROLE_KEYS = [
  'admin',
  'payroll',
  'shop-foreman',
  'project-manager',
  'foreman',
] as const satisfies readonly EditableUserRole[]

export const CURRENT_DEFAULT_EDITABLE_USER_ROLE: EditableUserRole = 'foreman'

export const CURRENT_ROLE_LABELS: Readonly<Record<RawRoleKey, string>> = {
  admin: 'Admin',
  payroll: 'Payroll',
  'shop-foreman': 'Shop Foreman',
  'project-manager': 'Project Manager',
  foreman: 'Foreman',
  none: 'No Access',
}

export const EDITABLE_USER_ROLE_OPTIONS: readonly { label: string; value: EditableUserRole }[] =
  CURRENT_EDITABLE_USER_ROLE_KEYS.map((role) => ({
    label: CURRENT_ROLE_LABELS[role],
    value: role,
  }))

export function isCurrentStoredRoleKey(value: unknown): value is RawRoleKey {
  return typeof value === 'string' && CURRENT_STORED_ROLE_KEYS.includes(value as RawRoleKey)
}

export function isEditableUserRole(value: unknown): value is EditableUserRole {
  return typeof value === 'string' && CURRENT_EDITABLE_USER_ROLE_KEYS.includes(value as EditableUserRole)
}

export function normalizeStoredRoleKey(value: unknown): RawRoleKey {
  if (typeof value !== 'string') return 'none'

  const normalized = normalizeRoleAlias(value)
  return isCurrentStoredRoleKey(normalized) ? normalized : 'none'
}

function normalizeRoleAlias(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[\s_]+/g, '-')
  if (normalized === 'shopforeman') return 'shop-foreman'
  if (normalized === 'projectmanager') return 'project-manager'
  return normalized
}

export function getCurrentEffectiveRole(role: RawRoleKey): EffectiveRoleKey {
  if (role === 'admin') return 'admin'
  if (role === 'foreman' || role === 'project-manager') return 'foreman'
  return 'none'
}

export function getStoredRoleLabel(role: RawRoleKey | null | undefined): string {
  return CURRENT_ROLE_LABELS[role ?? 'none']
}

export function normalizeEditableUserRole(role: RawRoleKey): EditableUserRole {
  return isEditableUserRole(role) ? role : CURRENT_DEFAULT_EDITABLE_USER_ROLE
}

export function currentRoleCanBeAssignedJobs(role: RawRoleKey): boolean {
  return targetRoleCanBeAssignedJobs(role)
}
