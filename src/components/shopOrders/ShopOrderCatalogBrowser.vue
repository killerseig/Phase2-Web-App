<script setup lang="ts">
import { computed, nextTick, ref, toRef, useSlots } from 'vue'
import AppAlert from '@/components/common/AppAlert.vue'
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import AppToolbarCard from '@/components/common/AppToolbarCard.vue'
import CatalogOrderSearchResults from '@/components/shopOrders/CatalogOrderSearchResults.vue'
import ShopOrderBrowseTree from '@/components/shopOrders/ShopOrderBrowseTree.vue'
import { useCatalogSearchResults, type CatalogSearchResult } from '@/composables/useCatalogSearchResults'
import type { ShopCatalogItem } from '@/services'
import type { ShopCategory } from '@/stores/shopCategories'
import { buildCatalogTreeIndex } from '@/utils/catalogTree'

type CatalogSelectable = {
  id?: string
  name?: string
  description?: string
  sku?: string
  price?: string | number
  quantity?: number
}

const props = defineProps<{
  items: ShopCatalogItem[]
  categories: ShopCategory[]
  catalogItemQtys: Record<string, number>
  selectedItemQuantities: Record<string, number>
}>()
const slots = useSlots()

const emit = defineEmits<{
  (e: 'select-for-order', item: CatalogSelectable): void
  (e: 'update:catalog-item-qty', payload: { id: string; qty: number }): void
}>()

const catalogSearch = ref('')
const browseExpandedNodes = ref<Set<string>>(new Set())

const itemsSource = toRef(props, 'items')
const categoriesSource = toRef(props, 'categories')

const {
  isSearching,
  results: searchResults,
  totalResultCount,
  hasMoreResults,
} = useCatalogSearchResults({
  searchQuery: catalogSearch,
  categories: categoriesSource,
  allItems: itemsSource,
  includeCategory: (category) => category.active !== false,
  includeItem: (item) => item.active !== false,
  debounceMs: 40,
  maxResults: 250,
})

const activeExpandedNodes = computed(() => browseExpandedNodes.value)
const browseTreeIndex = computed(() =>
  buildCatalogTreeIndex({
    categories: categoriesSource.value,
    items: itemsSource.value,
    includeCategory: (category) => category.active !== false,
    includeItem: (item) => item.active !== false,
  })
)
const rootCategoryNodeIds = computed(() => browseTreeIndex.value.rootCategoryNodeIds)
const uncategorizedItemNodeIds = computed(() => browseTreeIndex.value.rootItemNodeIds)

const orderableNodeIds = computed(() => {
  const orderable = new Set<string>()
  browseTreeIndex.value.categoryNodesById.forEach((_category, nodeId) => {
    if ((browseTreeIndex.value.childIds.get(nodeId)?.length ?? 0) === 0) {
      orderable.add(nodeId)
    }
  })
  browseTreeIndex.value.itemNodesById.forEach((_item, nodeId) => {
    if ((browseTreeIndex.value.childIds.get(nodeId)?.length ?? 0) === 0) {
      orderable.add(nodeId)
    }
  })

  return orderable
})

const hasAnyNodes = computed(() =>
  rootCategoryNodeIds.value.length > 0 || uncategorizedItemNodeIds.value.length > 0
)
const hasSearchResults = computed(() => searchResults.value.length > 0)
const showCatalogMissingState = computed(() => !itemsSource.value.length)
const showNoCatalogNodes = computed(() => !isSearching.value && !hasAnyNodes.value)
const showSearchResults = computed(() => isSearching.value && hasSearchResults.value)
const showNoSearchResults = computed(() => isSearching.value && !hasSearchResults.value)

const toggleExpand = (nodeId: string) => {
  const next = new Set(browseExpandedNodes.value)
  if (next.has(nodeId)) next.delete(nodeId)
  else next.add(nodeId)
  browseExpandedNodes.value = next
}

async function revealSearchResult(result: CatalogSearchResult) {
  catalogSearch.value = ''
  const nextExpanded = new Set(browseExpandedNodes.value)
  result.ancestorNodeIds.forEach((nodeId) => nextExpanded.add(nodeId))
  if (result.hasChildren) {
    nextExpanded.add(result.nodeId)
  }
  browseExpandedNodes.value = nextExpanded

  await nextTick()
  const target = document.getElementById(`btn-${result.nodeId}`)
  if (!target) return
  target.scrollIntoView({ behavior: 'smooth', block: 'center' })
  if (target instanceof HTMLElement) {
    target.focus()
  }
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

          <div v-show="!isSearching && hasAnyNodes">
            <ShopOrderBrowseTree
              :root-category-node-ids="rootCategoryNodeIds"
              :uncategorized-item-node-ids="uncategorizedItemNodeIds"
              :node-child-ids="browseTreeIndex.childIds"
              :item-nodes-by-id="browseTreeIndex.itemNodesById"
              :category-nodes-by-id="browseTreeIndex.categoryNodesById"
              :catalog-item-qtys="catalogItemQtys"
              :selected-item-quantities="selectedItemQuantities"
              :expanded="activeExpandedNodes"
              @toggle-expand="toggleExpand"
              @update:catalog-item-qty="(payload) => emit('update:catalog-item-qty', payload)"
              @select-for-order="(item) => emit('select-for-order', item)"
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
