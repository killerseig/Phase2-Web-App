import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref } from 'vue'

export interface ShopCategory {
  id: string
  name: string
  parentId: string | null
  sku?: string
  price?: number
  active: boolean
  createdAt?: unknown
  updatedAt?: unknown
}

export interface CategoryNode extends ShopCategory {
  children: CategoryNode[]
}

import {
  archiveCategory as archiveCategoryService,
  createCategory as createCategoryService,
  deleteCategory as deleteCategoryService,
  getAllCategories,
  reactivateCategory as reactivateCategoryService,
  subscribeCategories as subscribeCategoriesService,
  updateCategory as updateCategoryService,
} from '@/services'
import { normalizeError } from '@/services/serviceUtils'
import { logError } from '@/utils'

const MAX_TREE_DEPTH = 100

function cloneCategory(category: ShopCategory): ShopCategory {
  return { ...category }
}

function sortCategories(categories: ShopCategory[]): ShopCategory[] {
  return categories.slice().sort((a, b) => a.name.localeCompare(b.name))
}

function categoriesMatch(serverCategory: ShopCategory, pendingCategory: ShopCategory): boolean {
  return (
    serverCategory.name === pendingCategory.name &&
    (serverCategory.parentId ?? null) === (pendingCategory.parentId ?? null) &&
    (serverCategory.sku ?? null) === (pendingCategory.sku ?? null) &&
    (serverCategory.price ?? null) === (pendingCategory.price ?? null) &&
    (serverCategory.active ?? true) === (pendingCategory.active ?? true)
  )
}

function createTempCategoryId(): string {
  return `temp-category-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export const useShopCategoriesStore = defineStore('shopCategories', () => {
  const categories = ref<ShopCategory[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const serverCategories = ref<ShopCategory[]>([])
  let unsubscribeCategories: (() => void) | null = null
  const pendingDeletedCategoryIds = new Set<string>()
  const pendingUpsertCategories = new Map<string, ShopCategory>()

  const setStoreError = (err: unknown, fallback: string) => {
    error.value = normalizeError(err, fallback)
  }

  const ensureServerStateInitialized = () => {
    if (!serverCategories.value.length && categories.value.length) {
      serverCategories.value = sortCategories(categories.value.map(cloneCategory))
    }
  }

  const applyCategoryState = () => {
    const visibleServerCategories = sortCategories(
      serverCategories.value
        .filter((category) => !pendingDeletedCategoryIds.has(category.id))
        .map(cloneCategory)
    )
    const serverCategoriesById = new Map(visibleServerCategories.map((category) => [category.id, category] as const))

    for (const [categoryId, pendingCategory] of Array.from(pendingUpsertCategories.entries())) {
      const serverCategory = serverCategoriesById.get(categoryId)
      if (serverCategory && categoriesMatch(serverCategory, pendingCategory)) {
        pendingUpsertCategories.delete(categoryId)
      }
    }

    const mergedCategories = visibleServerCategories.map((category) =>
      cloneCategory(pendingUpsertCategories.get(category.id) ?? category)
    )
    const mergedIds = new Set(mergedCategories.map((category) => category.id))

    for (const [categoryId, pendingCategory] of pendingUpsertCategories.entries()) {
      if (!mergedIds.has(categoryId) && !pendingDeletedCategoryIds.has(categoryId)) {
        mergedCategories.push(cloneCategory(pendingCategory))
      }
    }

    categories.value = sortCategories(mergedCategories)
  }

  const applyCategorySnapshot = (nextCategories: ShopCategory[]) => {
    serverCategories.value = sortCategories(nextCategories.map(cloneCategory))
    const snapshotIds = new Set(serverCategories.value.map((category) => category.id))

    for (const categoryId of Array.from(pendingDeletedCategoryIds)) {
      if (!snapshotIds.has(categoryId)) {
        pendingDeletedCategoryIds.delete(categoryId)
      }
    }

    applyCategoryState()
  }

  const withOptimisticCategory = (categoryId: string, nextCategory: ShopCategory) => {
    const previousPending = pendingUpsertCategories.get(categoryId)
    pendingUpsertCategories.set(categoryId, cloneCategory(nextCategory))
    applyCategoryState()

    return {
      rollback() {
        if (previousPending) {
          pendingUpsertCategories.set(categoryId, previousPending)
        } else {
          pendingUpsertCategories.delete(categoryId)
        }
        applyCategoryState()
      },
    }
  }

  const stopCategoriesSubscription = () => {
    if (!unsubscribeCategories) return
    unsubscribeCategories()
    unsubscribeCategories = null
  }

  const beginOptimisticDelete = (categoryIds: string[]) => {
    ensureServerStateInitialized()
    const deleteIds = new Set(categoryIds)
    const previousPendingCategories = new Map<string, ShopCategory>()

    deleteIds.forEach((categoryId) => {
      const pendingCategory = pendingUpsertCategories.get(categoryId)
      if (pendingCategory) {
        previousPendingCategories.set(categoryId, pendingCategory)
        pendingUpsertCategories.delete(categoryId)
      }
      pendingDeletedCategoryIds.add(categoryId)
    })

    applyCategoryState()

    return {
      rollback() {
        deleteIds.forEach((categoryId) => pendingDeletedCategoryIds.delete(categoryId))
        previousPendingCategories.forEach((category, categoryId) =>
          pendingUpsertCategories.set(categoryId, category)
        )
        applyCategoryState()
      },
      commit() {
        applyCategoryState()
      },
    }
  }

  function buildCategoryTree(
    items: ShopCategory[],
    parentId: string | null = null,
    seen = new Set<string>(),
    depth = 0,
  ): CategoryNode[] {
    if (depth > MAX_TREE_DEPTH) return []

    return items
      .filter((category) => category.parentId === parentId)
      .map((category) => {
        if (seen.has(category.id)) {
          return { ...category, children: [] as CategoryNode[] }
        }
        const nextSeen = new Set(seen)
        nextSeen.add(category.id)
        return {
          ...category,
          children: buildCategoryTree(items, category.id, nextSeen, depth + 1),
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  const activeTree = computed(() => buildCategoryTree(categories.value.filter((category) => category.active)))
  const fullTree = computed(() => buildCategoryTree(categories.value))

  function getCategoryById(id: string): ShopCategory | undefined {
    return categories.value.find((category) => category.id === id)
  }

  function getChildren(parentId: string | null = null): ShopCategory[] {
    return categories.value
      .filter((category) => category.parentId === parentId)
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  function hasChildren(categoryId: string): boolean {
    return categories.value.some((category) => category.parentId === categoryId)
  }

  function getDescendants(categoryId: string, seen = new Set<string>(), depth = 0): ShopCategory[] {
    if (depth > MAX_TREE_DEPTH) return []
    if (seen.has(categoryId)) return []

    const nextSeen = new Set(seen)
    nextSeen.add(categoryId)

    const direct = categories.value.filter((category) => category.parentId === categoryId)
    return [...direct, ...direct.flatMap((child) => getDescendants(child.id, nextSeen, depth + 1))]
  }

  function getBreadcrumb(categoryId: string): ShopCategory[] {
    const path: ShopCategory[] = []
    const seen = new Set<string>()
    let current = getCategoryById(categoryId)
    let depth = 0

    while (current && depth <= MAX_TREE_DEPTH) {
      if (seen.has(current.id)) break
      seen.add(current.id)
      path.unshift(current)
      current = current.parentId ? getCategoryById(current.parentId) : undefined
      depth += 1
    }

    return path
  }

  async function fetchAllCategories() {
    isLoading.value = true
    error.value = null
    try {
      applyCategorySnapshot(await getAllCategories())
    } catch (err) {
      setStoreError(err, 'Failed to fetch categories')
      logError('ShopCategories Store', error.value || 'Failed to fetch categories', err)
    } finally {
      isLoading.value = false
    }
  }

  function subscribeAllCategories() {
    stopCategoriesSubscription()
    isLoading.value = true
    error.value = null

    unsubscribeCategories = subscribeCategoriesService(
      (nextCategories) => {
        applyCategorySnapshot(nextCategories)
        isLoading.value = false
      },
      (err) => {
        setStoreError(err, 'Failed to subscribe to categories')
        isLoading.value = false
        logError('ShopCategories Store', 'subscribeAllCategories failed', err)
      }
    )
  }

  async function createCategory(
    name: string,
    parentId: string | null = null,
    sku?: string,
    price?: number
  ): Promise<ShopCategory> {
    const nextName = name.trim()
    const nextSku = sku?.trim() || undefined
    const tempCategory: ShopCategory = {
      id: createTempCategoryId(),
      name: nextName,
      parentId,
      sku: nextSku,
      price: price ?? undefined,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    pendingUpsertCategories.set(tempCategory.id, cloneCategory(tempCategory))
    applyCategoryState()

    try {
      const createdCategory = await createCategoryService(nextName, parentId, nextSku, price)
      pendingUpsertCategories.delete(tempCategory.id)
      pendingUpsertCategories.set(createdCategory.id, cloneCategory(createdCategory))
      applyCategoryState()
      return createdCategory
    } catch (err) {
      pendingUpsertCategories.delete(tempCategory.id)
      applyCategoryState()
      setStoreError(err, 'Failed to create category')
      logError('ShopCategories Store', 'createCategory failed', err)
      throw err
    }
  }

  async function updateCategory(
    id: string,
    updates: { name?: string; active?: boolean; sku?: string | null; price?: number | null }
  ): Promise<void> {
    ensureServerStateInitialized()
    const currentCategory = categories.value.find((category) => category.id === id)

    if (!currentCategory) {
      await updateCategoryService(id, updates)
      return
    }

    const optimisticChange = withOptimisticCategory(id, {
      ...cloneCategory(currentCategory),
      name: updates.name ?? currentCategory.name,
      sku: updates.sku !== undefined ? updates.sku ?? undefined : currentCategory.sku,
      price: updates.price !== undefined ? updates.price ?? undefined : currentCategory.price,
      active: updates.active ?? currentCategory.active,
      updatedAt: new Date(),
    })

    try {
      await updateCategoryService(id, updates)
    } catch (err) {
      optimisticChange.rollback()
      setStoreError(err, 'Failed to update category')
      logError('ShopCategories Store', 'updateCategory failed', err)
      throw err
    }
  }

  async function archiveCategory(id: string): Promise<void> {
    ensureServerStateInitialized()
    const descendants = getDescendants(id)
    const allToArchive = [id, ...descendants.map((category) => category.id)]
    const optimisticChanges = allToArchive
      .map((categoryId) => {
        const currentCategory = categories.value.find((category) => category.id === categoryId)
        if (!currentCategory) return null
        return withOptimisticCategory(categoryId, {
          ...cloneCategory(currentCategory),
          active: false,
          updatedAt: new Date(),
        })
      })
      .filter(Boolean)

    try {
      await Promise.all(allToArchive.map((categoryId) => archiveCategoryService(categoryId)))
    } catch (err) {
      optimisticChanges.forEach((change) => change?.rollback())
      setStoreError(err, 'Failed to archive category')
      logError('ShopCategories Store', 'archiveCategory failed', err)
      throw err
    }
  }

  async function reactivateCategory(id: string): Promise<void> {
    ensureServerStateInitialized()
    const currentCategory = categories.value.find((category) => category.id === id)

    if (!currentCategory) {
      await reactivateCategoryService(id)
      return
    }

    const optimisticChange = withOptimisticCategory(id, {
      ...cloneCategory(currentCategory),
      active: true,
      updatedAt: new Date(),
    })

    try {
      await reactivateCategoryService(id)
    } catch (err) {
      optimisticChange.rollback()
      setStoreError(err, 'Failed to reactivate category')
      logError('ShopCategories Store', 'reactivateCategory failed', err)
      throw err
    }
  }

  async function deleteCategory(id: string): Promise<void> {
    if (hasChildren(id)) {
      const err = new Error('Cannot delete category with subcategories')
      setStoreError(err, 'Failed to delete category')
      throw err
    }

    const optimisticDelete = beginOptimisticDelete([id])

    try {
      await deleteCategoryService(id)
      optimisticDelete.commit()
    } catch (err) {
      optimisticDelete.rollback()
      setStoreError(err, 'Failed to delete category')
      logError('ShopCategories Store', 'deleteCategory failed', err)
      throw err
    }
  }

  function clearError() {
    error.value = null
  }

  function $reset() {
    stopCategoriesSubscription()
    pendingDeletedCategoryIds.clear()
    pendingUpsertCategories.clear()
    serverCategories.value = []
    categories.value = []
    isLoading.value = false
    error.value = null
  }

  return {
    categories,
    isLoading,
    error,
    activeTree,
    fullTree,
    buildCategoryTree,
    getCategoryById,
    getChildren,
    hasChildren,
    getDescendants,
    getBreadcrumb,
    fetchAllCategories,
    subscribeAllCategories,
    createCategory,
    updateCategory,
    archiveCategory,
    reactivateCategory,
    deleteCategory,
    beginOptimisticDelete,
    clearError,
    stopCategoriesSubscription,
    $reset,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useShopCategoriesStore, import.meta.hot))
}
