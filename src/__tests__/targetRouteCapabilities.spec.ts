import { describe, expect, it } from 'vitest'

import {
  isTargetRouteCapability,
  targetRoleCanUseRouteCapability,
  targetRoleHasWorkspaceAccess,
} from '@/auth/targetRouteCapabilities'

describe('target route capabilities', () => {
  it('recognizes only known target route capability metadata values', () => {
    expect(isTargetRouteCapability('manage-users')).toBe(true)
    expect(isTargetRouteCapability('manage-employees')).toBe(true)
    expect(isTargetRouteCapability('manage-reference-lists')).toBe(true)
    expect(isTargetRouteCapability('manage-shop-catalog')).toBe(true)
    expect(isTargetRouteCapability('use-timecard-export')).toBe(true)
    expect(isTargetRouteCapability('manage-timecards')).toBe(false)
    expect(isTargetRouteCapability(null)).toBe(false)
  })

  it('allows only authenticated active target workspace roles into the workspace', () => {
    expect(targetRoleHasWorkspaceAccess({
      authenticated: true,
      active: true,
      role: 'admin',
    })).toBe(true)
    expect(targetRoleHasWorkspaceAccess({
      authenticated: true,
      active: true,
      role: 'payroll',
    })).toBe(true)
    expect(targetRoleHasWorkspaceAccess({
      authenticated: true,
      active: true,
      role: 'shop-foreman',
    })).toBe(true)
    expect(targetRoleHasWorkspaceAccess({
      authenticated: true,
      active: true,
      role: 'project-manager',
    })).toBe(true)
    expect(targetRoleHasWorkspaceAccess({
      authenticated: true,
      active: true,
      role: 'foreman',
    })).toBe(true)
    expect(targetRoleHasWorkspaceAccess({
      authenticated: true,
      active: true,
      role: 'none',
    })).toBe(false)
    expect(targetRoleHasWorkspaceAccess({
      authenticated: true,
      active: false,
      role: 'admin',
    })).toBe(false)
    expect(targetRoleHasWorkspaceAccess({
      authenticated: false,
      active: true,
      role: 'admin',
    })).toBe(false)
  })

  it('models Admin as able to use every target protected route capability', () => {
    expect(targetRoleCanUseRouteCapability('admin', 'manage-users')).toBe(true)
    expect(targetRoleCanUseRouteCapability('admin', 'manage-employees')).toBe(true)
    expect(targetRoleCanUseRouteCapability('admin', 'manage-reference-lists')).toBe(true)
    expect(targetRoleCanUseRouteCapability('admin', 'manage-shop-catalog')).toBe(true)
    expect(targetRoleCanUseRouteCapability('admin', 'use-timecard-export')).toBe(true)
  })

  it('models Payroll as Employees and Timecard Export access without setup/catalog/user routes', () => {
    expect(targetRoleCanUseRouteCapability('payroll', 'manage-employees')).toBe(true)
    expect(targetRoleCanUseRouteCapability('payroll', 'use-timecard-export')).toBe(true)
    expect(targetRoleCanUseRouteCapability('payroll', 'manage-users')).toBe(false)
    expect(targetRoleCanUseRouteCapability('payroll', 'manage-reference-lists')).toBe(false)
    expect(targetRoleCanUseRouteCapability('payroll', 'manage-shop-catalog')).toBe(false)
  })

  it('models Shop Foreman as Shop Catalog access without other protected admin routes', () => {
    expect(targetRoleCanUseRouteCapability('shop-foreman', 'manage-shop-catalog')).toBe(true)
    expect(targetRoleCanUseRouteCapability('shop-foreman', 'manage-users')).toBe(false)
    expect(targetRoleCanUseRouteCapability('shop-foreman', 'manage-employees')).toBe(false)
    expect(targetRoleCanUseRouteCapability('shop-foreman', 'manage-reference-lists')).toBe(false)
    expect(targetRoleCanUseRouteCapability('shop-foreman', 'use-timecard-export')).toBe(false)
  })

  it('keeps Project Manager, Foreman, and no-access users out of protected admin routes', () => {
    for (const role of ['project-manager', 'foreman', 'none'] as const) {
      expect(targetRoleCanUseRouteCapability(role, 'manage-users')).toBe(false)
      expect(targetRoleCanUseRouteCapability(role, 'manage-employees')).toBe(false)
      expect(targetRoleCanUseRouteCapability(role, 'manage-reference-lists')).toBe(false)
      expect(targetRoleCanUseRouteCapability(role, 'manage-shop-catalog')).toBe(false)
      expect(targetRoleCanUseRouteCapability(role, 'use-timecard-export')).toBe(false)
    }
  })
})
