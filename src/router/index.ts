import {
  createRouter,
  createWebHistory,
  type NavigationGuardWithThis,
  type RouteComponent,
  type RouteLocationNormalized,
  type RouteMeta,
  type RouteRecordRaw,
} from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useJobAccess } from '@/composables/useJobAccess'
import { ROUTES, ROLES, type Role } from '@/constants/app'

declare module 'vue-router' {
  interface RouteMeta {
    public: boolean
    roles: Role[]
    title: string
  }
}

type LazyView = () => Promise<RouteComponent>

// Route configurations
interface RouteConfig {
  path: string
  name?: string
  component?: LazyView
  roles?: Role[]
  isPublic?: boolean
  title?: string
  redirect?: string
}

const BASE_TITLE = 'Phase 2'

const toMeta = (config: RouteConfig): RouteMeta => ({
  public: config.isPublic ?? false,
  roles: config.roles ?? [],
  title: config.title ?? 'App',
})

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
const routes: RouteRecordRaw[] = routeConfigs.map((config) => {
  // If the route is a redirect, do not include component or props
  if (config.redirect) {
    return {
      path: config.path,
      redirect: config.redirect,
      meta: toMeta(config),
      ...(config.name && { name: config.name }),
    }
  }
  // Otherwise, normal route
  return {
    path: config.path,
    ...(config.name && { name: config.name }),
    ...(config.component && { component: config.component }),
    meta: toMeta(config),
    props: config.path.includes(':') ? true : undefined,
  }
})

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

export const runNavigationGuard: NavigationGuardWithThis<undefined> = async (to: RouteLocationNormalized) => {
  const auth = useAuthStore()
  const jobAccess = useJobAccess()

  const meta = (to.meta ?? {}) as Partial<RouteMeta>
  const isPublicRoute = meta.public ?? false
  const allowedRoles = Array.isArray(meta.roles) ? meta.roles : []

  // Ensure auth state is resolved (no polling loop)
  if (!auth.ready) await auth.init()

  // Public routes
  if (isPublicRoute) {
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
  if (allowedRoles.length > 0) {
    const userRole = auth.role || ROLES.NONE
    if (!allowedRoles.includes(userRole)) {
      return { name: 'unauthorized' }
    }
  }

  // Foremen can only access jobs assigned to them
  if (auth.role === ROLES.FOREMAN && to.params?.jobId) {
    const jobIdParam = Array.isArray(to.params.jobId) ? to.params.jobId[0] : to.params.jobId
    const jobId = String(jobIdParam)
    if (!jobAccess.canAccessJob(jobId)) {
      return { name: 'unauthorized' }
    }
  }

  return true
}

router.beforeEach(runNavigationGuard)

// Update document title after navigation completes
router.afterEach((to) => {
  const pageTitle = to.meta.title as string | undefined
  document.title = pageTitle ? `${pageTitle} · ${BASE_TITLE}` : BASE_TITLE
})
