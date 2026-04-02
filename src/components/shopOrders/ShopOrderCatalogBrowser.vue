<script setup lang="ts">
import { toRef, useSlots } from 'vue'
import CatalogBrowseTree from '@/components/catalog/CatalogBrowseTree.vue'
import AppAlert from '@/components/common/AppAlert.vue'
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import AppToolbarCard from '@/components/common/AppToolbarCard.vue'
import CatalogOrderSearchResults from '@/components/shopOrders/CatalogOrderSearchResults.vue'
import type { ShopCatalogItem } from '@/services'
import type { ShopCategory } from '@/stores/shopCategories'
import type { CatalogItemQuantityUpdate, CatalogOrderSelection } from '@/types/shopOrders'
import { useShopOrderCatalogBrowser } from '@/components/shopOrders/useShopOrderCatalogBrowser'

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
    <AppToolbarCard body-class="d-flex flex-column gap-3">
      <div class="d-flex flex-wrap justify-content-between align-items-start gap-2">
        <div>
          <h5 class="mb-1">Add Items from Catalog</h5>
          <div class="small text-muted">
            Search names, SKU, and visible catalog details without reloading the tree.
          </div>
        </div>
      </div>
      <div class="input-group">
        <span class="input-group-text"><i class="bi bi-search"></i></span>
        <input
          v-model="catalogSearch"
          type="text"
          class="form-control"
          autocomplete="off"
          spellcheck="false"
          placeholder="Find an item or browse a category..."
        />
        <button
          v-if="catalogSearch"
          type="button"
          class="btn btn-outline-secondary"
          @click="catalogSearch = ''"
        >
          Clear
        </button>
      </div>
    </AppToolbarCard>

    <div class="card app-section-card">
      <div class="card-header panel-header">
        <h5 class="mb-0"><i class="bi bi-info-circle me-2"></i>Catalog</h5>
      </div>

      <div class="card-body">
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
          <CatalogOrderSearchResults
            v-if="showSearchResults"
            :results="searchResults"
            :total-result-count="totalResultCount"
            :has-more-results="hasMoreResults"
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
      </div>
    </div>

    <div v-if="slots.footer" class="card app-section-card">
      <div class="card-header panel-header">
        <h5 class="mb-0">Or Add a Custom Item</h5>
      </div>
      <div class="card-body">
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>
