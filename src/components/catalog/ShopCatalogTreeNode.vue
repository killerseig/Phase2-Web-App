<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ActionToggleGroup from '@/components/common/ActionToggleGroup.vue'
import InlineField from '@/components/common/InlineField.vue'
import CatalogRowColumns from '@/components/catalog/CatalogRowColumns.vue'
import { useShopCategoriesStore } from '@/stores/shopCategories'
import type { ShopCatalogItem } from '@/services'
import type {
  CatalogTreeChildCountMap,
  CatalogTreeDirectMatchStrengthMap,
  CatalogTreeVisibleIdSet,
} from '@/composables/useCatalogTreeSearch'
import type {
  CatalogTreeCategoryNodeMap,
  CatalogTreeChildNodeMap,
  CatalogTreeItemNodeMap,
} from '@/utils/catalogTree'

defineOptions({ name: 'ShopCatalogTreeNode' })

interface Props {
  nodeId: string
  expanded: Set<string>
  items?: ShopCatalogItem[]
  orderMode?: boolean
  catalogItemQtys?: Record<string, number>
  selectedItemQuantities?: Record<string, number>
  itemFilter?: (item: ShopCatalogItem) => boolean
  nodeChildIds?: CatalogTreeChildNodeMap
  itemNodesById?: CatalogTreeItemNodeMap
  categoryNodesById?: CatalogTreeCategoryNodeMap
  searchMode?: boolean
  searchVisibleIds?: CatalogTreeVisibleIdSet
  searchCategoryDirectMatchIds?: Set<string>
  searchDirectMatchStrengths?: CatalogTreeDirectMatchStrengthMap
  searchVisibleChildCounts?: CatalogTreeChildCountMap
  bypassSearchFilter?: boolean
  editingItemId?: string | null
  editingCategoryId?: string | null
  editCategoryName?: string
  savingCategoryEdit?: boolean
  depth?: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'toggle-expand': [id: string]
  'add-child': [parentId: string]
  'add-item': [categoryId: string]
  'edit-item': [item: ShopCatalogItem]
  'save-item': [itemId: string, updates: { description?: string; sku?: string | null; price?: number | null }]
  'delete-item': [item: ShopCatalogItem]
  'edit-category': [id: string]
  'save-category': [id: string, updates: { name: string }]
  'cancel-category-edit': []
  'cancel-item-edit': []
  'archive': [id: string]
  'reactivate': [id: string]
  'archive-item': [item: ShopCatalogItem]
  'reactivate-item': [item: ShopCatalogItem]
  'delete-category': [id: string]
  'select-for-order': [item: ShopCatalogItem | { id: string; description: string; quantity: number }]
  'update:catalogItemQty': [payload: { id: string; qty: number }]
  'update:editCategoryName': [name: string]
}>()

const categoriesStore = useShopCategoriesStore()

// Local state for inline editing
const editDesc = ref('')
const editSku = ref('')
const editPrice = ref('')
const editDescOriginal = ref('')
const editSkuOriginal = ref('')
const editPriceOriginal = ref('')
const isSaving = ref(false)
const showActions = ref(false)

const ITEM_PREFIX = 'item-'

const isItem = computed(() => props.nodeId.startsWith(ITEM_PREFIX))
const itemId = computed(() => (isItem.value ? props.nodeId.slice(ITEM_PREFIX.length) : null))
const itemSafeId = computed(() => itemId.value ?? '')
const categoryId = computed(() => (!isItem.value ? props.nodeId : null))

const category = computed(() => {
  if (!categoryId.value) return null
  if (props.categoryNodesById) {
    return props.categoryNodesById.get(categoryId.value) ?? null
  }
  return categoriesStore.getCategoryById(categoryId.value) ?? null
})
const categorySafeId = computed(() => category.value?.id ?? '')
const categorySafeName = computed(() => category.value?.name ?? '')
const editCategoryNameModel = computed({
  get: () => props.editCategoryName ?? '',
  set: (value: string | number | boolean) => emit('update:editCategoryName', String(value ?? '')),
})
const item = computed(() => {
  if (!itemId.value) return null
  if (props.itemNodesById) {
    return props.itemNodesById.get(props.nodeId) ?? null
  }
  if (!props.items) return null
  return props.items.find(i => i.id === itemId.value) ?? null
})

const isEditing = computed(() => props.editingItemId === itemId.value)
const itemArchived = computed(() => !!item.value && item.value.active === false)
const isExpanded = computed(() => props.expanded.has(props.nodeId))
const isSearchVisible = computed(() => props.searchVisibleIds?.has(props.nodeId) ?? true)
const isDirectCategoryMatch = computed(() => props.searchCategoryDirectMatchIds?.has(props.nodeId) ?? false)

const allChildren = computed(() => {
  if (props.nodeChildIds) {
    return props.nodeChildIds.get(props.nodeId) ?? []
  }

  if (categoryId.value) {
    const categoryChildren = categoriesStore.getChildren(categoryId.value).map(child => child.id)
    let itemChildren = (props.items?.filter(i => i.categoryId === categoryId.value) ?? []).map(i => `${ITEM_PREFIX}${i.id}`)
    if (props.itemFilter) {
      itemChildren = itemChildren.filter(nodeKey => {
        const id = nodeKey.slice(ITEM_PREFIX.length)
        const catalogItem = props.items?.find(i => i.id === id)
        return catalogItem ? props.itemFilter!(catalogItem) : true
      })
    }
    return [...categoryChildren, ...itemChildren]
  }

  if (itemId.value) {
    return categoriesStore.categories
      .filter(c => c.parentId === `${ITEM_PREFIX}${itemId.value}` || c.parentId === itemId.value)
      .map(c => c.id)
  }

  return []
})

const children = computed(() => {
  if (!props.searchMode || props.bypassSearchFilter) return allChildren.value
  if (!isSearchVisible.value) return []

  if (isDirectCategoryMatch.value) {
    return isExpanded.value ? allChildren.value : []
  }

  return allChildren.value.filter((childId) => props.searchVisibleIds?.has(childId))
})

const hasChildren = computed(() => allChildren.value.length > 0)
const isArchived = computed(() => !!category.value && !category.value.active)
const animateExpansion = computed(() => !props.searchMode)
const childBypassSearchFilter = computed(() =>
  !!props.bypassSearchFilter || (!!props.searchMode && isDirectCategoryMatch.value && isExpanded.value)
)
const showItemPurchasingFields = computed(() => !hasChildren.value)
const isEditingCategory = computed(() => props.editingCategoryId === props.nodeId)
const nodeDepth = computed(() => props.depth ?? 0)
const depthClass = computed(() => (nodeDepth.value % 2 === 0 ? 'depth-even' : 'depth-odd'))
const selectableNodeCount = computed(() => {
  if (!props.orderMode || hasChildren.value) return 0
  const nodeKey = isItem.value ? itemSafeId.value : categorySafeId.value
  if (!nodeKey) return 0
  return props.selectedItemQuantities?.[nodeKey] ?? 0
})
const categoryDisplayLabel = computed(() => {
  const countSuffix = selectableNodeCount.value > 0 ? ` x${selectableNodeCount.value}` : ''
  return `${categorySafeName.value}${countSuffix}`
})
const itemDisplayLabel = computed(() => {
  const baseLabel = item.value?.description ?? ''
  const countSuffix = selectableNodeCount.value > 0 ? ` x${selectableNodeCount.value}` : ''
  return `${baseLabel}${countSuffix}`
})

function toggleSelf() {
  if (!hasChildren.value) return
  emit('toggle-expand', props.nodeId)
}

function forwardToggle(id: string) {
  emit('toggle-expand', id)
}

function toggleActions() {
  showActions.value = !showActions.value
}

function handleCatalogQtyInput(categoryItemId: string, event: Event) {
  const rawValue = Number((event.target as HTMLInputElement).value)
  const qty = Math.max(1, Math.floor(rawValue || 1))
  emit('update:catalogItemQty', { id: categoryItemId, qty })
}

function handleSelectCategoryForOrder(categoryId: string, categoryName: string) {
  const qty = props.catalogItemQtys?.[categoryId] || 1
  emit('select-for-order', { id: categoryId, description: categoryName, quantity: qty })
}

function syncItemEditFields() {
  if (!item.value) return
  editDesc.value = item.value.description
  editSku.value = item.value.sku || ''
  editPrice.value = item.value.price?.toString() || ''
  editDescOriginal.value = editDesc.value
  editSkuOriginal.value = editSku.value
  editPriceOriginal.value = editPrice.value
}

function handleEditItem() {
  if (item.value) {
    syncItemEditFields()
    emit('edit-item', item.value)
  }
}

function handleSaveItem() {
  if (!item.value || !editDesc.value.trim()) return

  isSaving.value = true
  const updates: { description: string; sku?: string | null; price?: number | null } = {
    description: editDesc.value.trim(),
  }

  if (showItemPurchasingFields.value) {
    const skuValue = editSku.value.trim()
    if (skuValue !== editSkuOriginal.value.trim()) {
      updates.sku = skuValue || null
    }

    if (editPrice.value !== editPriceOriginal.value) {
      updates.price = editPrice.value ? parseFloat(editPrice.value) : null
    }
  }

  emit('save-item', item.value.id, updates)
}

function handleCancelItemEdit() {
  isSaving.value = false
  emit('cancel-item-edit')
}

function handleNodeHeaderClick(event: MouseEvent) {
  if ((event.target as HTMLElement).closest('.btn-group') === null) {
    toggleSelf()
  }
}

function handleArchiveItem() {
  if (item.value) emit('archive-item', item.value)
}

function handleReactivateItem() {
  if (item.value) emit('reactivate-item', item.value)
}

function handleDeleteItem() {
  if (item.value) emit('delete-item', item.value)
}

function handleArchiveCategory() {
  emit('archive', props.nodeId)
}

function handleReactivateCategory() {
  emit('reactivate', props.nodeId)
}

function handleDeleteCategory() {
  emit('delete-category', props.nodeId)
}

function handleEditCategory() {
  emit('edit-category', props.nodeId)
}

function handleSaveCategory() {
  const updates: { name: string } = {
    name: (props.editCategoryName ?? '').trim(),
  }

  emit('save-category', props.nodeId, updates)
}

function asHTMLElement(el: Element): HTMLElement | null {
  return el instanceof HTMLElement ? el : null
}

function setAccordionEnter(el: Element) {
  const node = asHTMLElement(el)
  if (!node) return
  node.style.maxHeight = '0px'
  node.style.overflow = 'hidden'
}

function runAccordionEnter(el: Element) {
  const node = asHTMLElement(el)
  if (!node) return
  // Use measured height for smooth, adaptable animation
  const target = `${node.scrollHeight}px`
  node.style.transition = 'max-height 0.3s ease-in-out'
  requestAnimationFrame(() => {
    node.style.maxHeight = target
  })
}

function cleanupAccordion(el: Element) {
  const node = asHTMLElement(el)
  if (!node) return
  node.style.maxHeight = ''
  node.style.transition = ''
  node.style.overflow = ''
}

function setAccordionLeave(el: Element) {
  const node = asHTMLElement(el)
  if (!node) return
  node.style.maxHeight = `${node.scrollHeight}px`
  node.style.overflow = 'hidden'
}

function runAccordionLeave(el: Element) {
  const node = asHTMLElement(el)
  if (!node) return
  node.style.transition = 'max-height 0.3s ease-in-out'
  requestAnimationFrame(() => {
    node.style.maxHeight = '0px'
  })
}

watch(isEditing, (editing) => {
  if (editing) {
    syncItemEditFields()
  }
  if (!editing) {
    isSaving.value = false
    showActions.value = false
  }
}, { immediate: true })

watch(isEditingCategory, (editing) => {
  if (!editing) {
    showActions.value = false
  }
}, { immediate: true })
</script>

<template>
  <!-- Category nodes -->
  <div v-if="category && (!searchMode || bypassSearchFilter || isSearchVisible)" class="tree-node accordion-item">
    <div
      v-if="props.editingCategoryId !== props.nodeId"
      class="node-header"
      :class="depthClass"
      @click="handleNodeHeaderClick"
    >
      <button
        :id="`btn-${props.nodeId}`"
        class="accordion-button"
        type="button"
        @click.stop="toggleSelf"
        :aria-expanded="hasChildren ? isExpanded : undefined"
        :aria-controls="hasChildren ? `collapse-${props.nodeId}` : undefined"
        :class="{ collapsed: !isExpanded && hasChildren, 'has-children': hasChildren, 'not-expandable': !hasChildren }"
      >
        <CatalogRowColumns
          class="catalog-row-content"
          :label="categoryDisplayLabel"
          :archived="isArchived"
        />
      </button>

      <!-- Leaf categories are orderable in order mode (data stored as category but acts as item) -->
      <div v-if="orderMode && !hasChildren && catalogItemQtys" class="btn-group btn-group-sm node-actions" role="group">
        <input
          type="number"
          inputmode="numeric"
          min="1"
          step="1"
          :value="catalogItemQtys?.[categorySafeId] || 1"
          @input="(e) => handleCatalogQtyInput(categorySafeId, e)"
          class="form-control form-control-sm qty-input"
        />
        <button
          class="btn btn-sm btn-success"
          @click.stop="handleSelectCategoryForOrder(categorySafeId, categorySafeName)"
          title="Add to order"
        >
          <i class="bi bi-plus-circle"></i>
        </button>
      </div>
      <div
        v-else-if="!orderMode"
        class="d-flex align-items-center justify-content-end gap-1 flex-nowrap node-actions"
      >
        <ActionToggleGroup
          :open="showActions"
          wrapper-class="d-flex align-items-center justify-content-end gap-1 flex-nowrap node-actions"
          @toggle="toggleActions"
        >
          <button class="btn btn-outline-danger" @click.stop="handleDeleteCategory" title="Delete">
            <i class="bi bi-trash text-danger"></i>
          </button>
          <button v-if="!isArchived" class="btn btn-outline-success" @click.stop="() => emit('add-item', categorySafeId)" title="Add item">
            <i class="bi bi-file-earmark-plus text-success"></i>
          </button>
          <button class="btn btn-outline-secondary" @click.stop="handleEditCategory" title="Rename">
            <i class="bi bi-pencil"></i>
          </button>
          <button v-if="!isArchived" class="btn btn-outline-warning" @click.stop="handleArchiveCategory" title="Archive">
            <i class="bi bi-archive text-warning"></i>
          </button>
          <button v-else class="btn btn-outline-success" @click.stop="handleReactivateCategory" title="Reactivate">
            <i class="bi bi-arrow-counterclockwise text-success"></i>
          </button>
        </ActionToggleGroup>
      </div>
    </div>

    <div v-else class="node-header editing-category-header" :class="depthClass">
      <div class="category-edit-fields w-100">
        <InlineField
          :editing="true"
          v-model="editCategoryNameModel"
          input-class="form-control form-control-sm edit-category-input"
          placeholder="Category name"
          @enter="handleSaveCategory"
        />
      </div>
      <button class="btn btn-sm btn-success" @click.stop="handleSaveCategory" :disabled="props.savingCategoryEdit" title="Save">
        <i class="bi bi-check"></i>
      </button>
      <button class="btn btn-sm btn-outline-secondary" @click.stop="() => emit('cancel-category-edit')" :disabled="props.savingCategoryEdit" title="Cancel">
        <i class="bi bi-x"></i>
      </button>
    </div>

    <Transition
      v-if="animateExpansion"
      name="accordion"
      @before-enter="setAccordionEnter"
      @enter="runAccordionEnter"
      @after-enter="cleanupAccordion"
      @before-leave="setAccordionLeave"
      @leave="runAccordionLeave"
      @after-leave="cleanupAccordion"
    >
      <div v-if="hasChildren" v-show="isExpanded" :id="`collapse-${props.nodeId}`" class="accordion-collapse" role="region" :aria-labelledby="`btn-${props.nodeId}`">
        <div class="accordion-body p-0">
          <div class="accordion">
            <div v-for="childId of children" :key="childId">
              <ShopCatalogTreeNode
                :node-id="childId"
                :expanded="expanded"
                :items="items"
                :order-mode="orderMode"
                :catalog-item-qtys="catalogItemQtys"
                :selected-item-quantities="selectedItemQuantities"
                :item-filter="itemFilter"
                :node-child-ids="nodeChildIds"
                :item-nodes-by-id="itemNodesById"
                :category-nodes-by-id="categoryNodesById"
                :search-mode="searchMode"
                :search-visible-ids="searchVisibleIds"
                :search-category-direct-match-ids="searchCategoryDirectMatchIds"
                :search-direct-match-strengths="searchDirectMatchStrengths"
                :search-visible-child-counts="searchVisibleChildCounts"
                :bypass-search-filter="childBypassSearchFilter"
                :editing-item-id="editingItemId"
                :editing-category-id="editingCategoryId"
                :edit-category-name="editCategoryName"
                :saving-category-edit="savingCategoryEdit"
                :depth="nodeDepth + 1"
                @toggle-expand="forwardToggle"
                @add-child="(id) => emit('add-child', id)"
                @add-item="(id) => emit('add-item', id)"
                @edit-item="(child) => emit('edit-item', child)"
                @save-item="(itemId, updates) => emit('save-item', itemId, updates)"
                @delete-item="(child) => emit('delete-item', child)"
                @edit-category="(id) => emit('edit-category', id)"
                @save-category="(id, updates) => emit('save-category', id, updates)"
                @cancel-category-edit="() => emit('cancel-category-edit')"
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
          </div>
        </div>
      </div>
    </Transition>
    <div v-else-if="hasChildren && isExpanded" :id="`collapse-${props.nodeId}`" class="accordion-collapse" role="region" :aria-labelledby="`btn-${props.nodeId}`">
      <div class="accordion-body p-0">
        <div class="accordion">
          <div v-for="childId of children" :key="childId">
            <ShopCatalogTreeNode
              :node-id="childId"
              :expanded="expanded"
              :items="items"
              :order-mode="orderMode"
              :catalog-item-qtys="catalogItemQtys"
              :selected-item-quantities="selectedItemQuantities"
              :item-filter="itemFilter"
              :node-child-ids="nodeChildIds"
              :item-nodes-by-id="itemNodesById"
              :category-nodes-by-id="categoryNodesById"
              :search-mode="searchMode"
              :search-visible-ids="searchVisibleIds"
              :search-category-direct-match-ids="searchCategoryDirectMatchIds"
              :search-direct-match-strengths="searchDirectMatchStrengths"
              :search-visible-child-counts="searchVisibleChildCounts"
              :bypass-search-filter="childBypassSearchFilter"
              :editing-item-id="editingItemId"
              :editing-category-id="editingCategoryId"
              :edit-category-name="editCategoryName"
              :saving-category-edit="savingCategoryEdit"
              :depth="nodeDepth + 1"
              @toggle-expand="forwardToggle"
              @add-child="(id) => emit('add-child', id)"
              @add-item="(id) => emit('add-item', id)"
              @edit-item="(child) => emit('edit-item', child)"
              @save-item="(itemId, updates) => emit('save-item', itemId, updates)"
              @delete-item="(child) => emit('delete-item', child)"
              @edit-category="(id) => emit('edit-category', id)"
              @save-category="(id, updates) => emit('save-category', id, updates)"
              @cancel-category-edit="() => emit('cancel-category-edit')"
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
        </div>
      </div>
    </div>
  </div>

  <!-- Item nodes -->
  <div v-else-if="item && (!searchMode || bypassSearchFilter || isSearchVisible)" class="tree-node accordion-item">
    <div
      v-if="!isEditing"
      class="node-header"
      :class="depthClass"
      @click="handleNodeHeaderClick"
    >
      <button
        :id="`btn-${props.nodeId}`"
        class="accordion-button"
        type="button"
        @click.stop="toggleSelf"
        :aria-expanded="hasChildren ? isExpanded : undefined"
        :aria-controls="hasChildren ? `collapse-${props.nodeId}` : undefined"
        :class="{ collapsed: !isExpanded && hasChildren, 'has-children': hasChildren, 'not-expandable': !hasChildren }"
      >
        <i class="bi me-2 node-item-icon" :class="hasChildren ? 'bi-folder2' : 'bi-file-text'"></i>
        <CatalogRowColumns
          class="catalog-row-content"
          :label="itemDisplayLabel"
          :archived="itemArchived"
          :sku="showItemPurchasingFields ? item.sku : undefined"
          :price="showItemPurchasingFields ? item.price : undefined"
        />
      </button>

      <div v-if="orderMode && !hasChildren && catalogItemQtys && itemId" class="btn-group btn-group-sm node-actions" role="group">
        <input
          type="number"
          inputmode="numeric"
          min="1"
          step="1"
          :value="catalogItemQtys?.[itemSafeId] || 1"
          @input="(e) => handleCatalogQtyInput(itemSafeId, e)"
          class="form-control form-control-sm qty-input"
        />
        <button
          class="btn btn-sm btn-success"
          @click.stop="() => { if (item) emit('select-for-order', { id: item.id, description: item.description, quantity: catalogItemQtys?.[itemSafeId] || 1 }) }"
          title="Add to order"
        >
          <i class="bi bi-plus-circle"></i>
        </button>
      </div>
      <div
        v-else-if="!orderMode"
        class="d-flex align-items-center justify-content-end gap-1 flex-nowrap node-actions"
        @click.stop
      >
        <ActionToggleGroup
          :open="showActions"
          wrapper-class="d-flex align-items-center justify-content-end gap-1 flex-nowrap node-actions"
          @toggle="toggleActions"
        >
          <button class="btn btn-outline-danger" @click.stop="handleDeleteItem" title="Delete">
            <i class="bi bi-trash text-danger"></i>
          </button>
          <button v-if="item?.active" class="btn btn-outline-success" @click.stop="() => emit('add-item', itemSafeId)" title="Add item">
            <i class="bi bi-file-earmark-plus text-success"></i>
          </button>
          <button class="btn btn-outline-secondary" @click.stop="handleEditItem" title="Edit">
            <i class="bi bi-pencil"></i>
          </button>
          <button v-if="item.active" class="btn btn-outline-warning" @click.stop="handleArchiveItem" title="Archive"><i class="bi bi-archive text-warning"></i></button>
          <button v-else class="btn btn-outline-success" @click.stop="handleReactivateItem" title="Reactivate"><i class="bi bi-arrow-counterclockwise text-success"></i></button>
        </ActionToggleGroup>
      </div>
    </div>
    <div v-else class="node-header editing-item-header" :class="depthClass" @click.stop>
      <div class="accordion-button not-expandable editing-item-fields">
        <i class="bi me-2 node-item-icon" :class="hasChildren ? 'bi-folder2' : 'bi-file-text'"></i>
        <div class="item-edit-fields w-100">
          <InlineField
            :editing="true"
            v-model="editDesc"
            placeholder="Description"
            @enter="handleSaveItem"
            @escape="handleCancelItemEdit"
          />
          <InlineField
            v-if="showItemPurchasingFields"
            :editing="true"
            v-model="editSku"
            placeholder="SKU"
            @enter="handleSaveItem"
            @escape="handleCancelItemEdit"
          />
          <InlineField
            v-if="showItemPurchasingFields"
            :editing="true"
            v-model="editPrice"
            type="number"
            step="0.01"
            placeholder="Price"
            @enter="handleSaveItem"
            @escape="handleCancelItemEdit"
          />
        </div>
      </div>
      <div class="d-flex align-items-center justify-content-end gap-1 flex-nowrap node-actions" @click.stop>
        <button class="btn btn-sm btn-success" @click.stop="handleSaveItem" :disabled="isSaving" title="Save">
          <i class="bi bi-check"></i>
        </button>
        <button class="btn btn-sm btn-outline-secondary" @click.stop="handleCancelItemEdit" :disabled="isSaving" title="Cancel">
          <i class="bi bi-x"></i>
        </button>
      </div>
    </div>

    <Transition
      v-if="animateExpansion"
      name="accordion"
      @before-enter="setAccordionEnter"
      @enter="runAccordionEnter"
      @after-enter="cleanupAccordion"
      @before-leave="setAccordionLeave"
      @leave="runAccordionLeave"
      @after-leave="cleanupAccordion"
    >
      <div v-if="hasChildren" v-show="isExpanded" :id="`collapse-${props.nodeId}`" class="accordion-collapse" role="region" :aria-labelledby="`btn-${props.nodeId}`">
        <div class="accordion-body p-0">
          <div class="accordion">
            <div v-for="childId of children" :key="childId">
              <ShopCatalogTreeNode
                :node-id="childId"
                :expanded="expanded"
                :items="items"
                :order-mode="orderMode"
                :catalog-item-qtys="catalogItemQtys"
                :selected-item-quantities="selectedItemQuantities"
                :item-filter="itemFilter"
                :node-child-ids="nodeChildIds"
                :item-nodes-by-id="itemNodesById"
                :category-nodes-by-id="categoryNodesById"
                :search-mode="searchMode"
                :search-visible-ids="searchVisibleIds"
                :search-category-direct-match-ids="searchCategoryDirectMatchIds"
                :search-direct-match-strengths="searchDirectMatchStrengths"
                :search-visible-child-counts="searchVisibleChildCounts"
                :bypass-search-filter="childBypassSearchFilter"
                :editing-item-id="editingItemId"
                :editing-category-id="editingCategoryId"
                :edit-category-name="editCategoryName"
                :saving-category-edit="savingCategoryEdit"
                :depth="nodeDepth + 1"
                @toggle-expand="forwardToggle"
                @add-child="(id) => emit('add-child', id)"
                @add-item="(id) => emit('add-item', id)"
                @edit-item="(child) => emit('edit-item', child)"
                @save-item="(itemId, updates) => emit('save-item', itemId, updates)"
                @delete-item="(child) => emit('delete-item', child)"
                @edit-category="(id) => emit('edit-category', id)"
                @save-category="(id, updates) => emit('save-category', id, updates)"
                @cancel-category-edit="() => emit('cancel-category-edit')"
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
          </div>
        </div>
      </div>
    </Transition>
    <div v-else-if="hasChildren && isExpanded" :id="`collapse-${props.nodeId}`" class="accordion-collapse" role="region" :aria-labelledby="`btn-${props.nodeId}`">
      <div class="accordion-body p-0">
        <div class="accordion">
          <div v-for="childId of children" :key="childId">
            <ShopCatalogTreeNode
              :node-id="childId"
              :expanded="expanded"
              :items="items"
              :order-mode="orderMode"
              :catalog-item-qtys="catalogItemQtys"
              :selected-item-quantities="selectedItemQuantities"
              :item-filter="itemFilter"
              :node-child-ids="nodeChildIds"
              :item-nodes-by-id="itemNodesById"
              :category-nodes-by-id="categoryNodesById"
              :search-mode="searchMode"
              :search-visible-ids="searchVisibleIds"
              :search-category-direct-match-ids="searchCategoryDirectMatchIds"
              :search-direct-match-strengths="searchDirectMatchStrengths"
              :search-visible-child-counts="searchVisibleChildCounts"
              :bypass-search-filter="childBypassSearchFilter"
              :editing-item-id="editingItemId"
              :editing-category-id="editingCategoryId"
              :edit-category-name="editCategoryName"
              :saving-category-edit="savingCategoryEdit"
              :depth="nodeDepth + 1"
              @toggle-expand="forwardToggle"
              @add-child="(id) => emit('add-child', id)"
              @add-item="(id) => emit('add-item', id)"
              @edit-item="(child) => emit('edit-item', child)"
              @save-item="(itemId, updates) => emit('save-item', itemId, updates)"
              @delete-item="(child) => emit('delete-item', child)"
              @edit-category="(id) => emit('edit-category', id)"
              @save-category="(id, updates) => emit('save-category', id, updates)"
              @cancel-category-edit="() => emit('cancel-category-edit')"
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
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;

$arrow-color: $body-color;
$arrow-color-hex: str-slice(#{ $arrow-color }, 2);

.tree-node {
  background-color: transparent;
  border-bottom: 1px solid $border-color;
}

.tree-node:last-child {
  border-bottom: none;
}

.node-header {
  margin-bottom: 0;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid $border-color;
  cursor: pointer;
  transition: background-color 0.15s ease-in-out;
}

.node-header.depth-even {
  background-color: rgba($surface-2, 0.18);
}

.node-header.depth-odd {
  background-color: rgba($surface-3, 0.32);
}

.node-header:hover {
  background-color: rgba($primary, 0.08);
}

.accordion-button {
  padding: 0;
  background-color: transparent;
  color: $body-color;
  flex: 1;
  border: none;
  box-shadow: none;
  font-weight: normal;
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  text-align: left;
  transition: background-color 0.15s ease-in-out;
  pointer-events: auto;
  cursor: pointer;
  min-width: 0;
  padding-right: 0.5rem;
}

.accordion-button:hover:not(:disabled) {
  background-color: transparent;
}

.accordion-button:focus {
  outline: none;
  box-shadow: none;
}

.accordion-button.has-children {
  cursor: pointer;
}

.accordion-button:not(.has-children) {
  cursor: default;
}

.accordion-button:not(.has-children)::after {
  display: none;
}

.accordion-button.has-children::after {
  content: '';
  display: inline-block;
  width: 0.875rem;
  height: 0.875rem;
  margin-left: auto;
  flex-shrink: 0;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill='none' stroke='%23#{$arrow-color-hex}' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M2 5l6 6 6-6'/%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-size: 0.875rem;
  transition: transform 0.35s ease-in-out;
  transform: rotate(-180deg);
}

.accordion-button.collapsed.has-children::after {
  transform: rotate(0deg);
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

.catalog-row-content {
  flex: 1;
  min-width: 0;
}

.item-edit-fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 8rem 7rem;
  gap: 0.5rem;
  align-items: center;
}

.category-edit-fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.5rem;
  align-items: center;
  min-width: 0;
}

.editing-category-header {
  gap: 0.5rem;
  padding: 0.5rem;
}

.editing-item-header {
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  cursor: default;
}

.editing-item-fields {
  cursor: default;
}

.edit-category-input {
  flex: 1;
}

.node-item-icon {
  flex-shrink: 0;
}

.node-actions {
  margin-left: auto;
}

.qty-input {
  width: 70px;
}

.item-edit-fields input {
  min-width: 0;
}

.btn-group {
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
}

.node-header i,
.btn i {
  color: $body-color;
  opacity: 0.85;
}

.btn {
  color: $body-color;
  border-color: $border-color;
  background-color: rgba($surface-3, 0.6);
}

.btn:hover,
.btn:focus {
  background-color: rgba($primary, 0.12);
  border-color: $primary;
}

.tree-node.accordion-item {
  border-radius: 0;
}

.tree-node.accordion-item .accordion-button {
  border-radius: 0;
}
</style>
