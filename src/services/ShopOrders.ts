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

export type ShopOrderStatus = 'draft' | 'order' | 'receive'
const LEGACY_FOREMAN_SCOPE_KEY = 'scope:employee'

export type ShopOrderItem = {
  description: string
  quantity: number
  note?: string
  catalogItemId?: string | null
}

export type ShopOrder = {
  id: string
  jobId: string
  uid: string // Legacy scope marker kept for existing documents and indexes.
  ownerUid: string // real creator
  status: ShopOrderStatus
  orderDate?: unknown
  createdAt?: unknown
  updatedAt?: unknown
  items: ShopOrderItem[]
}

type ShopOrderSnapshotHandlers = {
  onUpdate: (orders: ShopOrder[]) => void
  onError?: (error: Error) => void
}

function normalize(id: string, data: DocumentData): ShopOrder {
  return {
    id,
    jobId: data.jobId,
    uid: data.uid,
    ownerUid: data.ownerUid ?? '',
    status: (data.status ?? 'draft') as ShopOrderStatus,
    orderDate: data.orderDate,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    items: Array.isArray(data.items) ? data.items : [],
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
 * Update shop order items
 */
export async function updateShopOrderItems(
  jobId: string,
  orderId: string,
  items: ShopOrderItem[]
) {
  try {
    assertJobAccess(jobId)
    requireUser()
    const ref = doc(db, ...jobDocumentPath(jobId, 'shop_orders', orderId))

    await updateDoc(ref, {
      items,
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to update shop order items'))
  }
}

/**
 * Update shop order status
 */
export async function updateShopOrderStatus(
  jobId: string,
  orderId: string,
  status: ShopOrderStatus
) {
  try {
    assertJobAccess(jobId)
    requireUser()
    const ref = doc(db, ...jobDocumentPath(jobId, 'shop_orders', orderId))

    await updateDoc(ref, {
      status,
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to update shop order status'))
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
