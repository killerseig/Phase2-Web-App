import {
  collection,
  onSnapshot,
  query,
  where,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { requireFirebaseServices } from '@/firebase'
import type { ShopOrderItemRecord, ShopOrderRecord, ShopOrderStatus } from '@/types/domain'
import { normalizeError } from '@/utils/normalizeError'

export interface CreateShopOrderInput {
  jobId: string
  jobCode: string | null
  jobName: string | null
  foremanUserId: string | null
  foremanName: string | null
  deliveryDate: string | null
}

export interface ShopOrderUpdateInput {
  deliveryDate?: string | null
  comments?: string
  items?: ShopOrderItemRecord[]
  status?: ShopOrderStatus
}

export interface ShopOrderActor {
  userId: string | null
  displayName: string | null
}

function toNullableText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length ? value.trim() : null
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
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function sanitizeShopOrderItem(item: ShopOrderItemRecord): ShopOrderItemRecord {
  return {
    id: item.id?.trim() || makeItemId(),
    sourceType: item.sourceType === 'custom' ? 'custom' : 'catalog',
    catalogItemId: toNullableText(item.catalogItemId),
    description: item.description.trim(),
    quantity: toQuantity(item.quantity),
    note: item.note.trim(),
    categoryId: toNullableText(item.categoryId),
    sku: toNullableText(item.sku),
  }
}

function sanitizeShopOrderItems(items: ShopOrderItemRecord[]) {
  return items
    .map((item) => sanitizeShopOrderItem(item))
    .filter((item) => item.description.length > 0)
}

function normalizeShopOrderItem(data: Record<string, unknown>): ShopOrderItemRecord {
  return {
    id: typeof data.id === 'string' && data.id.trim().length ? data.id : makeItemId(),
    sourceType: data.sourceType === 'custom' ? 'custom' : 'catalog',
    catalogItemId: toNullableText(data.catalogItemId),
    description: typeof data.description === 'string' ? data.description.trim() : '',
    quantity: toQuantity(data.quantity),
    note: typeof data.note === 'string' ? data.note.trim() : '',
    categoryId: toNullableText(data.categoryId),
    sku: toNullableText(data.sku),
  }
}

function toMillis(value: unknown): number {
  if (typeof (value as { toMillis?: () => number })?.toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis()
  }

  if (typeof (value as { toDate?: () => Date })?.toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().getTime()
  }

  if (value instanceof Date) {
    return value.getTime()
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value).getTime()
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function normalizeShopOrder(id: string, data: DocumentData): ShopOrderRecord {
  const rawItems = Array.isArray(data.items) ? data.items : []

  return {
    id,
    jobId: typeof data.jobId === 'string' ? data.jobId : '',
    jobCode: toNullableText(data.jobCode),
    jobName: toNullableText(data.jobName),
    deliveryDate: toNullableText(data.deliveryDate),
    status: data.status === 'submitted' ? 'submitted' : 'draft',
    comments: typeof data.comments === 'string' ? data.comments.trim() : '',
    foremanUserId: toNullableText(data.foremanUserId),
    foremanName: toNullableText(data.foremanName),
    items: rawItems
      .map((item) => (item && typeof item === 'object' ? normalizeShopOrderItem(item as Record<string, unknown>) : null))
      .filter((item): item is ShopOrderItemRecord => item !== null && item.description.length > 0),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    submittedAt: data.submittedAt,
  }
}

function getOrderSortTimestamp(order: ShopOrderRecord) {
  return toMillis(order.submittedAt) || toMillis(order.updatedAt) || toMillis(order.createdAt)
}

function sortOrders(orders: ShopOrderRecord[]) {
  return orders
    .slice()
    .sort((left, right) => {
      const rightTimestamp = getOrderSortTimestamp(right)
      const leftTimestamp = getOrderSortTimestamp(left)
      if (rightTimestamp !== leftTimestamp) return rightTimestamp - leftTimestamp

      return right.id.localeCompare(left.id)
    })
}

export function subscribeShopOrders(
  jobId: string,
  onUpdate: (orders: ShopOrderRecord[]) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  const { db } = requireFirebaseServices()

  return onSnapshot(
    query(collection(db, 'shopOrders'), where('jobId', '==', jobId)),
    (snapshot) => {
      onUpdate(sortOrders(snapshot.docs.map((item) => normalizeShopOrder(item.id, item.data()))))
    },
    (error) => {
      onError?.(error)
    },
  )
}

export async function createShopOrderRecord(input: CreateShopOrderInput): Promise<string> {
  try {
    const { functions } = requireFirebaseServices()
    const callable = httpsCallable<CreateShopOrderInput, { id: string }>(
      functions,
      'createShopOrderRecordCallable',
    )

    const result = await callable(input)
    const id = String(result.data?.id || '').trim()
    if (!id) {
      throw new Error('Shop order did not return an id.')
    }

    return id
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to create shop order.'))
  }
}

export async function updateShopOrderRecord(
  orderId: string,
  input: ShopOrderUpdateInput,
  actor?: ShopOrderActor,
): Promise<void> {
  try {
    const { functions } = requireFirebaseServices()
    const callable = httpsCallable<
      {
        orderId: string
        deliveryDate?: string | null
        comments?: string
        items?: ShopOrderItemRecord[]
        status?: ShopOrderStatus
        actor?: ShopOrderActor
      },
      { success: boolean }
    >(functions, 'updateShopOrderRecordCallable')

    await callable({
      orderId,
      ...('deliveryDate' in input ? { deliveryDate: input.deliveryDate } : {}),
      ...('comments' in input ? { comments: input.comments } : {}),
      ...('items' in input && input.items ? { items: sanitizeShopOrderItems(input.items) } : {}),
      ...('status' in input && input.status ? { status: input.status } : {}),
      ...(actor ? { actor } : {}),
    })
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to update shop order.'))
  }
}

export async function deleteShopOrderRecord(orderId: string): Promise<void> {
  try {
    const { functions } = requireFirebaseServices()
    const callable = httpsCallable<{ orderId: string }, { success: boolean }>(
      functions,
      'deleteShopOrderRecordCallable',
    )
    await callable({ orderId })
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to delete shop order.'))
  }
}

export async function sendShopOrderSubmissionEmail(jobId: string, shopOrderId: string): Promise<void> {
  try {
    const { functions } = requireFirebaseServices()
    const callable = httpsCallable<
      { jobId: string; shopOrderId: string },
      { success: boolean; message?: string }
    >(functions, 'sendShopOrderEmail')

    await callable({ jobId, shopOrderId })
  } catch (error) {
    throw new Error(normalizeError(error, 'Shop order was submitted, but the email could not be sent.'))
  }
}
