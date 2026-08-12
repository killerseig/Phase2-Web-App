import {
  canAccessJobRoute,
  canUseRouteCapability,
  isAppRouteCapability,
  type CapabilityJobRecord,
  type RouteNameLike,
} from '@/auth/capabilities'
import type { RawRoleKey } from '@/types/domain'

export type RouteAccessDecision = true | { name: 'jobs' | 'login' }

export interface RouteAccessInput {
  assignedJobIds?: readonly string[] | null
  currentUserId?: string | null
  hasWorkspaceAccess: boolean
  requiredCapability?: unknown
  requiresAuth?: boolean
  routeJobId: string
  routeName: RouteNameLike
  rawRole: RawRoleKey
  visibleJobs?: readonly CapabilityJobRecord[] | null
}

export function getRouteParamJobId(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function getRouteRequiresAuth(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function isPublicWorkspaceEntryRoute(routeName: RouteNameLike): boolean {
  return routeName === 'login' || routeName === 'forgot-password'
}

export function getRouteAccessDecision(input: RouteAccessInput): RouteAccessDecision {
  const requiresAuth = input.requiresAuth ?? true

  if (!requiresAuth) {
    if (isPublicWorkspaceEntryRoute(input.routeName) && input.hasWorkspaceAccess) {
      return { name: 'jobs' }
    }

    return true
  }

  if (!input.hasWorkspaceAccess) {
    return { name: 'login' }
  }

  const requiredCapability = isAppRouteCapability(input.requiredCapability)
    ? input.requiredCapability
    : null

  if (requiredCapability && !canUseRouteCapability(input.rawRole, requiredCapability)) {
    return { name: 'jobs' }
  }

  if (!canAccessJobRoute({
    assignedJobIds: input.assignedJobIds,
    currentUserId: input.currentUserId,
    jobId: input.routeJobId,
    rawRole: input.rawRole,
    routeName: input.routeName,
    visibleJobs: input.visibleJobs,
  })) {
    return { name: 'jobs' }
  }

  return true
}
