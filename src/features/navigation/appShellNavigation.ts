import {
  canUseRouteCapability,
  getCurrentRoleLabel,
  type AppRouteCapability,
} from '@/auth/capabilities'
import type { RawRoleKey } from '@/types/domain'
import { canListCompanyForms } from '@/features/forms/availableForms'

export interface AppShellNavigationItem {
  capability?: AppRouteCapability
  hidden?: boolean
  label: string
  to: string
}

const WORKSPACE_NAVIGATION_ITEMS: readonly AppShellNavigationItem[] = [
  { label: 'Jobs', to: '/jobs' },
  { label: 'My Timecard', to: '/jobs/my-timecard' },
  { label: 'Company Library', to: '/company-library' },
  { label: 'Site Inspection Forms', to: '/reports' },
  // Remove these visibility flags after review; route authorization is independent of navigation.
  { label: 'Role home', to: '/dashboards/role-home', hidden: true },
  { label: 'Job home', to: '/dashboards/job-home', hidden: true },
]

const ADMIN_NAVIGATION_ITEMS: readonly AppShellNavigationItem[] = [
  { capability: 'manage-website', label: 'Form Builder', to: '/admin/forms' },
  { capability: 'manage-website', label: 'Website Builder', to: '/admin/website' },
  { capability: 'manage-users', label: 'Users', to: '/users' },
  { capability: 'manage-employees', label: 'Employees', to: '/employees' },
  { capability: 'use-timecard-export', label: 'Timecard Export', to: '/exports/timecards' },
  { capability: 'manage-shop-catalog', label: 'Shop Catalog', to: '/settings/shop-catalog' },
]

export function getAppShellWorkspaceNavigationItems(rawRole: RawRoleKey = 'none'): AppShellNavigationItem[] {
  return WORKSPACE_NAVIGATION_ITEMS.filter((item) => !item.hidden &&
    (item.to !== '/reports' || canListCompanyForms(rawRole)) &&
    (item.to !== '/jobs/my-timecard' || ['admin','foreman','shop-foreman','project-manager'].includes(rawRole)))
}

export function getAppShellAdminNavigationItems(rawRole: RawRoleKey): AppShellNavigationItem[] {
  return ADMIN_NAVIGATION_ITEMS.filter(
    (item) => !item.capability || canUseRouteCapability(rawRole, item.capability),
  )
}

export function getAppShellRoleLabel(rawRole: RawRoleKey): string {
  return getCurrentRoleLabel(rawRole)
}
