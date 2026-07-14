import { computed } from 'vue'
import {
  buildShopCatalogCategoryOptions,
  buildShopCatalogChildCategoriesByParent,
  buildShopCatalogChildItemsByParent,
  countShopCatalogVisibleRecords,
  getShopCatalogCategoryPath,
  getShopCatalogDirectChildCategoryCount,
  getShopCatalogDirectChildItemCount,
  getShopCatalogVisibleChildCategoryCount,
  getShopCatalogVisibleChildItemCount,
} from '@/features/shopCatalog/adminViewHelpers'
import type { ShopCatalogItemRecord, ShopCategoryRecord } from '@/types/domain'

interface ReadonlyRef<T> {
  readonly value: T
}

interface UseShopCatalogDerivedDataOptions {
  categories: ReadonlyRef<ShopCategoryRecord[]>
  items: ReadonlyRef<ShopCatalogItemRecord[]>
  showArchived: ReadonlyRef<boolean>
}

export function useShopCatalogDerivedData({
  categories,
  items,
  showArchived,
}: UseShopCatalogDerivedDataOptions) {
  const categoriesById = computed(() => new Map(categories.value.map((category) => [category.id, category])))
  const childCategoriesByParent = computed(() => buildShopCatalogChildCategoriesByParent(categories.value))
  const childItemsByParent = computed(() => buildShopCatalogChildItemsByParent(items.value))
  const visibleFolderCount = computed(() => countShopCatalogVisibleRecords(categories.value, showArchived.value))
  const visibleItemCount = computed(() => countShopCatalogVisibleRecords(items.value, showArchived.value))

  function getDirectChildCategoryCount(categoryId: string | null) {
    return getShopCatalogDirectChildCategoryCount(childCategoriesByParent.value, categoryId)
  }

  function getDirectChildItemCount(categoryId: string | null) {
    return getShopCatalogDirectChildItemCount(childItemsByParent.value, categoryId)
  }

  function getVisibleChildCategoryCount(categoryId: string | null) {
    return getShopCatalogVisibleChildCategoryCount(childCategoriesByParent.value, categoryId, showArchived.value)
  }

  function getVisibleChildItemCount(categoryId: string | null) {
    return getShopCatalogVisibleChildItemCount(childItemsByParent.value, categoryId, showArchived.value)
  }

  function getCategoryPath(categoryId: string | null) {
    return getShopCatalogCategoryPath(categoryId, categoriesById.value)
  }

  const categoryOptions = computed(() => buildShopCatalogCategoryOptions(categories.value, getCategoryPath))

  return {
    categoriesById,
    categoryOptions,
    childCategoriesByParent,
    childItemsByParent,
    getCategoryPath,
    getDirectChildCategoryCount,
    getDirectChildItemCount,
    getVisibleChildCategoryCount,
    getVisibleChildItemCount,
    visibleFolderCount,
    visibleItemCount,
  }
}
