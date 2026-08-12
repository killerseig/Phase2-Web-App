import { describe, expect, it } from 'vitest'
import {
  getTargetRouteAccessDecision,
  getTargetRouteParamJobId,
  getTargetRouteRequiresAuth,
} from '@/router/targetRouteAccess'

describe('target route access decisions', () => {
  it('redirects signed-in target users away from public workspace entry routes to jobs', () => {
    expect(getTargetRouteAccessDecision({
      authenticated: true,
      requiresAuth: false,
      role: 'foreman',
      routeJobId: '',
      routeName: 'login',
    })).toEqual({ name: 'jobs' })

    expect(getTargetRouteAccessDecision({
      authenticated: true,
      requiresAuth: false,
      role: 'project-manager',
      routeJobId: '',
      routeName: 'forgot-password',
    })).toEqual({ name: 'jobs' })
  })

  it('allows non-entry public routes without workspace access', () => {
    expect(getTargetRouteAccessDecision({
      authenticated: false,
      requiresAuth: false,
      role: 'none',
      routeJobId: '',
      routeName: 'set-password',
    })).toBe(true)

    expect(getTargetRouteAccessDecision({
      authenticated: false,
      requiresAuth: false,
      role: 'none',
      routeJobId: '',
      routeName: 'not-found',
    })).toBe(true)
  })

  it('redirects protected routes to login when the target user lacks workspace access', () => {
    expect(getTargetRouteAccessDecision({
      authenticated: false,
      role: 'foreman',
      routeJobId: '',
      routeName: 'jobs',
    })).toEqual({ name: 'login' })

    expect(getTargetRouteAccessDecision({
      active: false,
      authenticated: true,
      role: 'admin',
      routeJobId: '',
      routeName: 'jobs',
    })).toEqual({ name: 'login' })

    expect(getTargetRouteAccessDecision({
      authenticated: true,
      role: 'none',
      routeJobId: '',
      routeName: 'jobs',
    })).toEqual({ name: 'login' })
  })

  it('redirects users away from protected admin routes they cannot use', () => {
    expect(getTargetRouteAccessDecision({
      authenticated: true,
      requiredCapability: 'manage-employees',
      role: 'payroll',
      routeJobId: '',
      routeName: 'employees',
    })).toBe(true)

    expect(getTargetRouteAccessDecision({
      authenticated: true,
      requiredCapability: 'manage-users',
      role: 'payroll',
      routeJobId: '',
      routeName: 'users',
    })).toEqual({ name: 'jobs' })

    expect(getTargetRouteAccessDecision({
      authenticated: true,
      requiredCapability: 'manage-shop-catalog',
      role: 'shop-foreman',
      routeJobId: '',
      routeName: 'shop-catalog',
    })).toBe(true)

    expect(getTargetRouteAccessDecision({
      authenticated: true,
      requiredCapability: 'manage-shop-catalog',
      role: 'foreman',
      routeJobId: '',
      routeName: 'shop-catalog',
    })).toEqual({ name: 'jobs' })
  })

  it('ignores unknown route capability metadata instead of blocking the route', () => {
    expect(getTargetRouteAccessDecision({
      authenticated: true,
      requiredCapability: 'not-a-real-capability',
      role: 'foreman',
      routeJobId: '',
      routeName: 'jobs',
    })).toBe(true)
  })

  it('requires target job-dashboard access for job-scoped routes', () => {
    expect(getTargetRouteAccessDecision({
      assignedJobIds: ['job-a'],
      authenticated: true,
      role: 'foreman',
      routeJobId: 'job-a',
      routeName: 'daily-logs',
    })).toBe(true)

    expect(getTargetRouteAccessDecision({
      assignedJobIds: ['job-b'],
      authenticated: true,
      role: 'foreman',
      routeJobId: 'job-a',
      routeName: 'daily-logs',
    })).toEqual({ name: 'jobs' })

    expect(getTargetRouteAccessDecision({
      authenticated: true,
      role: 'payroll',
      routeJobId: 'job-a',
      routeName: 'daily-logs',
    })).toEqual({ name: 'jobs' })
  })

  it('allows target shop foremen into the Shop job and assigned non-Shop jobs only', () => {
    expect(getTargetRouteAccessDecision({
      authenticated: true,
      isShopJob: true,
      role: 'shop-foreman',
      routeJobId: 'shop-job',
      routeName: 'shop-orders',
    })).toBe(true)

    expect(getTargetRouteAccessDecision({
      assignedJobIds: ['job-a'],
      authenticated: true,
      role: 'shop-foreman',
      routeJobId: 'job-a',
      routeName: 'shop-orders',
    })).toBe(true)

    expect(getTargetRouteAccessDecision({
      assignedJobIds: ['job-b'],
      authenticated: true,
      role: 'shop-foreman',
      routeJobId: 'job-a',
      routeName: 'shop-orders',
    })).toEqual({ name: 'jobs' })
  })

  it('allows target project managers into assigned job routes for view-first dashboards', () => {
    expect(getTargetRouteAccessDecision({
      assignedJobIds: ['job-a'],
      authenticated: true,
      role: 'project-manager',
      routeJobId: 'job-a',
      routeName: 'timecards',
    })).toBe(true)

    expect(getTargetRouteAccessDecision({
      assignedJobIds: ['job-b'],
      authenticated: true,
      role: 'project-manager',
      routeJobId: 'job-a',
      routeName: 'timecards',
    })).toEqual({ name: 'jobs' })
  })

  it('normalizes route job ids the same way as the target router guard will', () => {
    expect(getTargetRouteParamJobId('job-a')).toBe('job-a')
    expect(getTargetRouteParamJobId(['job-a'])).toBe('')
    expect(getTargetRouteParamJobId(undefined)).toBe('')
  })

  it('normalizes route auth metadata the same way as the target router guard will', () => {
    expect(getTargetRouteRequiresAuth(false)).toBe(false)
    expect(getTargetRouteRequiresAuth(true)).toBe(true)
    expect(getTargetRouteRequiresAuth('false')).toBeUndefined()
    expect(getTargetRouteRequiresAuth(undefined)).toBeUndefined()
  })
})
