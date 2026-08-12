import { getTargetRoleLabel, type TargetRoleKey } from '@/auth/targetRoleCapabilities'
import {
  targetRoleCanUseRouteCapability,
  type TargetRouteCapability,
} from '@/auth/targetRouteCapabilities'

export interface TargetAppShellNavigationItem {
  capability?: TargetRouteCapability
  label: string
  to: string
}

const TARGET_WORKSPACE_NAVIGATION_ITEMS: readonly TargetAppShellNavigationItem[] = [
  { label: 'Jobs', to: '/jobs' },
]

const TARGET_ADMIN_NAVIGATION_ITEMS: readonly TargetAppShellNavigationItem[] = [
  { capability: 'manage-users', label: 'Users', to: '/users' },
  { capability: 'manage-employees', label: 'Employees', to: '/employees' },
  { capability: 'use-timecard-export', label: 'Timecard Export', to: '/exports/timecards' },
  { capability: 'manage-shop-catalog', label: 'Shop Catalog', to: '/settings/shop-catalog' },
]

export function getTargetAppShellWorkspaceNavigationItems(
  role: TargetRoleKey,
): TargetAppShellNavigationItem[] {
  if (role === 'none') return []

  return TARGET_WORKSPACE_NAVIGATION_ITEMS.map((item) => ({ ...item }))
}

export function getTargetAppShellAdminNavigationItems(
  role: TargetRoleKey,
): TargetAppShellNavigationItem[] {
  return TARGET_ADMIN_NAVIGATION_ITEMS
    .filter((item) => (
      !item.capability || targetRoleCanUseRouteCapability(role, item.capability)
    ))
    .map((item) => ({ ...item }))
}

export function getTargetAppShellRoleLabel(role: TargetRoleKey): string {
  return getTargetRoleLabel(role)
}
