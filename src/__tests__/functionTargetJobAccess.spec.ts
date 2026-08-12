import { describe, expect, it } from 'vitest'

import { targetUserIsAssignedToJob } from '@/auth/targetJobAssignments'
import {
  targetRoleCanCreateJobs,
  targetRoleCanDeleteOrArchiveJobs,
  targetRoleCanEditJobSetup,
  targetRoleCanOpenJobDashboard,
  targetRoleCanSeeJobListEntry,
  type TargetJobAccessInput,
} from '@/auth/targetJobAccess'
import { type TargetRoleKey } from '@/auth/targetRoleCapabilities'
import { targetFunctionUserIsAssignedToJob } from '../../functions/src/targetJobAssignments'
import {
  targetFunctionRoleCanCreateJobs,
  targetFunctionRoleCanDeleteOrArchiveJobs,
  targetFunctionRoleCanEditJobSetup,
  targetFunctionRoleCanOpenJobDashboard,
  targetFunctionRoleCanSeeJobListEntry,
  type TargetFunctionJobAccessInput,
} from '../../functions/src/targetJobAccess'
import { type TargetFunctionRoleKey } from '../../functions/src/targetRoleCapabilities'

const targetRoles = [
  'admin',
  'payroll',
  'shop-foreman',
  'project-manager',
  'foreman',
  'none',
] as const satisfies readonly TargetRoleKey[]

const accessCases = [
  { role: 'admin', jobId: 'job-a' },
  { role: 'payroll', jobId: 'job-a' },
  { role: 'shop-foreman', jobId: 'shop-job', isShopJob: true },
  { role: 'shop-foreman', jobId: 'job-a', assignedJobIds: ['job-a'] },
  { role: 'shop-foreman', jobId: 'job-a', assignedJobIds: ['job-b'] },
  { role: 'project-manager', jobId: 'job-a', assignedJobIds: ['job-a'] },
  { role: 'project-manager', jobId: 'job-a', assignedJobIds: ['job-b'] },
  { role: 'foreman', jobId: 'job-a', assignedJobIds: ['job-a'] },
  { role: 'foreman', jobId: 'job-a', assignedJobIds: ['job-b'] },
  { role: 'none', jobId: 'job-a' },
  { role: 'admin', jobId: '' },
] as const satisfies readonly TargetJobAccessInput[]

describe('Cloud Functions target job access policy', () => {
  it('matches the frontend target assigned-job helper', () => {
    expect(targetFunctionUserIsAssignedToJob('job-a', ['job-a', 'job-b'])).toBe(
      targetUserIsAssignedToJob('job-a', ['job-a', 'job-b']),
    )
    expect(targetFunctionUserIsAssignedToJob('job-c', ['job-a', 'job-b'])).toBe(
      targetUserIsAssignedToJob('job-c', ['job-a', 'job-b']),
    )
    expect(targetFunctionUserIsAssignedToJob('', ['job-a'])).toBe(
      targetUserIsAssignedToJob('', ['job-a']),
    )
    expect(targetFunctionUserIsAssignedToJob('job-a', null)).toBe(
      targetUserIsAssignedToJob('job-a', null),
    )
  })

  it('matches frontend target create/delete job capabilities for every role', () => {
    for (const role of targetRoles) {
      expect(targetFunctionRoleCanCreateJobs(role as TargetFunctionRoleKey)).toBe(
        targetRoleCanCreateJobs(role),
      )
      expect(targetFunctionRoleCanDeleteOrArchiveJobs(role as TargetFunctionRoleKey)).toBe(
        targetRoleCanDeleteOrArchiveJobs(role),
      )
    }
  })

  it('matches frontend target job list, dashboard, and setup-edit policy', () => {
    for (const input of accessCases) {
      const functionInput = input as TargetFunctionJobAccessInput

      expect(targetFunctionRoleCanSeeJobListEntry(functionInput)).toBe(
        targetRoleCanSeeJobListEntry(input),
      )
      expect(targetFunctionRoleCanOpenJobDashboard(functionInput)).toBe(
        targetRoleCanOpenJobDashboard(input),
      )
      expect(targetFunctionRoleCanEditJobSetup(functionInput)).toBe(
        targetRoleCanEditJobSetup(input),
      )
    }
  })

  it('keeps backend target Payroll out of workflow dashboards while allowing job creation', () => {
    expect(targetFunctionRoleCanCreateJobs('payroll')).toBe(true)
    expect(targetFunctionRoleCanSeeJobListEntry({ role: 'payroll', jobId: 'job-a' })).toBe(true)
    expect(targetFunctionRoleCanOpenJobDashboard({ role: 'payroll', jobId: 'job-a' })).toBe(false)
    expect(targetFunctionRoleCanEditJobSetup({ role: 'payroll', jobId: 'job-a' })).toBe(false)
  })

  it('keeps backend target Project Managers scoped to assigned job dashboards and setup edits', () => {
    expect(targetFunctionRoleCanSeeJobListEntry({
      role: 'project-manager',
      jobId: 'job-a',
      assignedJobIds: ['job-a'],
    })).toBe(true)
    expect(targetFunctionRoleCanSeeJobListEntry({
      role: 'project-manager',
      jobId: 'job-a',
      assignedJobIds: ['job-b'],
    })).toBe(false)
    expect(targetFunctionRoleCanOpenJobDashboard({
      role: 'project-manager',
      jobId: 'job-a',
      assignedJobIds: ['job-a'],
    })).toBe(true)
    expect(targetFunctionRoleCanOpenJobDashboard({
      role: 'project-manager',
      jobId: 'job-a',
      assignedJobIds: ['job-b'],
    })).toBe(false)
    expect(targetFunctionRoleCanEditJobSetup({
      role: 'project-manager',
      jobId: 'job-a',
      assignedJobIds: ['job-a'],
    })).toBe(true)
    expect(targetFunctionRoleCanEditJobSetup({
      role: 'project-manager',
      jobId: 'job-a',
      assignedJobIds: ['job-b'],
    })).toBe(false)
  })
})
