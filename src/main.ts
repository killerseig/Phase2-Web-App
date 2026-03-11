import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { watch } from 'vue'
import App from './App.vue'
import { getRouteAccessRedirect, router } from './router'
import { useAuthStore } from './stores/auth'
import { ROLES } from './constants/app'
import 'bootstrap'
import 'bootstrap-icons/font/bootstrap-icons.css'
import './styles/main.scss'


const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

const auth = useAuthStore(pinia)
void auth.init()

const canAccessJob = (jobId: string): boolean => {
  if (!jobId) return false
  if (!auth.user || auth.active === false || !auth.role || auth.role === ROLES.NONE) return false
  if (auth.role === ROLES.FOREMAN) {
    return (auth.assignedJobIds ?? []).includes(jobId)
  }
  return true
}

let enforcingRouteAccess = false
let lastAuthSignature = ''
watch(
  [
    () => auth.ready,
    () => auth.user?.uid ?? null,
    () => auth.active,
    () => auth.role,
    () => auth.assignedJobIds.join('|'),
    () => router.currentRoute.value.fullPath,
  ],
  async () => {
    const authSignature = `${auth.user?.uid ?? ''}|${auth.active}|${auth.role ?? ''}|${auth.assignedJobIds.join('|')}`
    const authChanged = authSignature !== lastAuthSignature
    lastAuthSignature = authSignature

    if (!auth.ready || enforcingRouteAccess) return

    const currentRoute = router.currentRoute.value

    // If permissions are restored while on unauthorized, recover automatically.
    if (
      authChanged &&
      currentRoute.name === 'unauthorized' &&
      auth.user &&
      auth.active &&
      auth.role &&
      auth.role !== ROLES.NONE
    ) {
      enforcingRouteAccess = true
      try {
        await router.replace({ name: 'dashboard' })
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

app.mount('#app')
