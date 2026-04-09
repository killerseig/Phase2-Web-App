import { ROLES, ROUTES, ROUTE_NAMES, type RouteName } from '@/constants/app'
import type { RouteLocationRaw } from 'vue-router'

export type NavRole = typeof ROLES[keyof typeof ROLES]

export interface NavItem {
  label: string
  icon: string
  to: RouteLocationRaw
  roles?: NavRole[]
  section?: 'dashboard' | 'job' | 'controller' | 'admin'
  jobScoped?: boolean
}

export const navItems: NavItem[] = [
  { label: 'Dashboard', icon: 'bi-grid-1x2', to: ROUTES.DASHBOARD, section: 'dashboard' },
  { label: 'Job Home', icon: 'bi-briefcase', to: { name: ROUTE_NAMES.JOB_HOME }, section: 'job', jobScoped: true },
  { label: 'Daily Logs', icon: 'bi-journal-text', to: { name: ROUTE_NAMES.JOB_DAILY_LOGS }, section: 'job', jobScoped: true, roles: [ROLES.ADMIN, ROLES.FOREMAN] },
  { label: 'Timecards', icon: 'bi-clock-history', to: { name: ROUTE_NAMES.JOB_TIMECARDS }, section: 'job', jobScoped: true, roles: [ROLES.ADMIN, ROLES.FOREMAN] },
  { label: 'Shop Orders', icon: 'bi-receipt', to: { name: ROUTE_NAMES.JOB_SHOP_ORDERS }, section: 'job', jobScoped: true, roles: [ROLES.ADMIN, ROLES.FOREMAN] },
  { label: 'Controller', icon: 'bi-sliders', to: ROUTES.CONTROLLER, section: 'controller', roles: [ROLES.ADMIN, ROLES.CONTROLLER] },
  { label: 'Users', icon: 'bi-people', to: ROUTES.ADMIN_USERS, section: 'admin', roles: [ROLES.ADMIN] },
  { label: 'Employees', icon: 'bi-person-vcard', to: ROUTES.ADMIN_EMPLOYEES, section: 'admin', roles: [ROLES.ADMIN] },
  { label: 'Jobs', icon: 'bi-building', to: ROUTES.ADMIN_JOBS, section: 'admin', roles: [ROLES.ADMIN] },
  { label: 'Shop Catalog', icon: 'bi-box-seam', to: ROUTES.ADMIN_CATALOG, section: 'admin', roles: [ROLES.ADMIN] },
  { label: 'Email Settings', icon: 'bi-envelope', to: ROUTES.ADMIN_EMAIL_SETTINGS, section: 'admin', roles: [ROLES.ADMIN] },
]

export const crumbByRouteName: Partial<Record<RouteName, string>> = {
  [ROUTE_NAMES.DASHBOARD]: 'Dashboard',
  [ROUTE_NAMES.JOB_HOME]: 'Job',
  [ROUTE_NAMES.JOB_DAILY_LOGS]: 'Daily Logs',
  [ROUTE_NAMES.JOB_TIMECARDS]: 'Timecards',
  [ROUTE_NAMES.JOB_SHOP_ORDERS]: 'Shop Orders',
  [ROUTE_NAMES.CONTROLLER]: 'Controller',
  [ROUTE_NAMES.ADMIN_USERS]: 'Admin - Users',
  [ROUTE_NAMES.ADMIN_EMPLOYEES]: 'Admin - Employees',
  [ROUTE_NAMES.ADMIN_JOBS]: 'Admin - Jobs',
  [ROUTE_NAMES.ADMIN_SHOP_CATALOG]: 'Admin - Shop Catalog',
  [ROUTE_NAMES.ADMIN_EMAIL_SETTINGS]: 'Admin - Email Settings',
  [ROUTE_NAMES.UNAUTHORIZED]: 'Unauthorized',
  [ROUTE_NAMES.LOGIN]: 'Auth',
  [ROUTE_NAMES.SET_PASSWORD]: 'Auth',
}

