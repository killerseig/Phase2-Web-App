import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

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
      path: '/__e2e/timecard-workbook',
      name: 'e2e-timecard-workbook',
      component: () => import('@/views/E2ETimecardWorkbookView.vue'),
      meta: {
        requiresAuth: false,
        title: 'E2E Timecard Workbook',
      },
    },
    {
      path: '/__e2e/daily-log-draft',
      name: 'e2e-daily-log-draft',
      component: () => import('@/views/E2EDailyLogDraftView.vue'),
      meta: {
        requiresAuth: false,
        title: 'E2E Daily Log Draft',
      },
    },
    {
      path: '/__e2e/shop-order-workspace',
      name: 'e2e-shop-order-workspace',
      component: () => import('@/views/E2EShopOrderWorkspaceView.vue'),
      meta: {
        requiresAuth: false,
        title: 'E2E Shop Order Workspace',
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
        adminOnly: true,
      },
    },
    {
      path: '/exports/timecards/print',
      name: 'timecard-export-print',
      component: () => import('@/views/TimecardExportPrintView.vue'),
      meta: {
        title: 'Timecard PDF',
        adminOnly: true,
      },
    },
    {
      path: '/users',
      name: 'users',
      component: () => import('@/views/UsersView.vue'),
      meta: {
        title: 'Users',
        adminOnly: true,
      },
    },
    {
      path: '/employees',
      name: 'employees',
      component: () => import('@/views/EmployeesView.vue'),
      meta: {
        title: 'Employees',
        adminOnly: true,
      },
    },
    {
      path: '/settings/lists/:listKey(job-types|gcs|occupations)',
      name: 'reference-list',
      component: () => import('@/views/ReferenceListView.vue'),
      meta: {
        title: 'Reference List',
        adminOnly: true,
      },
    },
    {
      path: '/settings/shop-catalog',
      name: 'shop-catalog',
      component: () => import('@/views/ShopCatalogAdminView.vue'),
      meta: {
        title: 'Shop Catalog',
        adminOnly: true,
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
  const auth = useAuthStore()
  await auth.init()

  const requiresAuth = to.meta.requiresAuth ?? true
  if (!requiresAuth) {
    if ((to.name === 'login' || to.name === 'forgot-password') && auth.hasWorkspaceAccess) {
      return { name: 'jobs' }
    }
    return true
  }

  if (!auth.hasWorkspaceAccess) {
    return { name: 'login' }
  }

  if (to.meta.adminOnly && !auth.isAdmin) {
    return { name: 'jobs' }
  }

  if (typeof to.params.jobId === 'string' && !auth.canAccessJob(to.params.jobId)) {
    return { name: 'jobs' }
  }

  return true
})

router.afterEach((to) => {
  document.title = `${String(to.meta.title ?? 'Phase 2')} | Phase 2`
})

export default router
