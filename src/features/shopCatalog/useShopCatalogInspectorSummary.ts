import { computed } from 'vue'
import {
  formatShopCatalogPriceLabel,
  getShopCatalogSelectedCategoryHasChildren,
  getShopCatalogSelectedCategorySummaryLabel,
  getShopCatalogSelectedItemPathLabel,
  getShopCatalogSelectedItemSkuLabel,
  getShopCatalogItemDisplayName,
  getShopCategoryDisplayName,
} from '@/features/shopCatalog/adminViewHelpers'
import type { ShopCatalogItemRecord, ShopCategoryRecord } from '@/types/domain'

interface ReadonlyRef<T> {
  readonly value: T
}

interface UseShopCatalogInspectorSummaryOptions {
  childCategoriesByParent: ReadonlyRef<Map<string | null, ShopCategoryRecord[]>>
  childItemsByParent: ReadonlyRef<Map<string | null, ShopCatalogItemRecord[]>>
  getCategoryPath: (categoryId: string | null) => string
  selectedCategory: ReadonlyRef<ShopCategoryRecord | null>
  selectedItem: ReadonlyRef<ShopCatalogItemRecord | null>
}

export function useShopCatalogInspectorSummary({
  childCategoriesByParent,
  childItemsByParent,
  getCategoryPath,
  selectedCategory,
  selectedItem,
}: UseShopCatalogInspectorSummaryOptions) {
  const selectedCategoryHasChildren = computed(() => getShopCatalogSelectedCategoryHasChildren(
    selectedCategory.value,
    childCategoriesByParent.value,
    childItemsByParent.value,
  ))

  const selectedCategoryTitle = computed(() =>
    selectedCategory.value ? getShopCategoryDisplayName(selectedCategory.value) : '',
  )

  const selectedCategoryPathLabel = computed(() =>
    selectedCategory.value ? getCategoryPath(selectedCategory.value.parentId) : '',
  )

  const selectedCategorySummaryLabel = computed(() => getShopCatalogSelectedCategorySummaryLabel(
    selectedCategory.value,
    childCategoriesByParent.value,
    childItemsByParent.value,
  ))

  const selectedItemTitle = computed(() =>
    selectedItem.value ? getShopCatalogItemDisplayName(selectedItem.value) : '',
  )

  const selectedItemPathLabel = computed(() => getShopCatalogSelectedItemPathLabel(selectedItem.value, getCategoryPath))
  const selectedItemSkuLabel = computed(() => getShopCatalogSelectedItemSkuLabel(selectedItem.value))
  const selectedItemPriceLabel = computed(() => formatShopCatalogPriceLabel(selectedItem.value?.price ?? null))

  return {
    selectedCategoryHasChildren,
    selectedCategoryPathLabel,
    selectedCategorySummaryLabel,
    selectedCategoryTitle,
    selectedItemPathLabel,
    selectedItemPriceLabel,
    selectedItemSkuLabel,
    selectedItemTitle,
  }
}
