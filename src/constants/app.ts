/**
 * Frontend Constants
 * Centralized configuration for roles, routes, UI text, etc.
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

// Valid roles array for validation
export const VALID_ROLES = ['admin', 'employee', 'shop', 'foreman', 'none'] as const

// Route Paths
export const ROUTES = {
  LOGIN: '/login',
  SIGNUP: '/signup',
  DASHBOARD: '/dashboard',
  DAILY_LOGS: '/daily-logs',
  TIMECARDS: '/timecards',
  SHOP_ORDERS: '/shop-orders',
  JOB: '/job',
  ADMIN_USERS: '/admin/users',
  ADMIN_JOBS: '/admin/jobs',
  ADMIN_CATALOG: '/admin/shop-catalog',
  ADMIN_EMPLOYEES: '/admin/employees',
  ADMIN_EMAIL_SETTINGS: '/admin/email-settings',
  ADMIN_DATA_MIGRATION: '/admin/data-migration',
  UNAUTHORIZED: '/unauthorized',
} as const

// Navigation Labels
export const NAV_LABELS = {
  DASHBOARD: 'Dashboard',
  DAILY_LOGS: 'Daily Logs',
  TIMECARDS: 'Timecards',
  SHOP_ORDERS: 'Shop Orders',
  ADMIN: 'Admin',
  USERS: 'Users',
  JOBS: 'Jobs',
  SHOP: 'Shop Catalog',
  EMPLOYEES: 'Employees',
  LOGOUT: 'Logout',
  LOGIN: 'Login',
  SETTINGS: 'Settings',
} as const

// Messages
export const MESSAGES = {
  UNAUTHORIZED: 'You do not have permission to access this page.',
  LOADING: 'Loading...',
  ERROR: 'An error occurred. Please try again.',
  SUCCESS: 'Operation completed successfully.',
  CONFIRM_DELETE: 'Are you sure you want to delete this?',
  CONFIRM_LOGOUT: 'Are you sure you want to logout?',
} as const

// UI
export const UI = {
  BUTTON_SIZE: 'sm' as const,
  TOAST_DURATION: 3000,
  MODAL_ANIMATION: 'fade',
} as const

// Feature Flags
export const FEATURES = {
  ENABLE_SHOP: true,
  ENABLE_TIMECARDS: true,
  ENABLE_DAILY_LOGS: true,
} as const
