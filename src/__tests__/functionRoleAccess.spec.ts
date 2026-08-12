import { describe, expect, it } from 'vitest'

import {
  buildCurrentFunctionUser,
  canSendInviteForStoredRole,
  currentFunctionUserCanAccessAssignedJob,
  currentFunctionUserHasAnyRole,
  getCurrentFunctionRole,
  getFunctionAssignedJobIds,
  getFunctionDisplayName,
  isValidStoredRole,
  normalizeStoredRole,
} from '../../functions/src/roleAccess'

describe('Cloud Functions role access helpers', () => {
  it('recognizes the stored role catalog used by frontend and backend records', () => {
    expect(isValidStoredRole('admin')).toBe(true)
    expect(isValidStoredRole('payroll')).toBe(true)
    expect(isValidStoredRole('shop-foreman')).toBe(true)
    expect(isValidStoredRole('project-manager')).toBe(true)
    expect(isValidStoredRole('foreman')).toBe(true)
    expect(isValidStoredRole('none')).toBe(true)
    expect(isValidStoredRole('controller')).toBe(false)

    expect(normalizeStoredRole(' PAYROLL ')).toBe('payroll')
    expect(normalizeStoredRole('SHOP-FOREMAN')).toBe('shop-foreman')
    expect(normalizeStoredRole('Shop Foreman')).toBe('shop-foreman')
    expect(normalizeStoredRole('shop_foreman')).toBe('shop-foreman')
    expect(normalizeStoredRole('shopForeman')).toBe('shop-foreman')
    expect(normalizeStoredRole('Project Manager')).toBe('project-manager')
    expect(normalizeStoredRole('project_manager')).toBe('project-manager')
    expect(normalizeStoredRole('projectManager')).toBe('project-manager')
    expect(normalizeStoredRole('controller')).toBe('none')
    expect(normalizeStoredRole(null)).toBe('none')
  })

  it('preserves live target roles for callable authorization decisions', () => {
    expect(getCurrentFunctionRole('admin')).toBe('admin')
    expect(getCurrentFunctionRole('foreman')).toBe('foreman')
    expect(getCurrentFunctionRole('project-manager')).toBe('project-manager')
    expect(getCurrentFunctionRole('payroll')).toBe('payroll')
    expect(getCurrentFunctionRole('shop-foreman')).toBe('shop-foreman')
    expect(getCurrentFunctionRole('controller')).toBe('none')
  })

  it('normalizes assigned jobs and display names from Firestore user records', () => {
    expect(getFunctionAssignedJobIds({
      assignedJobIds: [' job-a ', '', 123, 'job-b'],
    })).toEqual(['job-a', 'job-b'])
    expect(getFunctionAssignedJobIds({ assignedJobIds: null })).toEqual([])

    expect(getFunctionDisplayName({
      firstName: ' Chris ',
      lastName: ' Larsen ',
      email: 'chris@example.com',
    })).toBe('Chris Larsen')
    expect(getFunctionDisplayName({
      firstName: '',
      lastName: '',
      email: ' fallback@example.com ',
    })).toBe('fallback@example.com')
    expect(getFunctionDisplayName({})).toBeNull()
  })

  it('builds the current callable authorization user shape with live target roles intact', () => {
    expect(buildCurrentFunctionUser('user-a', {
      role: 'project-manager',
      active: true,
      assignedJobIds: [' job-a '],
      firstName: 'Vince',
      lastName: 'Hintz',
    })).toEqual({
      uid: 'user-a',
      role: 'project-manager',
      active: true,
      assignedJobIds: ['job-a'],
      displayName: 'Vince Hintz',
    })

    expect(buildCurrentFunctionUser('user-b', {
      role: 'shop-foreman',
      active: true,
      assignedJobIds: ['shop'],
      email: 'cj@example.com',
    })).toEqual({
      uid: 'user-b',
      role: 'shop-foreman',
      active: true,
      assignedJobIds: ['shop'],
      displayName: 'cj@example.com',
    })
  })

  it('treats missing active flags as active while honoring explicit inactive users', () => {
    expect(buildCurrentFunctionUser('legacy-user', {
      role: 'foreman',
      assignedJobIds: ['job-a'],
    }).active).toBe(true)

    expect(buildCurrentFunctionUser('inactive-user', {
      role: 'foreman',
      active: false,
      assignedJobIds: ['job-a'],
    }).active).toBe(false)
  })

  it('checks current callable roles and assigned-job access from the shared user shape', () => {
    const admin = buildCurrentFunctionUser('admin-a', { role: 'admin', active: true })
    const foreman = buildCurrentFunctionUser('foreman-a', {
      role: 'foreman',
      active: true,
      assignedJobIds: ['job-a'],
    })
    const payroll = buildCurrentFunctionUser('payroll-a', {
      role: 'payroll',
      active: true,
      assignedJobIds: ['job-a'],
    })
    const shopForeman = buildCurrentFunctionUser('shop-a', {
      role: 'shop-foreman',
      active: true,
      assignedJobIds: ['shop'],
    })
    const projectManager = buildCurrentFunctionUser('pm-a', {
      role: 'project-manager',
      active: true,
      assignedJobIds: ['job-a'],
    })

    expect(currentFunctionUserHasAnyRole(admin, ['admin', 'foreman'])).toBe(true)
    expect(currentFunctionUserHasAnyRole(foreman, ['admin', 'foreman'])).toBe(true)
    expect(currentFunctionUserHasAnyRole(payroll, ['admin', 'foreman'])).toBe(false)
    expect(currentFunctionUserHasAnyRole(shopForeman, ['shop-foreman'])).toBe(true)

    expect(currentFunctionUserCanAccessAssignedJob(admin, 'anything')).toBe(true)
    expect(currentFunctionUserCanAccessAssignedJob(foreman, 'job-a')).toBe(true)
    expect(currentFunctionUserCanAccessAssignedJob(foreman, 'job-b')).toBe(false)
    expect(currentFunctionUserCanAccessAssignedJob(payroll, 'job-a')).toBe(false)
    expect(currentFunctionUserCanAccessAssignedJob(shopForeman, 'shop')).toBe(true)
    expect(currentFunctionUserCanAccessAssignedJob(projectManager, 'job-a')).toBe(true)
  })

  it('allows pending invites for every valid active access role except no-access users', () => {
    expect(canSendInviteForStoredRole('admin')).toBe(true)
    expect(canSendInviteForStoredRole('payroll')).toBe(true)
    expect(canSendInviteForStoredRole('shop-foreman')).toBe(true)
    expect(canSendInviteForStoredRole('project-manager')).toBe(true)
    expect(canSendInviteForStoredRole('foreman')).toBe(true)
    expect(canSendInviteForStoredRole('none')).toBe(false)
    expect(canSendInviteForStoredRole('controller')).toBe(false)
  })
})
