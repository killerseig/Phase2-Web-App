import { describe, expect, it } from 'vitest'
import {
  canAccessAdminArea,
  canAccessJobRoute,
  canAccessProfileAssignedJob,
  canAccessVisibleAssignedJob,
  canOpenUnassignedTimecardRoute,
  canUseFieldWorkflows,
  getCurrentRoleLabel,
  getEffectiveRole,
  hasCurrentWorkspaceAccess,
} from '@/auth/capabilities'

describe('auth capabilities', () => {
  it('keeps the current effective role mapping explicit', () => {
    expect(getEffectiveRole('admin')).toBe('admin')
    expect(getEffectiveRole('foreman')).toBe('foreman')
    expect(getEffectiveRole('project-manager')).toBe('foreman')
    expect(getEffectiveRole('none')).toBe('none')
  })

  it('allows only active authenticated app roles into the workspace', () => {
    expect(hasCurrentWorkspaceAccess({ authenticated: true, active: true, rawRole: 'foreman' })).toBe(true)
    expect(hasCurrentWorkspaceAccess({ authenticated: true, active: true, rawRole: 'project-manager' })).toBe(true)
    expect(hasCurrentWorkspaceAccess({ authenticated: true, active: false, rawRole: 'admin' })).toBe(false)
    expect(hasCurrentWorkspaceAccess({ authenticated: false, active: true, rawRole: 'admin' })).toBe(false)
    expect(hasCurrentWorkspaceAccess({ authenticated: true, active: true, rawRole: 'none' })).toBe(false)
  })

  it('separates admin access from field workflow access under current behavior', () => {
    expect(canAccessAdminArea('admin')).toBe(true)
    expect(canAccessAdminArea('foreman')).toBe(false)
    expect(canAccessAdminArea('project-manager')).toBe(false)
    expect(canUseFieldWorkflows('admin')).toBe(false)
    expect(canUseFieldWorkflows('foreman')).toBe(true)
    expect(canUseFieldWorkflows('project-manager')).toBe(true)
  })

  it('allows admins to access any profile-assigned job and field users to access assigned jobs only', () => {
    expect(canAccessProfileAssignedJob({
      assignedJobIds: [],
      jobId: 'job-a',
      rawRole: 'admin',
    })).toBe(true)
    expect(canAccessProfileAssignedJob({
      assignedJobIds: ['job-a'],
      jobId: 'job-a',
      rawRole: 'foreman',
    })).toBe(true)
    expect(canAccessProfileAssignedJob({
      assignedJobIds: ['job-b'],
      jobId: 'job-a',
      rawRole: 'foreman',
    })).toBe(false)
  })

  it('allows field users to access job records where they are assigned even if profile assignments are stale', () => {
    expect(canAccessVisibleAssignedJob({
      currentUserId: 'user-a',
      jobId: 'job-a',
      rawRole: 'foreman',
      visibleJobs: [{ id: 'job-a', assignedForemanIds: ['user-a'] }],
    })).toBe(true)
    expect(canAccessVisibleAssignedJob({
      currentUserId: 'user-a',
      jobId: 'job-a',
      rawRole: 'foreman',
      visibleJobs: [{ id: 'job-a', assignedForemanIds: ['user-b'] }],
    })).toBe(false)
    expect(canAccessVisibleAssignedJob({
      currentUserId: 'user-a',
      jobId: 'job-a',
      rawRole: 'admin',
      visibleJobs: [{ id: 'job-a', assignedForemanIds: ['user-a'] }],
    })).toBe(false)
  })

  it('keeps the current timecard exception limited to field workflow users', () => {
    expect(canOpenUnassignedTimecardRoute('foreman', 'timecards')).toBe(true)
    expect(canOpenUnassignedTimecardRoute('project-manager', 'timecards')).toBe(true)
    expect(canOpenUnassignedTimecardRoute('foreman', 'daily-logs')).toBe(false)
    expect(canOpenUnassignedTimecardRoute('admin', 'timecards')).toBe(false)
  })

  it('combines profile, visible-job, and timecard exception rules for job routes', () => {
    expect(canAccessJobRoute({
      assignedJobIds: [],
      currentUserId: 'admin-a',
      jobId: 'job-a',
      rawRole: 'admin',
      routeName: 'daily-logs',
      visibleJobs: [],
    })).toBe(true)
    expect(canAccessJobRoute({
      assignedJobIds: [],
      currentUserId: 'user-a',
      jobId: 'job-a',
      rawRole: 'foreman',
      routeName: 'daily-logs',
      visibleJobs: [{ id: 'job-a', assignedForemanIds: ['user-a'] }],
    })).toBe(true)
    expect(canAccessJobRoute({
      assignedJobIds: [],
      currentUserId: 'user-a',
      jobId: 'job-a',
      rawRole: 'foreman',
      routeName: 'timecards',
      visibleJobs: [],
    })).toBe(true)
    expect(canAccessJobRoute({
      assignedJobIds: [],
      currentUserId: 'user-a',
      jobId: 'job-a',
      rawRole: 'foreman',
      routeName: 'shop-orders',
      visibleJobs: [],
    })).toBe(false)
  })

  it('labels current roles for the app shell without expanding target roles early', () => {
    expect(getCurrentRoleLabel('admin')).toBe('Admin')
    expect(getCurrentRoleLabel('project-manager')).toBe('Project Manager')
    expect(getCurrentRoleLabel('foreman')).toBe('Foreman')
    expect(getCurrentRoleLabel('none')).toBe('Workspace')
  })
})
