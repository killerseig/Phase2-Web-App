import { ROLES } from '@/constants/app'

export type NavRole = typeof ROLES[keyof typeof ROLES]

export interface NavItem {
  label: string
  icon: string
  to: string | { name: string; params?: Record<string, string> }
  roles?: NavRole[]
  section?: 'dashboard' | 'job' | 'admin'
  jobScoped?: boolean
}

export const navItems: NavItem[] = [
  { label: 'Dashboard', icon: 'bi-grid-1x2', to: '/dashboard', section: 'dashboard' },
  { label: 'Job Home', icon: 'bi-briefcase', to: { name: 'job-home' }, section: 'job', jobScoped: true },
  { label: 'Daily Logs', icon: 'bi-journal-text', to: { name: 'job-daily-logs' }, section: 'job', jobScoped: true, roles: [ROLES.ADMIN, ROLES.EMPLOYEE, ROLES.FOREMAN] },
  { label: 'Timecards', icon: 'bi-clock-history', to: { name: 'job-timecards' }, section: 'job', jobScoped: true, roles: [ROLES.ADMIN, ROLES.EMPLOYEE, ROLES.FOREMAN] },
  { label: 'Shop Orders', icon: 'bi-receipt', to: { name: 'job-shop-orders' }, section: 'job', jobScoped: true, roles: [ROLES.ADMIN, ROLES.EMPLOYEE, ROLES.SHOP, ROLES.FOREMAN] },
  { label: 'Users', icon: 'bi-people', to: '/admin/users', section: 'admin', roles: [ROLES.ADMIN] },
  { label: 'Jobs', icon: 'bi-building', to: '/admin/jobs', section: 'admin', roles: [ROLES.ADMIN] },
  { label: 'Shop Catalog', icon: 'bi-box-seam', to: '/admin/shop-catalog', section: 'admin', roles: [ROLES.ADMIN] },
  { label: 'Email Settings', icon: 'bi-envelope', to: '/admin/email-settings', section: 'admin', roles: [ROLES.ADMIN] },
]

export const crumbByRouteName: Record<string, string> = {
  dashboard: 'Dashboard',
  'job-home': 'Job',
  'job-daily-logs': 'Daily Logs',
  'job-timecards': 'Timecards',
  'job-shop-orders': 'Shop Orders',
  'admin-users': 'Admin · Users',
  'admin-jobs': 'Admin · Jobs',
  'admin-shop-catalog': 'Admin · Shop Catalog',
  'admin-email-settings': 'Admin · Email Settings',
  'admin-data-migration': 'Admin · Data Migration',
  unauthorized: 'Unauthorized',
  login: 'Auth',
  'set-password': 'Auth',
}
