import { db } from '../firebase'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'

export type ShopCatalogItem = {
  id: string
  description: string
  categoryId?: string
  sku?: string
  price?: number
  active: boolean
  createdAt?: any
  updatedAt?: any
}

export type ShopCategory = {
  id: string
  name: string
  parentId: string | null
  active: boolean
  createdAt?: any
  updatedAt?: any
}

function normalize(id: string, data: any): ShopCatalogItem {
  return {
    id,
    description: data.description ?? '',
    categoryId: data.categoryId,
    sku: data.sku,
    price: data.price,
    active: data.active ?? true,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}

function normalizeCategory(id: string, data: any): ShopCategory {
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
  // This query may require an index if you keep the where+orderBy combo.
  // If Firestore asks, create index for: active ASC, description ASC
  const q = activeOnly
    ? query(collection(db, 'shopCatalog'), where('active', '==', true), orderBy('description', 'asc'))
    : query(collection(db, 'shopCatalog'), orderBy('description', 'asc'))

  const snap = await getDocs(q)
  return snap.docs.map(d => normalize(d.id, d.data()))
}

export async function createCatalogItem(description: string, categoryId?: string, sku?: string, price?: number) {
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
}

export async function updateCatalogItem(itemId: string, updates: { description?: string; sku?: string; price?: number }) {
  const ref = doc(db, 'shopCatalog', itemId)
  
  // Filter out undefined values - Firestore doesn't accept undefined
  const filteredUpdates = Object.fromEntries(
    Object.entries(updates).filter(([_, v]) => v !== undefined)
  )
  
  await updateDoc(ref, {
    ...filteredUpdates,
    updatedAt: serverTimestamp(),
  })
}

export async function setCatalogItemActive(itemId: string, active: boolean) {
  const ref = doc(db, 'shopCatalog', itemId)
  await updateDoc(ref, {
    active,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteCatalogItem(itemId: string) {
  const ref = doc(db, 'shopCatalog', itemId)
  await deleteDoc(ref)
}

/* ============= SHOP CATEGORIES ============= */

export async function getAllCategories(): Promise<ShopCategory[]> {
  const q = query(collection(db, 'shopCategories'), orderBy('name', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => normalizeCategory(d.id, d.data()))
}

export async function createCategory(name: string, parentId: string | null = null): Promise<ShopCategory> {
  const ref = await addDoc(collection(db, 'shopCategories'), {
    name: name.trim(),
    parentId: parentId || null,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  
  // Fetch the created document to get serverTimestamp values
  const snap = await getDocs(query(collection(db, 'shopCategories'), where('__name__', '==', ref.id)))
  const doc = snap.docs[0]
  return normalizeCategory(doc.id, doc.data())
}

export async function updateCategory(categoryId: string, updates: { name?: string; active?: boolean }): Promise<void> {
  const ref = doc(db, 'shopCategories', categoryId)
  await updateDoc(ref, {
    ...updates,
    updatedAt: serverTimestamp(),
  })
}

export async function archiveCategory(categoryId: string): Promise<void> {
  const ref = doc(db, 'shopCategories', categoryId)
  await updateDoc(ref, {
    active: false,
    updatedAt: serverTimestamp(),
  })
}

export async function reactivateCategory(categoryId: string): Promise<void> {
  const ref = doc(db, 'shopCategories', categoryId)
  await updateDoc(ref, {
    active: true,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteCategory(categoryId: string): Promise<void> {
  const ref = doc(db, 'shopCategories', categoryId)
  await deleteDoc(ref)
}

export const ShopCatalogService = {
  listCatalog,
  createCatalogItem,
  updateCatalogItem,
  setCatalogItemActive,
  deleteCatalogItem,
  getAllCategories,
  createCategory,
  updateCategory,
  archiveCategory,
  reactivateCategory,
  deleteCategory,
}

