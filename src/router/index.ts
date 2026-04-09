import {
  createRouter,
  createWebHistory,
  type NavigationGuardWithThis,
  type RouteComponent,
  type RouteLocationNormalized,
  type RouteMeta,
  type RouteRecordRaw,
} from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ROUTES, ROUTE_NAMES, ROLES, type Role, type RouteName } from '@/constants/app'
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
  name?: RouteName
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
  { path: '/', redirect: ROUTES.DASHBOARD },

  // Authentication
  {
    path: ROUTES.LOGIN,
    name: ROUTE_NAMES.LOGIN,
    component: () => import('../views/Login.vue'),
    requiresAuth: false,
    title: 'Login',
  },
  {
    path: ROUTES.SET_PASSWORD,
    name: ROUTE_NAMES.SET_PASSWORD,
    component: () => import('../views/SetPassword.vue'),
    requiresAuth: false,
    title: 'Set Your Password',
  },

  // User dashboard (job selector)
  {
    path: ROUTES.DASHBOARD,
    name: ROUTE_NAMES.DASHBOARD,
    component: () => import('../views/Dashboard.vue'),
    roles: [ROLES.ADMIN, ROLES.CONTROLLER, ROLES.FOREMAN],
    title: 'Dashboard',
  },

  // Controller page (admin/controller only)
  {
    path: ROUTES.CONTROLLER,
    name: ROUTE_NAMES.CONTROLLER,
    component: () => import('../views/Controller.vue'),
    roles: [ROLES.ADMIN, ROLES.CONTROLLER],
    title: 'Controller',
  },

  // Job home (module selector)
  {
    path: `${ROUTES.JOB}/:jobId`,
    name: ROUTE_NAMES.JOB_HOME,
    component: () => import('../views/JobHome.vue'),
    roles: [ROLES.ADMIN, ROLES.FOREMAN],
    title: 'Job Home',
  },

  // Job-scoped modules
  {
    path: `${ROUTES.JOB}/:jobId/daily-logs`,
    name: ROUTE_NAMES.JOB_DAILY_LOGS,
    component: () => import('../views/DailyLogs.vue'),
    roles: [ROLES.ADMIN, ROLES.FOREMAN],
    title: 'Daily Logs',
  },
  {
    path: `${ROUTES.JOB}/:jobId/timecards`,
    name: ROUTE_NAMES.JOB_TIMECARDS,
    component: () => import('../views/Timecards.vue'),
    roles: [ROLES.ADMIN, ROLES.FOREMAN],
    title: 'Timecards',
  },
  {
    path: `${ROUTES.JOB}/:jobId/shop-orders`,
    name: ROUTE_NAMES.JOB_SHOP_ORDERS,
    component: () => import('../views/ShopOrders.vue'),
    roles: [ROLES.ADMIN, ROLES.FOREMAN],
    title: 'Shop Orders',
  },

  // Admin section
  {
    path: ROUTES.ADMIN_USERS,
    name: ROUTE_NAMES.ADMIN_USERS,
    component: () => import('../views/admin/AdminUsers.vue'),
    roles: [ROLES.ADMIN],
    title: 'Admin - Users',
  },
  {
    path: ROUTES.ADMIN_EMPLOYEES,
    name: ROUTE_NAMES.ADMIN_EMPLOYEES,
    component: () => import('../views/admin/AdminEmployees.vue'),
    roles: [ROLES.ADMIN],
    title: 'Admin - Employees',
  },
  {
    path: ROUTES.ADMIN_JOBS,
    name: ROUTE_NAMES.ADMIN_JOBS,
    component: () => import('../views/admin/AdminJobs.vue'),
    roles: [ROLES.ADMIN],
    title: 'Admin - Jobs',
  },
  {
    path: ROUTES.ADMIN_CATALOG,
    name: ROUTE_NAMES.ADMIN_SHOP_CATALOG,
    component: () => import('../views/admin/AdminShopCatalog.vue'),
    roles: [ROLES.ADMIN],
    title: 'Admin - Shop Catalog',
  },
  {
    path: ROUTES.ADMIN_EMAIL_SETTINGS,
    name: ROUTE_NAMES.ADMIN_EMAIL_SETTINGS,
    component: () => import('../views/admin/AdminEmailSettings.vue'),
    roles: [ROLES.ADMIN],
    title: 'Admin - Email Settings',
  },

  // Access denied
  {
    path: ROUTES.UNAUTHORIZED,
    name: ROUTE_NAMES.UNAUTHORIZED,
    component: () => import('../views/Unauthorized.vue'),
    requiresAuth: false,
    title: 'Unauthorized',
  },

  // Catch-all
  {
    path: '/:pathMatch(.*)*',
    name: ROUTE_NAMES.NOT_FOUND,
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

type RouteRedirectName =
  | typeof ROUTE_NAMES.DASHBOARD
  | typeof ROUTE_NAMES.LOGIN
  | typeof ROUTE_NAMES.UNAUTHORIZED
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
    if (auth.user && to.name === ROUTE_NAMES.LOGIN) return { name: ROUTE_NAMES.DASHBOARD }
    return true
  }

  if (!auth.user) return { name: ROUTE_NAMES.LOGIN }
  if (!auth.active) return { name: ROUTE_NAMES.LOGIN }

  if (allowedRoles.length > 0) {
    const userRole = (auth.role ?? ROLES.NONE) as Role
    if (!allowedRoles.includes(userRole)) {
      return { name: ROUTE_NAMES.UNAUTHORIZED }
    }
  }

  if (auth.role === ROLES.FOREMAN && to.params?.jobId) {
    const jobIdParam = Array.isArray(to.params.jobId) ? to.params.jobId[0] : to.params.jobId
    const jobId = String(jobIdParam)
    if (!canAccessJob(jobId)) {
      return { name: ROUTE_NAMES.UNAUTHORIZED }
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
  if (redirect !== true && redirect.name === ROUTE_NAMES.LOGIN && auth.user && !auth.active) {
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

