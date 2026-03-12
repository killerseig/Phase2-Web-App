import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ROLES, ROUTE_NAMES, type Role, type RouteName } from '@/constants/app'

type RouteTarget = {
  meta?: Record<string, unknown>
  name?: RouteName | string
  params?: Record<string, unknown>
}

type AuthStoreStub = {
  ready: boolean
  init: ReturnType<typeof vi.fn>
  user: { uid: string } | null
  active: boolean
  role: Role | null
  assignedJobIds: string[]
  signOut: ReturnType<typeof vi.fn>
}

type GuardFn = (to: RouteTarget) => Promise<unknown>
type AccessRedirectFn = (
  to: RouteTarget,
  auth: { user: unknown; active: boolean; role: Role | null },
  canAccessJob: (jobId: string) => boolean
) => unknown

let mockAuth: AuthStoreStub
let runNavigationGuard: GuardFn
let getRouteAccessRedirect: AccessRedirectFn

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => mockAuth,
}))

const loadGuards = async () => {
  vi.resetModules()
  const mod = await import('@/router')
  return {
    runNavigationGuard: mod.runNavigationGuard as unknown as GuardFn,
    getRouteAccessRedirect: mod.getRouteAccessRedirect as AccessRedirectFn,
  }
}

describe('router navigation guard', () => {
  beforeEach(async () => {
    mockAuth = {
      ready: true,
      init: vi.fn().mockResolvedValue(undefined),
      user: { uid: 'user-1' },
      active: true,
      role: ROLES.ADMIN,
      assignedJobIds: ['job-1'],
      signOut: vi.fn().mockResolvedValue(undefined),
    }

    const guards = await loadGuards()
    runNavigationGuard = guards.runNavigationGuard
    getRouteAccessRedirect = guards.getRouteAccessRedirect
  })

  it('redirects authenticated users away from login', async () => {
    const result = await runNavigationGuard({
      meta: { requiresAuth: false },
      name: ROUTE_NAMES.LOGIN,
      params: {},
    })

    expect(result).toEqual({ name: ROUTE_NAMES.DASHBOARD })
  })

  it('allows unauthenticated users to access public not-found route', async () => {
    mockAuth.user = null
    const result = await runNavigationGuard({
      meta: { requiresAuth: false },
      name: ROUTE_NAMES.NOT_FOUND,
      params: { pathMatch: ['missing-page'] },
    })

    expect(result).toBe(true)
  })

  it('forces login when unauthenticated', async () => {
    mockAuth.user = null
    const result = await runNavigationGuard({ meta: {}, params: {} })
    expect(result).toEqual({ name: ROUTE_NAMES.LOGIN })
  })

  it('signs out inactive users', async () => {
    mockAuth.active = false
    const result = await runNavigationGuard({ meta: {}, params: {} })

    expect(mockAuth.signOut).toHaveBeenCalled()
    expect(result).toEqual({ name: ROUTE_NAMES.LOGIN })
  })

  it('blocks roles not in the allowed list', async () => {
    mockAuth.role = ROLES.EMPLOYEE
    const result = await runNavigationGuard({
      meta: { roles: [ROLES.ADMIN] },
      params: {},
    })

    expect(result).toEqual({ name: ROUTE_NAMES.UNAUTHORIZED })
  })

  it('allows controller users on the controller route', async () => {
    mockAuth.role = ROLES.CONTROLLER
    const result = await runNavigationGuard({
      meta: { roles: [ROLES.ADMIN, ROLES.CONTROLLER] },
      name: ROUTE_NAMES.CONTROLLER,
      params: {},
    })

    expect(result).toBe(true)
  })

  it('blocks controller users from admin-only routes', async () => {
    mockAuth.role = ROLES.CONTROLLER
    const result = await runNavigationGuard({
      meta: { roles: [ROLES.ADMIN] },
      name: ROUTE_NAMES.ADMIN_USERS,
      params: {},
    })

    expect(result).toEqual({ name: ROUTE_NAMES.UNAUTHORIZED })
  })

  it('blocks foremen from jobs they are not assigned to', async () => {
    mockAuth.role = ROLES.FOREMAN
    mockAuth.assignedJobIds = ['job-1']

    const result = await runNavigationGuard({
      meta: {},
      params: { jobId: 'job-2' },
    })

    expect(result).toEqual({ name: ROUTE_NAMES.UNAUTHORIZED })
  })

  it('returns unauthorized when a user loses required role on current route', () => {
    const result = getRouteAccessRedirect(
      {
        meta: { roles: [ROLES.ADMIN] },
        name: ROUTE_NAMES.ADMIN_USERS,
        params: {},
      },
      {
        user: { uid: 'user-1' },
        active: true,
        role: ROLES.NONE,
      },
      () => true
    )

    expect(result).toEqual({ name: ROUTE_NAMES.UNAUTHORIZED })
  })

  it('returns unauthorized when a foreman loses assignment for the open job route', () => {
    const result = getRouteAccessRedirect(
      {
        meta: {},
        name: ROUTE_NAMES.JOB_HOME,
        params: { jobId: 'job-99' },
      },
      {
        user: { uid: 'user-1' },
        active: true,
        role: ROLES.FOREMAN,
      },
      () => false
    )

    expect(result).toEqual({ name: ROUTE_NAMES.UNAUTHORIZED })
  })
})
