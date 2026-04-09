<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ActionToggleGroup from '@/components/common/ActionToggleGroup.vue'
import CatalogOrderActionGroup from '@/components/catalog/CatalogOrderActionGroup.vue'
import CatalogRowColumns from '@/components/catalog/CatalogRowColumns.vue'
import InlineField from '@/components/common/InlineField.vue'
import type { CatalogItemQuantityUpdate, CatalogOrderSelection } from '@/types/shopOrders'
import { createCatalogOrderSelection } from '@/utils/catalogOrder'

const props = withDefaults(defineProps<{
  nodeId: string
  depthClass: string
  hasChildren: boolean
  isExpanded: boolean
  isArchived: boolean
  isEditingCategory: boolean
  categoryId: string
  categoryName: string
  categoryLabel: string
  editCategoryName?: string
  savingCategoryEdit?: boolean
  orderMode?: boolean
  quantity?: number
  selectedQuantity?: number
}>(), {
  editCategoryName: '',
  savingCategoryEdit: false,
  orderMode: false,
  quantity: 1,
  selectedQuantity: 0,
})

const emit = defineEmits<{
  (e: 'toggle-expand', id: string): void
  (e: 'add-item', categoryId: string): void
  (e: 'edit-category', id: string): void
  (e: 'save-category', id: string, updates: { name: string }): void
  (e: 'cancel-category-edit'): void
  (e: 'archive', id: string): void
  (e: 'reactivate', id: string): void
  (e: 'delete-category', id: string): void
  (e: 'select-for-order', item: CatalogOrderSelection): void
  (e: 'update:catalogItemQty', payload: CatalogItemQuantityUpdate): void
  (e: 'update:editCategoryName', name: string): void
}>()

const showActions = ref(false)

watch(() => props.isEditingCategory, (editing) => {
  if (!editing) {
    showActions.value = false
  }
}, { immediate: true })

const editCategoryNameModel = computed({
  get: () => props.editCategoryName ?? '',
  set: (value: string | number | boolean) => emit('update:editCategoryName', String(value ?? '')),
})

function toggleSelf() {
  if (!props.hasChildren) return
  emit('toggle-expand', props.nodeId)
}

function toggleActions() {
  showActions.value = !showActions.value
}

function handleNodeHeaderClick(event: MouseEvent) {
  if ((event.target as HTMLElement).closest('.btn-group') === null) {
    toggleSelf()
  }
}

function handleCatalogQtyInput(qty: number) {
  emit('update:catalogItemQty', { id: props.categoryId, qty })
}

function handleSelectForOrder() {
  if (!props.categoryId) return
  emit('select-for-order', createCatalogOrderSelection({
    id: props.categoryId,
    description: props.categoryName,
    quantity: props.quantity,
  }))
}

function handleSaveCategory() {
  emit('save-category', props.nodeId, {
    name: (props.editCategoryName ?? '').trim(),
  })
}
</script>

<template>
  <div
    v-if="!props.isEditingCategory"
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
      <i class="bi me-2 node-item-icon bi-folder"></i>
      <CatalogRowColumns
        class="catalog-row-content"
        :label="props.categoryLabel"
        :archived="props.isArchived"
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

    <div
      v-else-if="!props.orderMode"
      class="d-flex align-items-center justify-content-end gap-1 flex-nowrap node-actions"
    >
      <ActionToggleGroup
        :open="showActions"
        wrapper-class="d-flex align-items-center justify-content-end gap-1 flex-nowrap node-actions"
        @toggle="toggleActions"
      >
        <button class="btn btn-outline-danger" title="Delete" @click.stop="emit('delete-category', props.nodeId)">
          <i class="bi bi-trash text-danger"></i>
        </button>
        <button
          v-if="!props.isArchived"
          class="btn btn-outline-success"
          title="Add item"
          @click.stop="emit('add-item', props.categoryId)"
        >
          <i class="bi bi-file-earmark-plus text-success"></i>
        </button>
        <button class="btn btn-outline-secondary" title="Rename" @click.stop="emit('edit-category', props.nodeId)">
          <i class="bi bi-pencil"></i>
        </button>
        <button
          v-if="!props.isArchived"
          class="btn btn-outline-warning"
          title="Archive"
          @click.stop="emit('archive', props.nodeId)"
        >
          <i class="bi bi-archive text-warning"></i>
        </button>
        <button
          v-else
          class="btn btn-outline-success"
          title="Reactivate"
          @click.stop="emit('reactivate', props.nodeId)"
        >
          <i class="bi bi-arrow-counterclockwise text-success"></i>
        </button>
      </ActionToggleGroup>
    </div>
  </div>

  <div v-else class="node-header editing-category-header" :class="props.depthClass">
    <div class="category-edit-fields w-100">
      <InlineField
        v-model="editCategoryNameModel"
        :editing="true"
        input-class="form-control form-control-sm edit-category-input"
        placeholder="Category name"
        @enter="handleSaveCategory"
      />
    </div>
    <button
      class="btn btn-sm btn-success"
      :disabled="props.savingCategoryEdit"
      title="Save"
      @click.stop="handleSaveCategory"
    >
      <i class="bi bi-check"></i>
    </button>
    <button
      class="btn btn-sm btn-outline-secondary"
      :disabled="props.savingCategoryEdit"
      title="Cancel"
      @click.stop="emit('cancel-category-edit')"
    >
      <i class="bi bi-x"></i>
    </button>
  </div>
</template>
