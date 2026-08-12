import { describe, expect, it } from 'vitest'
import {
  getTargetAppShellAdminNavigationItems,
  getTargetAppShellRoleLabel,
  getTargetAppShellWorkspaceNavigationItems,
} from '@/features/navigation/targetAppShellNavigation'

function adminLabels(role: Parameters<typeof getTargetAppShellAdminNavigationItems>[0]) {
  return getTargetAppShellAdminNavigationItems(role).map((item) => item.label)
}

function workspaceLabels(role: Parameters<typeof getTargetAppShellWorkspaceNavigationItems>[0]) {
  return getTargetAppShellWorkspaceNavigationItems(role).map((item) => item.label)
}

describe('target app shell navigation policy', () => {
  it('gives every active target role the jobs workspace link while dashboards are hidden', () => {
    expect(workspaceLabels('admin')).toEqual(['Jobs'])
    expect(workspaceLabels('payroll')).toEqual(['Jobs'])
    expect(workspaceLabels('shop-foreman')).toEqual(['Jobs'])
    expect(workspaceLabels('project-manager')).toEqual(['Jobs'])
    expect(workspaceLabels('foreman')).toEqual(['Jobs'])
  })

  it('keeps no-access users out of target workspace navigation', () => {
    expect(getTargetAppShellWorkspaceNavigationItems('none')).toEqual([])
  })

  it('shows admins every target protected admin navigation link', () => {
    expect(getTargetAppShellAdminNavigationItems('admin')).toEqual([
      { capability: 'manage-users', label: 'Users', to: '/users' },
      { capability: 'manage-employees', label: 'Employees', to: '/employees' },
      { capability: 'use-timecard-export', label: 'Timecard Export', to: '/exports/timecards' },
      { capability: 'manage-shop-catalog', label: 'Shop Catalog', to: '/settings/shop-catalog' },
    ])
  })

  it('limits payroll target navigation to employees and timecard export', () => {
    expect(adminLabels('payroll')).toEqual(['Employees', 'Timecard Export'])
  })

  it('limits shop foreman target navigation to shop catalog setup', () => {
    expect(adminLabels('shop-foreman')).toEqual(['Shop Catalog'])
  })

  it('keeps project managers and foremen out of target admin navigation', () => {
    expect(getTargetAppShellAdminNavigationItems('project-manager')).toEqual([])
    expect(getTargetAppShellAdminNavigationItems('foreman')).toEqual([])
    expect(getTargetAppShellAdminNavigationItems('none')).toEqual([])
  })

  it('centralizes app shell labels on the target role names', () => {
    expect(getTargetAppShellRoleLabel('admin')).toBe('Admin')
    expect(getTargetAppShellRoleLabel('payroll')).toBe('Payroll')
    expect(getTargetAppShellRoleLabel('shop-foreman')).toBe('Shop Foreman')
    expect(getTargetAppShellRoleLabel('project-manager')).toBe('Project Manager')
    expect(getTargetAppShellRoleLabel('foreman')).toBe('Foreman')
    expect(getTargetAppShellRoleLabel('none')).toBe('No Access')
  })

  it('returns fresh records so callers cannot mutate the canonical policy', () => {
    const workspaceItems = getTargetAppShellWorkspaceNavigationItems('foreman')
    const adminItems = getTargetAppShellAdminNavigationItems('admin')

    const jobsItem = workspaceItems[0]
    const usersItem = adminItems[0]

    expect(jobsItem).toBeDefined()
    expect(usersItem).toBeDefined()
    if (!jobsItem || !usersItem) return

    jobsItem.label = 'Changed'
    usersItem.label = 'Changed'

    expect(getTargetAppShellWorkspaceNavigationItems('foreman')[0]?.label).toBe('Jobs')
    expect(getTargetAppShellAdminNavigationItems('admin')[0]?.label).toBe('Users')
  })
})
