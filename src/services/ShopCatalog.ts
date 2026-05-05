import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore'
import { requireFirebaseServices } from '@/firebase'
import type { ShopCatalogItemRecord, ShopCategoryRecord } from '@/types/domain'
import { normalizeError } from '@/utils/normalizeError'

export interface CreateCategoryInput {
  name: string
  parentId: string | null
  active: boolean
}

export interface UpdateCategoryInput {
  name: string
  parentId: string | null
  active: boolean
}

export interface CreateCatalogItemInput {
  description: string
  categoryId: string | null
  sku: string | null
  price: number | null
  active: boolean
}

export interface UpdateCatalogItemInput {
  description: string
  categoryId: string | null
  sku: string | null
  price: number | null
  active: boolean
}

function normalizePrice(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function normalizeCategory(id: string, data: DocumentData): ShopCategoryRecord {
  return {
    id,
    name: typeof data.name === 'string' ? data.name : '',
    parentId: typeof data.parentId === 'string' && data.parentId.trim().length ? data.parentId : null,
    active: data.active !== false,
  }
}

function normalizeItem(id: string, data: DocumentData): ShopCatalogItemRecord {
  return {
    id,
    description: typeof data.description === 'string' ? data.description : '',
    categoryId: typeof data.categoryId === 'string' && data.categoryId.trim().length ? data.categoryId : null,
    sku: typeof data.sku === 'string' && data.sku.trim().length ? data.sku : null,
    price: normalizePrice(data.price),
    active: data.active !== false,
  }
}

function sortCategories(categories: ShopCategoryRecord[]) {
  return categories.slice().sort((left, right) => left.name.localeCompare(right.name))
}

function sortItems(items: ShopCatalogItemRecord[]) {
  return items.slice().sort((left, right) => left.description.localeCompare(right.description))
}

export function subscribeShopCategories(
  onUpdate: (categories: ShopCategoryRecord[]) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  const { db } = requireFirebaseServices()

  return onSnapshot(
    query(collection(db, 'shopCategories')),
    (snapshot) => {
      onUpdate(sortCategories(snapshot.docs.map((item) => normalizeCategory(item.id, item.data()))))
    },
    (error) => {
      onError?.(error)
    },
  )
}

export function subscribeShopCatalogItems(
  onUpdate: (items: ShopCatalogItemRecord[]) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  const { db } = requireFirebaseServices()

  return onSnapshot(
    query(collection(db, 'shopCatalog')),
    (snapshot) => {
      onUpdate(sortItems(snapshot.docs.map((item) => normalizeItem(item.id, item.data()))))
    },
    (error) => {
      onError?.(error)
    },
  )
}

export async function createShopCategory(input: CreateCategoryInput): Promise<string> {
  try {
    const { db } = requireFirebaseServices()
    const reference = await addDoc(collection(db, 'shopCategories'), {
      name: input.name.trim(),
      parentId: input.parentId,
      active: input.active,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    return reference.id
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to create folder.'))
  }
}

export async function updateShopCategory(categoryId: string, input: UpdateCategoryInput): Promise<void> {
  try {
    const { db } = requireFirebaseServices()
    await updateDoc(doc(db, 'shopCategories', categoryId), {
      name: input.name.trim(),
      parentId: input.parentId,
      active: input.active,
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to update folder.'))
  }
}

export async function deleteShopCategory(categoryId: string): Promise<void> {
  try {
    const { db } = requireFirebaseServices()
    await deleteDoc(doc(db, 'shopCategories', categoryId))
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to delete folder.'))
  }
}

export async function createShopCatalogItem(input: CreateCatalogItemInput): Promise<string> {
  try {
    const { db } = requireFirebaseServices()
    const reference = await addDoc(collection(db, 'shopCatalog'), {
      description: input.description.trim(),
      categoryId: input.categoryId,
      sku: input.sku,
      price: input.price,
      active: input.active,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    return reference.id
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to create catalog item.'))
  }
}

export async function updateShopCatalogItem(itemId: string, input: UpdateCatalogItemInput): Promise<void> {
  try {
    const { db } = requireFirebaseServices()
    await updateDoc(doc(db, 'shopCatalog', itemId), {
      description: input.description.trim(),
      categoryId: input.categoryId,
      sku: input.sku,
      price: input.price,
      active: input.active,
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to update catalog item.'))
  }
}

export async function deleteShopCatalogItem(itemId: string): Promise<void> {
  try {
    const { db } = requireFirebaseServices()
    await deleteDoc(doc(db, 'shopCatalog', itemId))
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to delete catalog item.'))
  }
}
