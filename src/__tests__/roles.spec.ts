import { describe, expect, it } from 'vitest'

import {
  CURRENT_DEFAULT_EDITABLE_USER_ROLE,
  CURRENT_EDITABLE_USER_ROLE_KEYS,
  CURRENT_ROLE_LABELS,
  CURRENT_STORED_ROLE_KEYS,
  EDITABLE_USER_ROLE_OPTIONS,
  currentRoleCanBeAssignedJobs,
  getCurrentEffectiveRole,
  getStoredRoleLabel,
  isCurrentStoredRoleKey,
  isEditableUserRole,
  normalizeEditableUserRole,
  normalizeStoredRoleKey,
} from '@/auth/roles'

describe('auth role helpers', () => {
  it('keeps the runtime role catalog explicit with every live target role assignable', () => {
    expect(CURRENT_STORED_ROLE_KEYS).toEqual([
      'admin',
      'payroll',
      'shop-foreman',
      'project-manager',
      'foreman',
      'none',
    ])
    expect(CURRENT_EDITABLE_USER_ROLE_KEYS).toEqual([
      'admin',
      'payroll',
      'shop-foreman',
      'project-manager',
      'foreman',
    ])
    expect(CURRENT_DEFAULT_EDITABLE_USER_ROLE).toBe('foreman')
  })

  it('lists every live target role as editable except no-access', () => {
    expect(EDITABLE_USER_ROLE_OPTIONS).toEqual([
      { label: 'Admin', value: 'admin' },
      { label: 'Payroll', value: 'payroll' },
      { label: 'Shop Foreman', value: 'shop-foreman' },
      { label: 'Project Manager', value: 'project-manager' },
      { label: 'Foreman', value: 'foreman' },
    ])
  })

  it('labels stored roles for user-facing badges', () => {
    expect(CURRENT_ROLE_LABELS).toEqual({
      admin: 'Admin',
      payroll: 'Payroll',
      'shop-foreman': 'Shop Foreman',
      'project-manager': 'Project Manager',
      foreman: 'Foreman',
      none: 'No Access',
    })
    expect(getStoredRoleLabel('admin')).toBe('Admin')
    expect(getStoredRoleLabel('payroll')).toBe('Payroll')
    expect(getStoredRoleLabel('shop-foreman')).toBe('Shop Foreman')
    expect(getStoredRoleLabel('project-manager')).toBe('Project Manager')
    expect(getStoredRoleLabel('foreman')).toBe('Foreman')
    expect(getStoredRoleLabel('none')).toBe('No Access')
  })

  it('normalizes stored roles through the recognized runtime catalog', () => {
    expect(isCurrentStoredRoleKey('admin')).toBe(true)
    expect(isCurrentStoredRoleKey('payroll')).toBe(true)
    expect(isCurrentStoredRoleKey('shop-foreman')).toBe(true)
    expect(isCurrentStoredRoleKey('project-manager')).toBe(true)
    expect(normalizeStoredRoleKey(' Admin ')).toBe('admin')
    expect(normalizeStoredRoleKey(' Payroll ')).toBe('payroll')
    expect(normalizeStoredRoleKey('SHOP-FOREMAN')).toBe('shop-foreman')
    expect(normalizeStoredRoleKey('Shop Foreman')).toBe('shop-foreman')
    expect(normalizeStoredRoleKey('shop_foreman')).toBe('shop-foreman')
    expect(normalizeStoredRoleKey('shopForeman')).toBe('shop-foreman')
    expect(normalizeStoredRoleKey('PROJECT-MANAGER')).toBe('project-manager')
    expect(normalizeStoredRoleKey('Project Manager')).toBe('project-manager')
    expect(normalizeStoredRoleKey('project_manager')).toBe('project-manager')
    expect(normalizeStoredRoleKey('projectManager')).toBe('project-manager')
    expect(normalizeStoredRoleKey('controller')).toBe('none')
    expect(normalizeStoredRoleKey(null)).toBe('none')
  })

  it('keeps the legacy coarse effective-role mapping while target assignment policy is live', () => {
    expect(getCurrentEffectiveRole('admin')).toBe('admin')
    expect(getCurrentEffectiveRole('payroll')).toBe('none')
    expect(getCurrentEffectiveRole('shop-foreman')).toBe('none')
    expect(getCurrentEffectiveRole('project-manager')).toBe('foreman')
    expect(getCurrentEffectiveRole('foreman')).toBe('foreman')
    expect(getCurrentEffectiveRole('none')).toBe('none')
    expect(currentRoleCanBeAssignedJobs('admin')).toBe(false)
    expect(currentRoleCanBeAssignedJobs('payroll')).toBe(false)
    expect(currentRoleCanBeAssignedJobs('shop-foreman')).toBe(true)
    expect(currentRoleCanBeAssignedJobs('project-manager')).toBe(true)
    expect(currentRoleCanBeAssignedJobs('foreman')).toBe(true)
    expect(currentRoleCanBeAssignedJobs('none')).toBe(false)
  })

  it('normalizes every live target role and rejects no-access as editable', () => {
    expect(isEditableUserRole('admin')).toBe(true)
    expect(isEditableUserRole('payroll')).toBe(true)
    expect(isEditableUserRole('shop-foreman')).toBe(true)
    expect(isEditableUserRole('project-manager')).toBe(true)
    expect(isEditableUserRole('foreman')).toBe(true)
    expect(isEditableUserRole('none')).toBe(false)

    expect(normalizeEditableUserRole('admin')).toBe('admin')
    expect(normalizeEditableUserRole('payroll')).toBe('payroll')
    expect(normalizeEditableUserRole('shop-foreman')).toBe('shop-foreman')
    expect(normalizeEditableUserRole('project-manager')).toBe('project-manager')
    expect(normalizeEditableUserRole('foreman')).toBe('foreman')
    expect(normalizeEditableUserRole('none')).toBe('foreman')
  })
})
