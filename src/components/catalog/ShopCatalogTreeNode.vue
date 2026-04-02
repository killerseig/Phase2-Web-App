<script setup lang="ts">
import { computed } from 'vue'
import CatalogTreeCategoryRow from '@/components/catalog/CatalogTreeCategoryRow.vue'
import CatalogTreeChildrenPanel from '@/components/catalog/CatalogTreeChildrenPanel.vue'
import CatalogTreeItemRow from '@/components/catalog/CatalogTreeItemRow.vue'
import { useShopCatalogTreeNode, type ShopCatalogTreeNodeProps } from '@/components/catalog/useShopCatalogTreeNode'
import type { ShopCatalogItem } from '@/services'
import type { CatalogItemQuantityUpdate, CatalogOrderSelection } from '@/types/shopOrders'

defineOptions({ name: 'ShopCatalogTreeNode' })

const props = defineProps<ShopCatalogTreeNodeProps>()

const emit = defineEmits<{
  (e: 'toggle-expand', id: string): void
  (e: 'add-child', parentId: string): void
  (e: 'add-item', categoryId: string): void
  (e: 'edit-item', item: ShopCatalogItem): void
  (e: 'save-item', itemId: string, updates: { description?: string; sku?: string | null; price?: number | null }): void
  (e: 'delete-item', item: ShopCatalogItem): void
  (e: 'edit-category', id: string): void
  (e: 'save-category', id: string, updates: { name: string }): void
  (e: 'cancel-category-edit'): void
  (e: 'cancel-item-edit'): void
  (e: 'archive', id: string): void
  (e: 'reactivate', id: string): void
  (e: 'archive-item', item: ShopCatalogItem): void
  (e: 'reactivate-item', item: ShopCatalogItem): void
  (e: 'delete-category', id: string): void
  (e: 'select-for-order', item: CatalogOrderSelection): void
  (e: 'update:catalogItemQty', payload: CatalogItemQuantityUpdate): void
  (e: 'update:editCategoryName', name: string): void
}>()

const {
  item,
  category,
  categorySafeId,
  isEditingItem,
  isEditingCategory,
  itemArchived,
  isArchived,
  isExpanded,
  hasChildren,
  children,
  shouldRenderNode,
  animateExpansion,
  childBypassSearchFilter,
  nodeDepth,
  depthClass,
  selectedItemCount,
  categoryDisplayLabel,
  itemDisplayLabel,
  getCatalogItemQty,
} = useShopCatalogTreeNode(props)

const childNodeProps = computed(() => ({
  expanded: props.expanded,
  items: props.items,
  orderMode: props.orderMode,
  catalogItemQtys: props.catalogItemQtys,
  selectedItemQuantities: props.selectedItemQuantities,
  itemFilter: props.itemFilter,
  nodeChildIds: props.nodeChildIds,
  itemNodesById: props.itemNodesById,
  categoryNodesById: props.categoryNodesById,
  searchMode: props.searchMode,
  searchVisibleIds: props.searchVisibleIds,
  searchCategoryDirectMatchIds: props.searchCategoryDirectMatchIds,
  searchDirectMatchStrengths: props.searchDirectMatchStrengths,
  searchVisibleChildCounts: props.searchVisibleChildCounts,
  bypassSearchFilter: childBypassSearchFilter.value,
  editingItemId: props.editingItemId,
  editingCategoryId: props.editingCategoryId,
  editCategoryName: props.editCategoryName,
  savingCategoryEdit: props.savingCategoryEdit,
}))

function forwardToggle(id: string) {
  emit('toggle-expand', id)
}
</script>

<template>
  <div v-if="shouldRenderNode" class="tree-node accordion-item">
    <CatalogTreeCategoryRow
      v-if="category"
      :node-id="props.nodeId"
      :depth-class="depthClass"
      :has-children="hasChildren"
      :is-expanded="isExpanded"
      :is-archived="isArchived"
      :is-editing-category="isEditingCategory"
      :category-id="categorySafeId"
      :category-name="category?.name ?? ''"
      :category-label="categoryDisplayLabel"
      :edit-category-name="props.editCategoryName"
      :saving-category-edit="props.savingCategoryEdit"
      :order-mode="props.orderMode"
      :quantity="getCatalogItemQty(categorySafeId)"
      :selected-quantity="selectedItemCount"
      @toggle-expand="forwardToggle"
      @add-item="(id) => emit('add-item', id)"
      @edit-category="(id) => emit('edit-category', id)"
      @save-category="(id, updates) => emit('save-category', id, updates)"
      @cancel-category-edit="emit('cancel-category-edit')"
      @archive="(id) => emit('archive', id)"
      @reactivate="(id) => emit('reactivate', id)"
      @delete-category="(id) => emit('delete-category', id)"
      @select-for-order="(selection) => emit('select-for-order', selection)"
      @update:catalogItemQty="(payload) => emit('update:catalogItemQty', payload)"
      @update:editCategoryName="(name) => emit('update:editCategoryName', name)"
    />

    <CatalogTreeItemRow
      v-else-if="item"
      :node-id="props.nodeId"
      :depth-class="depthClass"
      :has-children="hasChildren"
      :is-expanded="isExpanded"
      :is-editing-item="isEditingItem"
      :item-archived="itemArchived"
      :item="item"
      :item-label="itemDisplayLabel"
      :order-mode="props.orderMode"
      :quantity="getCatalogItemQty(item.id)"
      :selected-quantity="selectedItemCount"
      @toggle-expand="forwardToggle"
      @add-item="(id) => emit('add-item', id)"
      @edit-item="(child) => emit('edit-item', child)"
      @save-item="(itemId, updates) => emit('save-item', itemId, updates)"
      @delete-item="(child) => emit('delete-item', child)"
      @cancel-item-edit="emit('cancel-item-edit')"
      @archive-item="(child) => emit('archive-item', child)"
      @reactivate-item="(child) => emit('reactivate-item', child)"
      @select-for-order="(selection) => emit('select-for-order', selection)"
      @update:catalogItemQty="(payload) => emit('update:catalogItemQty', payload)"
    />

    <CatalogTreeChildrenPanel
      :node-id="props.nodeId"
      :has-children="hasChildren"
      :is-expanded="isExpanded"
      :animate-expansion="animateExpansion"
    >
      <div v-for="childId of children" :key="childId">
        <ShopCatalogTreeNode
          v-bind="childNodeProps"
          :node-id="childId"
          :depth="nodeDepth + 1"
          @toggle-expand="forwardToggle"
          @add-child="(id) => emit('add-child', id)"
          @add-item="(id) => emit('add-item', id)"
          @edit-item="(child) => emit('edit-item', child)"
          @save-item="(itemId, updates) => emit('save-item', itemId, updates)"
          @delete-item="(child) => emit('delete-item', child)"
          @edit-category="(id) => emit('edit-category', id)"
          @save-category="(id, updates) => emit('save-category', id, updates)"
          @cancel-category-edit="emit('cancel-category-edit')"
          @cancel-item-edit="emit('cancel-item-edit')"
          @archive="(id) => emit('archive', id)"
          @reactivate="(id) => emit('reactivate', id)"
          @archive-item="(child) => emit('archive-item', child)"
          @reactivate-item="(child) => emit('reactivate-item', child)"
          @delete-category="(id) => emit('delete-category', id)"
          @select-for-order="(child) => emit('select-for-order', child)"
          @update:catalogItemQty="(payload) => emit('update:catalogItemQty', payload)"
          @update:editCategoryName="(name) => emit('update:editCategoryName', name)"
        />
      </div>
    </CatalogTreeChildrenPanel>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;

.tree-node {
  background-color: transparent;
  border-bottom: 1px solid $border-color;
}

.tree-node:last-child {
  border-bottom: none;
}

.accordion-collapse {
  padding-left: 1.5rem;
  border-left: 1px solid $border-color;
  overflow: hidden;
}

.accordion {
  border: none;
  --bs-accordion-bg: transparent;
}

.accordion-body {
  padding: 0.25rem 0 0.5rem;
  background-color: transparent;
}

.tree-node.accordion-item {
  border-radius: 0;
}
</style>
