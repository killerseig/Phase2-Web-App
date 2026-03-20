import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions'
import { connectStorageEmulator, getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const functions = getFunctions(app, 'us-central1')
export const storage = getStorage(app)

export const isUsingFirebaseEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true'

const parsePort = (value: string | undefined, fallback: number): number => {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback
}

if (isUsingFirebaseEmulators) {
  const globalScope = globalThis as typeof globalThis & {
    __phase2FirebaseEmulatorsConnected__?: boolean
  }

  if (!globalScope.__phase2FirebaseEmulatorsConnected__) {
    const authUrl = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL || 'http://127.0.0.1:9099'
    const firestoreHost = import.meta.env.VITE_FIRESTORE_EMULATOR_HOST || '127.0.0.1'
    const firestorePort = parsePort(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT, 8080)
    const functionsHost = import.meta.env.VITE_FIREBASE_FUNCTIONS_EMULATOR_HOST || '127.0.0.1'
    const functionsPort = parsePort(import.meta.env.VITE_FIREBASE_FUNCTIONS_EMULATOR_PORT, 5001)
    const storageHost = import.meta.env.VITE_FIREBASE_STORAGE_EMULATOR_HOST || '127.0.0.1'
    const storagePort = parsePort(import.meta.env.VITE_FIREBASE_STORAGE_EMULATOR_PORT, 9199)

    connectAuthEmulator(auth, authUrl, { disableWarnings: true })
    connectFirestoreEmulator(db, firestoreHost, firestorePort)
    connectFunctionsEmulator(functions, functionsHost, functionsPort)
    connectStorageEmulator(storage, storageHost, storagePort)

    globalScope.__phase2FirebaseEmulatorsConnected__ = true
  }
}
