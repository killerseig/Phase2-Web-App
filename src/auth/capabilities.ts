import type { EffectiveRoleKey, RawRoleKey } from '@/types/domain'
import { toEffectiveRole } from '@/types/domain'

export type RouteNameLike = string | symbol | null | undefined

export interface CapabilityProfileInput {
  authenticated: boolean
  active?: boolean | null
  rawRole: RawRoleKey
}

export interface CapabilityJobRecord {
  id: string
  assignedForemanIds?: readonly string[] | null
}

export interface AssignedJobAccessInput {
  assignedJobIds?: readonly string[] | null
  jobId: string
  rawRole: RawRoleKey
}

export interface VisibleJobAccessInput {
  currentUserId?: string | null
  jobId: string
  rawRole: RawRoleKey
  visibleJobs?: readonly CapabilityJobRecord[] | null
}

export interface JobRouteAccessInput extends AssignedJobAccessInput, VisibleJobAccessInput {
  routeName?: RouteNameLike
}

export function getEffectiveRole(rawRole: RawRoleKey): EffectiveRoleKey {
  return toEffectiveRole(rawRole)
}

export function hasCurrentWorkspaceAccess(input: CapabilityProfileInput): boolean {
  return input.authenticated && input.active !== false && getEffectiveRole(input.rawRole) !== 'none'
}

export function canAccessAdminArea(rawRole: RawRoleKey): boolean {
  return getEffectiveRole(rawRole) === 'admin'
}

export function canUseFieldWorkflows(rawRole: RawRoleKey): boolean {
  return getEffectiveRole(rawRole) === 'foreman'
}

export function canAccessProfileAssignedJob(input: AssignedJobAccessInput): boolean {
  if (canAccessAdminArea(input.rawRole)) return true
  return (input.assignedJobIds ?? []).includes(input.jobId)
}

export function canAccessVisibleAssignedJob(input: VisibleJobAccessInput): boolean {
  if (!input.jobId || !input.currentUserId || !canUseFieldWorkflows(input.rawRole)) return false

  return (input.visibleJobs ?? []).some((job) => (
    job.id === input.jobId && (job.assignedForemanIds ?? []).includes(input.currentUserId ?? '')
  ))
}

export function canOpenUnassignedTimecardRoute(rawRole: RawRoleKey, routeName: RouteNameLike): boolean {
  return routeName === 'timecards' && canUseFieldWorkflows(rawRole)
}

export function canAccessJobRoute(input: JobRouteAccessInput): boolean {
  if (!input.jobId) return true

  return (
    canAccessProfileAssignedJob(input)
    || canAccessVisibleAssignedJob(input)
    || canOpenUnassignedTimecardRoute(input.rawRole, input.routeName)
  )
}

export function getCurrentRoleLabel(rawRole: RawRoleKey): string {
  if (canAccessAdminArea(rawRole)) return 'Admin'
  if (rawRole === 'project-manager') return 'Project Manager'
  if (canUseFieldWorkflows(rawRole)) return 'Foreman'
  return 'Workspace'
}
