/**
 * Composable for permission and access control
 * Centralizes all authorization logic to prevent duplication
 */

import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { ROLES, type Role } from '@/constants/app'

export interface AccessLevel {
  canManageUsers: boolean
  canManageJobs: boolean
  canManageCatalog: boolean
  canAccessJob: boolean
  canAccessShopOrders: boolean
  canAccessTimecards: boolean
  canAccessDailyLogs: boolean
}

/**
 * Main composable for permission checks
 * Usage in components:
 * const { isAdmin, canAccessShopOrders, hasAccess } = usePermissions()
 */
export function usePermissions() {
  const authStore = useAuthStore()

  // Basic role checks
  const isAdmin = computed(() => authStore.role === ROLES.ADMIN)
  const isController = computed(() => authStore.role === ROLES.CONTROLLER)
  const isForeman = computed(() => authStore.role === ROLES.FOREMAN)
  const isNone = computed(() => authStore.role === ROLES.NONE)

  // Feature access checks
  const isManager = computed(() => isAdmin.value)

  const canAccessShopOrders = computed(() => {
    return isManager.value || isForeman.value
  })

  const canAccessTimecards = computed(() => {
    return isManager.value || isForeman.value
  })

  const canAccessDailyLogs = computed(() => {
    return isManager.value || isForeman.value
  })

  const canManageUsers = computed(() => isAdmin.value)
  const canManageJobs = computed(() => isAdmin.value)
  const canManageCatalog = computed(() => isAdmin.value)

  /**
   * Check if user has access to a specific job
   * Admin has access to all jobs
   * Admins can access all jobs, foremen only their assigned jobs.
   */
  const canAccessJob = computed(() => {
    return isAdmin.value || isForeman.value
  })

  /**
   * Check if user can perform an admin action
   */
  const requireAdmin = (): boolean => isAdmin.value

  /**
   * Check if user has a specific role
   */
  const hasRole = (role: Role): boolean => authStore.role === role

  /**
   * Check if user has any of the specified roles
   */
  const hasAnyRole = (roles: Role[]): boolean => roles.includes(authStore.role || ROLES.NONE)

  /**
   * Get complete access level object
   */
  const getAccessLevel = (): AccessLevel => ({
    canManageUsers: canManageUsers.value,
    canManageJobs: canManageJobs.value,
    canManageCatalog: canManageCatalog.value,
    canAccessJob: canAccessJob.value,
    canAccessShopOrders: canAccessShopOrders.value,
    canAccessTimecards: canAccessTimecards.value,
    canAccessDailyLogs: canAccessDailyLogs.value,
  })

  return {
    // Role checks
    isAdmin,
    isController,
    isForeman,
    isNone,
    isManager,

    // Feature access
    canAccessJob,
    canAccessShopOrders,
    canAccessTimecards,
    canAccessDailyLogs,
    canManageUsers,
    canManageJobs,
    canManageCatalog,

    // Utility methods
    requireAdmin,
    hasRole,
    hasAnyRole,
    getAccessLevel,
  }
}
