import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import {
  canAccessAdminArea,
  canAccessProfileAssignedJob,
  getEffectiveRole,
  hasCurrentWorkspaceAccess,
} from '@/auth/capabilities'
import { hasFirebaseConfig, requireFirebaseServices } from '@/firebase'
import { getOrCreateUserProfile, subscribeUserProfile } from '@/services/auth'
import { useJobsStore } from '@/stores/jobs'
import { getE2EAuthState, isE2EActive } from '@/testing/e2eRuntime'
import type { EffectiveRoleKey, RawRoleKey, UserProfile } from '@/types/domain'
import { normalizeError } from '@/utils/normalizeError'

type FirebaseLikeError = Error & {
  code?: string
}

let authInitPromise: Promise<void> | null = null
let unsubscribeAuth: (() => void) | null = null
let unsubscribeProfile: (() => void) | null = null

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function isRetryableProfileError(error: unknown) {
  if (!(error instanceof Error)) return false
  const firebaseError = error as FirebaseLikeError
  return (
    firebaseError.code === 'firestore/permission-denied' ||
    firebaseError.code === 'permission-denied' ||
    firebaseError.code === 'firestore/unavailable'
  )
}

export const useAuthStore = defineStore('auth', () => {
  const currentUser = ref<User | null>(null)
  const profile = ref<UserProfile | null>(null)
  const ready = ref(false)

  const rawRole = computed<RawRoleKey>(() => profile.value?.role ?? 'none')
  const roleKey = computed<EffectiveRoleKey>(() => getEffectiveRole(rawRole.value))
  const isAuthenticated = computed(() => currentUser.value !== null)
  const hasWorkspaceAccess = computed(() => hasCurrentWorkspaceAccess({
    active: profile.value?.active ?? true,
    authenticated: currentUser.value !== null,
    rawRole: rawRole.value,
  }))
  const isAdmin = computed(() => canAccessAdminArea(rawRole.value))
  const displayName = computed(() => {
    const first = profile.value?.firstName?.trim() ?? ''
    const last = profile.value?.lastName?.trim() ?? ''
    const fullName = `${first} ${last}`.trim()
    return fullName || currentUser.value?.displayName || currentUser.value?.email || ''
  })
  const assignedJobIds = computed(() => profile.value?.assignedJobIds ?? [])

  function clearProfileListener() {
    if (!unsubscribeProfile) return
    unsubscribeProfile()
    unsubscribeProfile = null
  }

  async function hydrateProfile(uid: string, authUser: User | null) {
    profile.value = await getOrCreateUserProfile(uid, {
      displayName: authUser?.displayName || null,
      email: authUser?.email ?? null,
    })
  }

  async function hydrateProfileWithRetry(uid: string, authUser: User | null) {
    const retryDelays = [0, 250, 800]
    let lastError: unknown = null

    for (const delay of retryDelays) {
      if (delay > 0) {
        await sleep(delay)
      }

      try {
        await hydrateProfile(uid, authUser)
        return
      } catch (error) {
        lastError = error
        if (!isRetryableProfileError(error) || delay === retryDelays[retryDelays.length - 1]) {
          throw error
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Failed to load user profile.')
  }

  function setupProfileListener(uid: string) {
    clearProfileListener()

    unsubscribeProfile = subscribeUserProfile(
      uid,
      (nextProfile) => {
        if (!nextProfile) {
          void signOut()
          return
        }

        profile.value = nextProfile

        if (profile.value && !profile.value.active) {
          void signOut()
        }
      },
      () => {
        void signOut()
      },
    )
  }

  async function init() {
    if (ready.value) return
    if (authInitPromise) return authInitPromise

    if (isE2EActive()) {
      const e2eAuthState = getE2EAuthState()
      currentUser.value = e2eAuthState
        ? ({
            uid: e2eAuthState.user.uid,
            email: e2eAuthState.user.email,
            displayName: e2eAuthState.user.displayName,
          } as User)
        : null
      profile.value = e2eAuthState?.profile ?? null
      ready.value = true
      return
    }

    if (!hasFirebaseConfig) {
      ready.value = true
      return
    }

    authInitPromise = new Promise<void>((resolve) => {
      let resolved = false

      const resolveInit = () => {
        if (resolved) return
        resolved = true
        ready.value = true
        resolve()
      }

      if (unsubscribeAuth) {
        resolveInit()
        return
      }

      const { auth } = requireFirebaseServices()

      unsubscribeAuth = onAuthStateChanged(auth, async (nextUser) => {
        currentUser.value = nextUser

        if (!nextUser) {
          profile.value = null
          clearProfileListener()
          resolveInit()
          return
        }

        try {
          await hydrateProfileWithRetry(nextUser.uid, nextUser)
          setupProfileListener(nextUser.uid)
        } catch {
          await signOut()
        }

        resolveInit()
      })
    })

    return authInitPromise
  }

  async function login(email: string, password: string) {
    if (!hasFirebaseConfig) {
      throw new Error('Firebase config is missing. Copy the v1 VITE_FIREBASE_* values into .env.local.')
    }

    const { auth } = requireFirebaseServices()
    const credentials = await signInWithEmailAndPassword(auth, email.trim(), password)

    currentUser.value = credentials.user

    if (!ready.value || !unsubscribeAuth) {
      await init()
    }

    await hydrateProfileWithRetry(credentials.user.uid, credentials.user)
    setupProfileListener(credentials.user.uid)
  }

  async function signOut() {
    clearProfileListener()

    if (hasFirebaseConfig && !isE2EActive()) {
      const { auth } = requireFirebaseServices()
      try {
        await firebaseSignOut(auth)
      } catch {
        // Keep clearing local state even if Firebase sign-out throws.
      }
    }

    currentUser.value = null
    profile.value = null
    ready.value = true
    useJobsStore().$reset()
  }

  function canAccessJob(jobId: string) {
    return canAccessProfileAssignedJob({
      assignedJobIds: assignedJobIds.value,
      jobId,
      rawRole: rawRole.value,
    })
  }

  function getLoginErrorMessage(error: unknown) {
    return normalizeError(error, 'Failed to sign in.')
  }

  return {
    currentUser,
    profile,
    ready,
    rawRole,
    roleKey,
    isAuthenticated,
    hasWorkspaceAccess,
    isAdmin,
    displayName,
    assignedJobIds,
    init,
    login,
    signOut,
    canAccessJob,
    getLoginErrorMessage,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAuthStore, import.meta.hot))
}
