<script setup lang="ts">
import { toRef, useSlots } from 'vue'
import CatalogBrowseTree from '@/components/catalog/CatalogBrowseTree.vue'
import CatalogSearchResultsList from '@/components/catalog/CatalogSearchResultsList.vue'
import AppAlert from '@/components/common/AppAlert.vue'
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import AppSearchToolbar from '@/components/common/AppSearchToolbar.vue'
import AppSectionCard from '@/components/common/AppSectionCard.vue'
import type { ShopCatalogItem } from '@/services'
import type { ShopCategory } from '@/stores/shopCategories'
import type { CatalogItemQuantityUpdate, CatalogOrderSelection } from '@/types/shopOrders'
import { useShopOrderCatalogBrowser } from '@/composables/shopOrders/useShopOrderCatalogBrowser'

const props = defineProps<{
  items: ShopCatalogItem[]
  categories: ShopCategory[]
  catalogItemQtys: Record<string, number>
  selectedItemQuantities: Record<string, number>
}>()
const slots = useSlots()

const emit = defineEmits<{
  (e: 'select-for-order', item: CatalogOrderSelection): void
  (e: 'update:catalog-item-qty', payload: CatalogItemQuantityUpdate): void
}>()

const itemsSource = toRef(props, 'items')
const categoriesSource = toRef(props, 'categories')
const {
  catalogSearch,
  activeExpandedNodes,
  browseTreeIndex,
  rootNodeIds,
  isSearching,
  searchResults,
  totalResultCount,
  hasMoreResults,
  orderableNodeIds,
  showCatalogMissingState,
  showNoCatalogNodes,
  showSearchResults,
  showNoSearchResults,
  toggleExpand,
  revealSearchResult,
} = useShopOrderCatalogBrowser({
  items: itemsSource,
  categories: categoriesSource,
})

const treeListeners = {
  'toggle-expand': toggleExpand,
  'update:catalogItemQty': (payload: CatalogItemQuantityUpdate) => emit('update:catalog-item-qty', payload),
  'select-for-order': (item: CatalogOrderSelection) => emit('select-for-order', item),
}
</script>

<template>
  <div class="shop-order-catalog-browser d-flex flex-column gap-4">
    <AppSearchToolbar
      v-model="catalogSearch"
      title="Add Items from Catalog"
      subtitle="Search names, SKU, and visible catalog details without reloading the tree."
      placeholder="Find an item or browse a category..."
      clearable
      show-icon
    />

    <AppSectionCard title="Catalog" icon="bi bi-info-circle">
      <AppAlert
        v-if="showCatalogMissingState"
        variant="info"
        message="No items in catalog. Please add items to the catalog first in Admin > Shop Catalog."
      />

      <template v-else-if="showNoCatalogNodes">
        <AppEmptyState
          icon="bi bi-inbox"
          icon-class="fs-2"
          message="No items available."
        />
      </template>

      <template v-else>
        <CatalogSearchResultsList
          v-if="showSearchResults"
          :results="searchResults"
          :total-result-count="totalResultCount"
          :has-more-results="hasMoreResults"
          mode="order"
          :catalog-item-qtys="catalogItemQtys"
          :selected-item-quantities="selectedItemQuantities"
          :orderable-node-ids="orderableNodeIds"
          @reveal="revealSearchResult"
          @update:catalog-item-qty="(payload) => emit('update:catalog-item-qty', payload)"
          @select-for-order="(item) => emit('select-for-order', item)"
        />

        <AppEmptyState
          v-else-if="showNoSearchResults"
          icon="bi bi-search"
          icon-class="fs-2"
          message="No catalog items match your search."
        />

        <div v-show="!isSearching && rootNodeIds.length > 0">
          <CatalogBrowseTree
            :root-node-ids="rootNodeIds"
            :expanded="activeExpandedNodes"
            :order-mode="true"
            :catalog-item-qtys="catalogItemQtys"
            :selected-item-quantities="selectedItemQuantities"
            :node-child-ids="browseTreeIndex.childIds"
            :item-nodes-by-id="browseTreeIndex.itemNodesById"
            :category-nodes-by-id="browseTreeIndex.categoryNodesById"
            :tree-node-listeners="treeListeners"
          />
        </div>
      </template>
    </AppSectionCard>

    <AppSectionCard v-if="slots.footer" title="Or Add a Custom Item">
      <slot name="footer" />
    </AppSectionCard>
  </div>
</template>
