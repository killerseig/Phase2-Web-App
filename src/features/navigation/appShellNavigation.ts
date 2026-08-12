import {
  canUseRouteCapability,
  getCurrentRoleLabel,
  type AppRouteCapability,
} from '@/auth/capabilities'
import type { RawRoleKey } from '@/types/domain'

export interface AppShellNavigationItem {
  capability?: AppRouteCapability
  label: string
  to: string
}

const WORKSPACE_NAVIGATION_ITEMS: readonly AppShellNavigationItem[] = [
  { label: 'Jobs', to: '/jobs' },
]

const ADMIN_NAVIGATION_ITEMS: readonly AppShellNavigationItem[] = [
  { capability: 'manage-users', label: 'Users', to: '/users' },
  { capability: 'manage-employees', label: 'Employees', to: '/employees' },
  { capability: 'use-timecard-export', label: 'Timecard Export', to: '/exports/timecards' },
  { capability: 'manage-shop-catalog', label: 'Shop Catalog', to: '/settings/shop-catalog' },
]

export function getAppShellWorkspaceNavigationItems(): AppShellNavigationItem[] {
  return [...WORKSPACE_NAVIGATION_ITEMS]
}

export function getAppShellAdminNavigationItems(rawRole: RawRoleKey): AppShellNavigationItem[] {
  return ADMIN_NAVIGATION_ITEMS.filter((item) => (
    !item.capability || canUseRouteCapability(rawRole, item.capability)
  ))
}

export function getAppShellRoleLabel(rawRole: RawRoleKey): string {
  return getCurrentRoleLabel(rawRole)
}
