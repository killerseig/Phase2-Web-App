import { db } from '../firebase'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
  type DocumentData,
} from 'firebase/firestore'
import { normalizeError } from './serviceUtils'

export type ShopCatalogItem = {
  id: string
  description: string
  categoryId?: string
  sku?: string
  price?: number
  active: boolean
  createdAt?: unknown
  updatedAt?: unknown
}

export type ShopCategory = {
  id: string
  name: string
  parentId: string | null
  active: boolean
  createdAt?: unknown
  updatedAt?: unknown
}

function normalize(id: string, data: DocumentData): ShopCatalogItem {
  return {
    id,
    description: data.description ?? '',
    categoryId: typeof data.categoryId === 'string' ? data.categoryId : undefined,
    sku: typeof data.sku === 'string' ? data.sku : undefined,
    price: typeof data.price === 'number' ? data.price : undefined,
    active: data.active ?? true,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}

function normalizeCategory(id: string, data: DocumentData): ShopCategory {
  return {
    id,
    name: data.name ?? '',
    parentId: data.parentId ?? null,
    active: data.active ?? true,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}

export async function listCatalog(activeOnly = true): Promise<ShopCatalogItem[]> {
  try {
    const q = buildCatalogQuery(activeOnly)

    const snap = await getDocs(q)
    return sortCatalogItemsByDescription(snap.docs.map((d) => normalize(d.id, d.data())))
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to load catalog'))
  }
}

export function subscribeCatalog(
  activeOnly: boolean,
  onUpdate: (items: ShopCatalogItem[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  return onSnapshot(
    buildCatalogQuery(activeOnly),
    (snap) => {
      onUpdate(sortCatalogItemsByDescription(snap.docs.map((d) => normalize(d.id, d.data()))))
    },
    (err) => {
      onError?.(err)
    }
  )
}

export async function createCatalogItem(description: string, categoryId?: string, sku?: string, price?: number) {
  try {
    const ref = await addDoc(collection(db, 'shopCatalog'), {
      description: description.trim(),
      categoryId: categoryId || null,
      sku: sku?.trim() || null,
      price: price ?? null,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return ref.id
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to create catalog item'))
  }
}

export async function updateCatalogItem(
  itemId: string,
  updates: { description?: string; sku?: string | null; price?: number | null }
) {
  try {
    const ref = doc(db, 'shopCatalog', itemId)
    
    // Filter out undefined values - Firestore doesn't accept undefined
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    )
    
    await updateDoc(ref, {
      ...filteredUpdates,
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to update catalog item'))
  }
}

export async function setCatalogItemActive(itemId: string, active: boolean) {
  try {
    const ref = doc(db, 'shopCatalog', itemId)
    await updateDoc(ref, {
      active,
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to update catalog item'))
  }
}

export async function deleteCatalogItem(itemId: string) {
  try {
    const ref = doc(db, 'shopCatalog', itemId)
    await deleteDoc(ref)
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to delete catalog item'))
  }
}

/* ============= SHOP CATEGORIES ============= */

export async function getAllCategories(): Promise<ShopCategory[]> {
  try {
    const q = query(collection(db, 'shopCategories'))
    const snap = await getDocs(q)
    return sortCategoriesByName(snap.docs.map((d) => normalizeCategory(d.id, d.data())))
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to load categories'))
  }
}

export function subscribeCategories(
  onUpdate: (categories: ShopCategory[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  const q = query(collection(db, 'shopCategories'))
  return onSnapshot(
    q,
    (snap) => {
      onUpdate(sortCategoriesByName(snap.docs.map((d) => normalizeCategory(d.id, d.data()))))
    },
    (err) => {
      onError?.(err)
    }
  )
}

export async function createCategory(name: string, parentId: string | null = null): Promise<ShopCategory> {
  try {
    const ref = await addDoc(collection(db, 'shopCategories'), {
      name: name.trim(),
      parentId: parentId || null,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    
    // Fetch the created document to get serverTimestamp values
    const snap = await getDocs(query(collection(db, 'shopCategories'), where('__name__', '==', ref.id)))
    const createdDoc = snap.docs[0]
    if (!createdDoc) {
      throw new Error('Failed to load created category')
    }
    return normalizeCategory(createdDoc.id, createdDoc.data())
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to create category'))
  }
}

function sortCatalogItemsByDescription(items: ShopCatalogItem[]): ShopCatalogItem[] {
  return items.slice().sort((a, b) => a.description.localeCompare(b.description))
}

function sortCategoriesByName(categories: ShopCategory[]): ShopCategory[] {
  return categories.slice().sort((a, b) => a.name.localeCompare(b.name))
}

function buildCatalogQuery(activeOnly: boolean) {
  if (activeOnly) {
    return query(collection(db, 'shopCatalog'), where('active', '==', true))
  }
  return query(collection(db, 'shopCatalog'))
}

export async function updateCategory(categoryId: string, updates: { name?: string; active?: boolean }): Promise<void> {
  try {
    const ref = doc(db, 'shopCategories', categoryId)
    await updateDoc(ref, {
      ...updates,
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to update category'))
  }
}

export async function archiveCategory(categoryId: string): Promise<void> {
  try {
    const ref = doc(db, 'shopCategories', categoryId)
    await updateDoc(ref, {
      active: false,
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to archive category'))
  }
}

export async function reactivateCategory(categoryId: string): Promise<void> {
  try {
    const ref = doc(db, 'shopCategories', categoryId)
    await updateDoc(ref, {
      active: true,
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to reactivate category'))
  }
}

export async function deleteCategory(categoryId: string): Promise<void> {
  try {
    const ref = doc(db, 'shopCategories', categoryId)
    await deleteDoc(ref)
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to delete category'))
  }
}

export const ShopCatalogService = {
  listCatalog,
  subscribeCatalog,
  createCatalogItem,
  updateCatalogItem,
  setCatalogItemActive,
  deleteCatalogItem,
  getAllCategories,
  subscribeCategories,
  createCategory,
  updateCategory,
  archiveCategory,
  reactivateCategory,
  deleteCategory,
}

