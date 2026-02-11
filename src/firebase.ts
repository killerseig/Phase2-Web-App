import { initializeApp } from 'firebase/app'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: 'AIzaSyA2m7B5EalpzgclsTRseyMfxWnCtqIYKWI',
  authDomain: 'phase2-website.firebaseapp.com',
  projectId: 'phase2-website',
  storageBucket: 'phase2-website.firebasestorage.app',
  messagingSenderId: '792793988588',
  appId: '1:792793988588:web:4f3a132eb263f7f65ad4c9',
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const functions = getFunctions(app, 'us-central1')
export const storage = getStorage(app)

onAuthStateChanged(auth, (u) => {
  // Auth state listener for profile updates
})
