import { isShopJobRecord } from '@/auth/jobIdentity'
import { targetRoleCanOpenJobDashboard } from '@/auth/targetJobAccess'
import { targetRoleCanViewSubmittedTimecardReport } from '@/auth/targetTimecardAccess'
import type { RawRoleKey, JobRecord } from '@/types/domain'

export interface RoleDashboardJobShortcut {
  code: string
  dashboardRoute: string
  detail: string
  id: string
  isShopJob: boolean
  label: string
  moduleRoutes: {
    dailyLogs: string
    shopOrders: string
    submittedTimecards: string | null
    timecards: string
  }
}

export interface GetRoleDashboardJobShortcutsInput {
  assignedJobIds?: readonly string[] | null
  jobs: readonly JobRecord[]
  rawRole: RawRoleKey
}

const jobShortcutCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
})

function getJobShortcutLabel(job: JobRecord): string {
  return [job.code, job.name].filter(Boolean).join(' - ') || 'Untitled Job'
}

function getJobShortcutDetail(job: JobRecord): string {
  return [job.gc, job.type].filter(Boolean).join(' / ') || 'Job dashboard'
}

function compareJobShortcuts(left: RoleDashboardJobShortcut, right: RoleDashboardJobShortcut) {
  return jobShortcutCollator.compare(left.label, right.label)
}

export function getRoleDashboardJobShortcuts({
  assignedJobIds,
  jobs,
  rawRole,
}: GetRoleDashboardJobShortcutsInput): RoleDashboardJobShortcut[] {
  return jobs
    .filter((job) => job.active !== false)
    .filter((job) => targetRoleCanOpenJobDashboard({
      assignedJobIds,
      isShopJob: isShopJobRecord(job),
      jobId: job.id,
      role: rawRole,
    }))
    .map((job): RoleDashboardJobShortcut => {
      const isShopJob = isShopJobRecord(job)
      const canViewSubmittedTimecards = targetRoleCanViewSubmittedTimecardReport({
        assignedJobIds,
        isShopJob,
        jobId: job.id,
        role: rawRole,
      })

      return {
        code: job.code ?? '',
        dashboardRoute: `/jobs/${job.id}`,
        detail: getJobShortcutDetail(job),
        id: job.id,
        isShopJob,
        label: getJobShortcutLabel(job),
        moduleRoutes: {
          dailyLogs: `/jobs/${job.id}/daily-logs`,
          shopOrders: `/jobs/${job.id}/shop-orders`,
          submittedTimecards: canViewSubmittedTimecards ? `/jobs/${job.id}/timecards` : null,
          timecards: `/jobs/${job.id}/timecards`,
        },
      }
    })
    .sort(compareJobShortcuts)
}
