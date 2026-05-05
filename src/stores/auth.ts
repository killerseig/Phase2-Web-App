import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { hasFirebaseConfig, requireFirebaseServices } from '@/firebase'
import { useJobsStore } from '@/stores/jobs'
import type { RoleKey, RawRoleKey, UserProfile } from '@/types/domain'
import { normalizeRoleKey, toEffectiveRole } from '@/types/domain'
import { normalizeError } from '@/utils/normalizeError'

type FirebaseLikeError = Error & {
  code?: string
}

let authInitPromise: Promise<void> | null = null
let unsubscribeAuth: (() => void) | null = null
let unsubscribeProfile: (() => void) | null = null

function normalizeAssignedJobIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string')
}

function normalizeUserProfile(uid: string, data: Record<string, unknown>): UserProfile {
  return {
    id: uid,
    email: typeof data.email === 'string' ? data.email : null,
    firstName: typeof data.firstName === 'string' ? data.firstName : null,
    lastName: typeof data.lastName === 'string' ? data.lastName : null,
    role: normalizeRoleKey(data.role),
    active: data.active !== false,
    assignedJobIds: normalizeAssignedJobIds(data.assignedJobIds),
  }
}

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
  const roleKey = computed<RoleKey>(() => toEffectiveRole(rawRole.value))
  const isAuthenticated = computed(() => currentUser.value !== null)
  const hasWorkspaceAccess = computed(() => (
    currentUser.value !== null
    && (profile.value?.active ?? true)
    && roleKey.value !== 'none'
  ))
  const isAdmin = computed(() => roleKey.value === 'admin')
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

  function applyProfileState(uid: string, data: Record<string, unknown>) {
    profile.value = normalizeUserProfile(uid, data)
  }

  async function hydrateProfile(uid: string, authUser: User | null) {
    const { db } = requireFirebaseServices()
    const profileRef = doc(db, 'users', uid)
    const snapshot = await getDoc(profileRef)

    if (snapshot.exists()) {
      applyProfileState(snapshot.id, snapshot.data())
      return
    }

    await setDoc(profileRef, {
      email: authUser?.email ?? null,
      displayName: authUser?.displayName || null,
      firstName: null,
      lastName: null,
      role: 'none',
      active: true,
      assignedJobIds: [],
      createdAt: serverTimestamp(),
    })

    profile.value = {
      id: uid,
      email: authUser?.email ?? null,
      firstName: null,
      lastName: null,
      role: 'none',
      active: true,
      assignedJobIds: [],
    }
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
    const { db } = requireFirebaseServices()

    clearProfileListener()

    unsubscribeProfile = onSnapshot(
      doc(db, 'users', uid),
      (snapshot) => {
        if (!snapshot.exists()) {
          void signOut()
          return
        }

        applyProfileState(snapshot.id, snapshot.data())

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

    if (hasFirebaseConfig) {
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
    if (isAdmin.value) return true
    return assignedJobIds.value.includes(jobId)
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
