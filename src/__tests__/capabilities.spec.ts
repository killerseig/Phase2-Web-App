import { describe, expect, it } from 'vitest'
import {
  canAccessAdminArea,
  canCreateJobs,
  canDeleteOrArchiveJobs,
  canEditJobSetup,
  canAccessJobRoute,
  canAccessProfileAssignedJob,
  canAccessVisibleAssignedJob,
  canManageJobTimecards,
  canManageJobs,
  canOpenUnassignedTimecardRoute,
  canUseJobTimecardWorkflow,
  canUseRouteCapability,
  canUseJobSetupEditor,
  canUseTimecardExport,
  canUseFieldWorkflows,
  canViewAllDailyLogs,
  canViewAllJobs,
  canViewSubmittedTimecardReport,
  getCurrentRoleCapabilities,
  getCurrentRoleLabel,
  getEffectiveRole,
  hasCurrentWorkspaceAccess,
  isAppRouteCapability,
} from '@/auth/capabilities'

describe('auth capabilities', () => {
  it('keeps the current effective role mapping explicit', () => {
    expect(getEffectiveRole('admin')).toBe('admin')
    expect(getEffectiveRole('payroll')).toBe('none')
    expect(getEffectiveRole('shop-foreman')).toBe('none')
    expect(getEffectiveRole('foreman')).toBe('foreman')
    expect(getEffectiveRole('project-manager')).toBe('foreman')
    expect(getEffectiveRole('none')).toBe('none')
  })

  it('centralizes the live target capability bridge used by the current app store', () => {
    expect(getCurrentRoleCapabilities('admin')).toMatchObject({
      accessAdminArea: true,
      createJobs: true,
      deleteOrArchiveJobs: true,
      editAssignedJobs: true,
      manageJobTimecards: true,
      manageJobs: true,
      useFieldWorkflows: true,
      useJobSetupEditor: true,
      useTimecardExport: true,
      viewAllDailyLogs: true,
      viewAllJobs: true,
    })
    expect(getCurrentRoleCapabilities('foreman')).toMatchObject({
      accessAdminArea: false,
      createJobs: false,
      deleteOrArchiveJobs: false,
      editAssignedJobs: false,
      manageJobTimecards: false,
      manageJobs: false,
      useFieldWorkflows: true,
      useJobSetupEditor: false,
      useTimecardExport: false,
      viewAllDailyLogs: false,
      viewAllJobs: false,
    })
    expect(getCurrentRoleCapabilities('payroll')).toMatchObject({
      accessAdminArea: false,
      createJobs: true,
      deleteOrArchiveJobs: false,
      editAssignedJobs: false,
      manageJobTimecards: false,
      manageJobs: false,
      useFieldWorkflows: false,
      useJobSetupEditor: true,
      useTimecardExport: true,
      viewAllDailyLogs: false,
      viewAllJobs: true,
    })
    expect(getCurrentRoleCapabilities('shop-foreman')).toMatchObject({
      accessAdminArea: false,
      createJobs: false,
      deleteOrArchiveJobs: false,
      editAssignedJobs: false,
      manageJobTimecards: false,
      manageJobs: false,
      useFieldWorkflows: true,
      useJobSetupEditor: false,
      useTimecardExport: false,
      viewAllDailyLogs: false,
      viewAllJobs: true,
    })
    expect(getCurrentRoleCapabilities('project-manager')).toMatchObject({
      accessAdminArea: false,
      createJobs: false,
      deleteOrArchiveJobs: false,
      editAssignedJobs: true,
      manageJobTimecards: false,
      manageJobs: false,
      useFieldWorkflows: true,
      useJobSetupEditor: true,
      useTimecardExport: false,
      viewAllDailyLogs: false,
      viewAllJobs: false,
    })
    expect(getCurrentRoleCapabilities('none')).toMatchObject({
      accessAdminArea: false,
      createJobs: false,
      deleteOrArchiveJobs: false,
      editAssignedJobs: false,
      manageJobTimecards: false,
      manageJobs: false,
      useFieldWorkflows: false,
      useJobSetupEditor: false,
      useTimecardExport: false,
      viewAllDailyLogs: false,
      viewAllJobs: false,
    })
  })

  it('allows every active authenticated target role into the workspace', () => {
    expect(hasCurrentWorkspaceAccess({ authenticated: true, active: true, rawRole: 'foreman' })).toBe(true)
    expect(hasCurrentWorkspaceAccess({ authenticated: true, active: true, rawRole: 'project-manager' })).toBe(true)
    expect(hasCurrentWorkspaceAccess({ authenticated: true, active: true, rawRole: 'payroll' })).toBe(true)
    expect(hasCurrentWorkspaceAccess({ authenticated: true, active: true, rawRole: 'shop-foreman' })).toBe(true)
    expect(hasCurrentWorkspaceAccess({ authenticated: true, active: false, rawRole: 'admin' })).toBe(false)
    expect(hasCurrentWorkspaceAccess({ authenticated: false, active: true, rawRole: 'admin' })).toBe(false)
    expect(hasCurrentWorkspaceAccess({ authenticated: true, active: true, rawRole: 'none' })).toBe(false)
  })

  it('separates full admin access from target workflow access', () => {
    expect(canAccessAdminArea('admin')).toBe(true)
    expect(canAccessAdminArea('payroll')).toBe(false)
    expect(canAccessAdminArea('shop-foreman')).toBe(false)
    expect(canAccessAdminArea('foreman')).toBe(false)
    expect(canAccessAdminArea('project-manager')).toBe(false)
    expect(canUseFieldWorkflows('admin')).toBe(true)
    expect(canUseFieldWorkflows('payroll')).toBe(false)
    expect(canUseFieldWorkflows('shop-foreman')).toBe(true)
    expect(canUseFieldWorkflows('foreman')).toBe(true)
    expect(canUseFieldWorkflows('project-manager')).toBe(true)
  })

  it('checks named route capabilities against the live target role matrix', () => {
    expect(canUseRouteCapability('admin', 'manage-users')).toBe(true)
    expect(canUseRouteCapability('admin', 'manage-employees')).toBe(true)
    expect(canUseRouteCapability('admin', 'manage-reference-lists')).toBe(true)
    expect(canUseRouteCapability('admin', 'manage-shop-catalog')).toBe(true)
    expect(canUseRouteCapability('admin', 'use-timecard-export')).toBe(true)

    expect(canUseRouteCapability('foreman', 'use-timecard-export')).toBe(false)
    expect(canUseRouteCapability('payroll', 'use-timecard-export')).toBe(true)
    expect(canUseRouteCapability('payroll', 'manage-employees')).toBe(true)
    expect(canUseRouteCapability('payroll', 'manage-users')).toBe(false)
    expect(canUseRouteCapability('shop-foreman', 'manage-shop-catalog')).toBe(true)
    expect(canUseRouteCapability('project-manager', 'manage-shop-catalog')).toBe(false)
  })

  it('recognizes only known route capability metadata values', () => {
    expect(isAppRouteCapability('manage-users')).toBe(true)
    expect(isAppRouteCapability('use-timecard-export')).toBe(true)
    expect(isAppRouteCapability('manage-timecards')).toBe(false)
    expect(isAppRouteCapability(null)).toBe(false)
  })

  it('grants all-jobs visibility only to roles that need broad job lookup', () => {
    expect(canViewAllJobs('admin')).toBe(true)
    expect(canViewAllJobs('payroll')).toBe(true)
    expect(canViewAllJobs('shop-foreman')).toBe(true)
    expect(canViewAllJobs('foreman')).toBe(false)
    expect(canViewAllJobs('project-manager')).toBe(false)
    expect(canViewAllJobs('none')).toBe(false)
  })

  it('keeps broad job management admin-only while granular controls handle other job roles', () => {
    expect(canManageJobs('admin')).toBe(true)
    expect(canManageJobs('payroll')).toBe(false)
    expect(canManageJobs('shop-foreman')).toBe(false)
    expect(canManageJobs('foreman')).toBe(false)
    expect(canManageJobs('project-manager')).toBe(false)
    expect(canManageJobs('none')).toBe(false)
  })

  it('exposes granular job setup controls from the target role matrix', () => {
    expect(canCreateJobs('admin')).toBe(true)
    expect(canCreateJobs('payroll')).toBe(true)
    expect(canCreateJobs('project-manager')).toBe(false)
    expect(canCreateJobs('foreman')).toBe(false)

    expect(canUseJobSetupEditor('admin')).toBe(true)
    expect(canUseJobSetupEditor('payroll')).toBe(true)
    expect(canUseJobSetupEditor('project-manager')).toBe(true)
    expect(canUseJobSetupEditor('shop-foreman')).toBe(false)
    expect(canUseJobSetupEditor('foreman')).toBe(false)

    expect(canDeleteOrArchiveJobs('admin')).toBe(true)
    expect(canDeleteOrArchiveJobs('payroll')).toBe(false)
    expect(canDeleteOrArchiveJobs('project-manager')).toBe(false)

    expect(canEditJobSetup({
      assignedJobIds: ['job-a'],
      jobId: 'job-a',
      rawRole: 'project-manager',
    })).toBe(true)
    expect(canEditJobSetup({
      assignedJobIds: ['job-b'],
      jobId: 'job-a',
      rawRole: 'project-manager',
    })).toBe(false)
    expect(canEditJobSetup({
      assignedJobIds: ['job-a'],
      jobId: 'job-a',
      rawRole: 'payroll',
    })).toBe(false)
  })

  it('grants timecard export to admin and payroll only', () => {
    expect(canUseTimecardExport('admin')).toBe(true)
    expect(canUseTimecardExport('payroll')).toBe(true)
    expect(canUseTimecardExport('shop-foreman')).toBe(false)
    expect(canUseTimecardExport('foreman')).toBe(false)
    expect(canUseTimecardExport('project-manager')).toBe(false)
    expect(canUseTimecardExport('none')).toBe(false)
  })

  it('keeps global all-daily-log visibility admin-only', () => {
    expect(canViewAllDailyLogs('admin')).toBe(true)
    expect(canViewAllDailyLogs('payroll')).toBe(false)
    expect(canViewAllDailyLogs('shop-foreman')).toBe(false)
    expect(canViewAllDailyLogs('foreman')).toBe(false)
    expect(canViewAllDailyLogs('project-manager')).toBe(false)
    expect(canViewAllDailyLogs('none')).toBe(false)
  })

  it('keeps broad job timecard management admin-only', () => {
    expect(canManageJobTimecards('admin')).toBe(true)
    expect(canManageJobTimecards('payroll')).toBe(false)
    expect(canManageJobTimecards('shop-foreman')).toBe(false)
    expect(canManageJobTimecards('foreman')).toBe(false)
    expect(canManageJobTimecards('project-manager')).toBe(false)
    expect(canManageJobTimecards('none')).toBe(false)
  })

  it('separates assigned-job timecard workflow access from Project Manager submitted reporting', () => {
    expect(canUseJobTimecardWorkflow({
      assignedJobIds: ['job-a'],
      jobId: 'job-a',
      rawRole: 'foreman',
    })).toBe(true)
    expect(canUseJobTimecardWorkflow({
      assignedJobIds: ['job-a'],
      jobId: 'job-a',
      rawRole: 'project-manager',
    })).toBe(false)
    expect(canViewSubmittedTimecardReport({
      assignedJobIds: ['job-a'],
      jobId: 'job-a',
      rawRole: 'project-manager',
    })).toBe(true)
    expect(canViewSubmittedTimecardReport({
      assignedJobIds: ['job-b'],
      jobId: 'job-a',
      rawRole: 'project-manager',
    })).toBe(false)
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
    })).toBe(true)
  })

  it('keeps the timecard exception limited to roles that can edit field timecard workflows', () => {
    expect(canOpenUnassignedTimecardRoute('foreman', 'timecards')).toBe(true)
    expect(canOpenUnassignedTimecardRoute('project-manager', 'timecards')).toBe(false)
    expect(canOpenUnassignedTimecardRoute('payroll', 'timecards')).toBe(false)
    expect(canOpenUnassignedTimecardRoute('shop-foreman', 'timecards')).toBe(true)
    expect(canOpenUnassignedTimecardRoute('foreman', 'daily-logs')).toBe(false)
    expect(canOpenUnassignedTimecardRoute('admin', 'timecards')).toBe(true)
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
    expect(getCurrentRoleLabel('payroll')).toBe('Payroll')
    expect(getCurrentRoleLabel('shop-foreman')).toBe('Shop Foreman')
    expect(getCurrentRoleLabel('project-manager')).toBe('Project Manager')
    expect(getCurrentRoleLabel('foreman')).toBe('Foreman')
    expect(getCurrentRoleLabel('none')).toBe('Workspace')
  })
})
