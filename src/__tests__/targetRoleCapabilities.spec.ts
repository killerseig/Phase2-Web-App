import { describe, expect, it } from 'vitest'

import { EDITABLE_USER_ROLE_OPTIONS } from '@/auth/roles'
import {
  getTargetRoleCapabilities,
  getTargetRoleLabel,
  isTargetRoleKey,
  normalizeTargetRoleKey,
  TARGET_BUILT_IN_ROLE_KEYS,
  targetRoleCanBeAssignedJobs,
} from '@/auth/targetRoleCapabilities'

describe('target role capabilities', () => {
  it('documents the v1 built-in role order and exposes live target roles in user controls', () => {
    expect(TARGET_BUILT_IN_ROLE_KEYS).toEqual([
      'admin',
      'payroll',
      'shop-foreman',
      'project-manager',
      'foreman',
    ])
    expect(EDITABLE_USER_ROLE_OPTIONS).toEqual([
      { label: 'Admin', value: 'admin' },
      { label: 'Payroll', value: 'payroll' },
      { label: 'Shop Foreman', value: 'shop-foreman' },
      { label: 'Project Manager', value: 'project-manager' },
      { label: 'Foreman', value: 'foreman' },
    ])
  })

  it('normalizes and labels target roles', () => {
    expect(isTargetRoleKey('payroll')).toBe(true)
    expect(isTargetRoleKey('shop-foreman')).toBe(true)
    expect(isTargetRoleKey('controller')).toBe(false)
    expect(normalizeTargetRoleKey(' Payroll ')).toBe('payroll')
    expect(normalizeTargetRoleKey('SHOP-FOREMAN')).toBe('shop-foreman')
    expect(normalizeTargetRoleKey('Shop Foreman')).toBe('shop-foreman')
    expect(normalizeTargetRoleKey('shop_foreman')).toBe('shop-foreman')
    expect(normalizeTargetRoleKey('shopForeman')).toBe('shop-foreman')
    expect(normalizeTargetRoleKey('Project Manager')).toBe('project-manager')
    expect(normalizeTargetRoleKey('project_manager')).toBe('project-manager')
    expect(normalizeTargetRoleKey('projectManager')).toBe('project-manager')
    expect(normalizeTargetRoleKey('controller')).toBe('none')
    expect(getTargetRoleLabel('shop-foreman')).toBe('Shop Foreman')
    expect(getTargetRoleLabel(undefined)).toBe('No Access')
  })

  it('keeps Admin as the only full-access target role', () => {
    expect(getTargetRoleCapabilities('admin')).toMatchObject({
      accessWorkspace: true,
      createJobs: true,
      deleteOrArchiveJobs: true,
      deleteDraftTimecardWeeks: true,
      editAllJobs: true,
      editAssignedFieldWorkflows: true,
      editAssignedTimecards: true,
      editShopJobFieldWorkflows: true,
      manageEmployees: true,
      manageReferenceLists: true,
      manageShopCatalog: true,
      manageUsers: true,
      lockTimecards: true,
      useAssignedJobDashboards: true,
      useShopJobDashboard: true,
      useTimecardExport: true,
      viewAllJobs: true,
      viewSubmittedAssignedTimecards: true,
    })
  })

  it('models Payroll as employees, timecard export, job creation, and read-only job lookup', () => {
    expect(getTargetRoleCapabilities('payroll')).toMatchObject({
      accessWorkspace: true,
      createJobs: true,
      deleteOrArchiveJobs: false,
      deleteDraftTimecardWeeks: true,
      editAllJobs: false,
      editAssignedFieldWorkflows: false,
      editAssignedTimecards: false,
      editAssignedJobs: false,
      editShopJobFieldWorkflows: false,
      lockTimecards: true,
      manageEmployees: true,
      manageShopCatalog: false,
      useAssignedJobDashboards: false,
      useTimecardExport: true,
      viewAllJobs: true,
    })
  })

  it('models Shop Foreman as shop catalog plus Shop job workflow access without job setup editing', () => {
    expect(getTargetRoleCapabilities('shop-foreman')).toMatchObject({
      accessWorkspace: true,
      createJobs: false,
      deleteOrArchiveJobs: false,
      deleteDraftTimecardWeeks: false,
      editAllJobs: false,
      editAssignedFieldWorkflows: true,
      editAssignedTimecards: true,
      editAssignedJobs: false,
      editShopJobFieldWorkflows: true,
      editShopJobTimecards: true,
      lockTimecards: false,
      manageEmployees: false,
      manageShopCatalog: true,
      receiveShopJobFieldEmails: true,
      useAssignedJobDashboards: true,
      useShopJobDashboard: true,
      useTimecardExport: false,
      viewAllJobs: true,
    })
  })

  it('models Project Manager as assigned-job setup, field workflow, and reporting access without admin areas', () => {
    expect(getTargetRoleCapabilities('project-manager')).toMatchObject({
      accessWorkspace: true,
      createJobs: false,
      deleteOrArchiveJobs: false,
      deleteDraftTimecardWeeks: false,
      editAllJobs: false,
      editAssignedFieldWorkflows: true,
      editAssignedTimecards: false,
      editAssignedJobs: true,
      editShopJobFieldWorkflows: false,
      editShopJobTimecards: false,
      lockTimecards: false,
      manageEmployees: false,
      manageShopCatalog: false,
      manageUsers: false,
      receiveAssignedJobFieldEmails: true,
      useAssignedJobDashboards: true,
      useShopJobDashboard: false,
      useTimecardExport: false,
      viewAllJobs: false,
      viewSubmittedAssignedTimecards: true,
    })
  })

  it('models Foreman as assigned-job field workflow access only', () => {
    expect(getTargetRoleCapabilities('foreman')).toMatchObject({
      accessWorkspace: true,
      createJobs: false,
      deleteOrArchiveJobs: false,
      deleteDraftTimecardWeeks: false,
      editAssignedFieldWorkflows: true,
      editAssignedTimecards: true,
      editAssignedJobs: false,
      editShopJobFieldWorkflows: false,
      editShopJobTimecards: false,
      lockTimecards: false,
      manageEmployees: false,
      manageShopCatalog: false,
      receiveAssignedJobFieldEmails: true,
      useAssignedJobDashboards: true,
      useShopJobDashboard: false,
      useTimecardExport: false,
      viewAllJobs: false,
      viewSubmittedAssignedTimecards: false,
    })
  })

  it('keeps no-access users outside every target capability', () => {
    expect(Object.values(getTargetRoleCapabilities('none')).every((value) => value === false)).toBe(true)
  })

  it('limits job assignment roles to field-facing operational roles', () => {
    expect(targetRoleCanBeAssignedJobs('admin')).toBe(false)
    expect(targetRoleCanBeAssignedJobs('payroll')).toBe(false)
    expect(targetRoleCanBeAssignedJobs('project-manager')).toBe(true)
    expect(targetRoleCanBeAssignedJobs('shop-foreman')).toBe(true)
    expect(targetRoleCanBeAssignedJobs('foreman')).toBe(true)
  })
})
