<script setup lang="ts">
import { computed, ref } from 'vue'
import { useShopCategoriesStore } from '../../stores/shopCategories'
import type { ShopCatalogItem } from '@/services'

defineOptions({ name: 'ShopCatalogTreeNode' })

interface Props {
  nodeId: string
  expanded: Set<string>
  items?: ShopCatalogItem[]
  orderMode?: boolean
  catalogItemQtys?: Record<string, number>
  itemFilter?: (item: ShopCatalogItem) => boolean
  editingItemId?: string | null
  editingCategoryId?: string | null
  editCategoryName?: string
  savingCategoryEdit?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'toggle-expand': [id: string]
  'add-child': [parentId: string]
  'add-item': [categoryId: string]
  'edit-item': [item: ShopCatalogItem]
  'save-item': [itemId: string, updates: { description?: string; sku?: string; price?: number }]
  'delete-item': [item: ShopCatalogItem]
  'edit-category': [id: string]
  'save-category': [id: string, name: string]
  'cancel-category-edit': []
  'cancel-item-edit': []
  'archive': [id: string]
  'reactivate': [id: string]
  'archive-item': [item: ShopCatalogItem]
  'reactivate-item': [item: ShopCatalogItem]
  'delete-category': [id: string]
  'select-for-order': [item: ShopCatalogItem]
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

const ITEM_PREFIX = 'item-'

const isItem = computed(() => props.nodeId.startsWith(ITEM_PREFIX))
const itemId = computed(() => (isItem.value ? props.nodeId.slice(ITEM_PREFIX.length) : null))
const categoryId = computed(() => (!isItem.value ? props.nodeId : null))

const category = computed(() => (categoryId.value ? categoriesStore.getCategoryById(categoryId.value) : null))
const item = computed(() => {
  if (!itemId.value || !props.items) return null
  return props.items.find(i => i.id === itemId.value) ?? null
})

const isEditing = computed(() => props.editingItemId === itemId.value)
const itemArchived = computed(() => !!item.value && item.value.active === false)
const isExpanded = computed(() => props.expanded.has(props.nodeId))

const children = computed(() => {
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

const hasChildren = computed(() => children.value.length > 0)
const isArchived = computed(() => !!category.value && !category.value.active)

function toggleSelf() {
  if (!hasChildren.value) return
  emit('toggle-expand', props.nodeId)
}

function forwardToggle(id: string) {
  emit('toggle-expand', id)
}

function handleAddChild() {
  emit('add-child', props.nodeId)
}

function handleSelectForOrder() {
  if (item.value) emit('select-for-order', item.value)
}

function handleEditItem() {
  if (item.value) {
    editDesc.value = item.value.description
    editSku.value = item.value.sku || ''
    editPrice.value = item.value.price?.toString() || ''
    editDescOriginal.value = editDesc.value
    editSkuOriginal.value = editSku.value
    editPriceOriginal.value = editPrice.value
    emit('edit-item', item.value)
  }
}

function handleSaveItem() {
  if (!item.value || !editDesc.value.trim()) return

  isSaving.value = true
  const updates: any = { description: editDesc.value.trim() }

  const skuValue = editSku.value.trim()
  if (skuValue !== editSkuOriginal.value.trim()) {
    updates.sku = skuValue || null
  }

  if (editPrice.value !== editPriceOriginal.value) {
    updates.price = editPrice.value ? parseFloat(editPrice.value) : null
  }

  emit('save-item', item.value.id, updates)
  setTimeout(() => {
    isSaving.value = false
  }, 500)
}

function handleCancelEdit() {
  editDesc.value = ''
  editSku.value = ''
  editPrice.value = ''
  editDescOriginal.value = ''
  editSkuOriginal.value = ''
  editPriceOriginal.value = ''
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

function setAccordionEnter(el: HTMLElement) {
  el.style.maxHeight = '0px'
  el.style.overflow = 'hidden'
}

function runAccordionEnter(el: HTMLElement) {
  // Use measured height for smooth, adaptable animation
  const target = `${el.scrollHeight}px`
  el.style.transition = 'max-height 0.3s ease-in-out'
  requestAnimationFrame(() => {
    el.style.maxHeight = target
  })
}

function cleanupAccordion(el: HTMLElement) {
  el.style.maxHeight = ''
  el.style.transition = ''
  el.style.overflow = ''
}

function setAccordionLeave(el: HTMLElement) {
  el.style.maxHeight = `${el.scrollHeight}px`
  el.style.overflow = 'hidden'
}

function runAccordionLeave(el: HTMLElement) {
  el.style.transition = 'max-height 0.3s ease-in-out'
  requestAnimationFrame(() => {
    el.style.maxHeight = '0px'
  })
}
</script>

<template>
  <!-- Category nodes -->
  <div v-if="category" class="tree-node accordion-item">
    <div v-if="props.editingCategoryId !== props.nodeId" class="node-header">
      <button
        :id="`btn-${props.nodeId}`"
        class="accordion-button"
        type="button"
        @click="toggleSelf"
        :aria-expanded="hasChildren ? isExpanded : undefined"
        :aria-controls="hasChildren ? `collapse-${props.nodeId}` : undefined"
        :class="{ collapsed: !isExpanded && hasChildren, 'has-children': hasChildren, 'not-expandable': !hasChildren }"
      >
        <span class="category-label" :style="{ opacity: isArchived ? 0.5 : 1 }">
          {{ category.name }}
          <span v-if="isArchived" class="badge bg-secondary bg-opacity-75 ms-2" style="font-size: 0.65rem;">archived</span>
        </span>
      </button>

      <div v-if="orderMode && catalogItemQtys" class="btn-group btn-group-sm" role="group" style="margin-left: auto;">
        <input
          type="number"
          inputmode="numeric"
          min="1"
          step="1"
          :value="catalogItemQtys?.[category.id] || 1"
          @input="(e) => { if (catalogItemQtys) { const v = Math.max(1, Math.floor(Number((e.target as HTMLInputElement).value) || 1)); catalogItemQtys[category.id] = v } }"
          class="form-control form-control-sm"
          style="width: 70px;"
        />
        <button
          class="btn btn-sm btn-success"
          @click.stop="() => { const qty = catalogItemQtys?.[category.id] || 1; emit('select-for-order', { id: category.id, description: category.name, quantity: qty } as any) }"
          title="Add to order"
        >
          <i class="bi bi-plus-circle"></i>
        </button>
      </div>
      <div v-else-if="!orderMode" class="btn-group btn-group-sm" role="group" style="margin-left: auto;">
        <button v-if="!isArchived" class="btn btn-outline-secondary" @click.stop="handleAddChild" title="Add subcategory">
          <i class="bi bi-folder-plus"></i>
        </button>
        <button class="btn btn-outline-secondary" @click.stop="handleEditCategory" title="Edit">
          <i class="bi bi-pencil"></i>
        </button>
        <button v-if="!isArchived" class="btn btn-outline-warning" @click.stop="handleArchiveCategory" title="Archive">
          <i class="bi bi-archive"></i>
        </button>
        <button v-else class="btn btn-outline-success" @click.stop="handleReactivateCategory" title="Reactivate">
          <i class="bi bi-arrow-counterclockwise"></i>
        </button>
        <button class="btn btn-outline-danger" @click.stop="handleDeleteCategory" title="Delete">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    </div>

    <div v-else class="node-header" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem;">
      <input
        :value="props.editCategoryName"
        @input="(e) => emit('update:editCategoryName', (e.target as HTMLInputElement).value)"
        type="text"
        class="form-control form-control-sm"
        placeholder="Category name"
        style="flex: 1;"
      />
      <button class="btn btn-sm btn-success" @click.stop="() => emit('save-category', props.nodeId, props.editCategoryName || '')" :disabled="props.savingCategoryEdit" title="Save">
        <i class="bi bi-check"></i>
      </button>
      <button class="btn btn-sm btn-outline-secondary" @click.stop="() => emit('cancel-category-edit')" :disabled="props.savingCategoryEdit" title="Cancel">
        <i class="bi bi-x"></i>
      </button>
    </div>

    <Transition
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
                :item-filter="itemFilter"
                :editing-item-id="editingItemId"
                :editing-category-id="editingCategoryId"
                :edit-category-name="editCategoryName"
                :saving-category-edit="savingCategoryEdit"
                @toggle-expand="forwardToggle"
                @add-child="(id) => emit('add-child', id)"
                @add-item="(id) => emit('add-item', id)"
                @edit-item="(child) => emit('edit-item', child)"
                @save-item="(itemId, updates) => emit('save-item', itemId, updates)"
                @delete-item="(child) => emit('delete-item', child)"
                @edit-category="(id) => emit('edit-category', id)"
                @save-category="(id, name) => emit('save-category', id, name)"
                @cancel-category-edit="() => emit('cancel-category-edit')"
                @archive="(id) => emit('archive', id)"
                @reactivate="(id) => emit('reactivate', id)"
                @archive-item="(child) => emit('archive-item', child)"
                @reactivate-item="(child) => emit('reactivate-item', child)"
                @delete-category="(id) => emit('delete-category', id)"
                @select-for-order="(child) => emit('select-for-order', child)"
                @update:editCategoryName="(name) => emit('update:editCategoryName', name)"
              />
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>

  <!-- Item nodes -->
  <div v-else-if="item" class="tree-node accordion-item">
    <div class="node-header" @click="handleNodeHeaderClick">
      <button
        :id="`btn-${props.nodeId}`"
        class="accordion-button"
        type="button"
        @click.stop="toggleSelf"
        :aria-expanded="hasChildren ? isExpanded : undefined"
        :aria-controls="hasChildren ? `collapse-${props.nodeId}` : undefined"
        :class="{ collapsed: !isExpanded && hasChildren, 'has-children': hasChildren, 'not-expandable': !hasChildren }"
      >
        <i class="bi bi-file-text me-2" style="flex-shrink: 0;"></i>
        <span class="item-label flex-grow-1" :style="{ opacity: itemArchived ? 0.5 : 1 }">
          {{ item.description }}
          <span v-if="itemArchived" class="badge bg-secondary bg-opacity-75 ms-2" style="font-size: 0.65rem;">archived</span>
          <span v-if="item.sku" class="badge bg-info bg-opacity-75 ms-2" style="font-size: 0.85rem;">{{ item.sku }}</span>
          <span v-if="item.price" class="badge bg-success bg-opacity-75 ms-1" style="font-size: 0.85rem;">${{ item.price.toFixed(2) }}</span>
        </span>
      </button>

      <div v-if="!orderMode" class="btn-group btn-group-sm" role="group" style="margin-left: auto;" @click.stop>
        <button class="btn btn-outline-primary" @click.stop="handleAddChild" title="Add subcategory"><i class="bi bi-folder-plus"></i></button>
        <button class="btn btn-outline-secondary" @click.stop="handleEditItem" title="Edit"><i class="bi bi-pencil"></i></button>
        <button v-if="item.active" class="btn btn-outline-warning" @click.stop="handleArchiveItem" title="Archive"><i class="bi bi-archive"></i></button>
        <button v-else class="btn btn-outline-success" @click.stop="handleReactivateItem" title="Reactivate"><i class="bi bi-arrow-counterclockwise"></i></button>
        <button class="btn btn-outline-danger" @click.stop="handleDeleteItem" title="Delete"><i class="bi bi-trash"></i></button>
      </div>
    </div>

    <Transition
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
                :item-filter="itemFilter"
                :editing-item-id="editingItemId"
                :editing-category-id="editingCategoryId"
                :edit-category-name="editCategoryName"
                :saving-category-edit="savingCategoryEdit"
                @toggle-expand="forwardToggle"
                @add-child="(id) => emit('add-child', id)"
                @add-item="(id) => emit('add-item', id)"
                @edit-item="(child) => emit('edit-item', child)"
                @save-item="(itemId, updates) => emit('save-item', itemId, updates)"
                @delete-item="(child) => emit('delete-item', child)"
                @edit-category="(id) => emit('edit-category', id)"
                @save-category="(id, name) => emit('save-category', id, name)"
                @cancel-category-edit="() => emit('cancel-category-edit')"
                @archive="(id) => emit('archive', id)"
                @reactivate="(id) => emit('reactivate', id)"
                @archive-item="(child) => emit('archive-item', child)"
                @reactivate-item="(child) => emit('reactivate-item', child)"
                @delete-category="(id) => emit('delete-category', id)"
                @select-for-order="(child) => emit('select-for-order', child)"
                @update:editCategoryName="(name) => emit('update:editCategoryName', name)"
              />
            </div>
          </div>
        </div>
      </div>
    </Transition>
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
  display: none !important;
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

.category-label,
.item-label {
  cursor: pointer;
  user-select: none;
  color: $body-color;
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
