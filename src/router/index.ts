import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router'
import { getWorkspaceRedirectTarget } from '@/features/auth/authViewHelpers'
import {
  getRouteAccessDecision,
  getRouteParamJobId,
  getRouteRequiresAuth,
} from '@/router/routeAccess'
import { useAuthStore } from '@/stores/auth'
import { useJobsStore } from '@/stores/jobs'

function routeQueryText(value: unknown): string {
  const candidate = Array.isArray(value) ? value[0] : value
  return typeof candidate === 'string' ? candidate.trim() : ''
}

function getLegacyDailyLogGalleryRedirect(to: RouteLocationNormalized) {
  if (to.name !== 'daily-logs' || to.hash !== '#daily-log-photos') return null

  const jobId = getRouteParamJobId(to.params.jobId)
  const dailyLogId = routeQueryText(to.query.logId)
  if (!jobId || !dailyLogId) return null

  return {
    name: 'daily-log-gallery-legacy',
    params: { jobId, dailyLogId },
    replace: true,
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/login',
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: {
        requiresAuth: false,
        title: 'Login',
      },
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: () => import('@/views/ForgotPasswordView.vue'),
      meta: {
        requiresAuth: false,
        title: 'Forgot Password',
      },
    },
    {
      path: '/set-password',
      name: 'set-password',
      component: () => import('@/views/SetPasswordView.vue'),
      meta: {
        requiresAuth: false,
        title: 'Set Password',
      },
    },
    {
      path: '/daily-log-gallery/legacy/:jobId/:dailyLogId',
      name: 'daily-log-gallery-legacy',
      component: () => import('@/views/DailyLogGalleryView.vue'),
      meta: {
        requiresAuth: false,
        title: 'Daily Log Photos',
      },
    },
    {
      path: '/daily-log-gallery/:shareId',
      name: 'daily-log-gallery',
      component: () => import('@/views/DailyLogGalleryView.vue'),
      meta: {
        requiresAuth: false,
        title: 'Daily Log Photos',
      },
    },
    {
      path: '/jobs',
      name: 'jobs',
      component: () => import('@/views/JobsView.vue'),
      meta: {
        title: 'Jobs',
      },
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('@/views/RoleDashboardView.vue'),
      meta: {
        title: 'Dashboard',
      },
    },
    {
      path: '/jobs/:jobId',
      name: 'job-dashboard',
      component: () => import('@/views/JobDashboardView.vue'),
      meta: {
        title: 'Job Dashboard',
      },
    },
    {
      path: '/jobs/:jobId/timecards',
      name: 'timecards',
      component: () => import('@/views/TimecardsView.vue'),
      meta: {
        title: 'Timecards',
      },
    },
    {
      path: '/jobs/:jobId/daily-logs',
      name: 'daily-logs',
      component: () => import('@/views/DailyLogsView.vue'),
      meta: {
        title: 'Daily Logs',
      },
    },
    {
      path: '/jobs/:jobId/shop-orders',
      name: 'shop-orders',
      component: () => import('@/views/ShopOrdersView.vue'),
      meta: {
        title: 'Shop Orders',
      },
    },
    {
      path: '/exports/timecards',
      name: 'timecard-export',
      component: () => import('@/views/TimecardExportView.vue'),
      meta: {
        title: 'Timecard Export',
        requiredCapability: 'use-timecard-export',
      },
    },
    {
      path: '/exports/timecards/print',
      name: 'timecard-export-print',
      component: () => import('@/views/TimecardExportPrintView.vue'),
      meta: {
        title: 'Timecard PDF',
        requiredCapability: 'use-timecard-export',
      },
    },
    {
      path: '/users',
      name: 'users',
      component: () => import('@/views/UsersView.vue'),
      meta: {
        title: 'Users',
        requiredCapability: 'manage-users',
      },
    },
    {
      path: '/employees',
      name: 'employees',
      component: () => import('@/views/EmployeesView.vue'),
      meta: {
        title: 'Employees',
        requiredCapability: 'manage-employees',
      },
    },
    {
      path: '/settings/lists/:listKey(job-types|gcs|occupations)',
      name: 'reference-list',
      component: () => import('@/views/ReferenceListView.vue'),
      meta: {
        title: 'Reference List',
        requiredCapability: 'manage-reference-lists',
      },
    },
    {
      path: '/settings/shop-catalog',
      name: 'shop-catalog',
      component: () => import('@/views/ShopCatalogAdminView.vue'),
      meta: {
        title: 'Shop Catalog',
        requiredCapability: 'manage-shop-catalog',
      },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
      meta: {
        requiresAuth: false,
        title: 'Not Found',
      },
    },
  ],
})

router.beforeEach(async (to) => {
  const legacyGalleryRedirect = getLegacyDailyLogGalleryRedirect(to)
  if (legacyGalleryRedirect) return legacyGalleryRedirect

  // Public gallery links must not wait for or depend on an authenticated app session.
  if (to.name === 'daily-log-gallery' || to.name === 'daily-log-gallery-legacy') return true

  const auth = useAuthStore()
  const jobs = useJobsStore()

  await auth.init()
  const routeJobId = getRouteParamJobId(to.params.jobId)

  if (routeJobId && auth.hasWorkspaceAccess && jobs.jobs.length === 0) {
    // Do not block deep-link rendering on job list hydration. On refresh, a slow
    // callable/listener can otherwise leave the app shell blank before the route
    // component has a chance to load.
    void jobs.subscribeVisibleJobs()
  }

  if (to.name === 'login' && auth.hasWorkspaceAccess) {
    return getWorkspaceRedirectTarget(to.query.redirect)
  }

  const decision = getRouteAccessDecision({
    assignedJobIds: auth.assignedJobIds,
    currentUserId: auth.currentUser?.uid ?? null,
    hasWorkspaceAccess: auth.hasWorkspaceAccess,
    requiredCapability: to.meta.requiredCapability,
    requiresAuth: getRouteRequiresAuth(to.meta.requiresAuth),
    routeJobId,
    rawRole: auth.rawRole,
    routeName: to.name,
    visibleJobs: jobs.jobs,
  })

  if (decision !== true && decision.name === 'login') {
    return {
      name: 'login',
      query: { redirect: to.fullPath },
    }
  }

  return decision
})

router.afterEach((to) => {
  document.title = `${String(to.meta.title ?? 'Phase 2')} | Phase 2`
})

export default router
