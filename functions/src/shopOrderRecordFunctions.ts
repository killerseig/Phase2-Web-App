import * as admin from 'firebase-admin'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { db } from './runtime'

type ShopOrderRole = 'admin' | 'controller' | 'foreman' | 'none'
type ShopOrderStatus = 'draft' | 'submitted'

interface AuthorizedShopOrderUser {
  uid: string
  role: ShopOrderRole
  active: boolean
  assignedJobIds: string[]
  displayName: string | null
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function textOrNull(value: unknown) {
  const normalized = text(value)
  return normalized || null
}

function normalizeRole(value: unknown): ShopOrderRole {
  const role = text(value).toLowerCase()
  if (role === 'admin' || role === 'controller' || role === 'foreman') return role
  return 'none'
}

function toStatus(value: unknown): ShopOrderStatus {
  return value === 'submitted' ? 'submitted' : 'draft'
}

function toQuantity(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value >= 1 ? Math.round(value) : null
  }

  if (typeof value === 'string' && value.trim().length) {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed >= 1 ? Math.round(parsed) : null
  }

  return null
}

function makeItemId() {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function sanitizeItem(item: any) {
  return {
    id: text(item?.id) || makeItemId(),
    sourceType: text(item?.sourceType) === 'custom' ? 'custom' : 'catalog',
    catalogItemId: textOrNull(item?.catalogItemId),
    description: text(item?.description),
    quantity: toQuantity(item?.quantity),
    note: text(item?.note),
    categoryId: textOrNull(item?.categoryId),
    sku: textOrNull(item?.sku),
  }
}

function sanitizeItems(items: any[]) {
  return items.map((item) => sanitizeItem(item)).filter((item) => item.description.length > 0)
}

async function getAuthorizedUser(uid: string): Promise<AuthorizedShopOrderUser> {
  const userSnap = await db.collection('users').doc(uid).get()
  if (!userSnap.exists) {
    throw new HttpsError('failed-precondition', 'Your user profile was not found.')
  }

  const data = userSnap.data() || {}
  const role = normalizeRole(data.role)
  const active = data.active === true
  const assignedJobIds = Array.isArray(data.assignedJobIds)
    ? data.assignedJobIds
        .filter((value: unknown): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean)
    : []
  const displayName = [text(data.firstName), text(data.lastName)].filter(Boolean).join(' ') || textOrNull(data.email)

  if (!active) {
    throw new HttpsError('permission-denied', 'Your account is inactive.')
  }

  if (!['admin', 'controller', 'foreman'].includes(role)) {
    throw new HttpsError('permission-denied', 'Your account does not have access to shop orders.')
  }

  return {
    uid,
    role,
    active,
    assignedJobIds,
    displayName,
  }
}

function assertCanWriteJob(user: AuthorizedShopOrderUser, jobId: string) {
  if (user.role === 'admin' || user.role === 'controller') return
  if (user.role === 'foreman' && user.assignedJobIds.includes(jobId)) return
  throw new HttpsError('permission-denied', 'You are not assigned to this job.')
}

async function getShopOrderDoc(orderId: string) {
  const orderRef = db.collection('shopOrders').doc(orderId)
  const orderSnap = await orderRef.get()
  if (!orderSnap.exists) {
    throw new HttpsError('not-found', 'Shop order not found.')
  }

  const order = orderSnap.data() || {}
  const jobId = text(order.jobId)
  if (!jobId) {
    throw new HttpsError('failed-precondition', 'Shop order is missing its job assignment.')
  }

  return { orderRef, orderSnap, order, jobId }
}

export const createShopOrderRecordCallable = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in.')
  }

  const jobId = text(request.data?.jobId)
  if (!jobId) throw new HttpsError('invalid-argument', 'jobId is required')

  const user = await getAuthorizedUser(request.auth.uid)
  assertCanWriteJob(user, jobId)

  const created = await db.collection('shopOrders').add({
    jobId,
    jobCode: textOrNull(request.data?.jobCode),
    jobName: textOrNull(request.data?.jobName),
    deliveryDate: textOrNull(request.data?.deliveryDate),
    status: 'draft',
    comments: '',
    foremanUserId: textOrNull(request.data?.foremanUserId ?? request.auth.uid),
    foremanName: textOrNull(request.data?.foremanName ?? user.displayName),
    createdByUserId: request.auth.uid,
    updatedByUserId: request.auth.uid,
    submittedByUserId: null,
    items: [],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    submittedAt: null,
  })

  return { id: created.id }
})

export const updateShopOrderRecordCallable = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in.')
  }

  const orderId = text(request.data?.orderId)
  if (!orderId) throw new HttpsError('invalid-argument', 'orderId is required')

  const { orderRef, order, jobId } = await getShopOrderDoc(orderId)
  const user = await getAuthorizedUser(request.auth.uid)
  assertCanWriteJob(user, jobId)

  if (toStatus(order.status) === 'submitted' && user.role === 'foreman') {
    throw new HttpsError('failed-precondition', 'Submitted shop orders cannot be changed by foremen.')
  }

  const payload: Record<string, unknown> = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedByUserId: request.auth.uid,
  }

  if ('deliveryDate' in request.data) {
    payload.deliveryDate = textOrNull(request.data?.deliveryDate)
  }

  if ('comments' in request.data) {
    payload.comments = text(request.data?.comments)
  }

  if ('items' in request.data && Array.isArray(request.data?.items)) {
    payload.items = sanitizeItems(request.data.items)
  }

  if ('status' in request.data && request.data?.status) {
    const status = toStatus(request.data.status)
    payload.status = status

    if (status === 'submitted') {
      payload.submittedAt = admin.firestore.FieldValue.serverTimestamp()
      payload.submittedByUserId = textOrNull(request.data?.actor?.userId ?? request.auth.uid)
      payload.submittedByName = textOrNull(request.data?.actor?.displayName ?? user.displayName)
    }
  }

  await orderRef.update(payload)
  return { success: true }
})

export const deleteShopOrderRecordCallable = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in.')
  }

  const orderId = text(request.data?.orderId)
  if (!orderId) throw new HttpsError('invalid-argument', 'orderId is required')

  const { orderRef, order, jobId } = await getShopOrderDoc(orderId)
  const user = await getAuthorizedUser(request.auth.uid)
  assertCanWriteJob(user, jobId)

  if (toStatus(order.status) === 'submitted' && user.role === 'foreman') {
    throw new HttpsError('failed-precondition', 'Submitted shop orders cannot be deleted by foremen.')
  }

  await orderRef.delete()
  return { success: true }
})
