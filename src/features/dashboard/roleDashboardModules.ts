import {
  getTargetRoleCapabilities,
  type TargetRoleCapabilities,
  type TargetRoleKey,
} from '@/auth/targetRoleCapabilities'

export type TargetRoleDashboardModuleKey =
  | 'users'
  | 'employees'
  | 'job-setup'
  | 'jobs-lookup'
  | 'assigned-job-dashboards'
  | 'shop-job-dashboard'
  | 'submitted-timecards'
  | 'timecard-export'
  | 'shop-catalog'

export interface TargetRoleDashboardModule {
  detail: string
  key: TargetRoleDashboardModuleKey
  label: string
  targetRoute: string
}

type DashboardModuleDefinition = TargetRoleDashboardModule & {
  canUse: (capabilities: TargetRoleCapabilities) => boolean
}

const TARGET_ROLE_DASHBOARD_MODULES: readonly DashboardModuleDefinition[] = [
  {
    key: 'users',
    label: 'Users',
    detail: 'Create users, manage access, and assign field-facing roles.',
    targetRoute: '/users',
    canUse: (capabilities) => capabilities.manageUsers,
  },
  {
    key: 'employees',
    label: 'Employees',
    detail: 'Maintain employee information needed for payroll and timecards.',
    targetRoute: '/employees',
    canUse: (capabilities) => capabilities.manageEmployees,
  },
  {
    key: 'job-setup',
    label: 'Create Jobs',
    detail: 'Create jobs before field work starts, then assign field users later.',
    targetRoute: '/jobs?mode=create',
    canUse: (capabilities) => capabilities.createJobs,
  },
  {
    key: 'jobs-lookup',
    label: 'Jobs Lookup',
    detail: 'Find jobs and drill into the shared job dashboard when allowed.',
    targetRoute: '/jobs',
    canUse: (capabilities) => capabilities.viewAllJobs,
  },
  {
    key: 'assigned-job-dashboards',
    label: 'Assigned Job Dashboards',
    detail: 'Open assigned jobs for timecards, daily logs, and shop orders.',
    targetRoute: '/jobs',
    canUse: (capabilities) => capabilities.useAssignedJobDashboards,
  },
  {
    key: 'shop-job-dashboard',
    label: 'Shop Job Dashboard',
    detail: 'Open the Shop job for shop timecards, daily logs, and shop orders.',
    targetRoute: '/jobs',
    canUse: (capabilities) => capabilities.useShopJobDashboard,
  },
  {
    key: 'submitted-timecards',
    label: 'Submitted Timecards',
    detail: 'Review submitted assigned-job timecards for billing context.',
    targetRoute: '/jobs',
    canUse: (capabilities) => capabilities.viewSubmittedAssignedTimecards,
  },
  {
    key: 'timecard-export',
    label: 'Timecard Export',
    detail: 'Review, lock, print, and export submitted timecard weeks.',
    targetRoute: '/exports/timecards',
    canUse: (capabilities) => capabilities.useTimecardExport,
  },
  {
    key: 'shop-catalog',
    label: 'Shop Catalog',
    detail: 'Manage the shop catalog used by online shop orders.',
    targetRoute: '/settings/shop-catalog',
    canUse: (capabilities) => capabilities.manageShopCatalog,
  },
] as const

export function getTargetRoleDashboardModules(role: TargetRoleKey): TargetRoleDashboardModule[] {
  const capabilities = getTargetRoleCapabilities(role)

  return TARGET_ROLE_DASHBOARD_MODULES
    .filter((module) => module.canUse(capabilities))
    .map(({ canUse: _canUse, ...module }) => ({ ...module }))
}
