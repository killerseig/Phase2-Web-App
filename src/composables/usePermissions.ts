/**
 * Composable for permission and access control
 * Centralizes all authorization logic to prevent duplication
 */

import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'

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
  const appStore = useAppStore()

  // Basic role checks
  const isAdmin = computed(() => authStore.role === 'admin')
  const isEmployee = computed(() => authStore.role === 'employee')
  const isShop = computed(() => authStore.role === 'shop')
  const isForeman = computed(() => authStore.role === 'foreman')
  const isNone = computed(() => authStore.role === 'none')

  // Feature access checks
  const isManager = computed(() => isAdmin.value)

  const canAccessShopOrders = computed(() => {
    return isManager.value || isEmployee.value || isShop.value || isForeman.value
  })

  const canAccessTimecards = computed(() => {
    return isManager.value || isEmployee.value || isForeman.value
  })

  const canAccessDailyLogs = computed(() => {
    return isManager.value || isEmployee.value || isForeman.value
  })

  const canManageUsers = computed(() => isAdmin.value)
  const canManageJobs = computed(() => isAdmin.value)
  const canManageCatalog = computed(() => isAdmin.value)

  /**
   * Check if user has access to a specific job
   * Admin has access to all jobs
   * Employees and shop users have implicit access to all jobs
   */
  const canAccessJob = computed(() => {
    return isAdmin.value || isEmployee.value || isShop.value || isForeman.value
  })

  /**
   * Check if user can perform an admin action
   */
  const requireAdmin = (): boolean => isAdmin.value

  /**
   * Check if user has a specific role
   */
  const hasRole = (role: string): boolean => authStore.role === role

  /**
   * Check if user has any of the specified roles
   */
  const hasAnyRole = (roles: string[]): boolean => roles.includes(authStore.role || 'none')

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
    isEmployee,
    isForeman,
    isShop,
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
