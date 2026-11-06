import type { JobRecord } from '@/types/domain'
export type JobsRouteIntent =
  | { kind: 'create' | 'defaults' | 'archived' }
  | { kind: 'edit'; job: JobRecord }
  | { kind: 'denied' }
export function resolveJobsRouteIntent(
  query: Record<string, unknown>,
  access: {
    canCreate: boolean
    canManage: boolean
    canUseEditor: boolean
    jobs: JobRecord[]
    canEdit: (job: JobRecord) => boolean
  },
): JobsRouteIntent | null {
  const action = query.jobAction
  if (!['create', 'defaults', 'archived', 'edit'].includes(String(action)) || typeof action !== 'string') return null
  if (!access.canUseEditor) return { kind: 'denied' }
  if (action === 'create') return { kind: access.canCreate ? 'create' : 'denied' }
  if (action === 'defaults' || action === 'archived') return { kind: access.canManage ? action : 'denied' }
  const job = typeof query.jobId === 'string' ? access.jobs.find(job => job.id === query.jobId) : undefined
  return job && access.canEdit(job) ? { kind: 'edit', job } : { kind: 'denied' }
}

export function jobsManagementRoute(
  action: 'create' | 'defaults' | 'archived' | 'edit',
  scope?: 'personal' | 'role' | 'job',
  dashboardJob?: string,
  jobId?: string,
) {
  return {
    name: scope ? 'dashboard-jobs-management' : 'jobs',
    query: {
      jobAction: action,
      ...(jobId ? { jobId } : {}),
      ...(scope ? { fromDashboard: scope } : {}),
      ...(scope === 'job' && dashboardJob ? { dashboardJob } : {}),
    },
  }
}

export function resolveJobsDashboardReturn(query: Record<string, unknown>) {
  if (query.fromDashboard === 'personal') return { name: 'personal-workspace' }
  if (query.fromDashboard === 'role') return { name: 'role-workspace' }
  if (query.fromDashboard !== 'job') return null
  if (query.dashboardJob === undefined) return { name: 'shared-job-home' }
  if (typeof query.dashboardJob !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(query.dashboardJob)) return null
  return { name: 'shared-job-home', params: { jobId: query.dashboardJob } }
}
