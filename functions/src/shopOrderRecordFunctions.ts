import {
  FieldValue,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import {
  type CurrentFunctionUser,
  buildCurrentFunctionUser,
  currentFunctionUserHasAnyRole,
} from './roleAccess'
import { canWriteFieldWorkflowForJob, type FieldWorkflowWriteAction } from './fieldWorkflowAccess'
import { getJobDetails } from './firestoreService'
import { isFunctionShopJob } from './jobIdentity'
import { db } from './runtime'

type ShopOrderStatus = 'draft' | 'submitted'

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function textOrNull(value: unknown) {
  const normalized = text(value)
  return normalized || null
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

function toPrice(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.round(value * 100) / 100
  }

  if (typeof value === 'string' && value.trim().length) {
    const parsed = Number(value.replace(/[$,]/g, ''))
    return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : null
  }

  return null
}

function makeItemId() {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

const shopOrderItemCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
})

function sanitizeItem(item: any) {
  return {
    id: text(item?.id) || makeItemId(),
    sourceType: text(item?.sourceType) === 'custom' ? 'custom' : 'catalog',
    catalogItemId: textOrNull(item?.catalogItemId),
    description: text(item?.description),
    quantity: toQuantity(item?.quantity),
    price: toPrice(item?.price),
    note: text(item?.note),
    categoryId: textOrNull(item?.categoryId),
    sku: textOrNull(item?.sku),
  }
}

function getShopOrderItemDisplayName(item: any) {
  const description = text(item?.description) || 'Untitled Item'
  if (text(item?.sourceType) !== 'catalog') return description

  return description
    .split(' / ')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .at(-1) || description
}

function sortShopOrderItems<T extends { description: string; id?: string; sourceType?: string }>(items: T[]) {
  return items.slice().sort((left, right) => {
    const displayComparison = shopOrderItemCollator.compare(
      getShopOrderItemDisplayName(left),
      getShopOrderItemDisplayName(right),
    )
    if (displayComparison !== 0) return displayComparison

    const descriptionComparison = shopOrderItemCollator.compare(text(left.description), text(right.description))
    if (descriptionComparison !== 0) return descriptionComparison

    return text(left.id).localeCompare(text(right.id))
  })
}

function sanitizeItems(items: any[]) {
  return sortShopOrderItems(items.map((item) => sanitizeItem(item)).filter((item) => item.description.length > 0))
}

async function getAuthorizedUser(uid: string): Promise<CurrentFunctionUser> {
  const userSnap = await db.collection('users').doc(uid).get()
  if (!userSnap.exists) {
    throw new HttpsError('failed-precondition', 'Your user profile was not found.')
  }

  const data = userSnap.data() || {}
  const user = buildCurrentFunctionUser(uid, data)

  if (!user.active) {
    throw new HttpsError('permission-denied', 'Your account is inactive.')
  }

  if (!currentFunctionUserHasAnyRole(user, ['admin', 'foreman', 'shop-foreman', 'project-manager'])) {
    throw new HttpsError('permission-denied', 'Your account does not have access to shop orders.')
  }

  return user
}

async function getAuthorizedReader(uid: string): Promise<CurrentFunctionUser> {
  const userSnap = await db.collection('users').doc(uid).get()
  if (!userSnap.exists) {
    throw new HttpsError('failed-precondition', 'Your user profile was not found.')
  }

  const data = userSnap.data() || {}
  const user = buildCurrentFunctionUser(uid, data)

  if (!user.active) {
    throw new HttpsError('permission-denied', 'Your account is inactive.')
  }

  if (!currentFunctionUserHasAnyRole(user, ['admin', 'foreman', 'shop-foreman', 'project-manager'])) {
    throw new HttpsError('permission-denied', 'Your account does not have access to shop orders.')
  }

  return user
}

function canReadJobShopOrders(
  user: CurrentFunctionUser,
  jobId: string,
  jobDetails: Awaited<ReturnType<typeof getJobDetails>>,
) {
  if (user.role === 'admin') return true

  const assignedJobIds = new Set(user.assignedJobIds)
  if ((jobDetails?.assignedForemanIds ?? []).includes(user.uid)) {
    assignedJobIds.add(jobId)
  }

  if (assignedJobIds.has(jobId)) return true
  return user.role === 'shop-foreman' && isFunctionShopJob(jobDetails)
}

function assertCanWriteJob(
  user: CurrentFunctionUser,
  jobId: string,
  jobDetails: Awaited<ReturnType<typeof getJobDetails>>,
  action: FieldWorkflowWriteAction,
) {
  if (canWriteFieldWorkflowForJob(user, jobId, jobDetails, action)) return
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

function serializeFirestoreValue(value: any): any {
  if (value === null || value === undefined) return value
  if (typeof value?.toDate === 'function') {
    return value.toDate().toISOString()
  }
  if (Array.isArray(value)) {
    return value.map((entry) => serializeFirestoreValue(entry))
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, serializeFirestoreValue(entry)]),
    )
  }
  return value
}

function normalizeOrderForResponse(doc: QueryDocumentSnapshot | DocumentSnapshot) {
  return {
    id: doc.id,
    ...serializeFirestoreValue(doc.data() || {}),
  }
}

function getOrderSortTimestamp(order: any) {
  const submitted = Date.parse(text(order?.submittedAt))
  if (Number.isFinite(submitted)) return submitted

  const updated = Date.parse(text(order?.updatedAt))
  if (Number.isFinite(updated)) return updated

  const created = Date.parse(text(order?.createdAt))
  return Number.isFinite(created) ? created : 0
}

function sortOrderResponses(orders: any[]) {
  return orders.slice().sort((left, right) => (
    getOrderSortTimestamp(right) - getOrderSortTimestamp(left)
    || text(right.id).localeCompare(text(left.id))
  ))
}

export const listShopOrdersForCurrentUser = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in.')
  }

  const jobId = text(request.data?.jobId)
  if (!jobId || jobId.includes('/')) {
    throw new HttpsError('invalid-argument', 'jobId is required.')
  }

  const user = await getAuthorizedReader(request.auth.uid)
  const jobDetails = await getJobDetails(jobId)
  if (!canReadJobShopOrders(user, jobId, jobDetails)) {
    throw new HttpsError('permission-denied', 'Your account does not have access to this job shop order workspace.')
  }

  const snapshot = await db.collection('shopOrders').where('jobId', '==', jobId).get()
  return {
    orders: sortOrderResponses(snapshot.docs.map(normalizeOrderForResponse)),
  }
})

export const createShopOrderRecordCallable = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in.')
  }

  const jobId = text(request.data?.jobId)
  if (!jobId) throw new HttpsError('invalid-argument', 'jobId is required')

  const user = await getAuthorizedUser(request.auth.uid)
  const jobDetails = await getJobDetails(jobId)
  assertCanWriteJob(user, jobId, jobDetails, 'create')

  const created = await db.collection('shopOrders').add({
    jobId,
    jobCode: textOrNull(request.data?.jobCode),
    jobName: textOrNull(request.data?.jobName),
    deliveryDate: textOrNull(request.data?.deliveryDate),
    status: 'draft',
    comments: '',
    foremanUserId: request.auth.uid,
    foremanName: user.displayName,
    createdByUserId: request.auth.uid,
    updatedByUserId: request.auth.uid,
    submittedByUserId: null,
    items: [],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
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
  const jobDetails = await getJobDetails(jobId)
  const writeAction: FieldWorkflowWriteAction = (
    'status' in request.data && toStatus(request.data?.status) === 'submitted'
  ) ? 'submit' : 'edit-draft'
  assertCanWriteJob(user, jobId, jobDetails, writeAction)

  if (toStatus(order.status) === 'submitted' && user.role !== 'admin') {
    throw new HttpsError('failed-precondition', 'Submitted shop orders cannot be changed by field users.')
  }

  const payload: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
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
      payload.submittedAt = FieldValue.serverTimestamp()
      payload.submittedByUserId = request.auth.uid
      payload.submittedByName = user.displayName
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
  const jobDetails = await getJobDetails(jobId)
  assertCanWriteJob(user, jobId, jobDetails, 'edit-draft')

  if (toStatus(order.status) === 'submitted' && user.role !== 'admin') {
    throw new HttpsError('failed-precondition', 'Submitted shop orders cannot be deleted by field users.')
  }

  await orderRef.delete()
  return { success: true }
})
