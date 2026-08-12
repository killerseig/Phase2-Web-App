import { getCurrentEffectiveRole, getStoredRoleLabel } from '@/auth/roles'
import { isShopJobRecord } from '@/auth/jobIdentity'
import { getTargetRoleCapabilities } from '@/auth/targetRoleCapabilities'
import {
  targetRoleCanCreateJobs,
  targetRoleCanDeleteOrArchiveJobs,
  targetRoleCanEditJobSetup,
  targetRoleCanOpenJobDashboard,
} from '@/auth/targetJobAccess'
import { targetRoleCanUseRouteCapability } from '@/auth/targetRouteCapabilities'
import {
  targetRoleCanUseJobTimecardWorkflow,
  targetRoleCanViewSubmittedTimecardReport,
} from '@/auth/targetTimecardAccess'
import type { EffectiveRoleKey, RawRoleKey } from '@/types/domain'

export type RouteNameLike = string | symbol | null | undefined
export type AppRouteCapability =
  | 'manage-users'
  | 'manage-employees'
  | 'manage-reference-lists'
  | 'manage-shop-catalog'
  | 'use-timecard-export'

export function isAppRouteCapability(value: unknown): value is AppRouteCapability {
  return (
    value === 'manage-users'
    || value === 'manage-employees'
    || value === 'manage-reference-lists'
    || value === 'manage-shop-catalog'
    || value === 'use-timecard-export'
  )
}

export interface CapabilityProfileInput {
  authenticated: boolean
  active?: boolean | null
  rawRole: RawRoleKey
}

export interface CapabilityJobRecord {
  id: string
  assignedForemanIds?: readonly string[] | null
  code?: unknown
  name?: unknown
  number?: unknown
}

export interface AssignedJobAccessInput {
  assignedJobIds?: readonly string[] | null
  isShopJob?: boolean
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

export interface CurrentRoleCapabilities {
  accessAdminArea: boolean
  createJobs: boolean
  deleteOrArchiveJobs: boolean
  editAssignedJobs: boolean
  manageJobTimecards: boolean
  manageJobs: boolean
  useFieldWorkflows: boolean
  useJobSetupEditor: boolean
  useTimecardExport: boolean
  viewAllDailyLogs: boolean
  viewAllJobs: boolean
}

export function getEffectiveRole(rawRole: RawRoleKey): EffectiveRoleKey {
  return getCurrentEffectiveRole(rawRole)
}

export function getCurrentRoleCapabilities(rawRole: RawRoleKey): CurrentRoleCapabilities {
  const targetCapabilities = getTargetRoleCapabilities(rawRole)

  return {
    accessAdminArea: rawRole === 'admin',
    createJobs: targetCapabilities.createJobs,
    deleteOrArchiveJobs: targetCapabilities.deleteOrArchiveJobs,
    editAssignedJobs: targetCapabilities.editAssignedJobs,
    manageJobTimecards: targetCapabilities.editAllJobs,
    manageJobs: targetCapabilities.editAllJobs,
    useFieldWorkflows:
      targetCapabilities.editAssignedFieldWorkflows
      || targetCapabilities.editAssignedTimecards
      || targetCapabilities.editShopJobFieldWorkflows
      || targetCapabilities.editShopJobTimecards,
    useJobSetupEditor:
      targetCapabilities.createJobs
      || targetCapabilities.editAllJobs
      || targetCapabilities.editAssignedJobs,
    useTimecardExport: targetCapabilities.useTimecardExport,
    viewAllDailyLogs: targetCapabilities.editAllJobs,
    viewAllJobs: targetCapabilities.viewAllJobs,
  }
}

export function hasCurrentWorkspaceAccess(input: CapabilityProfileInput): boolean {
  return input.authenticated
    && input.active !== false
    && getTargetRoleCapabilities(input.rawRole).accessWorkspace
}

export function canAccessAdminArea(rawRole: RawRoleKey): boolean {
  return getCurrentRoleCapabilities(rawRole).accessAdminArea
}

export function canViewAllJobs(rawRole: RawRoleKey): boolean {
  return getCurrentRoleCapabilities(rawRole).viewAllJobs
}

export function canManageJobs(rawRole: RawRoleKey): boolean {
  return getCurrentRoleCapabilities(rawRole).manageJobs
}

export function canCreateJobs(rawRole: RawRoleKey): boolean {
  return targetRoleCanCreateJobs(rawRole)
}

export function canDeleteOrArchiveJobs(rawRole: RawRoleKey): boolean {
  return targetRoleCanDeleteOrArchiveJobs(rawRole)
}

export function canUseJobSetupEditor(rawRole: RawRoleKey): boolean {
  return getCurrentRoleCapabilities(rawRole).useJobSetupEditor
}

export function canEditJobSetup(input: AssignedJobAccessInput): boolean {
  return targetRoleCanEditJobSetup({
    assignedJobIds: input.assignedJobIds,
    jobId: input.jobId,
    role: input.rawRole,
  })
}

export function canUseTimecardExport(rawRole: RawRoleKey): boolean {
  return getCurrentRoleCapabilities(rawRole).useTimecardExport
}

export function canViewAllDailyLogs(rawRole: RawRoleKey): boolean {
  return getCurrentRoleCapabilities(rawRole).viewAllDailyLogs
}

export function canManageJobTimecards(rawRole: RawRoleKey): boolean {
  return getCurrentRoleCapabilities(rawRole).manageJobTimecards
}

export function canUseJobTimecardWorkflow(input: AssignedJobAccessInput): boolean {
  return targetRoleCanUseJobTimecardWorkflow({
    assignedJobIds: input.assignedJobIds,
    isShopJob: input.isShopJob,
    jobId: input.jobId,
    role: input.rawRole,
  })
}

export function canViewSubmittedTimecardReport(input: AssignedJobAccessInput): boolean {
  return targetRoleCanViewSubmittedTimecardReport({
    assignedJobIds: input.assignedJobIds,
    isShopJob: input.isShopJob,
    jobId: input.jobId,
    role: input.rawRole,
  })
}

export function canUseRouteCapability(rawRole: RawRoleKey, capability: AppRouteCapability): boolean {
  return targetRoleCanUseRouteCapability(rawRole, capability)
}

export function canUseFieldWorkflows(rawRole: RawRoleKey): boolean {
  return getCurrentRoleCapabilities(rawRole).useFieldWorkflows
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
  const capabilities = getTargetRoleCapabilities(rawRole)
  return routeName === 'timecards' && (
    capabilities.editAllJobs ||
    capabilities.editAssignedTimecards ||
    capabilities.editShopJobTimecards
  )
}

function getVisibleJobForAccess(input: VisibleJobAccessInput): CapabilityJobRecord | null {
  return (input.visibleJobs ?? []).find((job) => job.id === input.jobId) ?? null
}

function getRouteAssignedJobIds(input: JobRouteAccessInput): string[] {
  const assignedJobIds = new Set(input.jobId ? input.assignedJobIds ?? [] : [])
  const visibleJob = getVisibleJobForAccess(input)

  if (
    input.currentUserId
    && visibleJob?.assignedForemanIds?.includes(input.currentUserId)
  ) {
    assignedJobIds.add(visibleJob.id)
  }

  return Array.from(assignedJobIds)
}

export function canAccessJobRoute(input: JobRouteAccessInput): boolean {
  if (!input.jobId) return true

  const visibleJob = getVisibleJobForAccess(input)

  if (targetRoleCanOpenJobDashboard({
    assignedJobIds: getRouteAssignedJobIds(input),
    isShopJob: isShopJobRecord(visibleJob),
    jobId: input.jobId,
    role: input.rawRole,
  })) {
    return true
  }

  return (
    canAccessProfileAssignedJob(input)
    || canAccessVisibleAssignedJob(input)
    || canOpenUnassignedTimecardRoute(input.rawRole, input.routeName)
  )
}

export function getCurrentRoleLabel(rawRole: RawRoleKey): string {
  if (rawRole === 'none') return 'Workspace'
  return getStoredRoleLabel(rawRole)
}
