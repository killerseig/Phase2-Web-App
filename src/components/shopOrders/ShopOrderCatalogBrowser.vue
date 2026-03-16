<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import ShopCatalogTreeNode from '@/components/admin/ShopCatalogTreeNode.vue'
import { useCatalogTreeSearch } from '@/composables/useCatalogTreeSearch'
import type { ShopCatalogItem } from '@/services'
import type { CategoryNode, ShopCategory } from '@/stores/shopCategories'

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
  fullTree: CategoryNode[]
  catalogItemQtys: Record<string, number>
}>()

const emit = defineEmits<{
  (e: 'select-for-order', item: CatalogSelectable): void
  (e: 'update:catalog-item-qty', payload: { id: string; qty: number }): void
}>()

const catalogSearch = ref('')
const browseExpandedNodes = ref<Set<string>>(new Set())
const searchExpandedNodes = ref<Set<string>>(new Set())

const itemsSource = shallowRef(props.items)
const categoriesSource = shallowRef(props.categories)
const fullTreeSource = shallowRef(props.fullTree)

watch(() => props.items, (items) => { itemsSource.value = items }, { immediate: true })
watch(() => props.categories, (categories) => { categoriesSource.value = categories }, { immediate: true })
watch(() => props.fullTree, (tree) => { fullTreeSource.value = tree }, { immediate: true })

const includeCatalogItem = (item: { active: boolean }) => item.active

const {
  isSearching,
  buildExpandedNodesForSearch,
  nodeChildIds,
  itemNodesById,
  searchVisibleIds,
  searchCategoryDirectMatchIds,
  searchDirectMatchStrengths,
  searchVisibleChildCounts,
  visibleRootCategoryNodeIds,
  visibleUncategorizedItemNodeIds,
} = useCatalogTreeSearch({
  searchQuery: catalogSearch,
  categories: categoriesSource,
  allItems: itemsSource,
  fullTree: fullTreeSource,
  getCategoryById: (id) => categoriesSource.value.find((category) => category.id === id),
  getChildren: (parentId) =>
    categoriesSource.value
      .filter((category) => category.parentId === parentId)
      .sort((a, b) => a.name.localeCompare(b.name)),
  includeItem: includeCatalogItem,
  debounceMs: 0,
})

// Auto-expand matching paths when search query changes
watch(isSearching, (searching) => {
  if (searching) {
    searchExpandedNodes.value = buildExpandedNodesForSearch()
  } else {
    searchExpandedNodes.value = new Set()
  }
})

// Update auto-expanded nodes when search results change while searching
watch(searchVisibleIds, () => {
  if (isSearching.value) {
    searchExpandedNodes.value = buildExpandedNodesForSearch()
  }
})

// Active expanded nodes: search mode uses search expansions, browse mode uses browse expansions
const activeExpandedNodes = computed(() =>
  isSearching.value ? searchExpandedNodes.value : browseExpandedNodes.value
)

// All root category node IDs (full list when browsing, filtered when searching)
const rootCategoryNodeIds = computed(() =>
  isSearching.value
    ? visibleRootCategoryNodeIds.value
    : fullTreeSource.value.map((c) => c.id)
)

// All uncategorized item node IDs
const uncategorizedItemNodeIds = computed(() =>
  isSearching.value
    ? visibleUncategorizedItemNodeIds.value
    : itemsSource.value
        .filter((item) => includeCatalogItem(item) && !item.categoryId)
        .map((item) => `item-${item.id}`)
)

const hasAnyNodes = computed(() =>
  rootCategoryNodeIds.value.length > 0 || uncategorizedItemNodeIds.value.length > 0
)

const nodeQtyKey = (nodeId: string) => (nodeId.startsWith('item-') ? nodeId.slice(5) : nodeId)

const nodeMemoDeps = (nodeId: string) => {
  return [
    nodeId,
    isSearching.value,
    activeExpandedNodes.value.has(nodeId),
    searchVisibleIds.value?.has(nodeId) ?? !isSearching.value,
    searchCategoryDirectMatchIds.value?.has(nodeId) ?? false,
    searchDirectMatchStrengths.value?.get(nodeId) ?? 'none',
    searchVisibleChildCounts.value?.get(nodeId) ?? -1,
    props.catalogItemQtys[nodeQtyKey(nodeId)] ?? 1,
  ]
}

const toggleExpand = (nodeId: string) => {
  if (isSearching.value) {
    const next = new Set(searchExpandedNodes.value)
    if (next.has(nodeId)) next.delete(nodeId)
    else next.add(nodeId)
    searchExpandedNodes.value = next
  } else {
    const next = new Set(browseExpandedNodes.value)
    if (next.has(nodeId)) next.delete(nodeId)
    else next.add(nodeId)
    browseExpandedNodes.value = next
  }
}
</script>

<template>
  <div class="card app-section-card">
    <div class="card-header panel-header">
      <div class="d-flex flex-column gap-3">
        <div class="d-flex flex-wrap justify-content-between align-items-start gap-2">
          <div>
            <h5 class="mb-1">Add Items from Catalog</h5>
            <div class="small text-muted">
              Search names, SKU, and visible catalog details without reloading the tree.
            </div>
          </div>
          <span v-if="isSearching" class="badge app-badge-pill app-badge-pill--sm text-bg-info">
            Search active
          </span>
        </div>
        <div class="input-group">
          <span class="input-group-text"><i class="bi bi-search"></i></span>
          <input
            v-model="catalogSearch"
            type="search"
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
      </div>
    </div>

    <div class="card-body">
      <div v-if="!items.length" class="alert alert-info">
        No items in catalog. Please add items to the catalog first in Admin > Shop Catalog.
      </div>

      <template v-else>
        <div v-if="isSearching && !hasAnyNodes" class="alert alert-info">
          No items match your search.
        </div>
        <div v-else-if="!hasAnyNodes" class="alert alert-info">
          No items available.
        </div>

        <div v-show="hasAnyNodes" class="app-catalog-tree">
          <div v-for="itemNodeId of uncategorizedItemNodeIds" :key="itemNodeId" class="mb-0">
            <ShopCatalogTreeNode
              v-memo="nodeMemoDeps(itemNodeId)"
              :node-id="itemNodeId"
              :expanded="activeExpandedNodes"
              :items="items"
              :order-mode="true"
              :catalog-item-qtys="catalogItemQtys"
              :item-filter="includeCatalogItem"
              :node-child-ids="nodeChildIds"
              :item-nodes-by-id="itemNodesById"
              :search-mode="isSearching"
              :search-visible-ids="searchVisibleIds"
              :search-category-direct-match-ids="searchCategoryDirectMatchIds"
              :search-direct-match-strengths="searchDirectMatchStrengths"
              :search-visible-child-counts="searchVisibleChildCounts"
              @toggle-expand="toggleExpand"
              @update:catalog-item-qty="(payload) => emit('update:catalog-item-qty', payload)"
              @select-for-order="(item) => emit('select-for-order', item)"
            />
          </div>

          <div v-for="catId of rootCategoryNodeIds" :key="catId">
            <ShopCatalogTreeNode
              v-memo="nodeMemoDeps(catId)"
              :node-id="catId"
              :expanded="activeExpandedNodes"
              :items="items"
              :order-mode="true"
              :catalog-item-qtys="catalogItemQtys"
              :item-filter="includeCatalogItem"
              :node-child-ids="nodeChildIds"
              :item-nodes-by-id="itemNodesById"
              :search-mode="isSearching"
              :search-visible-ids="searchVisibleIds"
              :search-category-direct-match-ids="searchCategoryDirectMatchIds"
              :search-direct-match-strengths="searchDirectMatchStrengths"
              :search-visible-child-counts="searchVisibleChildCounts"
              @toggle-expand="toggleExpand"
              @update:catalog-item-qty="(payload) => emit('update:catalog-item-qty', payload)"
              @select-for-order="(item) => emit('select-for-order', item)"
            />
          </div>
        </div>
      </template>
    </div>

    <div class="card-footer panel-footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<style scoped>
</style>
