import { describe, expect, it } from 'vitest'
import { getTargetRoleDashboardModules } from '@/features/dashboard/roleDashboardModules'

function getModuleKeys(role: Parameters<typeof getTargetRoleDashboardModules>[0]) {
  return getTargetRoleDashboardModules(role).map((module) => module.key)
}

describe('target role dashboard modules', () => {
  it('gives admins every current role-dashboard module in a stable priority order', () => {
    expect(getModuleKeys('admin')).toEqual([
      'users',
      'employees',
      'job-setup',
      'jobs-lookup',
      'assigned-job-dashboards',
      'shop-job-dashboard',
      'submitted-timecards',
      'timecard-export',
      'shop-catalog',
    ])
  })

  it('models payroll as employees, job creation, all-job lookup, and timecard export', () => {
    expect(getModuleKeys('payroll')).toEqual([
      'employees',
      'job-setup',
      'jobs-lookup',
      'timecard-export',
    ])
  })

  it('models shop foremen around shop catalog, all-job lookup, and shop/assigned job dashboards', () => {
    expect(getModuleKeys('shop-foreman')).toEqual([
      'jobs-lookup',
      'assigned-job-dashboards',
      'shop-job-dashboard',
      'shop-catalog',
    ])
  })

  it('models project managers around assigned jobs and billing timecards only', () => {
    expect(getModuleKeys('project-manager')).toEqual([
      'assigned-job-dashboards',
      'submitted-timecards',
    ])
  })

  it('models foremen around assigned field-workflow job dashboards only', () => {
    expect(getModuleKeys('foreman')).toEqual([
      'assigned-job-dashboards',
    ])
  })

  it('keeps no-access users without dashboard modules', () => {
    expect(getTargetRoleDashboardModules('none')).toEqual([])
  })

  it('returns fresh module records so callers cannot mutate the canonical policy', () => {
    const modules = getTargetRoleDashboardModules('payroll')
    const employeesModule = modules[0]

    expect(employeesModule).toBeDefined()
    if (!employeesModule) return

    employeesModule.label = 'Changed'

    expect(getTargetRoleDashboardModules('payroll')[0]?.label).toBe('Employees')
  })
})
