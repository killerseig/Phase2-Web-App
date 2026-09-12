export interface JobDashboardModule {
  detail: string
  label: string
  to: string
}

export const JOB_DASHBOARD_MODULES: readonly JobDashboardModule[] = [
  {
    label: 'Timecards',
    detail: 'Enter crew hours and submit weekly timecards.',
    to: 'timecards',
  },
  {
    label: 'Daily Logs',
    detail: 'Record daily work, site updates, and photos.',
    to: 'daily-logs',
  },
  {
    label: 'Shop Orders',
    detail: 'Order materials from the catalog or add a custom item.',
    to: 'shop-orders',
  },
] as const

export function getJobDashboardModules(): JobDashboardModule[] {
  return JOB_DASHBOARD_MODULES.map((module) => ({ ...module }))
}
