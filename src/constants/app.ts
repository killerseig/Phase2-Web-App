/**
 * Frontend Constants
 * Centralized configuration for roles, routes, and shared validation constants.
 */

// User Roles
export const ROLES = {
  ADMIN: 'admin',
  EMPLOYEE: 'employee',
  SHOP: 'shop',
  FOREMAN: 'foreman',
  NONE: 'none',
} as const

export type Role = typeof ROLES[keyof typeof ROLES]

// Route Paths
export const ROUTES = {
  LOGIN: '/login',
  SET_PASSWORD: '/set-password',
  DASHBOARD: '/dashboard',
  DAILY_LOGS: '/daily-logs',
  TIMECARDS: '/timecards',
  SHOP_ORDERS: '/shop-orders',
  JOB: '/job',
  ADMIN_USERS: '/admin/users',
  ADMIN_JOBS: '/admin/jobs',
  ADMIN_CATALOG: '/admin/shop-catalog',
  ADMIN_EMAIL_SETTINGS: '/admin/email-settings',
  ADMIN_DATA_MIGRATION: '/admin/data-migration',
  UNAUTHORIZED: '/unauthorized',
} as const

// Route Names
export const ROUTE_NAMES = {
  LOGIN: 'login',
  SET_PASSWORD: 'set-password',
  DASHBOARD: 'dashboard',
  JOB_HOME: 'job-home',
  JOB_DAILY_LOGS: 'job-daily-logs',
  JOB_TIMECARDS: 'job-timecards',
  JOB_SHOP_ORDERS: 'job-shop-orders',
  ADMIN_USERS: 'admin-users',
  ADMIN_JOBS: 'admin-jobs',
  ADMIN_SHOP_CATALOG: 'admin-shop-catalog',
  ADMIN_EMAIL_SETTINGS: 'admin-email-settings',
  ADMIN_DATA_MIGRATION: 'admin-data-migration',
  UNAUTHORIZED: 'unauthorized',
  NOT_FOUND: 'not-found',
} as const

export type RouteName = typeof ROUTE_NAMES[keyof typeof ROUTE_NAMES]

// Timecard validation and display constants
export const ACCOUNT_VALIDATION = {
  ACCOUNT_NUMBER_PATTERN: /^\d{4}$/, // Exactly 4 digits
  ACCOUNT_NUMBER_LENGTH: 4,
  GL_CODE_LENGTH: 3, // 3-digit GL code makes account number optional
  EMPLOYEE_NUMBER_PATTERN: /^\d{4,5}$/, // 4-5 digits
  EMPLOYEE_NUMBER_MIN: 4,
  EMPLOYEE_NUMBER_MAX: 5,
} as const

// Day names for display (index 0=Sunday)
export const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
