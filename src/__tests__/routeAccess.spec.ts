import { describe, expect, it } from 'vitest'
import { getRouteAccessDecision, getRouteParamJobId, getRouteRequiresAuth } from '@/router/routeAccess'

describe('route access decisions', () => {
  it('redirects signed-in users away from public workspace entry routes', () => {
    expect(getRouteAccessDecision({
      hasWorkspaceAccess: true,
      requiresAuth: false,
      routeJobId: '',
      routeName: 'login',
      rawRole: 'foreman',
    })).toEqual({ name: 'jobs' })

    expect(getRouteAccessDecision({
      hasWorkspaceAccess: true,
      requiresAuth: false,
      routeJobId: '',
      routeName: 'forgot-password',
      rawRole: 'foreman',
    })).toEqual({ name: 'jobs' })
  })

  it('allows non-entry public routes without requiring workspace access', () => {
    expect(getRouteAccessDecision({
      hasWorkspaceAccess: false,
      requiresAuth: false,
      routeJobId: '',
      routeName: 'set-password',
      rawRole: 'none',
    })).toBe(true)

    expect(getRouteAccessDecision({
      hasWorkspaceAccess: false,
      requiresAuth: false,
      routeJobId: '',
      routeName: 'not-found',
      rawRole: 'none',
    })).toBe(true)
  })

  it('redirects protected routes to login when the user lacks workspace access', () => {
    expect(getRouteAccessDecision({
      hasWorkspaceAccess: false,
      routeJobId: '',
      routeName: 'jobs',
      rawRole: 'none',
    })).toEqual({ name: 'login' })
  })

  it('redirects users away from routes requiring capabilities they do not have', () => {
    expect(getRouteAccessDecision({
      hasWorkspaceAccess: true,
      requiredCapability: 'manage-users',
      routeJobId: '',
      routeName: 'users',
      rawRole: 'foreman',
    })).toEqual({ name: 'jobs' })

    expect(getRouteAccessDecision({
      hasWorkspaceAccess: true,
      requiredCapability: 'manage-users',
      routeJobId: '',
      routeName: 'users',
      rawRole: 'admin',
    })).toBe(true)
  })

  it('ignores unknown route capability metadata instead of blocking the route', () => {
    expect(getRouteAccessDecision({
      hasWorkspaceAccess: true,
      requiredCapability: 'not-a-real-capability',
      routeJobId: '',
      routeName: 'jobs',
      rawRole: 'foreman',
    })).toBe(true)
  })

  it('keeps assigned-job access checks in the route access helper', () => {
    expect(getRouteAccessDecision({
      assignedJobIds: ['job-a'],
      currentUserId: 'foreman-a',
      hasWorkspaceAccess: true,
      routeJobId: 'job-a',
      routeName: 'daily-logs',
      rawRole: 'foreman',
      visibleJobs: [],
    })).toBe(true)

    expect(getRouteAccessDecision({
      assignedJobIds: ['job-b'],
      currentUserId: 'foreman-a',
      hasWorkspaceAccess: true,
      routeJobId: 'job-a',
      routeName: 'daily-logs',
      rawRole: 'foreman',
      visibleJobs: [],
    })).toEqual({ name: 'jobs' })
  })

  it('preserves the visible-job fallback and temporary timecard exception', () => {
    expect(getRouteAccessDecision({
      assignedJobIds: [],
      currentUserId: 'foreman-a',
      hasWorkspaceAccess: true,
      routeJobId: 'job-a',
      routeName: 'daily-logs',
      rawRole: 'foreman',
      visibleJobs: [{ id: 'job-a', assignedForemanIds: ['foreman-a'] }],
    })).toBe(true)

    expect(getRouteAccessDecision({
      assignedJobIds: [],
      currentUserId: 'foreman-a',
      hasWorkspaceAccess: true,
      routeJobId: 'job-a',
      routeName: 'timecards',
      rawRole: 'foreman',
      visibleJobs: [],
    })).toBe(true)
  })

  it('allows Shop Foremen into the visible Shop job without explicit assignment', () => {
    expect(getRouteAccessDecision({
      assignedJobIds: [],
      currentUserId: 'shop-foreman-a',
      hasWorkspaceAccess: true,
      routeJobId: 'job-shop',
      routeName: 'shop-orders',
      rawRole: 'shop-foreman',
      visibleJobs: [{ id: 'job-shop', code: '736', name: 'Shop', assignedForemanIds: [] }],
    })).toBe(true)

    expect(getRouteAccessDecision({
      assignedJobIds: [],
      currentUserId: 'shop-foreman-a',
      hasWorkspaceAccess: true,
      routeJobId: 'job-shop',
      routeName: 'shop-orders',
      rawRole: 'shop-foreman',
      visibleJobs: [{ id: 'job-shop', number: 736, name: 'Warehouse', assignedForemanIds: [] }],
    })).toBe(true)

    expect(getRouteAccessDecision({
      assignedJobIds: [],
      currentUserId: 'shop-foreman-a',
      hasWorkspaceAccess: true,
      routeJobId: 'job-field',
      routeName: 'shop-orders',
      rawRole: 'shop-foreman',
      visibleJobs: [{ id: 'job-field', code: '1A', name: 'Field Job', assignedForemanIds: [] }],
    })).toEqual({ name: 'jobs' })
  })

  it('normalizes route job ids the same way as the router guard', () => {
    expect(getRouteParamJobId('job-a')).toBe('job-a')
    expect(getRouteParamJobId(['job-a'])).toBe('')
    expect(getRouteParamJobId(undefined)).toBe('')
  })

  it('normalizes route auth metadata the same way as the router guard', () => {
    expect(getRouteRequiresAuth(false)).toBe(false)
    expect(getRouteRequiresAuth(true)).toBe(true)
    expect(getRouteRequiresAuth('false')).toBeUndefined()
    expect(getRouteRequiresAuth(undefined)).toBeUndefined()
  })
})
