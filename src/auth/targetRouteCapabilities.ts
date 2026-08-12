import { getTargetRoleCapabilities, type TargetRoleCapabilities, type TargetRoleKey } from '@/auth/targetRoleCapabilities'

export type TargetRouteCapability =
  | 'manage-users'
  | 'manage-employees'
  | 'manage-reference-lists'
  | 'manage-shop-catalog'
  | 'use-timecard-export'

export interface TargetCapabilityProfileInput {
  active?: boolean | null
  authenticated: boolean
  role: TargetRoleKey
}

type TargetRouteCapabilityKey = keyof Pick<
  TargetRoleCapabilities,
  | 'manageEmployees'
  | 'manageReferenceLists'
  | 'manageShopCatalog'
  | 'manageUsers'
  | 'useTimecardExport'
>

const TARGET_ROUTE_CAPABILITY_MAP: Readonly<Record<TargetRouteCapability, TargetRouteCapabilityKey>> = {
  'manage-employees': 'manageEmployees',
  'manage-reference-lists': 'manageReferenceLists',
  'manage-shop-catalog': 'manageShopCatalog',
  'manage-users': 'manageUsers',
  'use-timecard-export': 'useTimecardExport',
}

export function isTargetRouteCapability(value: unknown): value is TargetRouteCapability {
  return (
    value === 'manage-users'
    || value === 'manage-employees'
    || value === 'manage-reference-lists'
    || value === 'manage-shop-catalog'
    || value === 'use-timecard-export'
  )
}

export function targetRoleHasWorkspaceAccess(input: TargetCapabilityProfileInput): boolean {
  return input.authenticated
    && input.active !== false
    && getTargetRoleCapabilities(input.role).accessWorkspace
}

export function targetRoleCanUseRouteCapability(
  role: TargetRoleKey,
  capability: TargetRouteCapability,
): boolean {
  return getTargetRoleCapabilities(role)[TARGET_ROUTE_CAPABILITY_MAP[capability]]
}
