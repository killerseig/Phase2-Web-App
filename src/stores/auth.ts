import { defineStore } from 'pinia'
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

type AuthState = {
  user: User | null
  role: Role | null
  active: boolean
  assignedJobIds: string[]
  ready: boolean
  _initPromise: Promise<void> | null
  _unsubscribeProfile: (() => void) | null
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    role: null,
    active: true,
    assignedJobIds: [],
    ready: false,
    _initPromise: null,
    _unsubscribeProfile: null,
  }),

  actions: {
    /**
     * Set up a real-time listener on the user's profile document
     * Updates role and active status immediately when changed
     * Logs out if user is deleted or deactivated
     */
    setupProfileListener(uid: string) {
      // Clean up any existing listener
      if (this._unsubscribeProfile) {
        this._unsubscribeProfile()
      }

      const profileRef = doc(db, 'users', uid)
      
      return new Promise<void>((resolve) => {
        let firstSnapshot = true
        this._unsubscribeProfile = onSnapshot(
          profileRef,
          (snap) => {
            if (!snap.exists()) {
              // User document was deleted - sign out immediately
              this.signOut()
              resolve()
              return
            }

            const data = snap.data()
            const newRole = (data.role as Role) ?? ROLES.NONE
            const newActive = data.active === true
            const newAssignedJobIds = (data.assignedJobIds ?? []) as string[]

            // Update role if changed
            if (this.role !== newRole) {
              this.role = newRole
            }

            // Update active status if changed
            if (this.active !== newActive) {
              this.active = newActive

              // If deactivated, sign out immediately
              if (!newActive) {
                this.signOut()
              }
            }

            // Update assigned job IDs if changed
            if (JSON.stringify(this.assignedJobIds) !== JSON.stringify(newAssignedJobIds)) {
              this.assignedJobIds = newAssignedJobIds
            }
            
            // Resolve on first snapshot to signal that listener is active
            if (firstSnapshot) {
              firstSnapshot = false
              resolve()
            }
          },
          (error) => {
            resolve() // Resolve even on error to not block
          }
        )
      })
    },

    init() {
      if (this._initPromise) return this._initPromise

      this._initPromise = new Promise<void>((resolve) => {
        onAuthStateChanged(auth, async (u) => {
          this.user = u

          if (!u) {
            this.role = null
            this.active = true
            // Clean up listener if signing out
            if (this._unsubscribeProfile) {
              this._unsubscribeProfile()
              this._unsubscribeProfile = null
            }
            this.ready = true
            resolve()
            return
          }

          // Role loading (adjust collection/key to match your schema)
          // Common pattern: users/{uid}.role
          try {
            const snap = await getDoc(doc(db, 'users', u.uid))
            if (snap.exists()) {
              const data = snap.data()
              this.role = (data.role as Role) ?? ROLES.NONE
              this.active = data.active === true
              this.assignedJobIds = (data.assignedJobIds ?? []) as string[]
            } else {
              // Create user document if it doesn't exist (for imported/external users)
              await setDoc(doc(db, 'users', u.uid), {
                email: u.email,
                displayName: u.displayName || null,
                firstName: null,
                lastName: null,
                role: ROLES.NONE,
                active: true,
                assignedJobIds: [],
                createdAt: new Date(),
              })
              this.role = ROLES.NONE
              this.active = true
              this.assignedJobIds = []
            }

            // Set up real-time listener for future changes
            await this.setupProfileListener(u.uid)
          } catch (e) {
            this.role = null
          }

          this.ready = true
          resolve()
        })
      })

      return this._initPromise
    },

    // --- What Login.vue expects ---
    async login(email: string, password: string) {
      const cred = await signInWithEmailAndPassword(auth, email, password)
      this.user = cred.user
      this._initPromise = null // Reset so init() creates a new promise for this session
      if (!this.ready) {
        await this.init()
      }
      return cred
    },

    async register(email: string, password: string) {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      this.user = cred.user
      
      // Create the Firestore user profile document with default role 'none'
      // SignUp component will add firstName and lastName
      if (cred.user) {
        await setDoc(doc(db, 'users', cred.user.uid), {
          email: cred.user.email,
          active: true,
          role: ROLES.NONE,
          createdAt: new Date(),
        })
      }
      
      if (!this.ready) await this.init()
      return cred
    },

    async signOut() {
      // Clean up listener
      if (this._unsubscribeProfile) {
        this._unsubscribeProfile()
        this._unsubscribeProfile = null
      }
      
      await fbSignOut(auth)
      this.user = null
      this.role = null
      this.active = true
      this.assignedJobIds = []
      this.ready = false // Reset ready so next login/init works fresh
      this._initPromise = null // Reset promise so next init() creates a new one
    },

    // Backwards-compatible aliases (if any files use these)
    async logout() {
      return this.signOut()
    },
    async signout() {
      return this.signOut()
    },
  },
})
