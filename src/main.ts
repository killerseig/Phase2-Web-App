import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { watch } from 'vue'
import App from '@/App.vue'
import { getRouteAccessRedirect, router } from '@/router'
import { useAuthStore } from '@/stores/auth'
import { ROLES, ROUTE_NAMES } from '@/constants/app'
import { logError } from '@/utils'
import { canAccessJobForSnapshot } from '@/utils/accessControl'
import 'bootstrap'
import 'bootstrap-icons/font/bootstrap-icons.css'
import './styles/main.scss'

declare global {
  interface Window {
    __phase2ErrorHandlersInstalled?: boolean
  }
}

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)
app.config.errorHandler = (error, _instance, info) => {
  logError('Vue', `Unhandled component error (${info})`, error)
}

if (typeof window !== 'undefined' && !window.__phase2ErrorHandlersInstalled) {
  window.addEventListener('error', (event: ErrorEvent) => {
    logError('Window', 'Unhandled error event', event.error ?? event.message)
  })

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    logError('Window', 'Unhandled promise rejection', event.reason)
  })

  window.__phase2ErrorHandlersInstalled = true
}

if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('data-bs-theme', 'dark')
}

const auth = useAuthStore(pinia)
void auth.init()

const canAccessJob = (jobId: string): boolean =>
  canAccessJobForSnapshot(
    {
      user: auth.user,
      active: auth.active,
      role: auth.role,
      assignedJobIds: auth.assignedJobIds,
    },
    jobId
  )

const getAssignedJobsSignature = () => [...auth.assignedJobIds].sort().join('|')

let enforcingRouteAccess = false
let lastAuthSignature = ''
watch(
  [
    () => auth.ready,
    () => auth.user?.uid ?? null,
    () => auth.active,
    () => auth.role,
    getAssignedJobsSignature,
    () => router.currentRoute.value.fullPath,
  ],
  async () => {
    const authSignature = `${auth.user?.uid ?? ''}|${auth.active}|${auth.role ?? ''}|${getAssignedJobsSignature()}`
    const authChanged = authSignature !== lastAuthSignature
    lastAuthSignature = authSignature

    if (!auth.ready || enforcingRouteAccess) return

    const currentRoute = router.currentRoute.value

    // If permissions are restored while on unauthorized, recover automatically.
    if (
      authChanged &&
      currentRoute.name === ROUTE_NAMES.UNAUTHORIZED &&
      auth.user &&
      auth.active &&
      auth.role &&
      auth.role !== ROLES.NONE
    ) {
      enforcingRouteAccess = true
      try {
        await router.replace({ name: ROUTE_NAMES.DASHBOARD })
      } finally {
        enforcingRouteAccess = false
      }
      return
    }

    const redirect = getRouteAccessRedirect(
      currentRoute,
      { user: auth.user, active: auth.active, role: auth.role },
      canAccessJob
    )

    if (redirect === true) return

    const target = router.resolve(redirect)
    if (target.fullPath === currentRoute.fullPath) return

    enforcingRouteAccess = true
    try {
      await router.replace(redirect)
    } finally {
      enforcingRouteAccess = false
    }
  },
  { immediate: true }
)

const bootstrap = async () => {
  await router.isReady()
  app.mount('#app')
}

void bootstrap()
