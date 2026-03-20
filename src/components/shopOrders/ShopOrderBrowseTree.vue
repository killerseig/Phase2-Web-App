<script setup lang="ts">
import ShopCatalogTreeNode from '@/components/catalog/ShopCatalogTreeNode.vue'
import type {
  CatalogTreeCategoryNodeMap,
  CatalogTreeChildNodeMap,
  CatalogTreeItemNodeMap,
} from '@/utils/catalogTree'

type CatalogSelectable = {
  id?: string
  name?: string
  description?: string
  sku?: string
  price?: string | number
  quantity?: number
}

const props = defineProps<{
  rootCategoryNodeIds: string[]
  uncategorizedItemNodeIds: string[]
  nodeChildIds: CatalogTreeChildNodeMap
  itemNodesById: CatalogTreeItemNodeMap
  categoryNodesById: CatalogTreeCategoryNodeMap
  catalogItemQtys: Record<string, number>
  expanded: Set<string>
}>()

const emit = defineEmits<{
  (e: 'toggle-expand', nodeId: string): void
  (e: 'update:catalog-item-qty', payload: { id: string; qty: number }): void
  (e: 'select-for-order', item: CatalogSelectable): void
}>()
</script>

<template>
  <div class="app-catalog-tree">
    <div v-for="itemNodeId of props.uncategorizedItemNodeIds" :key="itemNodeId" class="mb-0">
      <ShopCatalogTreeNode
        :node-id="itemNodeId"
        :expanded="props.expanded"
        :order-mode="true"
        :node-child-ids="props.nodeChildIds"
        :item-nodes-by-id="props.itemNodesById"
        :category-nodes-by-id="props.categoryNodesById"
        :catalog-item-qtys="props.catalogItemQtys"
        @toggle-expand="(nodeId) => emit('toggle-expand', nodeId)"
        @update:catalog-item-qty="(payload) => emit('update:catalog-item-qty', payload)"
        @select-for-order="(item) => emit('select-for-order', item)"
      />
    </div>

    <div v-for="catId of props.rootCategoryNodeIds" :key="catId">
      <ShopCatalogTreeNode
        :node-id="catId"
        :expanded="props.expanded"
        :order-mode="true"
        :node-child-ids="props.nodeChildIds"
        :item-nodes-by-id="props.itemNodesById"
        :category-nodes-by-id="props.categoryNodesById"
        :catalog-item-qtys="props.catalogItemQtys"
        @toggle-expand="(nodeId) => emit('toggle-expand', nodeId)"
        @update:catalog-item-qty="(payload) => emit('update:catalog-item-qty', payload)"
        @select-for-order="(item) => emit('select-for-order', item)"
      />
    </div>
  </div>
</template>
