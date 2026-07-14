import { computed } from 'vue'
import {
  buildShopCatalogCategoryParentOptions,
  buildShopCatalogTreeNodes,
  formatShopCatalogFolderItemSummary,
  hasShopCatalogRootBucketChildren,
  type ShopCatalogCategoryOption,
} from '@/features/shopCatalog/adminViewHelpers'
import type { ShopCatalogTreeNode } from '@/features/shopCatalog/treeTypes'
import type { ShopCatalogItemRecord, ShopCategoryRecord } from '@/types/domain'

interface ReadonlyRef<T> {
  readonly value: T
}

interface InlineCreateState {
  key: ShopCatalogTreeNode['key'] | null
  kind: 'category' | 'item' | null
  parentId: string | null
  value: string
}

interface UseShopCatalogTreeDisplayStateOptions {
  categoryOptions: ReadonlyRef<ShopCatalogCategoryOption[]>
  childCategoriesByParent: ReadonlyRef<ReadonlyMap<string | null, readonly ShopCategoryRecord[]>>
  childItemsByParent: ReadonlyRef<ReadonlyMap<string | null, readonly ShopCatalogItemRecord[]>>
  createState: InlineCreateState
  expandedCategoryIds: ReadonlyRef<readonly string[]>
  getCategoryPath: (categoryId: string | null) => string
  getVisibleChildCategoryCount: (categoryId: string | null) => number
  getVisibleChildItemCount: (categoryId: string | null) => number
  rootBucketExpanded: ReadonlyRef<boolean>
  selectedCategory: ReadonlyRef<ShopCategoryRecord | null>
  showArchived: ReadonlyRef<boolean>
  treeSearch: ReadonlyRef<string>
}

export function useShopCatalogTreeDisplayState({
  categoryOptions,
  childCategoriesByParent,
  childItemsByParent,
  createState,
  expandedCategoryIds,
  getCategoryPath,
  getVisibleChildCategoryCount,
  getVisibleChildItemCount,
  rootBucketExpanded,
  selectedCategory,
  showArchived,
  treeSearch,
}: UseShopCatalogTreeDisplayStateOptions) {
  const visibleRootCategoryCount = computed(() => getVisibleChildCategoryCount(null))
  const visibleRootItemCount = computed(() => getVisibleChildItemCount(null))
  const rootBucketHasChildren = computed(() => hasShopCatalogRootBucketChildren({
    visibleRootCategoryCount: visibleRootCategoryCount.value,
    visibleRootItemCount: visibleRootItemCount.value,
    createParentId: createState.parentId,
    createKey: createState.key,
  }))
  const rootBucketSummary = computed(() => (
    formatShopCatalogFolderItemSummary(visibleRootCategoryCount.value, visibleRootItemCount.value)
  ))
  const detailCategoryParentOptions = computed(() => buildShopCatalogCategoryParentOptions(
    selectedCategory.value,
    categoryOptions.value,
    childCategoriesByParent.value,
  ))
  const treeNodes = computed<ShopCatalogTreeNode[]>(() =>
    buildShopCatalogTreeNodes({
      treeSearch: treeSearch.value,
      showArchived: showArchived.value,
      rootBucketExpanded: rootBucketExpanded.value,
      expandedCategoryIds: expandedCategoryIds.value,
      createState,
      childCategoriesByParent: childCategoriesByParent.value,
      childItemsByParent: childItemsByParent.value,
      getCategoryPath,
    }),
  )

  return {
    detailCategoryParentOptions,
    rootBucketHasChildren,
    rootBucketSummary,
    treeNodes,
    visibleRootCategoryCount,
    visibleRootItemCount,
  }
}
