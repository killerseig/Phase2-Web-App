import { auth, db } from '../firebase'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { useJobAccess } from '@/composables/useJobAccess'

export type ShopOrderStatus = 'draft' | 'order' | 'receive'

export type ShopOrderItem = {
  description: string
  quantity: number
  note?: string
  catalogItemId?: string | null
}

export type ShopOrder = {
  id: string
  jobId: string
  uid: string // scope key: 'scope:employee', 'scope:shop', 'scope:admin'
  ownerUid: string // real creator
  status: ShopOrderStatus
  orderDate?: any
  createdAt?: any
  updatedAt?: any
  items: ShopOrderItem[]
}

function requireUser() {
  const u = auth.currentUser
  if (!u) throw new Error('Not signed in')
  return u
}

const jobAccess = useJobAccess()

const assertJobAccess = (jobId: string) => {
  if (!jobAccess.canAccessJob(jobId)) {
    throw new Error('You do not have access to this job')
  }
}

function normalize(id: string, data: any): ShopOrder {
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
 * List all shop orders for a job that the user has access to
 * Requires indexes for each scope:
 * - jobId + uid ('scope:employee') + orderDate DESC
 * - jobId + uid ('scope:shop') + orderDate DESC
 * - jobId + uid ('scope:admin') + orderDate DESC
 */
export async function listShopOrders(
  jobId: string,
  scopes: string[] = ['scope:employee'],
  max = 25
): Promise<ShopOrder[]> {
  assertJobAccess(jobId)
  requireUser()

  const docMap = new Map<string, ShopOrder>()

  for (const scope of scopes) {
    const q = query(
      collection(db, 'jobs', jobId, 'shop_orders'),
      where('uid', '==', scope),
      orderBy('orderDate', 'desc'),
      limit(max)
    )

    const snap = await getDocs(q)
    for (const d of snap.docs) {
      const order = normalize(d.id, d.data())
      docMap.set(d.id, order)
    }
  }

  return Array.from(docMap.values()).sort((a, b) => {
    const ta = a.orderDate?.toMillis ? a.orderDate.toMillis() : 0
    const tb = b.orderDate?.toMillis ? b.orderDate.toMillis() : 0
    return tb - ta
  })
}

/**
 * Create a new draft shop order with a scope key (uid)
 */
export async function createShopOrder(jobId: string, scopeKey: string) {
  assertJobAccess(jobId)
  const u = requireUser()

  // Firebase's addDoc automatically generates a unique document ID
  // No redundancy checking needed - Firestore ensures uniqueness at the database level
  const ref = await addDoc(collection(db, 'jobs', jobId, 'shop_orders'), {
    jobId,
    uid: scopeKey, // visibility scope
    ownerUid: u.uid, // real creator
    status: 'draft',
    items: [],
    orderDate: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return ref.id
}

/**
 * Update shop order items
 */
export async function updateShopOrderItems(
  jobId: string,
  orderId: string,
  items: ShopOrderItem[]
) {
  assertJobAccess(jobId)
  requireUser()
  const ref = doc(db, 'jobs', jobId, 'shop_orders', orderId)

  await updateDoc(ref, {
    items,
    updatedAt: serverTimestamp(),
  })
}

/**
 * Update shop order status
 */
export async function updateShopOrderStatus(
  jobId: string,
  orderId: string,
  status: ShopOrderStatus
) {
  assertJobAccess(jobId)
  requireUser()
  const ref = doc(db, 'jobs', jobId, 'shop_orders', orderId)

  await updateDoc(ref, {
    status,
    updatedAt: serverTimestamp(),
  })
}

/**
 * Update shop order scope (uid)
 */
export async function updateShopOrderScope(
  jobId: string,
  orderId: string,
  scopeKey: string
) {
  assertJobAccess(jobId)
  requireUser()
  const ref = doc(db, 'jobs', jobId, 'shop_orders', orderId)

  await updateDoc(ref, {
    uid: scopeKey,
    updatedAt: serverTimestamp(),
  })
}
