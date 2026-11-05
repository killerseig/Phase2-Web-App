import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TimecardWorkbookCard from '@/components/timecards/TimecardWorkbookCard.vue'
import { buildEmployeeCard } from './workbook'
import { getRouteAccessDecision } from '@/router/routeAccess'
import { getAppShellWorkspaceNavigationItems, getAppShellAdminNavigationItems } from '@/features/navigation/appShellNavigation'
import { getTargetRoleCapabilities } from '@/auth/targetRoleCapabilities'
import { normalizeStoredRoleKey, EDITABLE_USER_ROLE_OPTIONS, currentRoleCanBeAssignedJobs, currentRoleCanHaveAccountJobAssignments } from '@/auth/roles'
import { buildCurrentFunctionUser } from '../../../functions/src/roleAccess'
import { personalAssignedJobIds, personalCurrentWeekEnd } from '../../../functions/src/personalTimecardWorkspace'

describe('restricted employee timecard access', () => {
  it('recognizes the stored role without granting general backend workforce access', () => {
    expect(normalizeStoredRoleKey('Employee')).toBe('employee')
    expect(EDITABLE_USER_ROLE_OPTIONS).toContainEqual({ label: 'Employee', value: 'employee' })
    expect(buildCurrentFunctionUser('self', { role: 'employee', active: true }).role).toBe('none')
    expect(getAppShellWorkspaceNavigationItems('employee')).toEqual([])
    expect(getAppShellAdminNavigationItems('employee')).toEqual([])
    expect(Object.entries(getTargetRoleCapabilities('employee')).filter(([, value]) => value).map(([key]) => key)).toEqual(['accessWorkspace'])
  })
  it.each(['jobs', 'reports', 'company-library', 'form-builder', 'users', 'timecards', 'form-response', 'public-website', 'login'])('redirects employee away from %s', routeName => {
    expect(getRouteAccessDecision({ rawRole: 'employee', hasWorkspaceAccess: true, routeName, routeJobId: 'assigned', assignedJobIds: ['assigned'], requiresAuth: false })).toEqual({ name: 'my-timecard' })
  })
  it('preserves admin and field privileges while allowing personal assignment data', () => {
    expect(currentRoleCanHaveAccountJobAssignments('admin')).toBe(true)
    expect(currentRoleCanBeAssignedJobs('admin')).toBe(false)
    expect(currentRoleCanHaveAccountJobAssignments('payroll')).toBe(false)
    expect(getAppShellAdminNavigationItems('admin').some(item => item.to === '/users')).toBe(true)
    for (const role of ['admin', 'foreman', 'shop-foreman', 'project-manager'] as const) {
      expect(getAppShellWorkspaceNavigationItems(role).some(item => item.to === '/jobs/my-timecard')).toBe(false)
      expect(getAppShellWorkspaceNavigationItems(role).some(item => item.to === '/jobs')).toBe(true)
    }
  })
  it('allows only the personal workspace and still rejects inactive accounts', () => {
    expect(getRouteAccessDecision({ rawRole: 'employee', hasWorkspaceAccess: true, routeName: 'my-timecard', routeJobId: '' })).toBe(true)
    expect(getRouteAccessDecision({ rawRole: 'employee', hasWorkspaceAccess: false, routeName: 'my-timecard', routeJobId: '' })).toEqual({ name: 'login' })
  })
  it('combines only explicit payroll and account assignments, never a role-wide job list', () => {
    expect(personalAssignedJobIds({ jobId: 'primary' }, ['second', 'primary', '', 'bad/path'])).toEqual(['primary', 'second'])
    expect(personalAssignedJobIds({}, [])).toEqual([])
  })
  it.each([
    ['2026-11-08T05:59:00Z', '2026-11-07'],
    ['2026-11-08T07:01:00Z', '2026-11-14'],
    ['2026-03-08T08:01:00Z', '2026-03-14'],
  ])('uses the payroll local date at %s', (now, expected) => {
    expect(personalCurrentWeekEnd(new Date(now))).toBe(expected)
  })
  it('uses the real worksheet while protecting payroll fields and keeping notes editable', async () => {
    const card = { id: 'own', ...buildEmployeeCard({ employeeId: 'self', firstName: 'Test', lastName: 'Employee', employeeNumber: 'T1', occupation: 'Painter', wageRate: null, isContractor: false }, '2026-11-07', 0) }
    const wrapper = mount(TimecardWorkbookCard, { props: { card, weekEndDate: '2026-11-07', personalEntry: true, showEmployeeWage: false, showCostValues: false } })
    expect(wrapper.find('.timecard-card__sheet').exists()).toBe(true)
    expect(wrapper.get('[data-testid="timecard-account-0"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[aria-label="Line 1 MON hours"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[aria-label="Line 1 MON production"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.timecard-grid__diff-cell input').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.timecard-card__footer-input').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="timecard-notes-input"]').attributes('disabled')).toBeUndefined()
    await wrapper.setProps({ readOnly: true })
    expect(wrapper.findAll('input').every(input => input.attributes('disabled') !== undefined)).toBe(true)
    wrapper.unmount()
  })
})
