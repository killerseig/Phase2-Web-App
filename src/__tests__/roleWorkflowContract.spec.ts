import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  targetRoleCanCreateFieldWorkflow,
  targetRoleCanOpenFieldWorkflow,
  targetRoleCanSubmitFieldWorkflow,
} from '@/auth/targetFieldWorkflowAccess'
import {
  targetRoleCanCreateJobs,
  targetRoleCanDeleteOrArchiveJobs,
  targetRoleCanEditJobSetup,
  targetRoleCanOpenJobDashboard,
  targetRoleCanSeeJobListEntry,
} from '@/auth/targetJobAccess'
import { getTargetRoleCapabilities } from '@/auth/targetRoleCapabilities'
import {
  targetRoleCanLockTimecards,
  targetRoleCanUseJobTimecardWorkflow,
  targetRoleCanUseTimecardExport,
  targetRoleCanViewSubmittedTimecards,
} from '@/auth/targetTimecardAccess'
import { canWriteFieldWorkflowForJob } from '../../functions/src/fieldWorkflowAccess'
import type { CurrentFunctionUser } from '../../functions/src/roleAccess'
import { canCreateTimecardWeekForJob } from '../../functions/src/timecardWeekAccess'

function functionUser(
  role: CurrentFunctionUser['role'],
  uid: string,
  assignedJobIds: string[] = [],
): CurrentFunctionUser {
  return {
    active: true,
    assignedJobIds,
    displayName: `${role} User`,
    role,
    uid,
  }
}

describe('role workflow contract', () => {
  it('keeps Admin as the only full-access role', () => {
    const capabilities = getTargetRoleCapabilities('admin')

    expect(capabilities.manageUsers).toBe(true)
    expect(capabilities.manageEmployees).toBe(true)
    expect(capabilities.manageShopCatalog).toBe(true)
    expect(targetRoleCanCreateJobs('admin')).toBe(true)
    expect(targetRoleCanDeleteOrArchiveJobs('admin')).toBe(true)
    expect(targetRoleCanUseTimecardExport('admin')).toBe(true)
    expect(targetRoleCanLockTimecards('admin')).toBe(true)
    expect(targetRoleCanCreateFieldWorkflow({ role: 'admin', jobId: 'any-job' })).toBe(true)
    expect(targetRoleCanUseJobTimecardWorkflow({ role: 'admin', jobId: 'any-job' })).toBe(true)
  })

  it('keeps Payroll scoped to employees, job creation, and timecard export', () => {
    const capabilities = getTargetRoleCapabilities('payroll')

    expect(capabilities.manageEmployees).toBe(true)
    expect(capabilities.manageUsers).toBe(false)
    expect(capabilities.manageShopCatalog).toBe(false)
    expect(targetRoleCanCreateJobs('payroll')).toBe(true)
    expect(targetRoleCanDeleteOrArchiveJobs('payroll')).toBe(false)
    expect(targetRoleCanUseTimecardExport('payroll')).toBe(true)
    expect(targetRoleCanLockTimecards('payroll')).toBe(true)
    expect(targetRoleCanOpenJobDashboard({ role: 'payroll', jobId: 'job-a' })).toBe(false)
    expect(targetRoleCanCreateFieldWorkflow({ role: 'payroll', jobId: 'job-a' })).toBe(false)
    expect(targetRoleCanUseJobTimecardWorkflow({ role: 'payroll', jobId: 'job-a' })).toBe(false)
  })

  it('allows Foremen to work assigned job dashboards, timecards, daily logs, and shop orders', () => {
    const assignedInput = { role: 'foreman' as const, jobId: 'job-a', assignedJobIds: ['job-a'] }
    const unassignedInput = { role: 'foreman' as const, jobId: 'job-a', assignedJobIds: ['job-b'] }

    expect(targetRoleCanSeeJobListEntry(assignedInput)).toBe(true)
    expect(targetRoleCanOpenJobDashboard(assignedInput)).toBe(true)
    expect(targetRoleCanOpenFieldWorkflow(assignedInput)).toBe(true)
    expect(targetRoleCanCreateFieldWorkflow(assignedInput)).toBe(true)
    expect(targetRoleCanSubmitFieldWorkflow(assignedInput)).toBe(true)
    expect(targetRoleCanUseJobTimecardWorkflow(assignedInput)).toBe(true)

    expect(targetRoleCanSeeJobListEntry(unassignedInput)).toBe(false)
    expect(targetRoleCanCreateFieldWorkflow(unassignedInput)).toBe(false)
    expect(targetRoleCanUseJobTimecardWorkflow(unassignedInput)).toBe(false)
  })

  it('allows stale-profile Foremen when the job record contains the assignment', () => {
    const foreman = functionUser('foreman', 'foreman-uid')
    const job = {
      assignedForemanIds: ['foreman-uid'],
      name: 'Lucky 3 Ranch',
      number: '5229',
    }

    expect(canWriteFieldWorkflowForJob(foreman, 'job-a', job, 'create')).toBe(true)
    expect(canWriteFieldWorkflowForJob(foreman, 'job-a', job, 'submit')).toBe(true)
    expect(canCreateTimecardWeekForJob(foreman, 'job-a', job)).toBe(true)
  })

  it('allows Shop Foremen to run the shop job and read all jobs without general admin rights', () => {
    const capabilities = getTargetRoleCapabilities('shop-foreman')
    const shopJob = { role: 'shop-foreman' as const, jobId: 'shop-job', isShopJob: true }
    const regularJob = { role: 'shop-foreman' as const, jobId: 'job-a', isShopJob: false }

    expect(capabilities.viewAllJobs).toBe(true)
    expect(capabilities.manageShopCatalog).toBe(true)
    expect(capabilities.manageUsers).toBe(false)
    expect(capabilities.manageEmployees).toBe(false)
    expect(targetRoleCanCreateFieldWorkflow(shopJob)).toBe(true)
    expect(targetRoleCanUseJobTimecardWorkflow(shopJob)).toBe(true)
    expect(targetRoleCanCreateFieldWorkflow(regularJob)).toBe(false)
    expect(targetRoleCanUseJobTimecardWorkflow(regularJob)).toBe(false)
  })

  it('keeps Project Managers assigned-job scoped with field workflow access but no timecard editing', () => {
    const assignedInput = {
      role: 'project-manager' as const,
      jobId: 'job-a',
      assignedJobIds: ['job-a'],
    }
    const unassignedInput = {
      role: 'project-manager' as const,
      jobId: 'job-a',
      assignedJobIds: ['job-b'],
    }

    expect(targetRoleCanSeeJobListEntry(assignedInput)).toBe(true)
    expect(targetRoleCanOpenJobDashboard(assignedInput)).toBe(true)
    expect(targetRoleCanEditJobSetup(assignedInput)).toBe(true)
    expect(targetRoleCanOpenFieldWorkflow(assignedInput)).toBe(true)
    expect(targetRoleCanCreateFieldWorkflow(assignedInput)).toBe(true)
    expect(targetRoleCanSubmitFieldWorkflow(assignedInput)).toBe(true)
    expect(targetRoleCanUseJobTimecardWorkflow(assignedInput)).toBe(false)
    expect(targetRoleCanViewSubmittedTimecards(assignedInput)).toBe(true)

    expect(targetRoleCanSeeJobListEntry(unassignedInput)).toBe(false)
    expect(targetRoleCanEditJobSetup(unassignedInput)).toBe(false)
    expect(targetRoleCanOpenFieldWorkflow(unassignedInput)).toBe(false)
    expect(targetRoleCanViewSubmittedTimecards(unassignedInput)).toBe(false)
  })

  it('keeps Firestore rules aligned with the role contract at the critical predicates', () => {
    const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8')

    expect(rules).toContain('function hasFieldAssigneeRole()')
    expect(rules).toContain('hasForemanRole() || hasShopForemanRole() || hasProjectManagerRole()')
    expect(rules).toContain('function isFieldEditorRole()')
    expect(rules).toContain('hasForemanRole() || hasShopForemanRole()')
    expect(rules).toContain('function hasFieldWorkflowWriteAccess(jobId)')
    expect(rules).toContain('isFieldWorkflowEditorRole() && isForemanAssigned(jobId)')
    expect(rules).toContain('function canViewAllJobs()')
    expect(rules).toContain('hasAdminRole() || hasPayrollRole() || hasShopForemanRole()')
    expect(rules).toContain('function canUseTimecardExport()')
    expect(rules).toContain('isAdmin() || isPayroll()')
    expect(rules).toContain('function foremanCanWorkWeek(weekData)')
    expect(rules).toContain('return canUseTimecards() && hasJobWriteAccess(weekData.jobId);')
    expect(rules).toContain('allow write: if false;')
    expect(rules).not.toContain('.changedKeys()')
    expect(rules).toContain('match /dailyLogs/{logId}')
    expect(rules).toContain('match /shopOrders/{orderId}')
    expect(rules).toContain('match /timecardWeeks/{weekId}')
  })

  it('keeps shop order callables open to assigned Project Managers', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'functions/src/shopOrderRecordFunctions.ts'),
      'utf8',
    )
    const shopOrderFieldRoleList =
      "currentFunctionUserHasAnyRole(user, ['admin', 'foreman', 'shop-foreman', 'project-manager'])"

    expect(source.split(shopOrderFieldRoleList).length - 1).toBe(2)
  })

  it('requires job authorization as well as file validation for attachments', () => {
    const rules = readFileSync(resolve(process.cwd(), 'storage.rules'), 'utf8')

    expect(rules).toContain('function isSupportedDailyLogAttachmentUpload(logId)')
    expect(rules).toContain('request.resource.size < 10 * 1024 * 1024')
    expect(rules).toContain("request.resource.contentType in ['image/jpeg', 'image/png', 'image/webp']")
    expect(rules).toContain("request.resource.metadata.variant == 'gallery-photo'")
    expect(rules).toContain('function isSupportedDailyLogThumbnailUpload(logId)')
    expect(rules).toContain('request.resource.size <= 300 * 1024')
    expect(rules).toContain("request.resource.contentType == 'image/jpeg'")
    expect(rules).toContain("request.resource.metadata.variant == 'email-thumbnail'")
    expect(rules).toContain('request.resource.metadata.dailyLogId == logId')
    expect(rules).toContain('request.resource.metadata.uploadedBy == request.auth.uid')
    expect(rules).toContain('allow read: if canReadLog(logId);')
    expect(rules).toContain(
      'allow create: if canEditLog(logId) && isSupportedDailyLogAttachmentUpload(logId);',
    )
    expect(rules).toContain('allow delete: if canEditLog(logId);')
    expect(rules).toContain('allow update: if false;')
    expect(rules).toContain('firestore.get(')
    expect(rules).toContain('request.resource.metadata.jobId == log(logId).jobId')
    expect(rules).toContain('match /daily-logs/{logId}/thumbnails/{fileName}')
    expect(rules).toContain('match /daily-logs/{logId}/{fileName}')
  })
})
