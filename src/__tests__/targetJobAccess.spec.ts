import { describe, expect, it } from 'vitest'

import {
  targetRoleCanCreateJobs,
  targetRoleCanDeleteOrArchiveJobs,
  targetRoleCanEditJobSetup,
  targetRoleCanOpenJobDashboard,
  targetRoleCanSeeJobListEntry,
} from '@/auth/targetJobAccess'

describe('target job access policy', () => {
  it('models Admin as full job access', () => {
    expect(targetRoleCanCreateJobs('admin')).toBe(true)
    expect(targetRoleCanDeleteOrArchiveJobs('admin')).toBe(true)
    expect(targetRoleCanSeeJobListEntry({ role: 'admin', jobId: 'job-a' })).toBe(true)
    expect(targetRoleCanOpenJobDashboard({ role: 'admin', jobId: 'job-a' })).toBe(true)
    expect(targetRoleCanEditJobSetup({ role: 'admin', jobId: 'job-a' })).toBe(true)
  })

  it('models Payroll as job creation plus read-only all-job lookup without workflow dashboards', () => {
    expect(targetRoleCanCreateJobs('payroll')).toBe(true)
    expect(targetRoleCanDeleteOrArchiveJobs('payroll')).toBe(false)
    expect(targetRoleCanSeeJobListEntry({ role: 'payroll', jobId: 'job-a' })).toBe(true)
    expect(targetRoleCanOpenJobDashboard({ role: 'payroll', jobId: 'job-a' })).toBe(false)
    expect(targetRoleCanEditJobSetup({ role: 'payroll', jobId: 'job-a' })).toBe(false)
  })

  it('models Shop Foreman as read-only all-job lookup plus Shop and assigned workflow dashboards', () => {
    expect(targetRoleCanCreateJobs('shop-foreman')).toBe(false)
    expect(targetRoleCanDeleteOrArchiveJobs('shop-foreman')).toBe(false)
    expect(targetRoleCanSeeJobListEntry({ role: 'shop-foreman', jobId: 'job-a' })).toBe(true)
    expect(targetRoleCanOpenJobDashboard({ role: 'shop-foreman', jobId: 'shop-job', isShopJob: true })).toBe(true)
    expect(targetRoleCanOpenJobDashboard({
      role: 'shop-foreman',
      jobId: 'job-a',
      assignedJobIds: ['job-a'],
    })).toBe(true)
    expect(targetRoleCanOpenJobDashboard({ role: 'shop-foreman', jobId: 'job-a' })).toBe(false)
    expect(targetRoleCanEditJobSetup({ role: 'shop-foreman', jobId: 'shop-job', isShopJob: true })).toBe(false)
  })

  it('models Project Manager as assigned-job list, dashboard, and setup edit access', () => {
    expect(targetRoleCanCreateJobs('project-manager')).toBe(false)
    expect(targetRoleCanDeleteOrArchiveJobs('project-manager')).toBe(false)
    expect(targetRoleCanSeeJobListEntry({
      role: 'project-manager',
      jobId: 'job-a',
      assignedJobIds: ['job-a'],
    })).toBe(true)
    expect(targetRoleCanSeeJobListEntry({
      role: 'project-manager',
      jobId: 'job-a',
      assignedJobIds: ['job-b'],
    })).toBe(false)
    expect(targetRoleCanOpenJobDashboard({
      role: 'project-manager',
      jobId: 'job-a',
      assignedJobIds: ['job-a'],
    })).toBe(true)
    expect(targetRoleCanOpenJobDashboard({
      role: 'project-manager',
      jobId: 'job-a',
      assignedJobIds: ['job-b'],
    })).toBe(false)
    expect(targetRoleCanEditJobSetup({
      role: 'project-manager',
      jobId: 'job-a',
      assignedJobIds: ['job-a'],
    })).toBe(true)
    expect(targetRoleCanEditJobSetup({
      role: 'project-manager',
      jobId: 'job-a',
      assignedJobIds: ['job-b'],
    })).toBe(false)
  })

  it('models Foreman as assigned-job list and dashboard access without setup editing', () => {
    expect(targetRoleCanCreateJobs('foreman')).toBe(false)
    expect(targetRoleCanDeleteOrArchiveJobs('foreman')).toBe(false)
    expect(targetRoleCanSeeJobListEntry({
      role: 'foreman',
      jobId: 'job-a',
      assignedJobIds: ['job-a'],
    })).toBe(true)
    expect(targetRoleCanSeeJobListEntry({
      role: 'foreman',
      jobId: 'job-a',
      assignedJobIds: ['job-b'],
    })).toBe(false)
    expect(targetRoleCanOpenJobDashboard({
      role: 'foreman',
      jobId: 'job-a',
      assignedJobIds: ['job-a'],
    })).toBe(true)
    expect(targetRoleCanEditJobSetup({
      role: 'foreman',
      jobId: 'job-a',
      assignedJobIds: ['job-a'],
    })).toBe(false)
  })

  it('keeps no-access users and missing job ids out of job surfaces', () => {
    expect(targetRoleCanCreateJobs('none')).toBe(false)
    expect(targetRoleCanDeleteOrArchiveJobs('none')).toBe(false)
    expect(targetRoleCanSeeJobListEntry({ role: 'none', jobId: 'job-a' })).toBe(false)
    expect(targetRoleCanOpenJobDashboard({ role: 'none', jobId: 'job-a' })).toBe(false)
    expect(targetRoleCanEditJobSetup({ role: 'none', jobId: 'job-a' })).toBe(false)
    expect(targetRoleCanSeeJobListEntry({ role: 'admin', jobId: '' })).toBe(false)
    expect(targetRoleCanOpenJobDashboard({ role: 'admin', jobId: '' })).toBe(false)
    expect(targetRoleCanEditJobSetup({ role: 'admin', jobId: '' })).toBe(false)
  })
})
