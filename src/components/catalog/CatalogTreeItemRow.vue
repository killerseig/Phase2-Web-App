<script setup lang="ts">
import CatalogOrderActionGroup from '@/components/catalog/CatalogOrderActionGroup.vue'
import CatalogTreeItemAdminActions from '@/components/catalog/CatalogTreeItemAdminActions.vue'
import CatalogTreeItemEditFields from '@/components/catalog/CatalogTreeItemEditFields.vue'
import CatalogRowColumns from '@/components/catalog/CatalogRowColumns.vue'
import {
  useCatalogTreeItemRow,
  type CatalogTreeItemSaveUpdates,
} from '@/components/catalog/useCatalogTreeItemRow'
import type { ShopCatalogItem } from '@/services'
import type { CatalogItemQuantityUpdate, CatalogOrderSelection } from '@/types/shopOrders'
import { createCatalogOrderSelection } from '@/utils/catalogOrder'

const props = withDefaults(defineProps<{
  nodeId: string
  depthClass: string
  hasChildren: boolean
  isExpanded: boolean
  isEditingItem: boolean
  itemArchived: boolean
  item: ShopCatalogItem
  itemLabel: string
  quantity?: number
  selectedQuantity?: number
  orderMode?: boolean
}>(), {
  quantity: 1,
  selectedQuantity: 0,
  orderMode: false,
})

const emit = defineEmits<{
  (e: 'toggle-expand', id: string): void
  (e: 'add-item', categoryId: string): void
  (e: 'edit-item', item: ShopCatalogItem): void
  (e: 'save-item', itemId: string, updates: CatalogTreeItemSaveUpdates): void
  (e: 'delete-item', item: ShopCatalogItem): void
  (e: 'cancel-item-edit'): void
  (e: 'archive-item', item: ShopCatalogItem): void
  (e: 'reactivate-item', item: ShopCatalogItem): void
  (e: 'select-for-order', item: CatalogOrderSelection): void
  (e: 'update:catalogItemQty', payload: CatalogItemQuantityUpdate): void
}>()

const {
  editDesc,
  editSku,
  editPrice,
  isSaving,
  showActions,
  showItemPurchasingFields,
  syncItemEditFields,
  toggleActions,
  createSaveUpdates,
  stopEditingState,
} = useCatalogTreeItemRow(props)

function toggleSelf() {
  if (!props.hasChildren) return
  emit('toggle-expand', props.nodeId)
}

function handleNodeHeaderClick(event: MouseEvent) {
  if ((event.target as HTMLElement).closest('.btn-group') === null) {
    toggleSelf()
  }
}

function handleCatalogQtyInput(qty: number) {
  emit('update:catalogItemQty', { id: props.item.id, qty })
}

function handleSelectForOrder() {
  emit('select-for-order', createCatalogOrderSelection({
    id: props.item.id,
    description: props.item.description,
    quantity: props.quantity,
  }))
}

function handleEditItem() {
  syncItemEditFields()
  emit('edit-item', props.item)
}

function handleSaveItem() {
  const updates = createSaveUpdates()
  if (!updates) return
  emit('save-item', props.item.id, updates)
}

function handleCancelItemEdit() {
  stopEditingState()
  emit('cancel-item-edit')
}
</script>

<template>
  <div
    v-if="!props.isEditingItem"
    class="node-header"
    :class="props.depthClass"
    @click="handleNodeHeaderClick"
  >
    <button
      :id="`btn-${props.nodeId}`"
      class="accordion-button"
      type="button"
      :aria-expanded="props.hasChildren ? props.isExpanded : undefined"
      :aria-controls="props.hasChildren ? `collapse-${props.nodeId}` : undefined"
      :class="{ collapsed: !props.isExpanded && props.hasChildren, 'has-children': props.hasChildren, 'not-expandable': !props.hasChildren }"
      @click.stop="toggleSelf"
    >
      <i class="bi me-2 node-item-icon" :class="props.hasChildren ? 'bi-folder2' : 'bi-file-text'"></i>
      <CatalogRowColumns
        class="catalog-row-content"
        :label="props.itemLabel"
        :archived="props.itemArchived"
        :sku="showItemPurchasingFields ? props.item.sku : undefined"
        :price="showItemPurchasingFields ? props.item.price : undefined"
      />
    </button>

    <CatalogOrderActionGroup
      v-if="props.orderMode && !props.hasChildren"
      class="node-actions"
      :quantity="props.quantity"
      :selected-quantity="props.selectedQuantity"
      @update:qty="handleCatalogQtyInput"
      @add="handleSelectForOrder"
    />

    <CatalogTreeItemAdminActions
      v-else-if="!props.orderMode"
      :open="showActions"
      :item="props.item"
      :item-archived="props.itemArchived"
      @toggle="toggleActions"
      @add-item="(id) => emit('add-item', id)"
      @edit-item="handleEditItem"
      @delete-item="(item) => emit('delete-item', item)"
      @archive-item="(item) => emit('archive-item', item)"
      @reactivate-item="(item) => emit('reactivate-item', item)"
    />
  </div>

  <CatalogTreeItemEditFields
    v-else
    :depth-class="props.depthClass"
    :has-children="props.hasChildren"
    :is-saving="isSaving"
    :description="editDesc"
    :sku="editSku"
    :price="editPrice"
    @update:description="(value) => editDesc = value"
    @update:sku="(value) => editSku = value"
    @update:price="(value) => editPrice = value"
    @save="handleSaveItem"
    @cancel="handleCancelItemEdit"
  />
</template>

<style scoped lang="scss">
@use '@/styles/_catalogTreeNode.scss';
</style>
