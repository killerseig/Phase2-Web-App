import { describe, expect, it } from 'vitest'

import {
  targetRoleCanDeleteDraftTimecardWeeks,
  targetRoleCanLockTimecards,
  targetRoleCanSubmitJobTimecards,
  targetRoleCanUseJobTimecardWorkflow,
  targetRoleCanUseTimecardExport,
  targetRoleCanViewSubmittedTimecardReport,
  targetRoleCanViewSubmittedTimecards,
} from '@/auth/targetTimecardAccess'

describe('target timecard access policy', () => {
  it('models Admin as full timecard access', () => {
    expect(targetRoleCanUseTimecardExport('admin')).toBe(true)
    expect(targetRoleCanLockTimecards('admin')).toBe(true)
    expect(targetRoleCanDeleteDraftTimecardWeeks('admin')).toBe(true)
    expect(targetRoleCanUseJobTimecardWorkflow({ role: 'admin', jobId: 'job-a' })).toBe(true)
    expect(targetRoleCanSubmitJobTimecards({ role: 'admin', jobId: 'job-a' })).toBe(true)
    expect(targetRoleCanViewSubmittedTimecards({ role: 'admin', jobId: 'job-a' })).toBe(true)
    expect(targetRoleCanViewSubmittedTimecardReport({ role: 'admin', jobId: 'job-a' })).toBe(true)
  })

  it('models Payroll as export and lock access without job workflow access', () => {
    expect(targetRoleCanUseTimecardExport('payroll')).toBe(true)
    expect(targetRoleCanLockTimecards('payroll')).toBe(true)
    expect(targetRoleCanDeleteDraftTimecardWeeks('payroll')).toBe(true)
    expect(targetRoleCanUseJobTimecardWorkflow({ role: 'payroll', jobId: 'job-a' })).toBe(false)
    expect(targetRoleCanSubmitJobTimecards({ role: 'payroll', jobId: 'job-a' })).toBe(false)
    expect(targetRoleCanViewSubmittedTimecards({ role: 'payroll', jobId: 'job-a' })).toBe(true)
    expect(targetRoleCanViewSubmittedTimecardReport({ role: 'payroll', jobId: 'job-a' })).toBe(false)
  })

  it('models Shop Foreman as Shop job workflow plus assigned non-Shop job workflow access', () => {
    expect(targetRoleCanUseTimecardExport('shop-foreman')).toBe(false)
    expect(targetRoleCanLockTimecards('shop-foreman')).toBe(false)
    expect(targetRoleCanDeleteDraftTimecardWeeks('shop-foreman')).toBe(false)
    expect(targetRoleCanUseJobTimecardWorkflow({
      role: 'shop-foreman',
      jobId: 'shop-job',
      isShopJob: true,
    })).toBe(true)
    expect(targetRoleCanUseJobTimecardWorkflow({
      role: 'shop-foreman',
      jobId: 'job-a',
      assignedJobIds: ['job-a'],
    })).toBe(true)
    expect(targetRoleCanUseJobTimecardWorkflow({
      role: 'shop-foreman',
      jobId: 'job-a',
      assignedJobIds: [],
    })).toBe(false)
    expect(targetRoleCanSubmitJobTimecards({
      role: 'shop-foreman',
      jobId: 'shop-job',
      isShopJob: true,
    })).toBe(true)
    expect(targetRoleCanViewSubmittedTimecards({
      role: 'shop-foreman',
      jobId: 'shop-job',
      isShopJob: true,
    })).toBe(true)
    expect(targetRoleCanViewSubmittedTimecardReport({
      role: 'shop-foreman',
      jobId: 'shop-job',
      isShopJob: true,
    })).toBe(false)
  })

  it('models Project Manager as assigned-job submitted reporting without edit/submit/export access', () => {
    expect(targetRoleCanUseTimecardExport('project-manager')).toBe(false)
    expect(targetRoleCanLockTimecards('project-manager')).toBe(false)
    expect(targetRoleCanDeleteDraftTimecardWeeks('project-manager')).toBe(false)
    expect(targetRoleCanUseJobTimecardWorkflow({
      role: 'project-manager',
      jobId: 'job-a',
      assignedJobIds: ['job-a'],
    })).toBe(false)
    expect(targetRoleCanSubmitJobTimecards({
      role: 'project-manager',
      jobId: 'job-a',
      assignedJobIds: ['job-a'],
    })).toBe(false)
    expect(targetRoleCanViewSubmittedTimecards({
      role: 'project-manager',
      jobId: 'job-a',
      assignedJobIds: ['job-a'],
    })).toBe(true)
    expect(targetRoleCanViewSubmittedTimecardReport({
      role: 'project-manager',
      jobId: 'job-a',
      assignedJobIds: ['job-a'],
    })).toBe(true)
    expect(targetRoleCanViewSubmittedTimecards({
      role: 'project-manager',
      jobId: 'job-a',
      assignedJobIds: ['job-b'],
    })).toBe(false)
  })

  it('models Foreman as assigned job workflow access without export, lock, or billing-report access', () => {
    expect(targetRoleCanUseTimecardExport('foreman')).toBe(false)
    expect(targetRoleCanLockTimecards('foreman')).toBe(false)
    expect(targetRoleCanDeleteDraftTimecardWeeks('foreman')).toBe(false)
    expect(targetRoleCanUseJobTimecardWorkflow({
      role: 'foreman',
      jobId: 'job-a',
      assignedJobIds: ['job-a'],
    })).toBe(true)
    expect(targetRoleCanSubmitJobTimecards({
      role: 'foreman',
      jobId: 'job-a',
      assignedJobIds: ['job-a'],
    })).toBe(true)
    expect(targetRoleCanViewSubmittedTimecards({
      role: 'foreman',
      jobId: 'job-a',
      assignedJobIds: ['job-a'],
    })).toBe(true)
    expect(targetRoleCanViewSubmittedTimecardReport({
      role: 'foreman',
      jobId: 'job-a',
      assignedJobIds: ['job-a'],
    })).toBe(false)
    expect(targetRoleCanUseJobTimecardWorkflow({
      role: 'foreman',
      jobId: 'job-a',
      assignedJobIds: ['job-b'],
    })).toBe(false)
  })

  it('keeps no-access users and missing job ids out of job-scoped timecard surfaces', () => {
    expect(targetRoleCanUseTimecardExport('none')).toBe(false)
    expect(targetRoleCanLockTimecards('none')).toBe(false)
    expect(targetRoleCanDeleteDraftTimecardWeeks('none')).toBe(false)
    expect(targetRoleCanUseJobTimecardWorkflow({ role: 'none', jobId: 'job-a' })).toBe(false)
    expect(targetRoleCanSubmitJobTimecards({ role: 'none', jobId: 'job-a' })).toBe(false)
    expect(targetRoleCanViewSubmittedTimecards({ role: 'none', jobId: 'job-a' })).toBe(false)
    expect(targetRoleCanViewSubmittedTimecardReport({ role: 'none', jobId: 'job-a' })).toBe(false)
    expect(targetRoleCanUseJobTimecardWorkflow({
      role: 'admin',
      jobId: '',
    })).toBe(false)
    expect(targetRoleCanViewSubmittedTimecards({
      role: 'payroll',
      jobId: '',
    })).toBe(false)
  })
})
