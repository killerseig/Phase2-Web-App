import { describe, expect, it } from 'vitest'

import {
  targetRoleCanDeleteDraftTimecardWeeks,
  targetRoleCanLockTimecards,
  targetRoleCanSubmitJobTimecards,
  targetRoleCanUseJobTimecardWorkflow,
  targetRoleCanUseTimecardExport,
  targetRoleCanViewSubmittedTimecardReport,
  targetRoleCanViewSubmittedTimecards,
  type TargetTimecardAccessInput,
} from '@/auth/targetTimecardAccess'
import {
  targetFunctionRoleCanDeleteDraftTimecardWeeks,
  targetFunctionRoleCanLockTimecards,
  targetFunctionRoleCanSubmitJobTimecards,
  targetFunctionRoleCanUseJobTimecardWorkflow,
  targetFunctionRoleCanUseTimecardExport,
  targetFunctionRoleCanViewSubmittedTimecardReport,
  targetFunctionRoleCanViewSubmittedTimecards,
  type TargetFunctionTimecardAccessInput,
} from '../../functions/src/targetTimecardAccess'
import type { TargetRoleKey } from '@/auth/targetRoleCapabilities'

const targetRoles = [
  'admin',
  'payroll',
  'shop-foreman',
  'project-manager',
  'foreman',
  'none',
] as const satisfies readonly TargetRoleKey[]

const jobScopedCases = [
  { role: 'admin', jobId: 'job-a' },
  { role: 'payroll', jobId: 'job-a' },
  { role: 'shop-foreman', jobId: 'shop-job', isShopJob: true },
  { role: 'shop-foreman', jobId: 'job-a', assignedJobIds: ['job-a'] },
  { role: 'shop-foreman', jobId: 'job-a', assignedJobIds: [] },
  { role: 'project-manager', jobId: 'job-a', assignedJobIds: ['job-a'] },
  { role: 'project-manager', jobId: 'job-a', assignedJobIds: ['job-b'] },
  { role: 'foreman', jobId: 'job-a', assignedJobIds: ['job-a'] },
  { role: 'foreman', jobId: 'job-a', assignedJobIds: ['job-b'] },
  { role: 'none', jobId: 'job-a' },
  { role: 'admin', jobId: '' },
  { role: 'payroll', jobId: '' },
] as const satisfies readonly TargetTimecardAccessInput[]

describe('Cloud Functions target timecard access policy', () => {
  it('matches frontend target role-wide timecard access decisions', () => {
    for (const role of targetRoles) {
      expect(targetFunctionRoleCanUseTimecardExport(role)).toBe(
        targetRoleCanUseTimecardExport(role),
      )
      expect(targetFunctionRoleCanLockTimecards(role)).toBe(
        targetRoleCanLockTimecards(role),
      )
      expect(targetFunctionRoleCanDeleteDraftTimecardWeeks(role)).toBe(
        targetRoleCanDeleteDraftTimecardWeeks(role),
      )
    }
  })

  it('matches frontend target job-scoped timecard access decisions', () => {
    for (const input of jobScopedCases) {
      expect(targetFunctionRoleCanUseJobTimecardWorkflow(
        input as TargetFunctionTimecardAccessInput,
      )).toBe(targetRoleCanUseJobTimecardWorkflow(input))
      expect(targetFunctionRoleCanSubmitJobTimecards(
        input as TargetFunctionTimecardAccessInput,
      )).toBe(targetRoleCanSubmitJobTimecards(input))
      expect(targetFunctionRoleCanViewSubmittedTimecards(
        input as TargetFunctionTimecardAccessInput,
      )).toBe(targetRoleCanViewSubmittedTimecards(input))
      expect(targetFunctionRoleCanViewSubmittedTimecardReport(
        input as TargetFunctionTimecardAccessInput,
      )).toBe(targetRoleCanViewSubmittedTimecardReport(input))
    }
  })

  it('keeps backend target Payroll out of job entry while allowing export and lock workflows', () => {
    expect(targetFunctionRoleCanUseTimecardExport('payroll')).toBe(true)
    expect(targetFunctionRoleCanLockTimecards('payroll')).toBe(true)
    expect(targetFunctionRoleCanDeleteDraftTimecardWeeks('payroll')).toBe(true)
    expect(targetFunctionRoleCanUseJobTimecardWorkflow({
      role: 'payroll',
      jobId: 'job-a',
    })).toBe(false)
  })

  it('keeps backend target Project Managers view-only for assigned submitted timecards', () => {
    const assignedInput: TargetFunctionTimecardAccessInput = {
      assignedJobIds: ['job-a'],
      jobId: 'job-a',
      role: 'project-manager',
    }

    expect(targetFunctionRoleCanUseJobTimecardWorkflow(assignedInput)).toBe(false)
    expect(targetFunctionRoleCanSubmitJobTimecards(assignedInput)).toBe(false)
    expect(targetFunctionRoleCanViewSubmittedTimecards(assignedInput)).toBe(true)
    expect(targetFunctionRoleCanViewSubmittedTimecardReport(assignedInput)).toBe(true)
  })

  it('allows backend target Shop Foremen to enter Shop job timecards without explicit assignment', () => {
    const shopInput: TargetFunctionTimecardAccessInput = {
      isShopJob: true,
      jobId: 'shop-job',
      role: 'shop-foreman',
    }

    expect(targetFunctionRoleCanUseJobTimecardWorkflow(shopInput)).toBe(true)
    expect(targetFunctionRoleCanSubmitJobTimecards(shopInput)).toBe(true)
    expect(targetFunctionRoleCanViewSubmittedTimecards(shopInput)).toBe(true)
    expect(targetFunctionRoleCanViewSubmittedTimecardReport(shopInput)).toBe(false)
  })
})
