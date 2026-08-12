import { onBeforeUnmount, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

export const DEFAULT_IDLE_SESSION_TIMEOUT_MS = 30 * 60 * 1000

const activityEvents: Array<keyof WindowEventMap> = [
  'keydown',
  'mousedown',
  'mousemove',
  'scroll',
  'touchstart',
]

interface UseIdleSessionTimeoutOptions {
  timeoutMs?: number
}

export function useIdleSessionTimeout({
  timeoutMs = DEFAULT_IDLE_SESSION_TIMEOUT_MS,
}: UseIdleSessionTimeoutOptions = {}) {
  const auth = useAuthStore()
  const router = useRouter()
  let timerId: number | null = null
  let signingOut = false

  function clearTimer() {
    if (timerId === null) return
    window.clearTimeout(timerId)
    timerId = null
  }

  async function handleIdleTimeout() {
    timerId = null
    if (signingOut || !auth.isAuthenticated) return

    signingOut = true
    try {
      await auth.signOut()
      await router.push('/login')
    } finally {
      signingOut = false
    }
  }

  function scheduleTimer() {
    clearTimer()
    if (!auth.isAuthenticated) return
    timerId = window.setTimeout(() => {
      void handleIdleTimeout()
    }, timeoutMs)
  }

  function handleActivity() {
    scheduleTimer()
  }

  onMounted(() => {
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, { passive: true })
    })
    scheduleTimer()
  })

  onBeforeUnmount(() => {
    activityEvents.forEach((eventName) => {
      window.removeEventListener(eventName, handleActivity)
    })
    clearTimer()
  })

  watch(() => auth.isAuthenticated, () => {
    scheduleTimer()
  })
}
