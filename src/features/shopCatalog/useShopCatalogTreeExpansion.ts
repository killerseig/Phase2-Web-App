import { ref, type Ref } from 'vue'
import {
  isShopCatalogVisibleByArchive,
} from '@/features/shopCatalog/adminViewHelpers'
import type { ShopCategoryRecord } from '@/types/domain'

interface ReadonlyRef<T> {
  readonly value: T
}

interface ShopCatalogTreeExpansionOptions {
  categories: ReadonlyRef<ShopCategoryRecord[]>
  categoriesById: ReadonlyRef<Map<string, ShopCategoryRecord>>
  closeContextMenu?: () => void
  showArchived: Ref<boolean>
}

export function useShopCatalogTreeExpansion({
  categories,
  categoriesById,
  closeContextMenu,
  showArchived,
}: ShopCatalogTreeExpansionOptions) {
  const rootBucketExpanded = ref(true)
  const expandedCategoryIds = ref<string[]>([])

  function isCategoryExpanded(categoryId: string) {
    return expandedCategoryIds.value.includes(categoryId)
  }

  function ensureExpandedToCategory(categoryId: string | null) {
    let currentId = categoryId
    const next = new Set(expandedCategoryIds.value)

    while (currentId) {
      next.add(currentId)
      currentId = categoriesById.value.get(currentId)?.parentId ?? null
    }

    expandedCategoryIds.value = Array.from(next)
  }

  function toggleCategoryExpanded(categoryId: string) {
    if (isCategoryExpanded(categoryId)) {
      expandedCategoryIds.value = expandedCategoryIds.value.filter((id) => id !== categoryId)
      return
    }

    expandedCategoryIds.value = [...expandedCategoryIds.value, categoryId]
  }

  function getVisibleCategoryIds() {
    return categories.value
      .filter((category) => isShopCatalogVisibleByArchive(category.active, showArchived.value))
      .map((category) => category.id)
  }

  function toggleRootBucketExpanded() {
    rootBucketExpanded.value = !rootBucketExpanded.value
  }

  function expandAllCategories() {
    rootBucketExpanded.value = true
    expandedCategoryIds.value = getVisibleCategoryIds()
    closeContextMenu?.()
  }

  function collapseAllCategories() {
    rootBucketExpanded.value = false
    expandedCategoryIds.value = []
    closeContextMenu?.()
  }

  function initializeRootCategories(nextCategories = categories.value) {
    expandedCategoryIds.value = nextCategories
      .filter((category) => category.parentId === null)
      .map((category) => category.id)
  }

  return {
    collapseAllCategories,
    ensureExpandedToCategory,
    expandAllCategories,
    expandedCategoryIds,
    getVisibleCategoryIds,
    initializeRootCategories,
    isCategoryExpanded,
    rootBucketExpanded,
    toggleCategoryExpanded,
    toggleRootBucketExpanded,
  }
}
