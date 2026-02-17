import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface ShopCategory {
  id: string
  name: string
  parentId: string | null
  active: boolean
  createdAt?: any
  updatedAt?: any
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
  updateCategory as updateCategoryService,
} from '@/services'

export const useShopCategoriesStore = defineStore('shopCategories', () => {
  const categories = ref<ShopCategory[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const MAX_TREE_DEPTH = 100

  /**
   * Build a tree structure from flat category list
   */
  function buildCategoryTree(
    items: ShopCategory[],
    parentId: string | null = null,
    seen = new Set<string>(),
    depth = 0,
  ): CategoryNode[] {
    if (depth > MAX_TREE_DEPTH) return []

    return items
      .filter(cat => cat.parentId === parentId)
      .map(cat => {
        if (seen.has(cat.id)) {
          return { ...cat, children: [] as CategoryNode[] }
        }
        const nextSeen = new Set(seen)
        nextSeen.add(cat.id)
        return {
          ...cat,
          children: buildCategoryTree(items, cat.id, nextSeen, depth + 1),
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  /**
   * Get all active categories as a tree
   */
  const activeTree = computed(() => {
    const active = categories.value.filter(c => c.active)
    return buildCategoryTree(active)
  })

  /**
   * Get all categories (active and inactive) as a tree
   */
  const fullTree = computed(() => buildCategoryTree(categories.value))

  /**
   * Get a category by ID
   */
  function getCategoryById(id: string): ShopCategory | undefined {
    return categories.value.find(c => c.id === id)
  }

  /**
   * Get children of a category
   */
  function getChildren(parentId: string | null = null): ShopCategory[] {
    return categories.value.filter(c => c.parentId === parentId).sort((a, b) => a.name.localeCompare(b.name))
  }

  /**
   * Check if a category has children
   */
  function hasChildren(categoryId: string): boolean {
    return categories.value.some(c => c.parentId === categoryId)
  }

  /**
   * Get all descendants of a category (recursive)
   */
  function getDescendants(categoryId: string, seen = new Set<string>(), depth = 0): ShopCategory[] {
    if (depth > MAX_TREE_DEPTH) return []
    if (seen.has(categoryId)) return []

    const nextSeen = new Set(seen)
    nextSeen.add(categoryId)

    const direct = categories.value.filter(c => c.parentId === categoryId)
    return [
      ...direct,
      ...direct.flatMap(child => getDescendants(child.id, nextSeen, depth + 1)),
    ]
  }

  /**
   * Get breadcrumb path from root to category
   */
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

  /**
   * Fetch all categories from Firestore
   */
  async function fetchAllCategories() {
    isLoading.value = true
    error.value = null
    try {
      categories.value = await getAllCategories()
      console.log('[ShopCategories Store] Fetched categories:', categories.value)
    } catch (e: any) {
      error.value = e?.message || 'Failed to fetch categories'
      console.error('[ShopCategories Store]', error.value, e)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Create a new category
   */
  async function createCategory(name: string, parentId: string | null = null): Promise<ShopCategory> {
    try {
      console.log('[ShopCategories Store] Creating category:', { name, parentId })
      const newCat = await createCategoryService(name, parentId)
      console.log('[ShopCategories Store] Category created from service:', { id: newCat.id, name: newCat.name, parentId: newCat.parentId })
      categories.value.push(newCat)
      console.log('[ShopCategories Store] Categories after push:', categories.value.map(c => ({ id: c.id, name: c.name, parentId: c.parentId })))
      return newCat
    } catch (e: any) {
      error.value = e?.message || 'Failed to create category'
      console.error('[ShopCategories Store] createCategory failed:', e)
      throw e
    }
  }

  /**
   * Update a category (name, active status, etc.)
   */
  async function updateCategory(id: string, updates: { name?: string; active?: boolean }): Promise<void> {
    try {
      await updateCategoryService(id, updates)
      const cat = categories.value.find(c => c.id === id)
      if (cat) {
        if (updates.name) cat.name = updates.name
        if (updates.active !== undefined) cat.active = updates.active
        cat.updatedAt = new Date()
      }
    } catch (e: any) {
      error.value = e?.message || 'Failed to update category'
      console.error('[ShopCategories Store] updateCategory failed:', e)
      throw e
    }
  }

  /**
   * Archive a category and all its descendants
   */
  async function archiveCategory(id: string): Promise<void> {
    try {
      // Get all descendants to archive
      const descendants = getDescendants(id)
      const allToArchive = [id, ...descendants.map(d => d.id)]

      // Archive all in batch
      await Promise.all(allToArchive.map(catId => archiveCategoryService(catId)))

      // Update local state
      for (const catId of allToArchive) {
        const cat = categories.value.find(c => c.id === catId)
        if (cat) {
          cat.active = false
          cat.updatedAt = new Date()
        }
      }
    } catch (e: any) {
      error.value = e?.message || 'Failed to archive category'
      console.error('[ShopCategories Store] archiveCategory failed:', e)
      throw e
    }
  }

  /**
   * Reactivate a category
   */
  async function reactivateCategory(id: string): Promise<void> {
    try {
      await reactivateCategoryService(id)
      const cat = categories.value.find(c => c.id === id)
      if (cat) {
        cat.active = true
        cat.updatedAt = new Date()
      }
    } catch (e: any) {
      error.value = e?.message || 'Failed to reactivate category'
      console.error('[ShopCategories Store] reactivateCategory failed:', e)
      throw e
    }
  }

  /**
   * Delete a category (only if it has no children or items)
   */
  async function deleteCategory(id: string): Promise<void> {
    try {
      // Check for children
      if (hasChildren(id)) {
        throw new Error('Cannot delete category with subcategories')
      }

      await deleteCategoryService(id)
      categories.value = categories.value.filter(c => c.id !== id)
    } catch (e: any) {
      error.value = e?.message || 'Failed to delete category'
      console.error('[ShopCategories Store] deleteCategory failed:', e)
      throw e
    }
  }

  return {
    // State
    categories,
    isLoading,
    error,

    // Computed
    activeTree,
    fullTree,

    // Methods
    buildCategoryTree,
    getCategoryById,
    getChildren,
    hasChildren,
    getDescendants,
    getBreadcrumb,
    fetchAllCategories,
    createCategory,
    updateCategory,
    archiveCategory,
    reactivateCategory,
    deleteCategory,
  }
})
