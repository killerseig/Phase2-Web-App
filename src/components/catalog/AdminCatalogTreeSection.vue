<script setup lang="ts">
import CatalogBrowseTree from '@/components/catalog/CatalogBrowseTree.vue'
import CatalogSearchResultsList from '@/components/catalog/CatalogSearchResultsList.vue'
import AdminCardWrapper from '@/components/admin/AdminCardWrapper.vue'
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import type { CatalogSearchResult } from '@/composables/useCatalogSearchResults'
import type { CatalogTreeIndex } from '@/utils/catalogTree'
import type { AdminCatalogTreeListeners } from '@/composables/adminCatalog/adminCatalogTreeTypes'

const props = defineProps<{
  isSearching: boolean
  hasSearchResults: boolean
  results: CatalogSearchResult[]
  totalResultCount: number
  hasMoreResults: boolean
  rootNodeIds: string[]
  browseTreeIndex: CatalogTreeIndex
  expanded: Set<string>
  editingItemId: string | null
  editingCategoryId: string | null
  editCategoryName: string
  savingCategoryEdit: boolean
  treeListeners: AdminCatalogTreeListeners
}>()

const emit = defineEmits<{
  (e: 'reveal', result: CatalogSearchResult): void
}>()
</script>

<template>
  <AdminCardWrapper title="Catalog" class="admin-catalog-tree-section table-responsive">
    <CatalogSearchResultsList
      v-if="props.isSearching && props.hasSearchResults"
      :results="props.results"
      :total-result-count="props.totalResultCount"
      :has-more-results="props.hasMoreResults"
      @reveal="(result) => emit('reveal', result)"
    />

    <AppEmptyState
      v-else-if="props.isSearching"
      icon="bi bi-search"
      icon-class="fs-2"
      message="No catalog nodes match your search."
    />

    <div v-show="!props.isSearching && props.rootNodeIds.length > 0">
      <CatalogBrowseTree
        :root-node-ids="props.rootNodeIds"
        :expanded="props.expanded"
        :node-child-ids="props.browseTreeIndex.childIds"
        :item-nodes-by-id="props.browseTreeIndex.itemNodesById"
        :category-nodes-by-id="props.browseTreeIndex.categoryNodesById"
        :editing-item-id="props.editingItemId"
        :editing-category-id="props.editingCategoryId"
        :edit-category-name="props.editCategoryName"
        :saving-category-edit="props.savingCategoryEdit"
        :tree-node-listeners="props.treeListeners"
      />
    </div>

    <AppEmptyState
      v-if="!props.isSearching && props.rootNodeIds.length === 0"
      icon="bi bi-inbox"
      icon-class="fs-2"
      message="No categories or items yet. Create one to get started."
    />
  </AdminCardWrapper>
</template>
