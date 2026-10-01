import { randomUUID } from 'node:crypto'
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https'
import sharp from 'sharp'
import { FieldPath } from 'firebase-admin/firestore'
import { db, storageBucket } from './runtime'
import { buildCurrentFunctionUser } from './roleAccess'
import { compareWebsites } from './websiteChanges'
import {
  initialWebsite,
  publishedWebsite,
  validateWebsite,
  websiteAssetIds,
  type WebsiteSite,
} from './websiteModel'

const state = db.doc('websitePrivate/state')
const published = db.doc('websitePublished/current')
const revisions = state.collection('revisions')
const activity = state.collection('activity')
function checkVersion(actual: number, expected: unknown) {
  if (expected !== actual)
    throw new HttpsError(
      'aborted',
      'Another admin changed the website. Reload and review before saving.',
    )
}
async function requireWebsiteAdmin(uid?: string) {
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in to manage the website.')
  const profile = await db.doc(`users/${uid}`).get()
  const user = buildCurrentFunctionUser(uid, profile.data() || {})
  if (!profile.exists || !user.active || user.role !== 'admin')
    throw new HttpsError('permission-denied', 'Only active admins can manage the website.')
  return uid
}
export const websiteBuilder = onCall({ memory: '512MiB', timeoutSeconds: 60 }, async (request) => {
  const uid = await requireWebsiteAdmin(request.auth?.uid)
  const data = request.data || {}
  if (data.action === 'comparePublished') {
    const candidate = publishedWebsite(validateWebsite(data.site))
    return db.runTransaction(async (transaction) => {
      const [draftState, live] = await transaction.getAll(state, published)
      checkVersion(draftState.data()?.version || 0, data.version)
      return {
        ...compareWebsites(live.data()?.site, candidate),
        publishedAt: live.data()?.publishedAt || null,
      }
    })
  }
  if (data.action === 'getRevision') {
    if (typeof data.revisionId !== 'string' || !/^revision-\d{1,12}$/.test(data.revisionId))
      throw new HttpsError('invalid-argument', 'Choose a saved revision.')
    const record = await revisions.doc(data.revisionId).get()
    if (!record.exists)
      throw new HttpsError(
        'failed-precondition',
        'That saved version has expired. Refresh the history.',
      )
    return { draft: record.data()!.draft }
  }
  if (data.action === 'listRevisions') {
    const [records, events] = await Promise.all([
      revisions.orderBy('version', 'desc').limit(10).get(),
      activity.orderBy('version', 'desc').limit(50).get(),
    ])
    return {
      activity: events.docs.map((record) => ({ id: record.id, ...record.data() })),
      revisions: records.docs.map((record) => ({
        id: record.id,
        version: record.data().version,
        savedAt: record.data().savedAt,
        name: record.data().draft?.name || 'Website draft',
        savedBy: record.data().savedBy || '',
        action: record.data().action || 'save',
      })),
    }
  }
  if (data.action === 'listImages') {
    if (
      data.cursor !== undefined &&
      (typeof data.cursor !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(data.cursor))
    )
      throw new HttpsError('invalid-argument', 'Invalid image cursor.')
    let query = db.collection('websiteAssets').orderBy(FieldPath.documentId()).limit(25)
    if (data.cursor) query = query.startAfter(data.cursor)
    const records = (await query.get()).docs
    const images = records.slice(0, 24).map((record) => ({
      id: record.id,
      name: record.data().name || 'Uploaded image',
      size: record.data().size || 0,
      createdAt: record.data().createdAt || null,
    }))
    return { images, nextCursor: records.length > 24 ? images.at(-1)!.id : null }
  }
  if (data.action === 'uploadImage') {
    if (
      typeof data.base64 !== 'string' ||
      data.base64.length > 7 * 1024 * 1024 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(data.base64)
    )
      throw new HttpsError('invalid-argument', 'Choose a JPG, PNG or WebP image up to 5 MB.')
    const bytes = Buffer.from(data.base64, 'base64')
    if (!bytes.length || bytes.length > 5 * 1024 * 1024)
      throw new HttpsError('invalid-argument', 'Choose an image up to 5 MB.')
    let image: Buffer
    try {
      const source = sharp(bytes, { limitInputPixels: 25000000, failOn: 'error' })
      const info = await source.metadata()
      if (!['jpeg', 'png', 'webp'].includes(info.format || '') || (info.pages || 1) > 1)
        throw new Error('Unsupported image')
      image = await source
        .rotate()
        .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer()
      if (image.length > 2 * 1024 * 1024) throw new Error('Image too large')
    } catch {
      throw new HttpsError(
        'invalid-argument',
        'Use a readable still JPG, PNG or WebP image under 25 megapixels.',
      )
    }
    const id = randomUUID()
    const name =
      typeof data.name === 'string'
        ? data.name
            .split(/[\\/]/)
            .pop()!
            .replace(/[\x00-\x1f]/g, '')
            .slice(0, 160)
        : 'Uploaded image'
    const thumbnail = await sharp(image)
      .resize({ width: 320, height: 240, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 70 })
      .toBuffer()
    await storageBucket
      .file(`website-images/${id}.webp`)
      .save(image, { contentType: 'image/webp', resumable: false })
    await storageBucket
      .file(`website-images/${id}-thumb.webp`)
      .save(thumbnail, { contentType: 'image/webp', resumable: false })
    await db.doc(`websiteAssets/${id}`).set({
      uploadedBy: uid,
      createdAt: Date.now(),
      size: image.length,
      name: name || 'Uploaded image',
      hasThumbnail: true,
    })
    return { id, base64: image.toString('base64') }
  }
  if (data.action === 'getImage') {
    if (typeof data.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(data.id))
      throw new HttpsError('invalid-argument', 'Invalid image.')
    const asset = await db.doc(`websiteAssets/${data.id}`).get()
    if (!asset.exists) throw new HttpsError('not-found', 'Image not found.')
    const thumbnail = data.thumbnail === true
    let [bytes] = await storageBucket
      .file(
        `website-images/${data.id}${thumbnail && asset.data()?.hasThumbnail ? '-thumb' : ''}.webp`,
      )
      .download()
    if (thumbnail && !asset.data()?.hasThumbnail)
      bytes = await sharp(bytes)
        .resize({ width: 320, height: 240, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 70 })
        .toBuffer()
    return { id: data.id, base64: bytes.toString('base64') }
  }
  if (data.action === 'load') {
    const snapshot = (await state.get()).data()
    return {
      version: snapshot?.version || 0,
      draft: snapshot?.draft || initialWebsite(),
      publishedAt: snapshot?.publishedAt || null,
      hasPrevious: Boolean(snapshot?.previous),
      savedAt: snapshot?.savedAt || null,
    }
  }
  if (!['save', 'publish', 'restore', 'unpublish', 'restoreRevision'].includes(data.action))
    throw new HttpsError('invalid-argument', 'Unknown website action.')
  const draft = data.action === 'save' ? validateWebsite(data.site) : undefined
  return db.runTransaction(async (transaction) => {
    const snapshot = (await transaction.get(state)).data() || {}
    checkVersion(snapshot.version || 0, data.version)
    const version = (snapshot.version || 0) + 1
    const now = Date.now()
    const savedBy = String(request.auth?.token?.name || request.auth?.token?.email || uid).slice(
      0,
      160,
    )
    // All callers finish their reads before recording activity and writing state.
    async function recordActivity(nextDraft?: WebsiteSite) {
      const oldEvents = await transaction.get(activity.orderBy('version', 'desc').limit(51))
      const changes = nextDraft ? compareWebsites(snapshot.draft, nextDraft) : undefined
      transaction.set(activity.doc(`event-${version}`), {
        version,
        savedAt: now,
        savedBy,
        action: data.action,
        ...(data.action === 'restoreRevision' ? { source: data.revisionId } : {}),
        ...(changes
          ? {
              total: changes.total,
              paths: changes.changes.slice(0, 20).map((change) => change.path.slice(0, 240)),
            }
          : {}),
      })
      for (const entry of oldEvents.docs.slice(49)) transaction.delete(entry.ref)
    }
    if (data.action === 'restoreRevision') {
      if (typeof data.revisionId !== 'string' || !/^revision-\d{1,12}$/.test(data.revisionId))
        throw new HttpsError('invalid-argument', 'Choose a saved revision.')
      const record = await transaction.get(revisions.doc(data.revisionId))
      if (!record.exists) throw new HttpsError('not-found', 'That revision is no longer available.')
      const restored = validateWebsite(record.data()!.draft)
      const old = await transaction.get(revisions.orderBy('version', 'desc').limit(12))
      await recordActivity(restored)
      transaction.set(revisions.doc(`revision-${version}`), {
        version,
        savedAt: now,
        savedBy,
        action: data.action,
        draft: restored,
      })
      for (const entry of old.docs.slice(9)) transaction.delete(entry.ref)
      transaction.set(
        state,
        { draft: restored, version, savedAt: now, updatedBy: uid },
        { merge: true },
      )
      return { version, draft: restored, savedAt: now }
    }
    if (draft) {
      const ids = websiteAssetIds(draft)
      if (ids.length > 100)
        throw new HttpsError('invalid-argument', 'Use no more than 100 images per website.')
      if (
        ids.length &&
        (await transaction.getAll(...ids.map((id) => db.doc(`websiteAssets/${id}`)))).some(
          (doc) => !doc.exists,
        )
      )
        throw new HttpsError('invalid-argument', 'One of the images is missing. Upload it again.')
      const old = await transaction.get(revisions.orderBy('version', 'desc').limit(12))
      await recordActivity(draft)
      transaction.set(revisions.doc(`revision-${version}`), {
        version,
        savedAt: now,
        draft,
        savedBy,
        action: data.action,
      })
      for (const entry of old.docs.slice(9)) transaction.delete(entry.ref)
      transaction.set(state, { draft, version, savedAt: now, updatedBy: uid }, { merge: true })
      return { version, savedAt: now }
    }
    if (data.action === 'restore') {
      if (!snapshot.previous)
        throw new HttpsError('failed-precondition', 'There is no previous published version.')
      const restored = validateWebsite({
        ...snapshot.previous,
        forms: [
          ...(snapshot.draft?.forms || []).filter(
            (form: { id: string }) =>
              !snapshot.previous.forms?.some((previous: { id: string }) => previous.id === form.id),
          ),
          ...(snapshot.previous.forms || []).map((form: { id: string }) => ({
            ...form,
            ...(snapshot.draft?.forms?.find((current: { id: string }) => current.id === form.id)
              ?.delivery
              ? {
                  delivery: snapshot.draft.forms.find(
                    (current: { id: string }) => current.id === form.id,
                  ).delivery,
                }
              : {}),
          })),
        ],
        ...(snapshot.draft?.customWidgets ? { customWidgets: snapshot.draft.customWidgets } : {}),
        ...(snapshot.draft?.savedSections ? { savedSections: snapshot.draft.savedSections } : {}),
        ...(snapshot.draft?.theme?.presets
          ? {
              theme: {
                ...(snapshot.previous.theme || { enabled: false }),
                presets: snapshot.draft.theme.presets,
              },
            }
          : {}),
      })
      const old = await transaction.get(revisions.orderBy('version', 'desc').limit(12))
      await recordActivity(restored)
      transaction.set(revisions.doc(`revision-${version}`), {
        version,
        savedAt: now,
        draft: restored,
        savedBy,
        action: data.action,
      })
      for (const entry of old.docs.slice(9)) transaction.delete(entry.ref)
      transaction.set(
        state,
        { draft: restored, version, savedAt: now, updatedBy: uid },
        { merge: true },
      )
      return { version, draft: restored, savedAt: now }
    }
    const current = (await transaction.get(published)).data()
    if (data.action === 'unpublish') {
      await recordActivity()
      transaction.delete(published)
      transaction.delete(db.doc('websitePrivate/publicForms'))
      transaction.set(
        state,
        {
          version,
          publishedAt: null,
          updatedBy: uid,
          ...(current?.site ? { previous: current.site } : {}),
        },
        { merge: true },
      )
      return {
        version,
        publishedAt: null,
        hasPrevious: Boolean(current?.site || snapshot.previous),
      }
    }
    if (!snapshot.draft)
      throw new HttpsError('failed-precondition', 'Save a draft before publishing.')
    const site = publishedWebsite(validateWebsite(snapshot.draft))
    await recordActivity()
    transaction.set(published, { site, publishedAt: now, assetIds: websiteAssetIds(site) })
    transaction.set(db.doc('websitePrivate/publicForms'), {
      publishedAt: now,
      forms: (snapshot.draft.forms || []).filter((form: { id: string }) =>
        site.forms?.some((publicForm) => publicForm.id === form.id),
      ),
    })
    transaction.set(
      state,
      {
        version,
        publishedAt: now,
        updatedBy: uid,
        ...(current?.site ? { previous: current.site } : {}),
      },
      { merge: true },
    )
    return { version, publishedAt: now, hasPrevious: Boolean(current?.site || snapshot.previous) }
  })
})

// Anonymous readers receive only the explicitly published snapshot, never draft state.
export const getPublishedWebsite = onCall(async () => {
  const snapshot = (await published.get()).data()
  return { site: (snapshot?.site as WebsiteSite) || null }
})
export const websiteImage = onRequest(async (request, response) => {
  response.set('Cache-Control', 'no-store').set('X-Content-Type-Options', 'nosniff')
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.status(405).send('Method not allowed.')
    return
  }
  const id = request.query.id
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(id)) {
    response.status(404).send('Image not found.')
    return
  }
  try {
    const record = (await published.get()).data()
    if (!record?.assetIds?.includes(id)) {
      response.status(404).send('Image not found.')
      return
    }
    const [bytes] = await storageBucket.file(`website-images/${id}.webp`).download()
    response.type('image/webp').send(bytes)
  } catch {
    response.status(503).send('Image temporarily unavailable.')
  }
})
