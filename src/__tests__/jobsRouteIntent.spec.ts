import { describe, expect, it } from 'vitest'
import { jobsManagementRoute, resolveJobsDashboardReturn, resolveJobsRouteIntent } from '@/features/jobs/jobsRouteIntent'
import type { JobRecord } from '@/types/domain'
const job = { id: 'allowed', active: true } as JobRecord
const access = { canCreate: true, canManage: true, canUseEditor: true, jobs: [job], canEdit: (entry: JobRecord) => entry.id === 'allowed' }
describe('dashboard Jobs setup entry points', () => {
  it('resolves creation, defaults, archive and authorized job editing without changing jobs', () => {
    for (const kind of ['create', 'defaults', 'archived']) expect(resolveJobsRouteIntent({ jobAction: kind }, access)).toEqual({ kind })
    expect(resolveJobsRouteIntent({ jobAction: 'edit', jobId: 'allowed' }, access)).toEqual({ kind: 'edit', job })
    expect(job).toEqual({ id: 'allowed', active: true })
  })
  it('keeps ordinary URLs and malformed intents inert', () => {
    for (const query of [{}, { jobAction: ['create'] }, { jobAction: 'delete' }, { jobAction: 1 }]) expect(resolveJobsRouteIntent(query, access)).toBeNull()
  })
  it('denies unavailable jobs, roles and nonediting viewers without revealing job data', () => {
    expect(resolveJobsRouteIntent({ jobAction: 'edit', jobId: 'missing' }, access)).toEqual({ kind: 'denied' })
    expect(resolveJobsRouteIntent({ jobAction: 'edit', jobId: 'allowed' }, { ...access, canEdit: () => false })).toEqual({ kind: 'denied' })
    for (const jobAction of ['create', 'defaults', 'archived', 'edit']) expect(resolveJobsRouteIntent({ jobAction, jobId: 'allowed' }, { ...access, canUseEditor: false })).toEqual({ kind: 'denied' })
  })
  it('allows a create-only role without granting management or setup editing', () => {
    const payroll = { ...access, canManage: false, canEdit: () => false }
    expect(resolveJobsRouteIntent({ jobAction: 'create' }, payroll)).toEqual({ kind: 'create' })
    for (const jobAction of ['defaults', 'archived', 'edit']) expect(resolveJobsRouteIntent({ jobAction, jobId: 'allowed' }, payroll)).toEqual({ kind: 'denied' })
    expect(resolveJobsRouteIntent({ jobAction: 'create' }, { ...access, canCreate: false })).toEqual({ kind: 'denied' })
  })
})

it('returns only to known dashboard routes and preserves the originating job independently of the edited job', () => {
  expect(resolveJobsDashboardReturn({ fromDashboard: 'personal' })).toEqual({ name: 'personal-workspace' })
  expect(resolveJobsDashboardReturn({ fromDashboard: 'role' })).toEqual({ name: 'role-workspace' })
  const route = jobsManagementRoute('edit', 'job', 'origin-job', 'edited-job')
  expect(route.name).toBe('dashboard-jobs-management')
  expect(route.query.jobId).toBe('edited-job')
  expect(resolveJobsDashboardReturn(route.query)).toEqual({ name: 'shared-job-home', params: { jobId: 'origin-job' } })
  expect(resolveJobsDashboardReturn({ fromDashboard: 'job' })).toEqual({ name: 'shared-job-home' })
  for (const query of [{}, { fromDashboard: 'https://example.com' }, { fromDashboard: ['personal'] }, { fromDashboard: 'job', dashboardJob: '../secret' }, { fromDashboard: 'job', dashboardJob: ['job-1'] }]) expect(resolveJobsDashboardReturn(query)).toBeNull()
  expect(jobsManagementRoute('create')).toEqual({ name: 'jobs', query: { jobAction: 'create' } })
})
