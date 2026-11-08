import {
  canUseRouteCapability,
  getCurrentRoleLabel,
  type AppRouteCapability,
} from '@/auth/capabilities'
import type { RawRoleKey } from '@/types/domain'
import { canListCompanyForms } from '@/features/forms/availableForms'
import { getTargetRoleCapabilities } from '@/auth/targetRoleCapabilities'

export interface AppShellNavigationItem {
  capability?: AppRouteCapability
  label: string
  to: string
}

const WORKSPACE_NAVIGATION_ITEMS: readonly AppShellNavigationItem[] = [
  { label: 'Jobs', to: '/jobs' },
  { label: 'Personal dashboard', to: '/dashboards/personal' },
  { label: 'Role dashboard', to: '/dashboards/role' },
  { label: 'Job dashboards', to: '/dashboards/job-home' },
  { label: 'Company Library', to: '/company-library' },
  { label: 'Forms', to: '/reports' },
]

const ADMIN_NAVIGATION_ITEMS: readonly AppShellNavigationItem[] = [
  { capability: 'manage-announcements', label: 'Announcements', to: '/admin/announcements' },
  { capability: 'manage-website', label: 'Form Builder', to: '/admin/forms' },
  { capability: 'manage-website', label: 'Website Builder', to: '/admin/website' },
  { capability: 'manage-users', label: 'Users', to: '/users' },
  { capability: 'manage-employees', label: 'Employees', to: '/employees' },
  { capability: 'use-timecard-export', label: 'Timecard Export', to: '/exports/timecards' },
  { capability: 'manage-shop-catalog', label: 'Shop Catalog', to: '/settings/shop-catalog' },
]

export function getAppShellWorkspaceNavigationItems(
  rawRole: RawRoleKey = 'none',
): AppShellNavigationItem[] {
  if (rawRole === 'employee') return [{ label: 'Updates', to: '/dashboards/announcements' }]
  if (rawRole === 'none') return []
  const capabilities = getTargetRoleCapabilities(rawRole)
  return WORKSPACE_NAVIGATION_ITEMS.filter(
    (item) => (item.to !== '/reports' || canListCompanyForms(rawRole)) &&
      (item.to !== '/dashboards/job-home' || capabilities.editAllJobs ||
        capabilities.useAssignedJobDashboards || capabilities.useShopJobDashboard),
  ).map(item => ({ ...item }))
}

export function getAppShellAdminNavigationItems(rawRole: RawRoleKey): AppShellNavigationItem[] {
  return ADMIN_NAVIGATION_ITEMS.filter(
    (item) => !item.capability || canUseRouteCapability(rawRole, item.capability),
  )
}

export function getAppShellRoleLabel(rawRole: RawRoleKey): string {
  return getCurrentRoleLabel(rawRole)
}
