import { describe, expect, it } from 'vitest'
import {
  getAppShellAdminNavigationItems,
  getAppShellRoleLabel,
  getAppShellWorkspaceNavigationItems,
} from '@/features/navigation/appShellNavigation'

describe('app shell navigation policy', () => {
  it('keeps unannounced dashboards out of workspace navigation for every role', () => {
    expect(getAppShellWorkspaceNavigationItems()).toEqual([
      { label: 'Jobs', to: '/jobs' },
      { label: 'Company Library', to: '/company-library' },
    ])
  })

  it.each(['admin', 'foreman', 'project-manager', 'shop-foreman'] as const)('opens Library and Forms without a selected job for %s', role => {
    expect(getAppShellWorkspaceNavigationItems(role).map(item => item.to)).toEqual(['/jobs', '/jobs/my-timecard', '/company-library', '/reports'])
  })

  it('does not advertise the forbidden form list to Payroll', () => {
    expect(getAppShellWorkspaceNavigationItems('payroll').map(item => item.to)).toEqual(['/jobs', '/company-library'])
  })

  it('shows the current admin navigation only when the role can use each route capability', () => {
    expect(getAppShellAdminNavigationItems('admin')).toEqual([
      { capability: 'manage-website', label: 'Form Builder', to: '/admin/forms' },
      { capability: 'manage-website', label: 'Website Builder', to: '/admin/website' },
      { capability: 'manage-users', label: 'Users', to: '/users' },
      { capability: 'manage-employees', label: 'Employees', to: '/employees' },
      { capability: 'use-timecard-export', label: 'Timecard Export', to: '/exports/timecards' },
      { capability: 'manage-shop-catalog', label: 'Shop Catalog', to: '/settings/shop-catalog' },
    ])

    expect(getAppShellAdminNavigationItems('payroll')).toEqual([
      { capability: 'manage-employees', label: 'Employees', to: '/employees' },
      { capability: 'use-timecard-export', label: 'Timecard Export', to: '/exports/timecards' },
    ])
    expect(getAppShellAdminNavigationItems('shop-foreman')).toEqual([
      { capability: 'manage-shop-catalog', label: 'Shop Catalog', to: '/settings/shop-catalog' },
    ])
    expect(getAppShellAdminNavigationItems('foreman')).toEqual([])
    expect(getAppShellAdminNavigationItems('project-manager')).toEqual([])
    expect(getAppShellAdminNavigationItems('none')).toEqual([])
  })

  it('keeps app-shell role labels centralized with current role behavior', () => {
    expect(getAppShellRoleLabel('admin')).toBe('Admin')
    expect(getAppShellRoleLabel('project-manager')).toBe('Project Manager')
    expect(getAppShellRoleLabel('foreman')).toBe('Foreman')
    expect(getAppShellRoleLabel('none')).toBe('Workspace')
  })
})
