<script setup lang="ts">
import ShopCatalogTreeNode from '@/components/catalog/ShopCatalogTreeNode.vue'
import type { ShopCatalogTreeNodeProps } from '@/components/catalog/useShopCatalogTreeNode'

type TreeNodeListener = (...args: never[]) => unknown

const props = withDefaults(defineProps<
  Omit<ShopCatalogTreeNodeProps, 'nodeId' | 'depth'> & {
    rootNodeIds: string[]
    treeNodeListeners?: Record<string, TreeNodeListener>
  }
>(), {
  treeNodeListeners: () => ({}),
})
</script>

<template>
  <div class="app-catalog-tree">
    <ShopCatalogTreeNode
      v-for="nodeId of props.rootNodeIds"
      :key="nodeId"
      :node-id="nodeId"
      :expanded="props.expanded"
      :items="props.items"
      :order-mode="props.orderMode"
      :catalog-item-qtys="props.catalogItemQtys"
      :selected-item-quantities="props.selectedItemQuantities"
      :item-filter="props.itemFilter"
      :node-child-ids="props.nodeChildIds"
      :item-nodes-by-id="props.itemNodesById"
      :category-nodes-by-id="props.categoryNodesById"
      :search-mode="props.searchMode"
      :search-visible-ids="props.searchVisibleIds"
      :search-category-direct-match-ids="props.searchCategoryDirectMatchIds"
      :search-direct-match-strengths="props.searchDirectMatchStrengths"
      :search-visible-child-counts="props.searchVisibleChildCounts"
      :bypass-search-filter="props.bypassSearchFilter"
      :editing-item-id="props.editingItemId"
      :editing-category-id="props.editingCategoryId"
      :edit-category-name="props.editCategoryName"
      :saving-category-edit="props.savingCategoryEdit"
      v-on="props.treeNodeListeners"
    />
  </div>
</template>
