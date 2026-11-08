// Verification-build initializer only. Never imported by the normal application build.
import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions'
import { connectStorageEmulator, getStorage } from 'firebase/storage'

export const hasFirebaseConfig = true
let services: ReturnType<typeof initialize> | undefined
function initialize() {
  if (!import.meta.env.PROD || location.hostname !== '127.0.0.1' || location.port !== '5296')
    throw new Error('The verification build is restricted to its isolated local server.')
  const projectId = 'demo-phase2-critical-built'
  const app = initializeApp({ projectId, apiKey: 'isolated-verification-only', authDomain: `${projectId}.firebaseapp.com`, storageBucket: `${projectId}.appspot.com`, appId: 'isolated-verification-only' })
  const auth = getAuth(app), db = getFirestore(app), functions = getFunctions(app, 'us-central1'), storage = getStorage(app)
  connectAuthEmulator(auth, 'http://127.0.0.1:9197', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 9297)
  connectFunctionsEmulator(functions, '127.0.0.1', 5297)
  connectStorageEmulator(storage, '127.0.0.1', 9397)
  return { app, auth, db, functions, storage }
}
export function getFirebaseServices() { return services ??= initialize() }
export const requireFirebaseServices = getFirebaseServices
