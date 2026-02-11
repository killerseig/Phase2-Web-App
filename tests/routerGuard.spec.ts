import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ROLES } from '@/constants/app'

let mockAuth: any
let mockJobAccess: any
let runNavigationGuard: any

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => mockAuth,
}))

vi.mock('@/composables/useJobAccess', () => ({
  useJobAccess: () => mockJobAccess,
}))

const loadGuard = async () => {
  vi.resetModules()
  const mod = await import('@/router')
  return mod.runNavigationGuard
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

    mockJobAccess = {
      canAccessJob: vi.fn().mockReturnValue(true),
    }

    runNavigationGuard = await loadGuard()
  })

  it('redirects authenticated users away from login', async () => {
    const result = await runNavigationGuard({
      meta: { public: true },
      name: 'login',
      params: {},
    })

    expect(result).toEqual({ name: 'dashboard' })
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
    mockJobAccess.canAccessJob.mockReturnValue(false)

    const result = await runNavigationGuard({
      meta: {},
      params: { jobId: 'job-2' },
    })

    expect(mockJobAccess.canAccessJob).toHaveBeenCalledWith('job-2')
    expect(result).toEqual({ name: 'unauthorized' })
  })
})
