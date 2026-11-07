import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, onScopeDispose, ref } from 'vue'
import {
  canAccessProfileAssignedJob,
  canCreateJobs as canCreateJobsForRole,
  canDeleteOrArchiveJobs as canDeleteOrArchiveJobsForRole,
  canEditJobSetup as canEditJobSetupForRole,
  canManageJobTimecards as canManageJobTimecardsForRole,
  canManageJobs as canManageJobsForRole,
  canUseJobTimecardWorkflow as canUseJobTimecardWorkflowForRole,
  canUseJobSetupEditor as canUseJobSetupEditorForRole,
  canUseTimecardExport as canUseTimecardExportForRole,
  canViewAllDailyLogs as canViewAllDailyLogsForRole,
  canViewAllJobs as canViewAllJobsForRole,
  canViewSubmittedTimecardReport as canViewSubmittedTimecardReportForRole,
  getEffectiveRole,
  hasCurrentWorkspaceAccess,
} from '@/auth/capabilities'
import {
  getOrCreateUserProfile,
  signInWithPassword,
  signOutOfAuthSession,
  subscribeAuthSession,
  subscribeUserProfile,
  type AuthSessionUser,
} from '@/services/auth'
import { hasConfiguredFirebase } from '@/services/firebaseConfig'
import { useJobsStore } from '@/stores/jobs'
import { getE2EAuthState, isE2EActive } from '@/testing/e2eRuntime'
import { clearTimecardPdfExports } from '@/features/timecards/pdf-export'
import type { EffectiveRoleKey, RawRoleKey, UserProfile } from '@/types/domain'
import { normalizeError } from '@/utils/normalizeError'

type FirebaseLikeError = Error & {
  code?: string
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

function isTransientProfileListenerError(error: unknown) {
  if (!(error instanceof Error)) return false
  const firebaseError = error as FirebaseLikeError
  return (
    firebaseError.code === 'firestore/deadline-exceeded' ||
    firebaseError.code === 'firestore/unavailable' ||
    firebaseError.code === 'deadline-exceeded' ||
    firebaseError.code === 'unavailable'
  )
}

export const useAuthStore = defineStore('auth', () => {
  const currentUser = ref<AuthSessionUser | null>(null)
  const profile = ref<UserProfile | null>(null)
  const ready = ref(false)
  let authInitPromise: Promise<void> | null = null
  let finishInit: (() => void) | undefined
  let unsubscribeAuth: (() => void) | null = null
  let unsubscribeProfile: (() => void) | null = null
  let profileRetryTimer: number | null = null
  let retryDelay: { timer: number; finish: () => void } | undefined
  let session = 0
  let listener = 0
  let disposed = false
  let profileLoad: { session: number; promise: Promise<void> } | undefined

  const rawRole = computed<RawRoleKey>(() => profile.value?.role ?? 'none')
  const roleKey = computed<EffectiveRoleKey>(() => getEffectiveRole(rawRole.value))
  const isAuthenticated = computed(() => currentUser.value !== null)
  const hasWorkspaceAccess = computed(() =>
    hasCurrentWorkspaceAccess({
      active: profile.value?.active ?? true,
      authenticated: currentUser.value !== null,
      rawRole: rawRole.value,
    }),
  )
  const canViewAllJobs = computed(() => canViewAllJobsForRole(rawRole.value))
  const canManageJobs = computed(() => canManageJobsForRole(rawRole.value))
  const canCreateJobs = computed(() => canCreateJobsForRole(rawRole.value))
  const canDeleteOrArchiveJobs = computed(() => canDeleteOrArchiveJobsForRole(rawRole.value))
  const canUseJobSetupEditor = computed(() => canUseJobSetupEditorForRole(rawRole.value))
  const canUseTimecardExport = computed(() => canUseTimecardExportForRole(rawRole.value))
  const canViewAllDailyLogs = computed(() => canViewAllDailyLogsForRole(rawRole.value))
  const canManageJobTimecards = computed(() => canManageJobTimecardsForRole(rawRole.value))
  const displayName = computed(() => {
    const first = profile.value?.firstName?.trim() ?? ''
    const last = profile.value?.lastName?.trim() ?? ''
    const fullName = `${first} ${last}`.trim()
    return fullName || currentUser.value?.displayName || currentUser.value?.email || ''
  })
  const assignedJobIds = computed(() => profile.value?.assignedJobIds ?? [])

  function clearProfileRetry() {
    if (profileRetryTimer === null) return
    window.clearTimeout(profileRetryTimer)
    profileRetryTimer = null
  }

  function clearProfileListener() {
    listener++
    clearProfileRetry()
    if (!unsubscribeProfile) return
    unsubscribeProfile()
    unsubscribeProfile = null
  }

  function isCurrent(uid: string, owner: number) {
    return !disposed && owner === session && currentUser.value?.uid === uid
  }

  function cancelRetryDelay() {
    if (!retryDelay) return
    window.clearTimeout(retryDelay.timer)
    retryDelay.finish()
    retryDelay = undefined
  }

  function waitForRetry(ms: number) {
    return new Promise<void>((resolve) => {
      const timer = window.setTimeout(() => {
        retryDelay = undefined
        resolve()
      }, ms)
      retryDelay = { timer, finish: resolve }
    })
  }

  function adoptSession(nextUser: AuthSessionUser | null, reset = false) {
    if (reset || currentUser.value?.uid !== nextUser?.uid) {
      session++
      clearProfileListener()
      cancelRetryDelay()
      profileLoad = undefined
      profile.value = null
      clearTimecardPdfExports()
      useJobsStore().$reset()
    }
    currentUser.value = nextUser
    return session
  }

  async function hydrateProfileWithRetry(authUser: AuthSessionUser, owner: number) {
    const uid = authUser.uid
    const retryDelays = [0, 250, 800]
    let lastError: unknown = null

    for (const delay of retryDelays) {
      if (!isCurrent(uid, owner)) return false
      if (delay > 0) {
        await waitForRetry(delay)
      }
      if (!isCurrent(uid, owner)) return false

      try {
        const loaded = await getOrCreateUserProfile(uid, {
          displayName: authUser.displayName || null,
          email: authUser.email ?? null,
        })
        if (!isCurrent(uid, owner)) return false
        profile.value = loaded
        return true
      } catch (error) {
        if (!isCurrent(uid, owner)) return false
        lastError = error
        if (!isRetryableProfileError(error) || delay === retryDelays[retryDelays.length - 1]) {
          throw error
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Failed to load user profile.')
  }

  function setupProfileListener(uid: string, owner: number) {
    if (!isCurrent(uid, owner)) return
    clearProfileListener()
    const subscription = listener
    const current = () => isCurrent(uid, owner) && subscription === listener

    const unsubscribe = subscribeUserProfile(
      uid,
      (nextProfile) => {
        if (!current()) return
        if (!nextProfile) {
          void signOut()
          return
        }

        profile.value = nextProfile

        if (profile.value && !profile.value.active) {
          void signOut()
        }
      },
      (error) => {
        if (!current()) return
        if (isTransientProfileListenerError(error)) {
          scheduleProfileListenerRetry(uid, owner, subscription)
          return
        }

        void signOut()
      },
    )
    // A synchronous listener callback can revoke the session before subscribe returns.
    if (current()) unsubscribeProfile = unsubscribe
    else unsubscribe()
  }

  function loadProfile(authUser: AuthSessionUser, owner: number) {
    if (!isCurrent(authUser.uid, owner)) return Promise.resolve()
    if (profileLoad?.session === owner) return profileLoad.promise
    const promise = hydrateProfileWithRetry(authUser, owner).then((loaded) => {
      if (loaded && isCurrent(authUser.uid, owner)) setupProfileListener(authUser.uid, owner)
    })
    profileLoad = { session: owner, promise }
    return promise
  }

  function scheduleProfileListenerRetry(uid: string, owner: number, subscription: number) {
    if (profileRetryTimer !== null) return

    profileRetryTimer = window.setTimeout(async () => {
      profileRetryTimer = null
      if (!isCurrent(uid, owner) || listener !== subscription) return
      const authUser = currentUser.value!
      // Retire the failed listener before recovery so queued callbacks cannot
      // overwrite the recovered profile or sign out another session.
      clearProfileListener()
      profileLoad = undefined

      try {
        await loadProfile(authUser, owner)
      } catch {
        if (isCurrent(uid, owner)) await signOut()
      }
    }, 1500)
  }

  async function init() {
    if (disposed) return
    if (authInitPromise) return authInitPromise
    if (ready.value && (unsubscribeAuth || isE2EActive() || !hasConfiguredFirebase)) return

    if (isE2EActive()) {
      const e2eAuthState = getE2EAuthState()
      currentUser.value = e2eAuthState
        ? ({
            uid: e2eAuthState.user.uid,
            email: e2eAuthState.user.email,
            displayName: e2eAuthState.user.displayName,
          } satisfies AuthSessionUser)
        : null
      profile.value = e2eAuthState?.profile ?? null
      ready.value = true
      return
    }

    if (!hasConfiguredFirebase) {
      ready.value = true
      return
    }

    authInitPromise = new Promise<void>((resolve) => {
      finishInit = () => {
        if (!disposed) ready.value = true
        finishInit = undefined
        resolve()
      }

      unsubscribeAuth = subscribeAuthSession(async (nextUser) => {
        if (disposed) return
        const owner = adoptSession(nextUser)
        if (!nextUser) {
          finishInit?.()
          return
        }

        try {
          await loadProfile(nextUser, owner)
        } catch {
          if (isCurrent(nextUser.uid, owner)) await signOut()
        }

        if (isCurrent(nextUser.uid, owner)) finishInit?.()
      })
    })

    return authInitPromise
  }

  async function login(email: string, password: string) {
    if (disposed) return
    if (!hasConfiguredFirebase) {
      throw new Error(
        'Firebase config is missing. Copy the v1 VITE_FIREBASE_* values into .env.local.',
      )
    }

    if (!ready.value || !unsubscribeAuth) {
      await init()
    }
    if (disposed) return
    const startedAt = session
    const authenticatedUser = await signInWithPassword(email, password)
    // Firebase may deliver this login's auth event before the credential result.
    // Only that matching transition may advance the session during this await.
    const expectedObserver =
      session === startedAt + 1 && currentUser.value?.uid === authenticatedUser.uid
    if (disposed || (session !== startedAt && !expectedObserver)) {
      throw new Error('Sign-in attempt is no longer current. Please try again.')
    }
    const owner = adoptSession(authenticatedUser)
    // The auth observer and the login continuation share one session load.
    await loadProfile(authenticatedUser, owner)
    if (!isCurrent(authenticatedUser.uid, owner)) {
      throw new Error('Sign-in attempt is no longer current. Please try again.')
    }
  }

  async function signOut() {
    if (disposed) return
    // Revoke local access before waiting for Firebase. A late provider response
    // must not clear a different session that arrived while this one signed out.
    adoptSession(null, true)
    ready.value = true
    finishInit?.()

    if (hasConfiguredFirebase && !isE2EActive()) {
      try {
        await signOutOfAuthSession()
      } catch {
        // Keep clearing local state even if Firebase sign-out throws.
      }
    }
  }

  onScopeDispose(() => {
    disposed = true
    session++
    clearProfileListener()
    cancelRetryDelay()
    unsubscribeAuth?.()
    unsubscribeAuth = null
    profileLoad = undefined
    finishInit?.()
  })

  function canAccessJob(jobId: string) {
    return canAccessProfileAssignedJob({
      assignedJobIds: assignedJobIds.value,
      jobId,
      rawRole: rawRole.value,
    })
  }

  function canEditJobSetup(jobId: string) {
    return canEditJobSetupForRole({
      assignedJobIds: assignedJobIds.value,
      jobId,
      rawRole: rawRole.value,
    })
  }

  function canUseJobTimecardWorkflow(jobId: string, isShopJob = false) {
    return canUseJobTimecardWorkflowForRole({
      assignedJobIds: assignedJobIds.value,
      isShopJob,
      jobId,
      rawRole: rawRole.value,
    })
  }

  function canViewSubmittedTimecardReport(jobId: string, isShopJob = false) {
    return canViewSubmittedTimecardReportForRole({
      assignedJobIds: assignedJobIds.value,
      isShopJob,
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
    canViewAllJobs,
    canManageJobs,
    canCreateJobs,
    canDeleteOrArchiveJobs,
    canUseJobSetupEditor,
    canUseTimecardExport,
    canViewAllDailyLogs,
    canManageJobTimecards,
    displayName,
    assignedJobIds,
    init,
    login,
    signOut,
    canAccessJob,
    canEditJobSetup,
    canUseJobTimecardWorkflow,
    canViewSubmittedTimecardReport,
    getLoginErrorMessage,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAuthStore, import.meta.hot))
}
