import { db } from '@/firebase'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore'
import { assertJobAccess, requireUser } from './serviceGuards'
import { jobCollectionPath, jobDocumentPath } from './servicePaths'
import { normalizeError } from './serviceUtils'
import {
  deriveShopOrderStatus,
  normalizeShopOrderRequestedDeliveryDate,
  sanitizeShopOrderItems,
} from '@/utils/shopOrderItems'

export type ShopOrderStatus = 'draft' | 'submitted' | 'partial' | 'backordered' | 'received'
const LEGACY_FOREMAN_SCOPE_KEY = 'scope:employee'

export type ShopOrderItem = {
  description: string
  quantity: number
  note?: string
  catalogItemId?: string | null
  costCode?: string | null
  receivedQuantity?: number
  backorderedQuantity?: number
}

export type ShopOrder = {
  id: string
  jobId: string
  uid: string // Legacy scope marker kept for existing documents and indexes.
  ownerUid: string // real creator
  status: ShopOrderStatus
  orderNumber?: string | null
  orderDate?: unknown
  createdAt?: unknown
  updatedAt?: unknown
  requestedDeliveryDate?: string | null
  items: ShopOrderItem[]
}

type ShopOrderUpdate = {
  items?: ShopOrderItem[]
  status?: ShopOrderStatus
  requestedDeliveryDate?: string | null
}

type ShopOrderSnapshotHandlers = {
  onUpdate: (orders: ShopOrder[]) => void
  onError?: (error: Error) => void
}

function normalizeShopOrderNumber(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value))
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length ? trimmed : null
  }

  return null
}

function buildTimestampShopOrderNumber(value: unknown): string | null {
  if (!value) return null

  const dateValue = typeof (value as { toDate?: () => Date })?.toDate === 'function'
    ? (value as { toDate: () => Date }).toDate()
    : value instanceof Date
      ? value
      : new Date(value as string | number)

  if (Number.isNaN(dateValue.getTime())) return null

  return [
    dateValue.getUTCFullYear(),
    String(dateValue.getUTCMonth() + 1).padStart(2, '0'),
    String(dateValue.getUTCDate()).padStart(2, '0'),
    String(dateValue.getUTCHours()).padStart(2, '0'),
    String(dateValue.getUTCMinutes()).padStart(2, '0'),
    String(dateValue.getUTCSeconds()).padStart(2, '0'),
  ].join('')
}

export function createShopOrderNumber(date = new Date()): string {
  return buildTimestampShopOrderNumber(date) ?? String(Date.now())
}

export function getShopOrderDisplayNumber(
  order: Pick<ShopOrder, 'orderNumber' | 'orderDate' | 'createdAt' | 'updatedAt'>
): string {
  return (
    normalizeShopOrderNumber(order.orderNumber)
    ?? buildTimestampShopOrderNumber(order.orderDate)
    ?? buildTimestampShopOrderNumber(order.createdAt)
    ?? buildTimestampShopOrderNumber(order.updatedAt)
    ?? 'Unnumbered'
  )
}

function normalizeShopOrderStatusValue(
  status: unknown,
  items: ShopOrderItem[],
): ShopOrderStatus {
  const rawStatus = String(status ?? '').trim().toLowerCase()

  if (!rawStatus || rawStatus === 'draft') return 'draft'
  if (rawStatus === 'receive' || rawStatus === 'received') return 'received'

  const fallbackStatus: Exclude<ShopOrderStatus, 'draft'> =
    rawStatus === 'partial'
      ? 'partial'
      : rawStatus === 'backordered'
        ? 'backordered'
        : 'submitted'

  return deriveShopOrderStatus(items, fallbackStatus)
}

function normalize(id: string, data: DocumentData): ShopOrder {
  const items = sanitizeShopOrderItems(Array.isArray(data.items) ? data.items : [])

  return {
    id,
    jobId: data.jobId,
    uid: data.uid,
    ownerUid: data.ownerUid ?? '',
    status: normalizeShopOrderStatusValue(data.status, items),
    orderNumber: normalizeShopOrderNumber(data.orderNumber),
    orderDate: data.orderDate,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    requestedDeliveryDate: normalizeShopOrderRequestedDeliveryDate(data.requestedDeliveryDate) ?? null,
    items,
  }
}

/**
 * Create a new draft shop order.
 * The legacy uid field is still written for compatibility with existing data.
 */
export async function createShopOrder(jobId: string) {
  try {
    assertJobAccess(jobId)
    const u = requireUser()

    // Firebase's addDoc automatically generates a unique document ID
    // No redundancy checking needed - Firestore ensures uniqueness at the database level
    const ref = await addDoc(collection(db, ...jobCollectionPath(jobId, 'shop_orders')), {
      jobId,
      uid: LEGACY_FOREMAN_SCOPE_KEY,
      ownerUid: u.uid, // real creator
      status: 'draft',
      orderNumber: createShopOrderNumber(),
      requestedDeliveryDate: null,
      items: [],
      orderDate: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    return ref.id
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to create shop order'))
  }
}

export function subscribeShopOrders(
  jobId: string,
  handlers: ShopOrderSnapshotHandlers
): Unsubscribe {
  assertJobAccess(jobId)
  requireUser()

  const q = query(collection(db, ...jobCollectionPath(jobId, 'shop_orders')), orderBy('orderDate', 'desc'))
  return onSnapshot(
    q,
    (snap) => {
      const orders = snap.docs.map((item) => normalize(item.id, item.data()))
      handlers.onUpdate(orders)
    },
    (err) => {
      handlers.onError?.(new Error(normalizeError(err, 'Failed to subscribe to shop orders')))
    }
  )
}

/**
 * Update shop order fields
 */
export async function updateShopOrderDetails(
  jobId: string,
  orderId: string,
  updates: ShopOrderUpdate,
) {
  try {
    assertJobAccess(jobId)
    requireUser()
    const ref = doc(db, ...jobDocumentPath(jobId, 'shop_orders', orderId))
    const payload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    }

    if ('items' in updates) {
      payload.items = sanitizeShopOrderItems(updates.items ?? [])
    }

    if ('status' in updates && updates.status) {
      payload.status = updates.status
    }

    if ('requestedDeliveryDate' in updates) {
      payload.requestedDeliveryDate = normalizeShopOrderRequestedDeliveryDate(
        updates.requestedDeliveryDate ?? null,
      ) ?? null
    }

    await updateDoc(ref, payload)
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to update shop order'))
  }
}

/**
 * Update shop order items
 */
export async function updateShopOrderItems(
  jobId: string,
  orderId: string,
  items: ShopOrderItem[],
  updates: Omit<ShopOrderUpdate, 'items'> = {},
) {
  await updateShopOrderDetails(jobId, orderId, {
    ...updates,
    items,
  })
}

/**
 * Update shop order status
 */
export async function updateShopOrderStatus(
  jobId: string,
  orderId: string,
  status: ShopOrderStatus,
) {
  await updateShopOrderDetails(jobId, orderId, { status })
}

export async function updateShopOrderRequestedDeliveryDate(
  jobId: string,
  orderId: string,
  requestedDeliveryDate: string | null,
) {
  try {
    await updateShopOrderDetails(jobId, orderId, { requestedDeliveryDate })
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to update requested delivery date'))
  }
}

export async function deleteShopOrder(jobId: string, orderId: string) {
  try {
    assertJobAccess(jobId)
    requireUser()
    const ref = doc(db, ...jobDocumentPath(jobId, 'shop_orders', orderId))
    await deleteDoc(ref)
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to delete shop order'))
  }
}
