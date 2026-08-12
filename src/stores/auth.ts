import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref } from 'vue'
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
import type { EffectiveRoleKey, RawRoleKey, UserProfile } from '@/types/domain'
import { normalizeError } from '@/utils/normalizeError'

type FirebaseLikeError = Error & {
  code?: string
}

let authInitPromise: Promise<void> | null = null
let unsubscribeAuth: (() => void) | null = null
let unsubscribeProfile: (() => void) | null = null
let profileRetryTimer: number | null = null

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

  const rawRole = computed<RawRoleKey>(() => profile.value?.role ?? 'none')
  const roleKey = computed<EffectiveRoleKey>(() => getEffectiveRole(rawRole.value))
  const isAuthenticated = computed(() => currentUser.value !== null)
  const hasWorkspaceAccess = computed(() => hasCurrentWorkspaceAccess({
    active: profile.value?.active ?? true,
    authenticated: currentUser.value !== null,
    rawRole: rawRole.value,
  }))
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
    clearProfileRetry()
    if (!unsubscribeProfile) return
    unsubscribeProfile()
    unsubscribeProfile = null
  }

  async function hydrateProfile(uid: string, authUser: AuthSessionUser | null) {
    profile.value = await getOrCreateUserProfile(uid, {
      displayName: authUser?.displayName || null,
      email: authUser?.email ?? null,
    })
  }

  async function hydrateProfileWithRetry(uid: string, authUser: AuthSessionUser | null) {
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
      (error) => {
        if (isTransientProfileListenerError(error)) {
          scheduleProfileListenerRetry(uid)
          return
        }

        void signOut()
      },
    )
  }

  function scheduleProfileListenerRetry(uid: string) {
    if (profileRetryTimer !== null) return

    profileRetryTimer = window.setTimeout(async () => {
      profileRetryTimer = null
      if (currentUser.value?.uid !== uid) return

      try {
        await hydrateProfileWithRetry(uid, currentUser.value)
        setupProfileListener(uid)
      } catch {
        await signOut()
      }
    }, 1500)
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

      unsubscribeAuth = subscribeAuthSession(async (nextUser) => {
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
    if (!hasConfiguredFirebase) {
      throw new Error('Firebase config is missing. Copy the v1 VITE_FIREBASE_* values into .env.local.')
    }

    const authenticatedUser = await signInWithPassword(email, password)
    currentUser.value = authenticatedUser

    if (!ready.value || !unsubscribeAuth) {
      await init()
    }

    await hydrateProfileWithRetry(authenticatedUser.uid, authenticatedUser)
    setupProfileListener(authenticatedUser.uid)
  }

  async function signOut() {
    clearProfileListener()

    if (hasConfiguredFirebase && !isE2EActive()) {
      try {
        await signOutOfAuthSession()
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
