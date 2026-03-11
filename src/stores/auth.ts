import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth'
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore'

// Use relative imports to avoid alias/tsconfig fights
import { auth, db } from '../firebase'
import { ROLES, type Role } from '@/constants/app'

const CANONICAL_ROLES = Object.values(ROLES) as Role[]

const normalizeRoleValue = (value: unknown): Role => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (CANONICAL_ROLES.includes(normalized as Role)) {
      return normalized as Role
    }
  }
  return ROLES.NONE
}

const normalizeAssignedJobIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return value.filter((id): id is string => typeof id === 'string')
}

let authInitPromise: Promise<void> | null = null
let unsubscribeAuth: (() => void) | null = null
let unsubscribeProfile: (() => void) | null = null

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const role = ref<Role | null>(null)
  const active = ref(true)
  const assignedJobIds = ref<string[]>([])
  const ready = ref(false)

  const applyProfileState = (data: Record<string, unknown>) => {
    role.value = normalizeRoleValue(data.role)
    active.value = data.active === true
    assignedJobIds.value = normalizeAssignedJobIds(data.assignedJobIds)
  }

  const hydrateProfile = async (uid: string, authUser: User | null) => {
    const profileRef = doc(db, 'users', uid)
    const snap = await getDoc(profileRef)
    if (snap.exists()) {
      applyProfileState(snap.data())
      return
    }

    // Create user document if it doesn't exist (for imported/external users)
    await setDoc(profileRef, {
      email: authUser?.email ?? null,
      displayName: authUser?.displayName || null,
      firstName: null,
      lastName: null,
      role: ROLES.NONE,
      active: true,
      assignedJobIds: [],
      createdAt: new Date(),
    })
    role.value = ROLES.NONE
    active.value = true
    assignedJobIds.value = []
  }

  /**
   * Set up a real-time listener on the user's profile document.
   * Updates role and active status immediately when changed.
   */
  const setupProfileListener = (uid: string) => {
    if (unsubscribeProfile) {
      unsubscribeProfile()
    }

    const profileRef = doc(db, 'users', uid)
    unsubscribeProfile = onSnapshot(profileRef, (snap) => {
      if (!snap.exists()) {
        // User document was deleted - sign out immediately.
        void signOut()
        return
      }

      applyProfileState(snap.data())

      // If deactivated or role is removed, revoke access immediately.
      if (!active.value || role.value === ROLES.NONE) {
        void signOut()
      }
    })
  }

  const clearProfileListener = () => {
    if (!unsubscribeProfile) return
    unsubscribeProfile()
    unsubscribeProfile = null
  }

  const init = () => {
    if (authInitPromise) return authInitPromise

    authInitPromise = new Promise<void>((resolve) => {
      let hasResolvedInit = false
      const resolveInit = () => {
        if (hasResolvedInit) return
        hasResolvedInit = true
        ready.value = true
        resolve()
      }

      if (unsubscribeAuth) {
        resolveInit()
        return
      }

      unsubscribeAuth = onAuthStateChanged(auth, async (nextUser) => {
        user.value = nextUser

        if (!nextUser) {
          role.value = null
          active.value = true
          assignedJobIds.value = []
          clearProfileListener()
          resolveInit()
          return
        }

        try {
          await hydrateProfile(nextUser.uid, nextUser)
          setupProfileListener(nextUser.uid)
        } catch {
          role.value = null
        }

        resolveInit()
      })
    })

    return authInitPromise
  }

  // Expected by Login.vue
  const login = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    user.value = cred.user
    if (!ready.value || !unsubscribeAuth) {
      await init()
    }
    await hydrateProfile(cred.user.uid, cred.user)
    setupProfileListener(cred.user.uid)
    return cred
  }

  const register = async (email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    user.value = cred.user

    // Create the Firestore user profile document with default role 'none'.
    // SignUp component will add firstName and lastName.
    if (cred.user) {
      await setDoc(doc(db, 'users', cred.user.uid), {
        email: cred.user.email,
        active: true,
        role: ROLES.NONE,
        createdAt: new Date(),
      })
    }

    if (!ready.value) await init()
    return cred
  }

  const signOut = async () => {
    clearProfileListener()
    await fbSignOut(auth)
    user.value = null
    role.value = null
    active.value = true
    assignedJobIds.value = []
  }

  const $reset = () => {
    clearProfileListener()
    user.value = null
    role.value = null
    active.value = true
    assignedJobIds.value = []
    ready.value = false
  }

  return {
    user,
    role,
    active,
    assignedJobIds,
    ready,
    init,
    login,
    register,
    signOut,
    $reset,
  }
})
