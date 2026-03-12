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
import { ROUTES, ROLES, type Role } from '@/constants/app'
import { canAccessJobForSnapshot } from '@/utils/accessControl'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth: boolean
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
  requiresAuth?: boolean
  title?: string
  redirect?: string
}

const BASE_TITLE = 'Phase 2'

const toMeta = (config: RouteConfig): RouteMeta => ({
  requiresAuth: config.requiresAuth ?? true,
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
    requiresAuth: false,
    title: 'Login',
  },
  {
    path: '/set-password',
    name: 'set-password',
    component: () => import('../views/SetPassword.vue'),
    requiresAuth: false,
    title: 'Set Your Password',
  },
  // Signup disabled - accounts created by admin only
  // {
  //   path: ROUTES.SIGNUP,
  //   name: 'signup',
  //   component: () => import('../views/SignUp.vue'),
  //   requiresAuth: false,
  //   title: 'Sign Up',
  // },

  // User dashboard (job selector)
  {
    path: ROUTES.DASHBOARD,
    name: 'dashboard',
    component: () => import('../views/Dashboard.vue'),
    roles: [ROLES.ADMIN, ROLES.EMPLOYEE, ROLES.SHOP, ROLES.FOREMAN],
    title: 'Dashboard',
  },

  // Job home (module selector)
  {
    path: `${ROUTES.JOB}/:jobId`,
    name: 'job-home',
    component: () => import('../views/JobHome.vue'),
    roles: [ROLES.ADMIN, ROLES.EMPLOYEE, ROLES.SHOP, ROLES.FOREMAN],
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
    title: 'Admin - Users',
  },
  {
    path: ROUTES.ADMIN_JOBS,
    name: 'admin-jobs',
    component: () => import('../views/admin/AdminJobs.vue'),
    roles: [ROLES.ADMIN],
    title: 'Admin - Jobs',
  },
  {
    path: ROUTES.ADMIN_CATALOG,
    name: 'admin-shop-catalog',
    component: () => import('../views/admin/AdminShopCatalog.vue'),
    roles: [ROLES.ADMIN],
    title: 'Admin - Shop Catalog',
  },
  {
    path: ROUTES.ADMIN_EMAIL_SETTINGS,
    name: 'admin-email-settings',
    component: () => import('../views/admin/AdminEmailSettings.vue'),
    roles: [ROLES.ADMIN],
    title: 'Admin - Email Settings',
  },
  {
    path: ROUTES.ADMIN_DATA_MIGRATION,
    name: 'admin-data-migration',
    component: () => import('../views/admin/AdminDataMigration.vue'),
    roles: [ROLES.ADMIN],
    title: 'Admin - Data Migration',
  },

  // Access denied
  {
    path: ROUTES.UNAUTHORIZED,
    name: 'unauthorized',
    component: () => import('../views/Unauthorized.vue'),
    requiresAuth: false,
    title: 'Unauthorized',
  },

  // Catch-all
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('../views/NotFound.vue'),
    requiresAuth: false,
    title: 'Not Found',
  },
]

const toRouteRecord = (config: RouteConfig): RouteRecordRaw => {
  if (config.redirect) {
    return {
      path: config.path,
      redirect: config.redirect,
      meta: toMeta(config),
      ...(config.name ? { name: config.name } : {}),
    }
  }

  if (!config.component) {
    throw new Error(`Route "${config.path}" is missing a component`)
  }

  return {
    path: config.path,
    component: config.component,
    meta: toMeta(config),
    ...(config.name ? { name: config.name } : {}),
    ...(config.path.includes(':') ? { props: true } : {}),
  }
}

// Build routes array for Vue Router
const routes: RouteRecordRaw[] = routeConfigs.map(toRouteRecord)

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, _from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) return { el: to.hash }
    return { top: 0 }
  },
})

type RouteRedirectName = 'dashboard' | 'login' | 'unauthorized'
type RouteAccessRedirect = true | { name: RouteRedirectName }

type AccessSnapshot = {
  user: unknown
  active: boolean
  role: Role | null
}

type RouteAccessTarget = Pick<RouteLocationNormalized, 'meta' | 'name' | 'params'>

export const getRouteAccessRedirect = (
  to: RouteAccessTarget,
  auth: AccessSnapshot,
  canAccessJob: (jobId: string) => boolean
): RouteAccessRedirect => {
  const meta = (to.meta ?? {}) as Partial<RouteMeta>
  const requiresAuth = meta.requiresAuth ?? true
  const allowedRoles = Array.isArray(meta.roles) ? meta.roles : []

  if (!requiresAuth) {
    if (auth.user && to.name === 'login') return { name: 'dashboard' }
    return true
  }

  if (!auth.user) return { name: 'login' }
  if (!auth.active) return { name: 'login' }

  if (allowedRoles.length > 0) {
    const userRole = (auth.role ?? ROLES.NONE) as Role
    if (!allowedRoles.includes(userRole)) {
      return { name: 'unauthorized' }
    }
  }

  if (auth.role === ROLES.FOREMAN && to.params?.jobId) {
    const jobIdParam = Array.isArray(to.params.jobId) ? to.params.jobId[0] : to.params.jobId
    const jobId = String(jobIdParam)
    if (!canAccessJob(jobId)) {
      return { name: 'unauthorized' }
    }
  }

  return true
}

export const runNavigationGuard: NavigationGuardWithThis<undefined> = async (to: RouteLocationNormalized) => {
  const auth = useAuthStore()

  // Ensure auth state is resolved (no polling loop)
  if (!auth.ready) await auth.init()

  const redirect = getRouteAccessRedirect(
    to,
    { user: auth.user, active: auth.active, role: auth.role },
    (jobId: string) =>
      canAccessJobForSnapshot(
        {
          user: auth.user,
          active: auth.active,
          role: auth.role,
          assignedJobIds: auth.assignedJobIds,
        },
        jobId
      )
  )

  // Keep existing behavior: inactive users are actively signed out.
  if (redirect !== true && redirect.name === 'login' && auth.user && !auth.active) {
    await auth.signOut()
  }

  return redirect
}

router.beforeEach(runNavigationGuard)

// Update document title after navigation completes
router.afterEach((to) => {
  const pageTitle = typeof to.meta.title === 'string' ? to.meta.title : undefined
  document.title = pageTitle ? `${pageTitle} - ${BASE_TITLE}` : BASE_TITLE
})

