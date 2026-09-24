import { createHash, randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth'
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  getDoc,
  setDoc,
  terminate,
} from 'firebase/firestore'
import { getStorage, connectStorageEmulator, ref, getBytes, uploadBytes } from 'firebase/storage'

const projectId = 'demo-phase2-security'
for (const key of [
  'FIRESTORE_EMULATOR_HOST',
  'FIREBASE_AUTH_EMULATOR_HOST',
  'FIREBASE_STORAGE_EMULATOR_HOST',
])
  assert.match(process.env[key] || '', /^(127\.0\.0\.1|localhost):\d+$/)
process.env.GCLOUD_PROJECT = projectId
const require = createRequire(new URL('../functions/package.json', import.meta.url))
const { initializeApp: initializeAdmin } = require('firebase-admin/app')
const { getFirestore: adminFirestore } = require('firebase-admin/firestore')
initializeAdmin({ projectId, storageBucket: `${projectId}.appspot.com` })
const db = adminFirestore()
const {
  websiteBuilder,
  getPublishedWebsite,
  websiteImage,
} = require('../functions/websiteFunctions.js')
const {
  validateWebsite,
  publishedWebsite,
  websiteAssetIds,
} = require('../functions/websiteModel.js')
const {
  dashboardWorkspace,
  validateDashboardWidgets,
} = require('../functions/dashboardFunctions.js')
const clients = []
const call = (user, action, data = {}) =>
  websiteBuilder.run({ auth: user ? { uid: user.uid } : undefined, data: { action, ...data } })
const publicSite = () => getPublishedWebsite.run({ data: {} })
let checks = 0
async function reject(operation, code = /permission-denied|unauthenticated|unauthorized/) {
  await assert.rejects(operation, (error) => {
    assert.match(error.code || '', code)
    return true
  })
  checks++
}
async function client(role, active = true) {
  const app = initializeApp(
    { projectId, apiKey: 'test-key', storageBucket: `${projectId}.appspot.com` },
    `website-${clients.length}`,
  )
  const auth = getAuth(app)
  connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, {
    disableWarnings: true,
  })
  const firestore = getFirestore(app)
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':')
  connectFirestoreEmulator(firestore, host, Number(port))
  const storage = getStorage(app)
  const [shost, sport] = process.env.FIREBASE_STORAGE_EMULATOR_HOST.split(':')
  connectStorageEmulator(storage, shost, Number(sport))
  const { user } = await signInAnonymously(auth)
  if (role) await db.doc(`users/${user.uid}`).set({ role, active })
  const result = { uid: user.uid, app, firestore, storage }
  clients.push(result)
  return result
}
let server
try {
  const admin = await client('admin')
  const actors = [null, await client(null), await client('admin', false)]
  for (const role of ['foreman', 'payroll', 'shop-foreman', 'project-manager'])
    actors.push(await client(role))
  const dashboard = (user, action, scope = 'personal', data = {}) =>
    dashboardWorkspace.run({
      auth: user ? { uid: user.uid } : undefined,
      data: { action, scope, ...data },
    })
  for (const actor of actors.slice(0, 3)) {
    await reject(() => dashboard(actor, 'load'))
    await reject(() => dashboard(actor, 'save', 'role', { widgets: [], version: 0 }))
  }
  const foreman = actors[3]
  const peer = await client('foreman')
  const personal = await dashboard(foreman, 'load')
  assert.equal(personal.canEdit, true)
  assert.equal(personal.version, 0)
  const note = { id: 'note', type: 'notes', span: 6, title: 'Private', text: 'Owner-only note' }
  await dashboard(foreman, 'save', 'personal', { widgets: [note], version: 0 })
  assert.equal((await dashboard(foreman, 'load')).widgets[0].text, 'Owner-only note')
  assert.equal((await dashboard(peer, 'load')).widgets[0].type, 'documents')
  await reject(
    () => dashboard(peer, 'load', 'personal', { ownerId: foreman.uid }),
    /invalid-argument/,
  )
  await reject(() => dashboard(admin, 'load', 'personal', { uid: foreman.uid }), /invalid-argument/)
  await reject(() => dashboard(foreman, 'save', 'personal', { widgets: [], version: 0 }), /aborted/)
  await dashboard(admin, 'save', 'role', {
    role: 'foreman',
    widgets: [{ ...note, text: 'Shared guidance' }],
    version: 0,
  })
  const shared = await dashboard(foreman, 'load', 'role')
  assert.equal(shared.canEdit, false)
  assert.equal(shared.widgets[0].text, 'Shared guidance')
  for (const actor of actors.slice(3)) {
    await reject(() => dashboard(actor, 'save', 'role', { widgets: [], version: 0 }))
    await reject(() => dashboard(actor, 'load', 'role', { role: 'admin' }))
  }
  for (const role of ['none', '../users', 'unknown'])
    await reject(() => dashboard(admin, 'load', 'role', { role }), /invalid-argument/)
  for (const widgets of [
    [{ ...note, span: '6' }],
    [{ ...note, type: 'html' }],
    [note, note],
    Array(13).fill(note),
    [{ ...note, text: 'x'.repeat(8001) }],
  ])
    assert.throws(() => validateDashboardWidgets(widgets))
  assert.deepEqual(validateDashboardWidgets([]), [])
  for (const actor of [admin, foreman, peer]) {
    for (const path of [`dashboardPersonal/${foreman.uid}`, 'dashboardRoles/foreman']) {
      await reject(() => getDoc(doc(actor.firestore, path)))
      await reject(() => setDoc(doc(actor.firestore, path), { widgets: [] }))
    }
  }
  const dashboardSaves = await Promise.allSettled([
    dashboard(foreman, 'save', 'personal', { widgets: [note], version: 1 }),
    dashboard(foreman, 'save', 'personal', { widgets: [], version: 1 }),
  ])
  assert.equal(dashboardSaves.filter((result) => result.status === 'fulfilled').length, 1)
  for (const actor of actors)
    for (const action of [
      'load',
      'save',
      'publish',
      'restore',
      'unpublish',
      'uploadImage',
      'getImage',
      'listImages',
      'listRevisions',
      'restoreRevision',
    ])
      await reject(() => call(actor, action))
  const initial = await call(admin, 'load')
  assert.equal(initial.version, 0)
  assert.equal((await publicSite()).site, null)
  assert.deepEqual((await call(admin, 'listRevisions')).revisions, [])
  const site = initial.draft
  assert.equal(site.pages[0].chrome, 'widgets')
  assert.deepEqual(site.pages[0].sections, [])
  site.pages[0].sections.push({
    id: 'hero',
    type: 'hero',
    title: 'Welcome',
    text: '',
    imageId: '',
    alt: '',
    linkLabel: '',
    linkUrl: '',
    hidden: false,
    items: [],
  })
  assert.equal(validateWebsite(site).pages[0].sections[0].span, undefined)
  for (const span of [4, 6, 8, 12]) {
    const layout = structuredClone(site)
    layout.pages[0].sections[0].span = span
    assert.equal(validateWebsite(layout).pages[0].sections[0].span, span)
  }
  for (const span of [0, -1, 5, 13, 6.5, '6', null, {}, 'span 12; color: red']) {
    const layout = structuredClone(site)
    layout.pages[0].sections[0].span = span
    assert.throws(() => validateWebsite(layout), /widget width/)
  }
  site.pages[0].sections[0].span = 6
  const geometry = { x: 3.5, y: 4, w: 8, h: 12, z: 3 }
  site.pages[0].sections[0].layout = geometry
  const appearance = {
    rotation: -12,
    background: '#123456',
    color: '#ffffff',
    borderColor: '#112233',
    borderWidth: 2,
    radius: 12,
    padding: 0,
    fontSize: 20,
    headingSize: 48,
    fontFamily: 'serif',
    textAlign: 'center',
    imageFit: 'contain',
    opacity: 85,
  }
  site.pages[0].sections[0].appearance = appearance
  assert.deepEqual(validateWebsite(site).pages[0].sections[0].appearance, appearance)
  site.pages[0].css =
    '.custom-feature .widget-title {color: #123456;} @media (max-width: 767px) {.widget-title {font-size:28px;}}'
  site.pages[0].layout = { desktop: 'grid', tablet: 'flow', mobile: 'flow', gap: 24, padding: 16 }
  site.pages[0].sections[0].styleClass = 'custom-feature'
  site.pages[0].sections[0].sizing = { grow: 2, basis: 30, minHeight: 200, align: 'center' }
  site.pages[0].sections[0].devices = {
    mobile: { appearance: { rotation: 5 }, hidden: false, sizing: { grow: 1 } },
  }
  const designed = validateWebsite(site).pages[0]
  assert.equal(designed.css, site.pages[0].css)
  assert.deepEqual(designed.layout, site.pages[0].layout)
  assert.deepEqual(designed.sections[0].devices, site.pages[0].sections[0].devices)
  for (const css of [
    null,
    'body {color:red;}',
    '.widget {background:url(https://example.com)}',
    '@import "x";',
    '.widget {position:fixed;}',
    '<style>bad</style>',
    '.widget {color:red',
    ' '.repeat(12001),
  ]) {
    const invalid = structuredClone(site)
    invalid.pages[0].css = css
    assert.throws(() => validateWebsite(invalid))
  }
  for (const patch of [
    { styleClass: 'other' },
    { sizing: { grow: 13 } },
    { sizing: { basis: -1 } },
    { sizing: { minHeight: 2001 } },
    { devices: { desktop: {} } },
    { devices: { mobile: { hidden: 'yes' } } },
    { devices: { mobile: { appearance: { rotation: 181 } } } },
    { devices: { mobile: { container: { direction: 'row', gap: 1 } } } },
  ]) {
    const invalid = structuredClone(site)
    Object.assign(invalid.pages[0].sections[0], patch)
    assert.throws(() => validateWebsite(invalid))
  }
  for (const layout of [
    { desktop: 'scale' },
    { tablet: 'grid' },
    { mobile: 'bad' },
    { gap: 161 },
    { padding: -1 },
  ]) {
    const invalid = structuredClone(site)
    invalid.pages[0].layout = layout
    assert.throws(() => validateWebsite(invalid))
  }
  for (const style of [
    null,
    { rotation: Infinity },
    { rotation: 181 },
    { opacity: -1 },
    { padding: 999 },
    { fontSize: '20' },
    { color: 'url(https://example.com)' },
    { fontFamily: 'custom' },
    { textAlign: 'garbage' },
    { imageFit: 'bad' },
  ]) {
    const invalid = structuredClone(site)
    invalid.pages[0].sections[0].appearance = style
    assert.throws(() => validateWebsite(invalid))
  }
  const nested = structuredClone(site)
  nested.pages[0].sections.push({
    ...structuredClone(site.pages[0].sections[0]),
    id: 'container',
    type: 'container',
    container: { direction: 'column', gap: 12 },
  })
  nested.pages[0].sections[0].parentId = 'container'
  assert.equal(validateWebsite(nested).pages[0].sections[0].parentId, 'container')
  for (const parentId of ['missing', nested.pages[0].sections[0].id]) {
    const invalid = structuredClone(nested)
    invalid.pages[0].sections[0].parentId = parentId
    assert.throws(() => validateWebsite(invalid), /hierarchy/)
  }
  const cycle = structuredClone(nested)
  cycle.pages[0].sections[0].type = 'container'
  cycle.pages[0].sections[1].parentId = cycle.pages[0].sections[0].id
  assert.throws(() => validateWebsite(cycle), /hierarchy/)
  for (const container of [
    { direction: 'grid', gap: 10 },
    { direction: 'row', gap: -1 },
    { direction: 'column', gap: Infinity },
  ]) {
    const invalid = structuredClone(nested)
    invalid.pages[0].sections[1].container = container
    assert.throws(() => validateWebsite(invalid))
  }
  site.pages[0].grid = { visible: true, snap: true, spacingX: 0.5, spacingY: 1 }
  assert.deepEqual(validateWebsite(site).pages[0].sections[0].layout, geometry)
  for (const layout of [
    null,
    {},
    { ...geometry, x: -1 },
    { ...geometry, w: 0 },
    { ...geometry, h: Infinity },
    { ...geometry, x: '3' },
    { ...geometry, y: 10000 },
    { ...geometry, z: 1.5 },
    { ...geometry, z: 10001 },
  ]) {
    const invalid = structuredClone(site)
    invalid.pages[0].sections[0].layout = layout
    assert.throws(() => validateWebsite(invalid))
  }
  for (const grid of [
    null,
    { visible: 'true', snap: true, spacingX: 1, spacingY: 1 },
    { visible: true, snap: true, spacingX: 0, spacingY: 1 },
  ]) {
    const invalid = structuredClone(site)
    invalid.pages[0].grid = grid
    assert.throws(() => validateWebsite(invalid))
  }
  site.pages[0].sections[0].title = '<script>bad()</script>'
  const image = await call(admin, 'uploadImage', {
    name: 'Project image.png',
    base64: readFileSync('e2e/fixtures/site.png').toString('base64'),
  })
  assert.ok(image.id)
  assert.ok(image.base64)
  const library = await call(admin, 'listImages')
  assert.equal(library.images[0].name, 'Project image.png')
  assert.equal(library.nextCursor, null)
  await reject(() => call(admin, 'listImages', { cursor: '../state' }), /invalid-argument/)
  const thumbnail = await call(admin, 'getImage', { id: image.id, thumbnail: true })
  const sharp = require('sharp')
  assert.ok((await sharp(Buffer.from(thumbnail.base64, 'base64')).metadata()).width <= 320)
  await db.doc(`websiteAssets/${image.id}`).update({ hasThumbnail: false })
  assert.ok((await call(admin, 'getImage', { id: image.id, thumbnail: true })).base64)
  assert.deepEqual(validateWebsite(initial.draft).branding, {
    logoId: '',
    logoAlt: '',
    footerText: '',
    footerLinks: [],
  })
  assert.equal((await call(admin, 'getImage', { id: image.id })).base64, image.base64)
  await reject(
    () => call(admin, 'uploadImage', { base64: Buffer.from('<svg></svg>').toString('base64') }),
    /invalid-argument/,
  )
  const hiddenImage = await call(admin, 'uploadImage', {
    base64: readFileSync('e2e/fixtures/site.png').toString('base64'),
  })
  const logo = await call(admin, 'uploadImage', {
    name: 'Logo.png',
    base64: readFileSync('e2e/fixtures/site.png').toString('base64'),
  })
  site.branding = {
    logoId: logo.id,
    logoAlt: 'Phase 2 logo',
    footerText: 'Company information',
    footerLinks: [{ id: 'contact', label: 'Contact', url: 'mailto:office@example.com' }],
  }
  site.pages[0].sections[0].imageId = image.id
  site.pages[0].sections[0].alt = 'Site photo'
  site.pages[0].sections.push({
    ...site.pages[0].sections[0],
    id: 'hidden',
    type: 'container',
    container: { direction: 'row', gap: 16 },
    hidden: true,
    title: 'Private draft section',
    imageId: hiddenImage.id,
  })
  site.pages[0].sections.push({
    ...site.pages[0].sections[0],
    id: 'hidden-child',
    parentId: 'hidden',
    imageId: hiddenImage.id,
  })
  site.savedSections = [
    {
      id: 'saved-intro',
      name: 'Private reusable section',
      sections: [
        {
          ...structuredClone(site.pages[0].sections[0]),
          id: 'saved-photo',
          imageId: hiddenImage.id,
          alt: '',
          title: 'Library-only content',
        },
      ],
    },
  ]
  assert.deepEqual(validateWebsite(site).savedSections, site.savedSections)
  for (const entries of [
    null,
    [{ ...site.savedSections[0], name: '' }],
    [{ ...site.savedSections[0], sections: [] }],
    [site.savedSections[0], site.savedSections[0]],
    Array.from({ length: 21 }, (_, i) => ({ ...site.savedSections[0], id: `saved-${i}` })),
    [
      {
        ...site.savedSections[0],
        sections: [{ ...site.savedSections[0].sections[0], parentId: 'missing' }],
      },
    ],
    [
      {
        ...site.savedSections[0],
        sections: [{ ...site.savedSections[0].sections[0], appearance: { rotation: 181 } }],
      },
    ],
  ]) {
    assert.throws(() => validateWebsite({ ...site, savedSections: entries }))
  }
  const missingSavedImage = structuredClone(site)
  missingSavedImage.savedSections[0].sections[0].imageId = 'missing-saved-image'
  await reject(
    () => call(admin, 'save', { version: 0, site: missingSavedImage }),
    /invalid-argument/,
  )
  server = createServer((request, response) => {
    request.query = Object.fromEntries(new URL(request.url, 'http://localhost').searchParams)
    response.set = (name, value) => {
      response.setHeader(name, value)
      return response
    }
    response.status = (status) => {
      response.statusCode = status
      return response
    }
    response.type = (mime) => {
      response.setHeader('Content-Type', mime)
      return response
    }
    response.send = (body) => {
      response.end(body)
      return response
    }
    websiteImage(request, response)
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const imageUrl = (id) => `http://127.0.0.1:${server.address().port}/?id=${id}`
  assert.equal((await fetch(imageUrl(image.id))).status, 404)
  assert.equal((await fetch(imageUrl(logo.id))).status, 404)
  await call(admin, 'save', { version: 0, site })
  assert.deepEqual((await call(admin, 'load')).draft.savedSections, site.savedSections)
  assert.equal((await call(admin, 'load')).draft.pages[0].sections[0].span, 6)
  assert.deepEqual((await call(admin, 'load')).draft.pages[0].sections[0].layout, geometry)
  assert.deepEqual((await call(admin, 'load')).draft.pages[0].sections[0].appearance, appearance)
  assert.equal(
    (await call(admin, 'load')).draft.pages[0].sections.find((entry) => entry.id === 'hidden-child')
      .parentId,
    'hidden',
  )
  assert.equal((await publicSite()).site, null)
  await reject(() => call(admin, 'save', { version: 0, site }), /aborted/)
  const unsafe = structuredClone(site)
  unsafe.pages[0].sections[0].linkUrl = 'javascript:alert(1)'
  assert.throws(() => validateWebsite(unsafe), /HTTPS/)
  const unsafeFooter = structuredClone(site)
  unsafeFooter.branding.footerLinks[0].url = 'javascript:alert(1)'
  assert.throws(() => validateWebsite(unsafeFooter), /HTTPS/)
  const noLogoDescription = structuredClone(site)
  noLogoDescription.branding.logoAlt = ''
  assert.throws(() => publishedWebsite(validateWebsite(noLogoDescription)), /description/)
  const brokenFooter = structuredClone(site)
  delete brokenFooter.pages[0].chrome
  brokenFooter.branding.footerLinks[0].url = '/website/missing'
  assert.throws(() => publishedWebsite(validateWebsite(brokenFooter)), /footer link/)
  const missingLogo = structuredClone(site)
  missingLogo.branding.logoId = 'missing'
  await reject(() => call(admin, 'save', { version: 1, site: missingLogo }), /invalid-argument/)
  const duplicate = structuredClone(site)
  duplicate.pages.push(duplicate.pages[0])
  assert.throws(() => validateWebsite(duplicate), /unique/)
  const missingImage = structuredClone(site)
  missingImage.pages[0].sections[0].imageId = 'missing'
  await reject(() => call(admin, 'save', { version: 1, site: missingImage }), /invalid-argument/)
  const brokenLink = structuredClone(site)
  brokenLink.pages[0].sections[0].linkLabel = 'Missing'
  brokenLink.pages[0].sections[0].linkUrl = '/website/missing'
  await call(admin, 'save', { version: 1, site: brokenLink })
  await reject(() => call(admin, 'publish', { version: 2 }), /invalid-argument/)
  await call(admin, 'save', { version: 2, site })
  await call(admin, 'publish', { version: 3 })
  let publicResult = (await publicSite()).site
  assert.equal(publicResult.savedSections, undefined)
  assert.equal(JSON.stringify(publicResult).includes('Library-only content'), false)
  assert.equal(publicResult.pages[0].sections.length, 1)
  assert.equal(publicResult.pages[0].sections[0].title, '<script>bad()</script>')
  assert.equal(publicResult.pages[0].sections[0].span, 6)
  assert.deepEqual(publicResult.pages[0].sections[0].layout, geometry)
  assert.deepEqual(publicResult.pages[0].sections[0].appearance, appearance)
  assert.equal(publicResult.pages[0].css, site.pages[0].css)
  assert.deepEqual(publicResult.pages[0].layout, site.pages[0].layout)
  assert.deepEqual(publicResult.pages[0].sections[0].devices, site.pages[0].sections[0].devices)
  assert.deepEqual(publicResult.pages[0].sections[0].sizing, site.pages[0].sections[0].sizing)
  assert.equal(publicResult.pages[0].sections[0].styleClass, 'custom-feature')
  assert.deepEqual(publicResult.pages[0].grid, site.pages[0].grid)
  assert.equal((await fetch(imageUrl(image.id))).status, 200)
  assert.equal((await fetch(imageUrl(logo.id))).status, 200)
  assert.equal((await fetch(imageUrl(`${image.id}-thumb`))).status, 404)
  assert.equal(publicResult.branding.footerText, 'Company information')
  assert.equal((await fetch(imageUrl(hiddenImage.id))).status, 404)
  site.name = 'Private next version'
  site.savedSections[0].name = 'Current library entry'
  await call(admin, 'save', { version: 4, site })
  assert.equal((await publicSite()).site.name, 'Phase 2')
  await call(admin, 'publish', { version: 5 })
  assert.equal((await publicSite()).site.name, 'Private next version')
  await call(admin, 'restore', { version: 6 })
  assert.deepEqual((await call(admin, 'load')).draft.savedSections, site.savedSections)
  assert.equal((await call(admin, 'load')).draft.name, 'Phase 2')
  assert.equal((await publicSite()).site.name, 'Private next version')
  const results = await Promise.allSettled([
    call(admin, 'save', { version: 7, site }),
    call(admin, 'save', { version: 7, site }),
  ])
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  for (const actor of clients) {
    for (const path of [
      'websitePrivate/state',
      'websitePrivate/state/revisions/revision-1',
      'websitePublished/current',
      `websiteAssets/${image.id}`,
    ]) {
      await reject(() => getDoc(doc(actor.firestore, path)))
      await reject(() => setDoc(doc(actor.firestore, path), { forged: true }))
    }
    await reject(() => getBytes(ref(actor.storage, `website-images/${image.id}.webp`)))
    await reject(() =>
      uploadBytes(ref(actor.storage, 'website-images/forged.webp'), new Uint8Array([1])),
    )
  }
  await call(admin, 'unpublish', { version: 8 })
  assert.equal((await publicSite()).site, null)
  assert.equal((await fetch(imageUrl(image.id))).status, 404)
  assert.equal((await fetch(imageUrl(logo.id))).status, 404)
  assert.ok((await call(admin, 'load')).draft)
  await Promise.all(
    Array.from({ length: 25 }, (_, i) =>
      db.doc(`websiteAssets/legacy-${String(i).padStart(2, '0')}`).set({ size: 10, createdAt: 1 }),
    ),
  )
  const first = await call(admin, 'listImages')
  assert.equal(first.images.length, 24)
  assert.ok(first.nextCursor)
  const second = await call(admin, 'listImages', { cursor: first.nextCursor })
  assert.equal(second.nextCursor, null)
  const listed = [...first.images, ...second.images]
  assert.equal(listed.length, 28)
  assert.equal(new Set(listed.map((image) => image.id)).size, 28)
  assert.equal(listed.find((image) => image.id === 'legacy-00').name, 'Uploaded image')
  const enhanced = structuredClone(site)
  const widget = enhanced.pages[0].sections[0]
  widget.textFormat = 'markdown'
  widget.text = '**Bold** and [Home](/website)'
  widget.imageSettings = {
    focusX: 12,
    focusY: 85,
    zoom: 1.5,
    caption: 'A project',
    overlay: '#000000',
    overlayOpacity: 25,
  }
  widget.locked = true
  assert.deepEqual(
    validateWebsite(enhanced).pages[0].sections[0].imageSettings,
    widget.imageSettings,
  )
  assert.equal(publishedWebsite(validateWebsite(enhanced)).pages[0].sections[0].locked, true)
  for (const patch of [
    { textFormat: 'html' },
    { locked: 'yes' },
    { imageSettings: { zoom: 4 } },
    { imageSettings: { focusX: -1 } },
    { imageSettings: { overlayOpacity: 81 } },
    { imageSettings: { overlay: 'url(https://evil.test)' } },
  ]) {
    const invalid = structuredClone(enhanced)
    Object.assign(invalid.pages[0].sections[0], patch)
    assert.throws(() => validateWebsite(invalid))
  }
  widget.type = 'navigation'
  widget.navigation = {
    brandText: 'Custom brand',
    brandRichText: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Custom brand', marks: [{ type: 'bold' }] }],
        },
      ],
    },
    showBrand: true,
    showPages: false,
    showLogin: true,
    links: [
      {
        id: 'menu',
        label: 'Company',
        url: '',
        children: [{ id: 'home', label: 'Home', url: '/website' }],
      },
    ],
  }
  assert.equal(
    publishedWebsite(validateWebsite(enhanced)).pages[0].sections[0].navigation.links[0].children[0]
      .url,
    '/website',
  )
  assert.deepEqual(
    publishedWebsite(validateWebsite(enhanced)).pages[0].sections[0].navigation.brandRichText,
    widget.navigation.brandRichText,
  )
  const brandText = widget.navigation.brandRichText.content[0].content[0]
  widget.navigation.loginLabel = { label: 'Team sign in' }
  widget.navigation.pageLabels = [{ id: enhanced.pages[0].id, label: 'Welcome' }]
  const menuChild = widget.navigation.links[0].children[0]
  menuChild.labelRichText = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Formatted link', marks: [{ type: 'bold' }] }],
      },
    ],
  }
  const publishedMenu = publishedWebsite(validateWebsite(enhanced)).pages[0].sections[0].navigation
  assert.equal(publishedMenu.loginLabel.label, 'Team sign in')
  assert.equal(publishedMenu.pageLabels[0].label, 'Welcome')
  assert.equal(publishedMenu.links[0].children[0].label, 'Formatted link')
  const menuText = menuChild.labelRichText.content[0].content[0]
  menuText.text = 'x'.repeat(81)
  assert.throws(() => validateWebsite(enhanced))
  menuText.text = 'Formatted link'
  menuText.marks = [{ type: 'link', attrs: { href: '/website' } }]
  assert.throws(() => validateWebsite(enhanced))
  menuText.marks = [{ type: 'bold' }]
  widget.navigation.loginLabel.label = ''
  assert.throws(() => publishedWebsite(validateWebsite(enhanced)))
  widget.navigation.loginLabel.label = 'Team sign in'
  brandText.marks = [{ type: 'link', attrs: { href: '/website/missing' } }]
  assert.throws(() => publishedWebsite(validateWebsite(enhanced)))
  brandText.marks = [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }]
  assert.throws(() => validateWebsite(enhanced))
  brandText.marks = [{ type: 'bold' }]
  widget.navigation.links[0].children[0].url = '/website/missing'
  assert.throws(() => publishedWebsite(validateWebsite(enhanced)))
  widget.navigation.links[0].children[0].url = 'javascript:alert(1)'
  assert.throws(() => validateWebsite(enhanced))
  delete widget.navigation
  widget.type = 'text'
  widget.text = '[Missing](/website/missing)'
  assert.throws(() => publishedWebsite(validateWebsite(enhanced)))
  const revisionList = (await call(admin, 'listRevisions')).revisions
  assert.ok(revisionList.length > 1)
  assert.ok(revisionList.every((entry) => !('draft' in entry)))
  await reject(
    () => call(admin, 'restoreRevision', { version: 9, revisionId: '../state' }),
    /invalid-argument/,
  )
  await reject(
    () => call(admin, 'restoreRevision', { version: 9, revisionId: 'revision-9999' }),
    /not-found/,
  )
  await reject(
    () => call(admin, 'restoreRevision', { version: 8, revisionId: revisionList[0].id }),
    /aborted/,
  )
  const earliest = revisionList.at(-1)
  const restored = await call(admin, 'restoreRevision', { version: 9, revisionId: earliest.id })
  assert.equal(restored.draft.name, earliest.name)
  assert.equal((await publicSite()).site, null)
  let revisionVersion = restored.version
  for (let i = 0; i < 11; i++) {
    site.name = 'Revision ' + i
    const saved = await call(admin, 'save', { version: revisionVersion, site })
    revisionVersion = saved.version
  }
  const history = (await call(admin, 'listRevisions')).revisions
  assert.equal(history.length, 10)
  assert.equal(history[0].version, revisionVersion)
  assert.equal((await db.collection('websitePrivate/state/revisions').get()).size, 10)
  await reject(
    () => call(admin, 'restoreRevision', { version: revisionVersion, revisionId: earliest.id }),
    /not-found/,
  )

  const customSite = structuredClone(site)
  const base = {
    id: 'source',
    type: 'text',
    title: 'Default heading',
    text: '',
    imageId: image.id,
    alt: 'Custom photo',
    linkLabel: '',
    linkUrl: '',
    hidden: false,
    items: [],
    layout: { x: 0, y: 0, w: 12, h: 8, z: 1 },
  }
  const visual = {
    id: 'visual',
    name: 'Visual design',
    kind: 'visual',
    sections: [
      base,
      {
        ...base,
        id: 'hidden-custom',
        hidden: true,
        text: 'Hidden custom secret',
        imageId: hiddenImage.id,
      },
    ],
    fields: [
      {
        key: 'heading',
        label: 'Heading',
        type: 'text',
        defaultValue: 'Default heading',
        sectionId: 'source',
        property: 'title',
      },
    ],
    html: '',
    css: '',
  }
  const code = {
    id: 'code',
    name: 'Code design',
    kind: 'code',
    sections: [],
    fields: [{ key: 'message', label: 'Message', type: 'text', defaultValue: 'Default text' }],
    html: '<h2>{{message}}</h2>',
    css: 'h2 { color: #123456; }',
  }
  customSite.customWidgets = [
    visual,
    code,
    {
      ...code,
      id: 'private-code',
      name: 'Private unused widget',
      html: '<p>Private custom design secret</p>',
    },
  ]
  customSite.pages[0].sections = [
    {
      ...base,
      id: 'placed',
      type: 'custom',
      imageId: '',
      custom: { definitionId: 'visual', values: { heading: 'Instance heading' } },
    },
    {
      ...base,
      id: 'coded',
      type: 'custom',
      imageId: '',
      custom: { definitionId: 'code', values: { message: '<script>bad()</script>' } },
    },
  ]
  const checkedCustom = validateWebsite(customSite)
  const publicCustom = publishedWebsite(checkedCustom)
  assert.equal(publicCustom.customWidgets, undefined)
  assert.equal(
    publicCustom.pages[0].sections[0].custom.inline.sections[0].title,
    'Instance heading',
  )
  assert.equal(publicCustom.pages[0].sections[0].custom.inline.sections.length, 1)
  assert.equal(
    publicCustom.pages[0].sections[1].custom.inline.html,
    '<h2>&lt;script&gt;bad()&lt;/script&gt;</h2>',
  )
  assert.equal(JSON.stringify(publicCustom).includes('Private custom design secret'), false)
  assert.equal(JSON.stringify(publicCustom).includes('Hidden custom secret'), false)
  assert.ok(!websiteAssetIds(publicCustom).includes(hiddenImage.id))
  assert.doesNotThrow(() => validateWebsite(publicCustom))
  for (const mutate of [
    (data) => {
      data.customWidgets = []
    },
    (data) => {
      data.pages[0].sections[0].custom.values.heading = 'x'.repeat(161)
    },
    (data) => {
      data.pages[0].sections[0].custom.values.unknown = 'x'
    },
    (data) => {
      data.customWidgets[0].sections[0].type = 'custom'
    },
    (data) => {
      data.customWidgets[0].fields[0].sectionId = 'missing'
    },
    (data) => {
      data.customWidgets[0].fields[0].property = '__proto__'
    },
    (data) => {
      data.customWidgets[1].html = '<script>alert(1)</script>'
    },
    (data) => {
      data.customWidgets[1].css = 'p{background:url(https://example.com)}'
    },
    (data) => {
      data.customWidgets[1].html = '<img src="x" onerror="bad()">'
    },
    (data) => {
      data.customWidgets[0].sections[0].layout.w = 0
    },
  ]) {
    const invalid = structuredClone(customSite)
    mutate(invalid)
    assert.throws(() => validateWebsite(invalid))
  }
  const missingCustomImage = structuredClone(customSite)
  missingCustomImage.customWidgets[0].sections[0].imageId = 'not-uploaded'
  await reject(
    () => call(admin, 'save', { version: revisionVersion, site: missingCustomImage }),
    /invalid-argument/,
  )
  const savedCustom = await call(admin, 'save', { version: revisionVersion, site: customSite })
  assert.deepEqual((await call(admin, 'load')).draft.customWidgets, checkedCustom.customWidgets)
  const customPublication = await call(admin, 'publish', { version: savedCustom.version })
  assert.deepEqual((await publicSite()).site.pages[0].sections, publicCustom.pages[0].sections)
  assert.equal((await fetch(imageUrl(hiddenImage.id))).status, 404)
  const restoredCustom = await call(admin, 'restore', { version: customPublication.version })
  assert.deepEqual(restoredCustom.draft.customWidgets, checkedCustom.customWidgets)
  assert.deepEqual((await publicSite()).site.pages[0].sections, publicCustom.pages[0].sections)

  const { newWebsiteForm } = require('../functions/websiteForms.js')
  const {
    submitWebsiteForm,
    websiteFormAdmin,
    deliverWebsiteSubmission,
  } = require('../functions/websiteFormFunctions.js')
  const formAdmin = (actor, action, data = {}) =>
    websiteFormAdmin.run({
      auth: actor ? { uid: actor.uid } : undefined,
      data: { action, ...data },
    })
  const submit = (data, ip = '198.51.100.10') => submitWebsiteForm.run({ data, rawRequest: { ip } })
  for (const actor of actors) {
    await reject(() => formAdmin(actor, 'list'))
    await reject(() => formAdmin(actor, 'retry', { id: 'forged' }))
  }
  const form = newWebsiteForm('public-contact')
  form.delivery = {
    to: ['office@example.test'],
    cc: ['manager@example.test'],
    subject: 'Website inquiry',
  }
  const formSite = structuredClone(customSite)
  formSite.forms = [
    form,
    { ...structuredClone(form), id: 'private-form', name: 'Unpublished form' },
  ]
  formSite.pages[0].sections = [
    { ...base, id: 'form-widget', type: 'form', imageId: '', formId: form.id },
  ]
  const savedForm = await call(admin, 'save', { version: restoredCustom.version, site: formSite })
  await reject(
    () => submit({ formId: form.id, submissionId: randomUUID(), website: '', values: {} }),
    /failed-precondition/,
  )
  const publishedForm = await call(admin, 'publish', { version: savedForm.version })
  const publicForms = (await publicSite()).site.forms
  assert.equal(publicForms.length, 1)
  assert.equal(publicForms[0].delivery, undefined)
  assert.equal(JSON.stringify(publicForms).includes('office@example.test'), false)
  const payload = {
    formId: form.id,
    submissionId: randomUUID(),
    website: '',
    values: { name: 'Visitor', email: 'visitor@example.test', message: '<script>bad()</script>' },
  }
  const submissionKey = createHash('sha256')
    .update(form.id + ':' + payload.submissionId)
    .digest('hex')
  await reject(() => submit({ ...payload, formId: 'private-form' }), /failed-precondition/)
  await reject(
    () => submit({ ...payload, values: { ...payload.values, email: 'invalid' } }),
    /invalid-argument/,
  )
  await reject(
    () => submit({ ...payload, values: { ...payload.values, to: 'attacker@example.test' } }),
    /invalid-argument/,
  )
  await submit({ ...payload, website: 'spam-trap' })
  assert.equal((await db.doc('websiteSubmissions/' + submissionKey).get()).exists, false)
  await Promise.all([submit({ ...payload, to: ['attacker@example.test'] }), submit(payload)])
  assert.equal((await db.collection('websiteSubmissions').get()).size, 1)
  const queued = (await db.doc('websiteSubmissions/' + submissionKey).get()).data()
  assert.deepEqual(queued.delivery, form.delivery)
  assert.equal(queued.replyTo, 'visitor@example.test')
  assert.equal(queued.emailStatus, 'pending')
  await reject(
    () => submit({ ...payload, values: { ...payload.values, message: 'Changed' } }),
    /already-exists/,
  )
  const emailService = require('../functions/emailService.js')
  const originalSend = emailService.sendEmail,
    originalEnabled = emailService.isEmailEnabled
  const sent = []
  emailService.isEmailEnabled = () => true
  emailService.sendEmail = async (options) => {
    sent.push(options)
  }
  try {
    await Promise.all([
      deliverWebsiteSubmission(submissionKey),
      deliverWebsiteSubmission(submissionKey),
    ])
    assert.equal(sent.length, 1)
    assert.deepEqual(sent[0].to, form.delivery.to)
    assert.deepEqual(sent[0].cc, form.delivery.cc)
    assert.equal(sent[0].replyTo, 'visitor@example.test')
    assert.ok(sent[0].html.includes('&lt;script&gt;bad()&lt;/script&gt;'))
    assert.equal(
      (await db.doc('websiteSubmissions/' + submissionKey).get()).data().emailStatus,
      'sent',
    )
    await formAdmin(admin, 'retry', { id: submissionKey })
    assert.equal(sent.length, 1)
    const second = { ...payload, submissionId: randomUUID() }
    const secondKey = createHash('sha256')
      .update(form.id + ':' + second.submissionId)
      .digest('hex')
    await submit(second)
    emailService.sendEmail = async () => {
      throw new Error('Simulated delivery failure')
    }
    await deliverWebsiteSubmission(secondKey)
    assert.equal(
      (await db.doc('websiteSubmissions/' + secondKey).get()).data().emailStatus,
      'failed',
    )
    assert.equal(
      (await db.doc('websiteSubmissions/' + secondKey).get()).data().answers[0].value,
      'Visitor',
    )
    emailService.isEmailEnabled = () => false
    await formAdmin(admin, 'retry', { id: secondKey })
    assert.equal(
      (await db.doc('websiteSubmissions/' + secondKey).get()).data().emailStatus,
      'disabled',
    )
    emailService.isEmailEnabled = () => true
    emailService.sendEmail = async (options) => {
      sent.push(options)
    }
    await formAdmin(admin, 'retry', { id: secondKey })
    assert.equal(sent.length, 2)
    assert.equal((await db.doc('websiteSubmissions/' + secondKey).get()).data().emailStatus, 'sent')
  } finally {
    emailService.sendEmail = originalSend
    emailService.isEmailEnabled = originalEnabled
  }
  const inbox = await formAdmin(admin, 'list')
  assert.equal(inbox.submissions.length, 2)
  assert.equal(inbox.submissions[0].fingerprint, undefined)
  for (let i = 0; i < 8; i++) await submit({ ...payload, submissionId: randomUUID() })
  await reject(() => submit({ ...payload, submissionId: randomUUID() }), /resource-exhausted/)
  await submit(payload) // Idempotent replay does not consume quota.
  for (const actor of clients)
    for (const path of [
      'websiteSubmissions/' + submissionKey,
      'websitePrivate/publicForms',
      'websiteFormLimits/site',
    ]) {
      await reject(() => getDoc(doc(actor.firestore, path)))
      await reject(() => setDoc(doc(actor.firestore, path), { forged: true }))
    }
  formSite.forms[0].delivery.to = ['changed@example.test']
  const changedForm = await call(admin, 'save', { version: publishedForm.version, site: formSite })
  assert.equal(
    (await db.doc('websitePrivate/publicForms').get()).data().forms[0].delivery.to[0],
    'office@example.test',
  )
  await call(admin, 'unpublish', { version: changedForm.version })
  await reject(
    () => submit({ ...payload, submissionId: randomUUID() }, '198.51.100.11'),
    /failed-precondition/,
  )
  assert.equal((await db.doc('websiteSubmissions/' + submissionKey).get()).exists, true)
  assert.equal((await db.doc('websitePrivate/publicForms').get()).exists, false)

  const themed = validateWebsite({
    name: 'Theme test',
    accent: '#145b88',
    theme: {
      background: '#f4f6f8',
      text: '#172c40',
      headingFont: 'display',
      contentWidth: 1200,
      spacing: 24,
    },
    pages: [
      {
        id: 'home',
        title: 'Home',
        slug: 'home',
        description: 'Theme test',
        chrome: 'widgets',
        inNavigation: true,
        sections: [
          {
            id: 'heading',
            type: 'hero',
            title: 'Theme test',
            text: 'Draft text',
            imageId: '',
            alt: '',
            linkLabel: '',
            linkUrl: '',
            hidden: false,
            items: [],
          },
        ],
      },
    ],
  })
  const beforeTheme = await call(admin, 'load')
  const themeSaved = await call(admin, 'save', { version: beforeTheme.version, site: themed })
  assert.deepEqual((await call(admin, 'load')).draft.theme, themed.theme)
  await call(admin, 'publish', { version: themeSaved.version })
  assert.deepEqual((await publicSite()).site.theme, themed.theme)
  for (const theme of [
    { text: 'url(https://invalid.test)' },
    { contentWidth: 0 },
    { spacing: NaN },
    { headingFont: 'external' },
    { unknown: 1 },
  ])
    await reject(async () => validateWebsite({ ...themed, theme }), /invalid-argument/)

  // Shared layouts use the same private save/publication/asset pipeline as pages.
  const layoutSite = structuredClone(themed)
  const slot = {
    ...structuredClone(layoutSite.pages[0].sections[0]),
    id: 'content-slot',
    type: 'page-content',
    title: 'Page content',
    text: '',
  }
  const layoutHeader = {
    ...structuredClone(layoutSite.pages[0].sections[0]),
    id: 'shared-heading',
    title: 'Shared heading',
  }
  layoutSite.sharedLayout = {
    id: 'site-layout',
    slug: 'site-layout',
    title: 'Site layout',
    chrome: 'widgets',
    description: '',
    inNavigation: false,
    layout: { desktop: 'flow', tablet: 'flow', mobile: 'flow' },
    sections: [layoutHeader, slot],
    html: '<header class="custom-header"><website-widget id="shared-heading"></website-widget></header><page-content></page-content>',
  }
  layoutSite.css = '.widget-title { color: #123456; }'
  layoutSite.js = 'window.siteReady = true'
  layoutSite.pages[0].useSiteLayout = true
  layoutSite.pages[0].html = '<main><website-widget id="heading"></website-widget></main>'
  layoutSite.pages[0].js = 'window.pageReady = window.siteReady'
  const currentLayout = await call(admin, 'load')
  const layoutSaved = await call(admin, 'save', {
    version: currentLayout.version,
    site: layoutSite,
  })
  assert.equal((await call(admin, 'load')).draft.sharedLayout.html, layoutSite.sharedLayout.html)
  await call(admin, 'publish', { version: layoutSaved.version })
  const layoutPublished = (await publicSite()).site
  assert.equal(layoutPublished.pages.length, 1)
  assert.equal(layoutPublished.sharedLayout.sections.length, 2)
  assert.equal(layoutPublished.js, layoutSite.js)
  assert.equal(layoutPublished.pages[0].js, layoutSite.pages[0].js)
  for (const change of [
    (candidate) => candidate.sharedLayout.sections.pop(),
    (candidate) => candidate.sharedLayout.sections.push({ ...slot, id: 'duplicate-slot' }),
    (candidate) => (candidate.sharedLayout.sections[1].hidden = true),
    (candidate) =>
      (candidate.sharedLayout.html = '<script>alert(1)</script><page-content></page-content>'),
    (candidate) =>
      (candidate.sharedLayout.html = '<page-content></page-content><page-content></page-content>'),
    (candidate) => (candidate.pages[0].html = '<website-widget id="missing"></website-widget>'),
    (candidate) => candidate.pages[0].sections.push(slot),
    (candidate) => (candidate.js = 'function ('),
    (candidate) => (candidate.pages[0].js = 'x'.repeat(20001)),
    (candidate) => (candidate.css = 'body { color: red; }'),
    (candidate) => delete candidate.sharedLayout,
  ]) {
    const candidate = structuredClone(layoutSite)
    change(candidate)
    await reject(async () => validateWebsite(candidate), /invalid-argument/)
  }
  // Component widgets preserve their data/settings and validate nested custom source content.
  const { blockTypes } = require('../functions/websiteBlocks.js')
  for (const type of blockTypes) {
    const row = {
      id: 'row',
      title: 'Label',
      subtitle: 'Role',
      text: 'Details',
      imageId: 'photo',
      alt: 'Company photo',
      linkLabel: '',
      linkUrl: '',
      value: 42,
    }
    const entry = {
      ...row,
      id: 'component',
      type,
      hidden: false,
      imageId: '',
      alt: '',
      icon: 'shield',
      linkLabel: type === 'button' ? 'Visit' : '',
      linkUrl: type === 'button' ? '/website' : '',
      items: ['button', 'icon', 'divider', 'spacer', 'badge', 'alert'].includes(type) ? [] : [row],
      blockOptions: { columns: 2, chartType: 'bar' },
    }
    const candidate = {
      name: 'Components',
      accent: '#174878',
      pages: [
        {
          id: 'home',
          slug: 'home',
          title: 'Home',
          description: '',
          inNavigation: true,
          chrome: 'widgets',
          sections: [entry],
        },
      ],
    }
    if (type === 'chart') entry.blockOptions = { columns: 2, chartType: 'area', showData: false }
    if (['metric', 'progress-ring'].includes(type)) {
      delete entry.value
      await reject(async () => publishedWebsite(validateWebsite(candidate)), /invalid-argument/)
      entry.value = type === 'progress-ring' ? 101 : 42
      if (type === 'progress-ring')
        await reject(async () => publishedWebsite(validateWebsite(candidate)), /invalid-argument/)
      entry.value = 42
    }
    const accepted = publishedWebsite(validateWebsite(candidate)).pages[0].sections[0]
    assert.equal(accepted.type, type)
    assert.equal(accepted.blockOptions.columns, 2)
    assert.equal(accepted.subtitle, 'Role')
    const source = { ...entry, layout: { x: 0, y: 0, w: 24, h: 12, z: 1 } }
    candidate.pages[0].sections = [
      {
        ...entry,
        type: 'custom',
        items: [],
        custom: {
          inline: {
            id: 'visual',
            name: 'Visual',
            kind: 'visual',
            html: '',
            css: '',
            fields: [],
            sections: [source],
          },
          values: {},
        },
      },
    ]
    assert.equal(
      publishedWebsite(validateWebsite(candidate)).pages[0].sections[0].custom.inline.sections[0]
        .type,
      type,
    )
    source.value = Number.POSITIVE_INFINITY
    await reject(async () => validateWebsite(candidate), /invalid-argument/)
    source.value = 1
    source.blockOptions.columns = 7
    await reject(async () => validateWebsite(candidate), /invalid-argument/)
  }

  // Interactive widgets share publication rules across normal and custom placements.
  const interactiveItem = {
    id: 'detail',
    title: 'Details',
    text: 'Read this information.',
    imageId: '',
    alt: '',
    linkLabel: 'Download',
    linkUrl: 'https://example.com/info.pdf',
  }
  for (const type of ['accordion', 'tabs', 'video', 'downloads']) {
    const entry = {
      ...interactiveItem,
      id: 'interactive',
      type,
      hidden: false,
      items: type === 'video' ? [] : [interactiveItem],
      linkUrl: type === 'video' ? 'https://youtu.be/abcdefghijk' : '',
      linkLabel: type === 'video' ? 'Open video' : '',
    }
    const candidate = {
      name: 'Widgets',
      accent: '#174878',
      pages: [
        {
          id: 'home',
          slug: 'home',
          title: 'Home',
          description: '',
          inNavigation: true,
          chrome: 'widgets',
          sections: [entry],
        },
      ],
    }
    assert.equal(publishedWebsite(validateWebsite(candidate)).pages[0].sections[0].type, type)
    if (type === 'video') entry.linkUrl = 'https://example.com/arbitrary-page'
    else entry.items = []
    await reject(async () => publishedWebsite(validateWebsite(candidate)), /invalid-argument/)
    const source = { ...entry, layout: { x: 0, y: 0, w: 24, h: 12, z: 1 } }
    candidate.pages[0].sections = [
      {
        ...entry,
        type: 'custom',
        linkUrl: '',
        linkLabel: '',
        items: [],
        custom: {
          inline: {
            id: 'visual',
            name: 'Visual',
            kind: 'visual',
            html: '',
            css: '',
            fields: [],
            sections: [source],
          },
          values: {},
        },
      },
    ]
    await reject(async () => publishedWebsite(validateWebsite(candidate)), /invalid-argument/)
  }

  console.log(
    `Website verification passed: ${checks} rejection checks, private drafts/images, validated publication, version conflicts, restoration, and unpublishing.`,
  )
} finally {
  if (server) await new Promise((resolve) => server.close(resolve))
  await Promise.all(
    clients.map(async (client) => {
      await terminate(client.firestore)
      await deleteApp(client.app)
    }),
  )
}
