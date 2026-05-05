import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getFunctions, type Functions } from 'firebase/functions'
import { getStorage, type FirebaseStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const hasFirebaseConfig = [
  firebaseConfig.apiKey,
  firebaseConfig.authDomain,
  firebaseConfig.projectId,
  firebaseConfig.storageBucket,
  firebaseConfig.messagingSenderId,
  firebaseConfig.appId,
].every(Boolean)

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null
let functions: Functions | null = null
let storage: FirebaseStorage | null = null

function initializeFirebaseServices() {
  if (!hasFirebaseConfig) {
    return {
      app: null,
      auth: null,
      db: null,
      functions: null,
      storage: null,
    }
  }

  if (app && auth && db && functions && storage) {
    return { app, auth, db, functions, storage }
  }

  app = initializeApp(firebaseConfig)
  auth = getAuth(app)
  db = getFirestore(app)
  functions = getFunctions(app, 'us-central1')
  storage = getStorage(app)

  return { app, auth, db, functions, storage }
}

export function getFirebaseServices() {
  return initializeFirebaseServices()
}

export function requireFirebaseServices() {
  const services = initializeFirebaseServices()

  if (!services.app || !services.auth || !services.db || !services.functions || !services.storage) {
    throw new Error('Firebase config is missing. Copy the v1 VITE_FIREBASE_* values into .env.local.')
  }

  return services
}
