import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { ROUTES, ROLES } from '@/constants/app'

type Role = typeof ROLES[keyof typeof ROLES]

// Route configurations
interface RouteConfig {
  path: string
  name: string
  component: () => Promise<any>
  roles?: Role[]
  isPublic?: boolean
  title: string
}

const routeConfigs: RouteConfig[] = [
  // Root
  { path: '/', redirect: '/dashboard' },

  // Authentication
  {
    path: ROUTES.LOGIN,
    name: 'login',
    component: () => import('../views/Login.vue'),
    isPublic: true,
    title: 'Login',
  },
  {
    path: '/set-password',
    name: 'set-password',
    component: () => import('../views/SetPassword.vue'),
    isPublic: true,
    title: 'Set Your Password',
  },
  // Signup disabled - accounts created by admin only
  // {
  //   path: ROUTES.SIGNUP,
  //   name: 'signup',
  //   component: () => import('../views/SignUp.vue'),
  //   isPublic: true,
  //   title: 'Sign Up',
  // },

  // User dashboard (job selector) - publicly accessible after login, shows role-specific content
  {
    path: ROUTES.DASHBOARD,
    name: 'dashboard',
    component: () => import('../views/Dashboard.vue'),
    title: 'Dashboard',
  },

  // Job home (module selector) - accessible to any authenticated user, shows role-specific modules
  {
    path: `${ROUTES.JOB}/:jobId`,
    name: 'job-home',
    component: () => import('../views/JobHome.vue'),
    title: 'Job Home',
  },

  // Job-scoped modules
  {
    path: `${ROUTES.JOB}/:jobId/daily-logs`,
    name: 'job-daily-logs',
    component: () => import('../views/DailyLogs.vue'),
    roles: [ROLES.ADMIN, ROLES.EMPLOYEE, ROLES.FOREMAN],
    title: 'Daily Logs',
  },
  {
    path: `${ROUTES.JOB}/:jobId/timecards`,
    name: 'job-timecards',
    component: () => import('../views/Timecards.vue'),
    roles: [ROLES.ADMIN, ROLES.EMPLOYEE, ROLES.FOREMAN],
    title: 'Timecards',
  },
  {
    path: `${ROUTES.JOB}/:jobId/shop-orders`,
    name: 'job-shop-orders',
    component: () => import('../views/ShopOrders.vue'),
    roles: [ROLES.ADMIN, ROLES.EMPLOYEE, ROLES.SHOP, ROLES.FOREMAN],
    title: 'Shop Orders',
  },

  // Admin section
  {
    path: ROUTES.ADMIN_USERS,
    name: 'admin-users',
    component: () => import('../views/admin/AdminUsers.vue'),
    roles: [ROLES.ADMIN],
    title: 'Admin · Users',
  },
  {
    path: ROUTES.ADMIN_JOBS,
    name: 'admin-jobs',
    component: () => import('../views/admin/AdminJobs.vue'),
    roles: [ROLES.ADMIN],
    title: 'Admin · Jobs',
  },
  {
    path: ROUTES.ADMIN_CATALOG,
    name: 'admin-shop-catalog',
    component: () => import('../views/admin/AdminShopCatalog.vue'),
    roles: [ROLES.ADMIN, ROLES.SHOP],
    title: 'Admin · Shop Catalog',
  },
  {
    path: ROUTES.ADMIN_EMAIL_SETTINGS,
    name: 'admin-email-settings',
    component: () => import('../views/admin/AdminEmailSettings.vue'),
    roles: [ROLES.ADMIN],
    title: 'Admin · Email Settings',
  },
  {
    path: ROUTES.ADMIN_DATA_MIGRATION,
    name: 'admin-data-migration',
    component: () => import('../views/admin/AdminDataMigration.vue'),
    roles: [ROLES.ADMIN],
    title: 'Admin · Data Migration',
  },

  // Access denied
  {
    path: ROUTES.UNAUTHORIZED,
    name: 'unauthorized',
    component: () => import('../views/Unauthorized.vue'),
    isPublic: true,
    title: 'Unauthorized',
  },

  // Catch-all
  { path: '/:pathMatch(.*)*', redirect: ROUTES.DASHBOARD },
]

// Build routes array for Vue Router
const routes: RouteRecordRaw[] = routeConfigs.map((config) => ({
  path: config.path,
  ...(config.name && { name: config.name }),
  ...(config.component && { component: config.component }),
  meta: {
    public: config.isPublic || false,
    roles: config.roles || [],
    title: config.title || 'App',
  },
  ...(config.path === '/' && { redirect: ROUTES.DASHBOARD }),
  props: config.path.includes(':') ? true : undefined,
}))

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  // Ensure auth state is resolved (no polling loop)
  if (!auth.ready) await auth.init()

  // Public routes
  if (to.meta.public) {
    if (auth.user && to.name === 'login') return { name: 'dashboard' }
    return true
  }

  // Authentication required
  if (!auth.user) return { name: 'login' }

  // Check if user is active (deactivated users should be signed out)
  if (!auth.active) {
    await auth.signOut()
    return { name: 'login' }
  }

  // Role-based access control
  const allowedRoles = to.meta.roles as Role[] | undefined
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = auth.role || ROLES.NONE
    if (!allowedRoles.includes(userRole)) {
      return { name: 'unauthorized' }
    }
  }

  return true
})
