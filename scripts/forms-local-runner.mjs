import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const projectId = 'demo-phase2-security'
for (const key of [
  'FIRESTORE_EMULATOR_HOST',
  'FIREBASE_AUTH_EMULATOR_HOST',
  'FIREBASE_STORAGE_EMULATOR_HOST',
])
  assert.match(process.env[key] || '', /^(127\.0\.0\.1|localhost):\d+$/)
process.env.GCLOUD_PROJECT = projectId
const require = createRequire(new URL('../functions/package.json', import.meta.url))
const { initializeApp } = require('firebase-admin/app'),
  { getAuth } = require('firebase-admin/auth'),
  { getFirestore } = require('firebase-admin/firestore')
initializeApp({ projectId, storageBucket: projectId + '.appspot.com' })
const { formTemplates, formWorkspace } = require('../functions/formFunctions.js'),
  { formEmail, deliverFormSubmission } = require('../functions/formDelivery.js')
const { dashboardWorkspace } = require('../functions/dashboardFunctions.js')
const handlers = { formTemplates, formWorkspace, formEmail, dashboardWorkspace },
  auth = getAuth(),
  db = getFirestore()
for (const [uid, email, role] of [
  ['forms-local-admin', 'admin@forms.local', 'admin'],
  ['forms-local-foreman', 'foreman@forms.local', 'foreman'],
]) {
  try {
    await auth.createUser({ uid, email, password: 'Local-Forms-Only-123!' })
  } catch (error) {
    if (error.code !== 'auth/uid-already-exists') throw error
  }
  await db
    .doc('users/' + uid)
    .set({ role, active: true, email, firstName: 'Local', lastName: role, assignedJobIds: [] })
}
const server = createServer(async (req, res) => {
  const origin = req.headers.origin || 'http://127.0.0.1:5173'
  if (['http://127.0.0.1:5173', 'http://localhost:5173'].includes(origin))
    res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Firebase-AppCheck')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Content-Type', 'application/json')
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }
  const pathname = new URL(req.url, 'http://127.0.0.1').pathname
  const name = pathname.startsWith('/demo-phase2-security/us-central1/')
      ? pathname.split('/').at(-1)
      : '',
    handler = handlers[name]
  if (req.method !== 'POST' || !handler) {
    res.writeHead(404)
    res.end(
      JSON.stringify({ error: { status: 'NOT_FOUND', message: 'Local form endpoint not found.' } }),
    )
    return
  }
  try {
    const token = String(req.headers.authorization || '').replace(/^Bearer /, '')
    const claims = await auth.verifyIdToken(token)
    let body = ''
    for await (const chunk of req) {
      body += chunk
      if (body.length > 3000000) throw new Error('Request too large')
    }
    const data = JSON.parse(body).data
    let result = await handler.run({ auth: { uid: claims.uid, token: claims }, data })
    if (name === 'formWorkspace' && data.action === 'submit') {
      await deliverFormSubmission(result.id)
      result = await formWorkspace.run({
        auth: { uid: claims.uid, token: claims },
        data: { action: 'get', id: result.id },
      })
    }
    res.end(JSON.stringify({ result }))
  } catch (error) {
    const code = String(error.code || 'invalid-argument').startsWith('auth/')
      ? 'unauthenticated'
      : error.code || 'invalid-argument'
    res.writeHead(code === 'unauthenticated' ? 401 : 400)
    res.end(
      JSON.stringify({
        error: {
          status: code.replaceAll('-', '_').toUpperCase(),
          message: code === 'unauthenticated' ? 'Sign in to the local emulator.' : error.message,
        },
      }),
    )
  }
})
await new Promise((resolve, reject) => {
  server.once('error', reject)
  server.listen(5001, '127.0.0.1', resolve)
})
const root = fileURLToPath(new URL('..', import.meta.url))
const vite = spawn(
  process.execPath,
  [root + '/node_modules/vite/bin/vite.js', '--config', root + '/scripts/vite.forms-local.ts'],
  {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
    env: {
      ...process.env,
      VITE_FORM_EMULATORS: 'true',
      VITE_FIREBASE_PROJECT_ID: projectId,
      VITE_FIREBASE_API_KEY: 'local-emulator-only',
      VITE_FIREBASE_AUTH_DOMAIN: projectId + '.firebaseapp.com',
      VITE_FIREBASE_STORAGE_BUCKET: projectId + '.appspot.com',
      VITE_FIREBASE_MESSAGING_SENDER_ID: '123456',
      VITE_FIREBASE_APP_ID: 'local-emulator-only',
    },
  },
)
console.log(
  'Local Form Builder: http://127.0.0.1:5173/admin/forms; admin@forms.local or foreman@forms.local; use the local demo sign-in buttons at /login. Demo emulators only; Graph email disabled.',
)
const stop = () => {
  vite.kill()
  server.close()
}
process.once('SIGINT', stop)
process.once('SIGTERM', stop)
if (process.env.FORMS_LOCAL_SMOKE === 'true') {
  const historical = (
    await db.collection('formRecords').where('ownerUid', '==', 'forms-local-admin').get()
  ).docs
    .map((doc) => doc.data())
    .find((record) => record.status === 'submitted' && record.answers.photo_impression?.length)
  if (historical) {
    process.env.FORMS_EXISTING_TEMPLATE = historical.templateId
    process.env.FORMS_EXISTING_RECORD = historical.id
  }
  const smoke = spawn(process.execPath, [root + '/scripts/verify-forms-browser.mjs'], {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
    env: process.env,
  })
  const code = await new Promise((resolve) => smoke.once('exit', resolve))
  stop()
  process.exitCode = Number(code) || 0
} else await new Promise((resolve) => vite.once('exit', resolve))
server.close()
