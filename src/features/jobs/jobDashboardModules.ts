export interface JobDashboardModule {
  detail: string
  label: string
  to: string
}

export const JOB_DASHBOARD_MODULES: readonly JobDashboardModule[] = [
  {
    label: 'Timecards',
    detail: 'Weekly card workflow stays the first production priority.',
    to: 'timecards',
  },
  {
    label: 'Daily Logs',
    detail: 'Structured daily reporting with shared recipients.',
    to: 'daily-logs',
  },
  {
    label: 'Shop Orders',
    detail: 'Explorer-style ordering workspace with custom items.',
    to: 'shop-orders',
  },
] as const

export function getJobDashboardModules(): JobDashboardModule[] {
  return JOB_DASHBOARD_MODULES.map((module) => ({ ...module }))
}
