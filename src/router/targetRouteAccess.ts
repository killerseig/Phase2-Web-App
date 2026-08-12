import { targetRoleCanOpenJobDashboard } from '@/auth/targetJobAccess'
import { type TargetRoleKey } from '@/auth/targetRoleCapabilities'
import {
  isTargetRouteCapability,
  targetRoleCanUseRouteCapability,
  targetRoleHasWorkspaceAccess,
} from '@/auth/targetRouteCapabilities'

export type TargetRouteNameLike = string | symbol | null | undefined
export type TargetRouteAccessDecision = true | { name: 'jobs' | 'login' }

export interface TargetRouteAccessInput {
  active?: boolean | null
  assignedJobIds?: readonly string[] | null
  authenticated: boolean
  isShopJob?: boolean
  requiredCapability?: unknown
  requiresAuth?: boolean
  role: TargetRoleKey
  routeJobId: string
  routeName: TargetRouteNameLike
}

export function getTargetRouteParamJobId(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function getTargetRouteRequiresAuth(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function isTargetPublicWorkspaceEntryRoute(routeName: TargetRouteNameLike): boolean {
  return routeName === 'login' || routeName === 'forgot-password'
}

export function getTargetRouteAccessDecision(
  input: TargetRouteAccessInput,
): TargetRouteAccessDecision {
  const requiresAuth = input.requiresAuth ?? true
  const hasWorkspaceAccess = targetRoleHasWorkspaceAccess({
    active: input.active,
    authenticated: input.authenticated,
    role: input.role,
  })

  if (!requiresAuth) {
    if (isTargetPublicWorkspaceEntryRoute(input.routeName) && hasWorkspaceAccess) {
      return { name: 'jobs' }
    }

    return true
  }

  if (!hasWorkspaceAccess) {
    return { name: 'login' }
  }

  const requiredCapability = isTargetRouteCapability(input.requiredCapability)
    ? input.requiredCapability
    : null

  if (requiredCapability && !targetRoleCanUseRouteCapability(input.role, requiredCapability)) {
    return { name: 'jobs' }
  }

  if (input.routeJobId && !targetRoleCanOpenJobDashboard({
    assignedJobIds: input.assignedJobIds,
    isShopJob: input.isShopJob,
    jobId: input.routeJobId,
    role: input.role,
  })) {
    return { name: 'jobs' }
  }

  return true
}
