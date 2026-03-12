import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ROLES } from '@/constants/app'

let mockAuth: any
let runNavigationGuard: any
let getRouteAccessRedirect: any

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => mockAuth,
}))

const loadGuards = async () => {
  vi.resetModules()
  const mod = await import('@/router')
  return {
    runNavigationGuard: mod.runNavigationGuard,
    getRouteAccessRedirect: mod.getRouteAccessRedirect,
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
      name: 'login',
      params: {},
    })

    expect(result).toEqual({ name: 'dashboard' })
  })

  it('allows unauthenticated users to access public not-found route', async () => {
    mockAuth.user = null
    const result = await runNavigationGuard({
      meta: { requiresAuth: false },
      name: 'not-found',
      params: { pathMatch: ['missing-page'] },
    })

    expect(result).toBe(true)
  })

  it('forces login when unauthenticated', async () => {
    mockAuth.user = null
    const result = await runNavigationGuard({ meta: {}, params: {} })
    expect(result).toEqual({ name: 'login' })
  })

  it('signs out inactive users', async () => {
    mockAuth.active = false
    const result = await runNavigationGuard({ meta: {}, params: {} })

    expect(mockAuth.signOut).toHaveBeenCalled()
    expect(result).toEqual({ name: 'login' })
  })

  it('blocks roles not in the allowed list', async () => {
    mockAuth.role = ROLES.EMPLOYEE
    const result = await runNavigationGuard({
      meta: { roles: [ROLES.ADMIN] },
      params: {},
    })

    expect(result).toEqual({ name: 'unauthorized' })
  })

  it('blocks foremen from jobs they are not assigned to', async () => {
    mockAuth.role = ROLES.FOREMAN
    mockAuth.assignedJobIds = ['job-1']

    const result = await runNavigationGuard({
      meta: {},
      params: { jobId: 'job-2' },
    })

    expect(result).toEqual({ name: 'unauthorized' })
  })

  it('returns unauthorized when a user loses required role on current route', () => {
    const result = getRouteAccessRedirect(
      {
        meta: { roles: [ROLES.ADMIN] },
        name: 'admin-users',
        params: {},
      },
      {
        user: { uid: 'user-1' },
        active: true,
        role: ROLES.NONE,
      },
      () => true
    )

    expect(result).toEqual({ name: 'unauthorized' })
  })

  it('returns unauthorized when a foreman loses assignment for the open job route', () => {
    const result = getRouteAccessRedirect(
      {
        meta: {},
        name: 'job-home',
        params: { jobId: 'job-99' },
      },
      {
        user: { uid: 'user-1' },
        active: true,
        role: ROLES.FOREMAN,
      },
      () => false
    )

    expect(result).toEqual({ name: 'unauthorized' })
  })
})
