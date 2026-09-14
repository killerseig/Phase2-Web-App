import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, signInAnonymously, signOut } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField, terminate } from 'firebase/firestore'
import { getStorage, connectStorageEmulator, ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage'

// Refuse to run against production even if the caller has application-default credentials.
const projectId = 'demo-phase2-security'
for (const key of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST', 'FIREBASE_STORAGE_EMULATOR_HOST']) {
  assert.match(process.env[key] || '', /^(127\.0\.0\.1|localhost):\d+$/, `${key} must point to a local emulator`)
}
const require = createRequire(new URL('../functions/package.json', import.meta.url))
const { initializeApp: initializeAdmin } = require('firebase-admin/app')
const { getFirestore: getAdminFirestore } = require('firebase-admin/firestore')
const { getAuth: getAdminAuth } = require('firebase-admin/auth')
initializeAdmin({ projectId, storageBucket: `${projectId}.appspot.com` })
const adminDb = getAdminFirestore()
const adminAuth = getAdminAuth()
const clients = []
let checks = 0

async function denied(label, operation) {
  try { await operation() } catch (error) {
    assert.match(error.code || '', /permission-denied|unauthorized/, `${label}: ${error}`)
    checks++
    return
  }
  throw new Error(`${label} was allowed`)
}

async function client(role, jobIds = [], active = true) {
  const app = initializeApp({ projectId, apiKey: 'test-key', storageBucket: `${projectId}.appspot.com` }, `test-${clients.length}`)
  const auth = getAuth(app)
  connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true })
  const db = getFirestore(app)
  const [firestoreHost, firestorePort] = process.env.FIRESTORE_EMULATOR_HOST.split(':')
  connectFirestoreEmulator(db, firestoreHost, Number(firestorePort))
  const storage = getStorage(app)
  const [storageHost, storagePort] = process.env.FIREBASE_STORAGE_EMULATOR_HOST.split(':')
  connectStorageEmulator(storage, storageHost, Number(storagePort))
  const { user } = await signInAnonymously(auth)
  if (role) await adminDb.doc(`users/${user.uid}`).set({ role, active, assignedJobIds: jobIds, firstName: 'Test', lastName: 'User' })
  const result = { app, auth, db, storage, uid: user.uid }
  clients.push(result)
  return result
}

try {
  const foreman = await client('foreman', ['job-a'])
  const outsider = await client('foreman', ['job-b'])
  const inactive = await client('foreman', ['job-a'], false)
  const anonymous = await client(null)
  const payroll = await client('payroll')
  const pm = await client('project-manager', ['job-a'])
  const admin = await client('admin')
  await adminDb.doc('jobs/job-a').set({ name: 'Test job', code: '123', active: true, archivedAt: null, assignedForemanIds: [], dailyLogRecipients: [] })
  await adminDb.doc('jobs/job-b').set({ name: 'Other job', code: '456', assignedForemanIds: [] })
  await adminDb.doc('dailyLogs/log-a').set({ jobId: 'job-a', status: 'draft', logDate: '2026-09-12', createdByUserId: foreman.uid })
  await adminDb.doc('shopOrders/order-a').set({ jobId: 'job-a', status: 'draft' })
  await adminDb.doc('timecardWeeks/week-a').set({ jobId: 'job-a', status: 'draft', ownerForemanUserId: foreman.uid })
  await adminDb.doc(`userSetupCredentials/${admin.uid}`).set({ setupTokenHash: 'private-hash' })

  for (const actor of [foreman, outsider, anonymous, payroll, admin]) {
    await denied('Private setup credential read', () => getDoc(doc(actor.db, 'userSetupCredentials', admin.uid)))
    await denied('Private setup credential write', () => setDoc(doc(actor.db, 'userSetupCredentials', actor.uid), { setupTokenHash: 'forged' }))
    for (const [collection, id] of [['dailyLogs', 'log-a'], ['shopOrders', 'order-a'], ['timecardWeeks', 'week-a']]) {
      await denied('Direct workflow create', () => setDoc(doc(actor.db, collection, 'forged'), { jobId: 'job-a', status: 'submitted' }))
      await denied('Direct workflow update', () => updateDoc(doc(actor.db, collection, id), { status: 'submitted' }))
      await denied('Direct workflow delete', () => deleteDoc(doc(actor.db, collection, id)))
    }
  }
  await updateDoc(doc(foreman.db, 'users', foreman.uid), { firstName: 'Updated' })
  await denied('Self privilege change', () => updateDoc(doc(foreman.db, 'users', foreman.uid), { role: 'admin' }))
  await denied('Self protected field addition', () => updateDoc(doc(foreman.db, 'users', foreman.uid), { setupToken: 'forged' }))
  await denied('Self protected field removal', () => updateDoc(doc(foreman.db, 'users', foreman.uid), { role: deleteField() }))
  await updateDoc(doc(foreman.db, 'jobs', 'job-a'), { dailyLogRecipients: ['test@example.invalid'] })
  await denied('Recipient editor field removal', () => updateDoc(doc(foreman.db, 'jobs', 'job-a'), { active: deleteField() }))
  await denied('Recipient editor field addition', () => updateDoc(doc(foreman.db, 'jobs', 'job-a'), { arbitrary: true }))
  await denied('PM archive removal', () => updateDoc(doc(pm.db, 'jobs', 'job-a'), { archivedAt: deleteField() }))
  await denied('Other job read', () => getDoc(doc(outsider.db, 'dailyLogs', 'log-a')))

  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
  const path = 'daily-logs/log-a/photo.jpg'
  const metadata = (uid, extra = {}) => ({ contentType: 'image/jpeg', customMetadata: { uploadedBy: uid, dailyLogId: 'log-a', jobId: 'job-a', variant: 'gallery-photo', ...extra } })
  await uploadBytes(ref(foreman.storage, path), bytes, metadata(foreman.uid))
  await getBytes(ref(foreman.storage, path))
  await getBytes(ref(pm.storage, path))
  for (const actor of [outsider, inactive, anonymous, payroll]) {
    await denied('Cross-job or inactive photo read', () => getBytes(ref(actor.storage, path)))
    await denied('Cross-job or inactive photo delete', () => deleteObject(ref(actor.storage, path)))
    await denied('Cross-job or inactive upload', () => uploadBytes(ref(actor.storage, `daily-logs/log-a/${actor.uid}.jpg`), bytes, metadata(actor.uid)))
  }
  await denied('False job metadata', () => uploadBytes(ref(foreman.storage, 'daily-logs/log-a/false-job.jpg'), bytes, metadata(foreman.uid, { jobId: 'job-b' })))
  await denied('SVG upload', () => uploadBytes(ref(foreman.storage, 'daily-logs/log-a/file.svg'), bytes, { ...metadata(foreman.uid), contentType: 'image/svg+xml' }))
  await denied('Oversized photo', () => uploadBytes(ref(foreman.storage, 'daily-logs/log-a/large.jpg'), new Uint8Array(10 * 1024 * 1024), metadata(foreman.uid)))
  const thumb = 'daily-logs/log-a/thumbnails/photo.jpg'
  await uploadBytes(ref(foreman.storage, thumb), bytes, metadata(foreman.uid, { variant: 'email-thumbnail' }))
  await denied('Oversized thumbnail', () => uploadBytes(ref(foreman.storage, 'daily-logs/log-a/thumbnails/large.jpg'), new Uint8Array(300 * 1024 + 1), metadata(foreman.uid, { variant: 'email-thumbnail' })))
  await adminDb.doc('dailyLogs/log-a').update({ status: 'submitted' })
  await denied('Submitted photo delete', () => deleteObject(ref(foreman.storage, path)))
  await denied('Submitted photo upload', () => uploadBytes(ref(foreman.storage, 'daily-logs/log-a/submitted.jpg'), bytes, metadata(foreman.uid)))
  await getBytes(ref(foreman.storage, path))
  await deleteObject(ref(admin.storage, path))
  await signOut(foreman.auth)
  await denied('Signed-out thumbnail read', () => getBytes(ref(foreman.storage, thumb)))

  const { setUserPassword, verifySetupToken, hashSetupToken } = require('../functions/userFunctions.js')
  const setupUid = 'setup-user'
  await adminAuth.createUser({ uid: setupUid, email: 'setup@example.invalid', password: 'Original-test-password' })
  const token = 'a'.repeat(64)
  await adminDb.doc(`users/${setupUid}`).set({ active: true, role: 'foreman', setupToken: token, setupTokenExpiry: new Date(Date.now() + 60000) })
  await denied('Legacy exposed setup token', () => verifySetupToken.run({ data: { uid: setupUid, setupToken: token } }))
  await adminDb.doc(`userSetupCredentials/${setupUid}`).set({ setupTokenHash: hashSetupToken(token), setupTokenExpiry: 'invalid-date' })
  await denied('Invalid token expiry', () => setUserPassword.run({ data: { uid: setupUid, setupToken: token, password: 'New-test-password-123' } }))
  await adminDb.doc(`userSetupCredentials/${setupUid}`).update({ setupTokenExpiry: new Date(Date.now() + 60000) })
  const requests = await Promise.allSettled([1, 2].map(i => setUserPassword.run({ data: { uid: setupUid, setupToken: token, password: `New-test-password-${i}` } })))
  assert.equal(requests.filter(r => r.status === 'fulfilled').length, 1, 'Only one concurrent token redemption may succeed')
  await denied('Consumed setup token', () => verifySetupToken.run({ data: { uid: setupUid, setupToken: token } }))
  console.log(`Security checks passed: ${checks} denied operations, authorized reads/writes, and single-use token concurrency.`)
} finally {
  for (const entry of clients) { await terminate(entry.db); await deleteApp(entry.app) }
  await adminDb.terminate()
}
