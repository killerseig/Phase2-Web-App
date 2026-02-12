<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import Toast from '../../components/Toast.vue'
import AdminCardWrapper from '../../components/admin/AdminCardWrapper.vue'
import ShopCatalogTreeNode from '../../components/admin/ShopCatalogTreeNode.vue'
import { useShopCategoriesStore } from '../../stores/shopCategories'
import { useShopCatalogStore } from '../../stores/shopCatalog'
import type { ShopCatalogItem } from '@/services'

const toastRef = ref<InstanceType<typeof Toast> | null>(null)
const categoriesStore = useShopCategoriesStore()
const catalogStore = useShopCatalogStore()

const saving = ref(false)
const expandedNodes = ref<Set<string>>(new Set())
const newCategoryName = ref('')
const newItemDesc = ref('')
const newItemSku = ref('')
const newItemPrice = ref('')
const showAddCategory = ref(false)
const showAddItem = ref(false)
const parentId = ref<string | null>(null) // Can be category ID or item ID
const selectedCategoryForItem = ref<string | null>(null)
const editingItemId = ref<string | null>(null)
const editingCategoryId = ref<string | null>(null)
const editCategoryName = ref('')
const editCategoryNameOriginal = ref('')
const savingCategoryEdit = ref(false)
const searchQuery = ref('')

// Computed
const categoryTree = computed(() => categoriesStore.fullTree)
const allItems = computed(() => catalogStore.allItems)
const uncategorizedItems = computed(() => 
  allItems.value.filter(item => !item.categoryId).map(item => `item-${item.id}`)
)
const loading = computed(() => categoriesStore.isLoading || catalogStore.isLoading)
const err = computed(() => categoriesStore.error || catalogStore.error || '')

// Search filter
const itemMatchesSearch = (item: ShopCatalogItem) => {
  if (!searchQuery.value.trim()) return true
  const q = searchQuery.value.toLowerCase()
  const desc = item.description ? item.description.toLowerCase() : ''
  const sku = item.sku ? item.sku.toLowerCase() : ''
  return desc.includes(q) || sku.includes(q)
}

const categoryHasMatchingItems = (categoryId: string, depth: number = 0): boolean => {
  // Prevent infinite recursion (max 50 levels deep)
  if (depth > 50) return false
  
  const q = searchQuery.value.toLowerCase()
  if (!q) return true
  
  // Check if the category name itself matches
  const cat = categoriesStore.categories.find(c => c.id === categoryId)
  if (cat && cat.name?.toLowerCase().includes(q)) {
    return true
  }
  
  // Check direct items in this category
  const directItems = allItems.value.filter(i => i.categoryId === categoryId)
  if (directItems.some(i => itemMatchesSearch(i))) return true
  
  // Check child categories recursively
  const children = categoriesStore.getChildren(categoryId)
  return children.some(child => categoryHasMatchingItems(child.id, depth + 1))
}

// Check if a category has matching items/descendants (but not counting the category name itself)
const categoryHasMatchingDescendants = (categoryId: string, depth: number = 0): boolean => {
  if (depth > 50) return false
  
  const q = searchQuery.value.toLowerCase()
  if (!q) return false
  
  // Check direct items in this category
  const directItems = allItems.value.filter(i => i.categoryId === categoryId)
  if (directItems.some(i => itemMatchesSearch(i))) return true
  
  // Check child categories recursively (including their names and descendants)
  const children = categoriesStore.getChildren(categoryId)
  return children.some(child => categoryHasMatchingItems(child.id, depth + 1))
}

const filteredItems = computed(() => {
  const query = searchQuery.value.toLowerCase()
  if (!query) return allItems.value
  
  return allItems.value.filter(item => itemMatchesSearch(item))
})

const filteredCategories = computed(() => {
  const query = searchQuery.value.toLowerCase()
  if (!query) return categoriesStore.categories
  
  return categoriesStore.categories.filter(cat =>
    cat.name.toLowerCase().includes(query)
  )
})

// Recursively filter tree to only include categories that should be visible
const filterCategoryTree = (tree: any[]): any[] => {
  return tree
    .filter(cat => {
      if (!searchQuery.value.trim()) return true
      // Must have matching descendants (not just matching by name)
      return categoryHasMatchingDescendants(cat.id)
    })
    .map(cat => ({
      ...cat,
      children: filterCategoryTree(cat.children)
    }))
}

const filteredCategoryTree = computed(() => filterCategoryTree(categoriesStore.fullTree))

const filteredUncategorizedItems = computed(() => {
  return allItems.value
    .filter(item => !item.categoryId && itemMatchesSearch(item))
    .map(item => `item-${item.id}`)
})

const hasMatchingItems = computed(() => {
  const itemIds = new Set(filteredItems.value.map(i => i.id))
  const categoryIds = new Set(filteredCategories.value.map(c => c.id))
  
  return { itemIds, categoryIds }
})

async function loadAll() {
  await categoriesStore.fetchAllCategories()
  await catalogStore.fetchCatalog()
}

function toggleExpand(nodeId: string) {
  const next = new Set(expandedNodes.value)
  if (next.has(nodeId)) {
    next.delete(nodeId)
  } else {
    next.add(nodeId)
    // When expanding, also expand all ancestor nodes
    expandAncestors(nodeId, next)
  }
  expandedNodes.value = next
}

const normalizeItemNodeId = (id: string) => (id.startsWith('item-') ? id : `item-${id}`)
const resolveParentNodeId = (parentId: string) => {
  if (parentId.startsWith('item-')) return parentId
  return allItems.value.some(i => i.id === parentId) ? normalizeItemNodeId(parentId) : parentId
}

// Helper to expand all ancestor nodes
function expandAncestors(nodeId: string, set: Set<string>, depth: number = 0) {
  if (depth > 50) return

  if (nodeId.startsWith('item-')) {
    const itemId = nodeId.slice(5)
    const item = allItems.value.find(i => i.id === itemId)
    if (item?.categoryId) {
      set.add(item.categoryId)
      expandAncestors(item.categoryId, set, depth + 1)
    }
    return
  }

  const category = categoriesStore.categories.find(c => c.id === nodeId)
  if (!category?.parentId) {
    return
  }

  const parentNodeId = resolveParentNodeId(category.parentId)
  set.add(parentNodeId)
  expandAncestors(parentNodeId, set, depth + 1)
}

// Auto-expand categories and items when search has matches
const autoExpandOnSearch = () => {
  if (!searchQuery.value.trim()) {
    // Don't clear - let manual expansions persist
    return
  }
  
  const nodesToExpand = new Set<string>()
  
  // Helper to expand category and all its parents up the tree
  const expandCategoryAndParents = (categoryId: string, depth: number = 0) => {
    if (depth > 50) return // Prevent infinite recursion
    nodesToExpand.add(categoryId)
    const cat = categoriesStore.categories.find(c => c.id === categoryId)
    if (cat?.parentId) {
      expandCategoryAndParents(cat.parentId, depth + 1)
    }
  }
  
  // Helper to recursively expand all child categories with matches
  const expandChildrenWithMatches = (parentId: string, depth: number = 0) => {
    if (depth > 50) return // Prevent infinite recursion
    const children = categoriesStore.getChildren(parentId)
    children.forEach(child => {
      // Only expand children that have descendants matching the search (not just matching by name)
      if (categoryHasMatchingDescendants(child.id)) {
        nodesToExpand.add(child.id)
        expandChildrenWithMatches(child.id, depth + 1) // Recurse into grandchildren
      }
    })
  }
  
  // Find all root categories with matching descendants and expand them
  const allCategories = categoriesStore.categories
  allCategories.forEach(cat => {
    if (categoryHasMatchingDescendants(cat.id)) {
      expandCategoryAndParents(cat.id)
      expandChildrenWithMatches(cat.id)
    }
  })
  
  // Also expand uncategorized items that match the search, and their matching children
  allItems.value.forEach(item => {
    if (!item.categoryId && itemMatchesSearch(item)) {
      if (categoryHasMatchingDescendants(`item-${item.id}`)) {
        nodesToExpand.add(`item-${item.id}`)
        expandChildrenWithMatches(`item-${item.id}`)
      }
    }
  })
  
  // Replace the entire ref to ensure Vue reactivity properly updates
  expandedNodes.value = new Set(nodesToExpand)
}

watch(() => searchQuery.value, () => {
  autoExpandOnSearch()
}, { immediate: false })

function openAddCategoryDialog(id: string | null = null) {
  parentId.value = id
  newCategoryName.value = ''
  showAddCategory.value = true
}

function openAddItemDialog(categoryId: string | null = null) {
  selectedCategoryForItem.value = categoryId
  newItemDesc.value = ''
  showAddItem.value = true
}

async function createCategory() {
  const name = newCategoryName.value.trim()
  if (!name) return

  saving.value = true
  try {
    await categoriesStore.createCategory(name, parentId.value)
    toastRef.value?.show(`Category "${name}" created`, 'success')
    showAddCategory.value = false
    
    // Auto-expand parent if creating subcategory
    if (parentId.value) {
      expandedNodes.value.add(parentId.value)
    }
  } catch (e: any) {
    toastRef.value?.show('Failed to create category', 'error')
  } finally {
    saving.value = false
  }
}

async function createItem() {
  if (!newItemDesc.value.trim()) return

  saving.value = true
  try {
    await catalogStore.createItem(
      newItemDesc.value.trim(),
      selectedCategoryForItem.value || undefined,
      newItemSku.value.trim() || undefined,
      newItemPrice.value ? parseFloat(newItemPrice.value) : undefined
    )
    newItemDesc.value = ''
    newItemSku.value = ''
    newItemPrice.value = ''
    toastRef.value?.show('Item added', 'success')
    showAddItem.value = false
  } catch (e: any) {
    toastRef.value?.show('Failed to add item', 'error')
  } finally {
    saving.value = false
  }
}

async function archiveCategory(categoryId: string) {
  const cat = categoriesStore.getCategoryById(categoryId)
  if (!cat) return
  
  saving.value = true
  try {
    await categoriesStore.archiveCategory(categoryId)
    toastRef.value?.show(`Archived "${cat.name}"`, 'success')
  } catch (e: any) {
    toastRef.value?.show('Failed to archive category', 'error')
  } finally {
    saving.value = false
  }
}

async function reactivateCategory(categoryId: string) {
  const cat = categoriesStore.getCategoryById(categoryId)
  if (!cat) return

  saving.value = true
  try {
    // Reactivate this category
    await categoriesStore.reactivateCategory(categoryId)
    
    // Then reactivate parent chain if needed
    if (cat.parentId) {
      if (cat.parentId.startsWith('item-')) {
        // Parent is an item - reactivate the item
        const itemId = cat.parentId.slice(5)
        const item = allItems.value.find(i => i.id === itemId)
        if (item && !item.active) {
          await catalogStore.setItemActive(itemId, true)
        }
      } else {
        // Parent is a category - reactivate it recursively
        const parentCat = categoriesStore.getCategoryById(cat.parentId)
        if (parentCat && !parentCat.active) {
          await reactivateCategory(cat.parentId)
        }
      }
    }
    
    toastRef.value?.show(`Reactivated "${cat.name}"`, 'success')
  } catch (e: any) {
    console.error('[AdminShopCatalog] Error reactivating category:', e)
    toastRef.value?.show('Failed to reactivate category', 'error')
  } finally {
    saving.value = false
  }
}

async function deleteCategory(categoryId: string) {
  const cat = categoriesStore.getCategoryById(categoryId)
  if (!cat) return

  if (categoriesStore.hasChildren(categoryId)) {
    toastRef.value?.show('Cannot delete category with subcategories', 'error')
    return
  }

  if (!confirm(`Delete "${cat.name}"? This cannot be undone.`)) return

  saving.value = true
  try {
    await categoriesStore.deleteCategory(categoryId)
    toastRef.value?.show(`Deleted "${cat.name}"`, 'success')
  } catch (e: any) {
    toastRef.value?.show('Failed to delete category', 'error')
  } finally {
    saving.value = false
  }
}

async function editItem(item: ShopCatalogItem) {
  editingItemId.value = item.id
}

async function saveItemFromTree(itemId: string, updates: { description?: string; sku?: string; price?: number }) {
  saving.value = true
  try {
    await catalogStore.updateItem(itemId, updates)
    toastRef.value?.show('Item updated', 'success')
    editingItemId.value = null
  } catch (e: any) {
    console.error('Failed to update item:', e)
    toastRef.value?.show(`Failed to update item: ${e?.message ?? 'Unknown error'}`, 'error')
  } finally {
    saving.value = false
  }
}

async function editCategory(categoryId: string) {
  const cat = categoriesStore.getCategoryById(categoryId)
  if (!cat) return
  
  editingCategoryId.value = categoryId
  editCategoryName.value = cat.name
  editCategoryNameOriginal.value = cat.name
}

async function saveCategoryEdit(categoryId: string) {
  if (!editCategoryName.value.trim()) {
    toastRef.value?.show('Category name is required', 'error')
    return
  }

  if (editCategoryName.value === editCategoryNameOriginal.value) {
    editingCategoryId.value = null
    return
  }

  savingCategoryEdit.value = true
  try {
    await categoriesStore.updateCategory(categoryId, { name: editCategoryName.value.trim() })
    toastRef.value?.show('Category updated', 'success')
  } catch (e: any) {
    toastRef.value?.show('Failed to update category', 'error')
  } finally {
    savingCategoryEdit.value = false
    editingCategoryId.value = null
  }
}

function cancelCategoryEdit() {
  editingCategoryId.value = null
  editCategoryName.value = ''
  editCategoryNameOriginal.value = ''
}

async function deleteItem(item: ShopCatalogItem) {
  if (!confirm(`Delete "${item.description}"? This cannot be undone.`)) return

  saving.value = true
  try {
    await catalogStore.deleteItem(item.id)
    toastRef.value?.show('Item deleted', 'success')
  } catch (e: any) {
    toastRef.value?.show('Failed to delete item', 'error')
  } finally {
    saving.value = false
  }
}

async function archiveItem(item: ShopCatalogItem) {
  saving.value = true
  try {
    // Get all child categories of this item
    const childCategories = categoriesStore.categories.filter(c => c.parentId === `item-${item.id}`)
    const allToArchive = [item.id, ...childCategories.map(c => c.id)]
    
    // Archive the item
    await catalogStore.setItemActive(item.id, false)
    
    // Archive all child categories
    for (const catId of childCategories.map(c => c.id)) {
      await categoriesStore.archiveCategory(catId)
    }
    
    toastRef.value?.show(`Archived "${item.description}" and ${childCategories.length} subcategories`, 'success')
  } catch (e: any) {
    toastRef.value?.show('Failed to archive item', 'error')
  } finally {
    saving.value = false
  }
}

async function reactivateItem(item: ShopCatalogItem) {
  saving.value = true
  try {
    // Just reactivate the item - children stay archived
    await catalogStore.setItemActive(item.id, true)
    toastRef.value?.show(`Reactivated "${item.description}"`, 'success')
  } catch (e: any) {
    toastRef.value?.show('Failed to reactivate item', 'error')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadAll()
})
</script>

<template>
  <Toast ref="toastRef" />
  
  <div class="container-fluid py-4" style="max-width: 1200px;">
    <!-- Header -->
    <div class="mb-4">
      <h2 class="h3 mb-1">Shop Catalog</h2>
      <p class="text-muted small mb-0">Manage product categories and items in a unified tree view</p>
      <div class="mt-3">
        <button class="btn btn-primary" @click="openAddItemDialog()" :disabled="saving">
          <i class="bi bi-plus-circle"></i> Add Item
        </button>
      </div>
    </div>

    <!-- Search Bar -->
    <div class="row mb-4">
      <div class="col">
        <input
          v-model="searchQuery"
          type="text"
          class="form-control form-control-sm"
          placeholder="Search by description, SKU, or price..."
          style="max-width: 400px;"
        />
      </div>
    </div>

    <!-- Error Alert -->
    <div v-if="err" class="alert alert-danger alert-dismissible fade show" role="alert">
      {{ err }}
      <button type="button" class="btn-close" @click="err = ''" />
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>

    <!-- Catalog Tree -->
    <div v-else>
      <AdminCardWrapper title="Catalog" class="table-responsive">
        <div v-if="filteredCategoryTree.length > 0 || filteredUncategorizedItems.length > 0" class="catalog-tree">
          <!-- Uncategorized Items (if any) -->
          <div v-for="itemId of filteredUncategorizedItems" :key="itemId" class="mb-0">
            <ShopCatalogTreeNode
              :node-id="itemId"
              :expanded="expandedNodes"
              :items="allItems"
              :editing-item-id="editingItemId"
              :editing-category-id="editingCategoryId"
              :edit-category-name="editCategoryName"
              :saving-category-edit="savingCategoryEdit"
              @toggle-expand="toggleExpand"
              @add-child="openAddCategoryDialog"
              @edit-item="editItem"
              @save-item="saveItemFromTree"
              @delete-item="deleteItem"
              @archive-item="archiveItem"
              @reactivate-item="reactivateItem"
              @edit-category="editCategory"
              @save-category="saveCategoryEdit"
              @cancel-category-edit="cancelCategoryEdit"
              @cancel-item-edit="() => editingItemId = null"
              @archive="archiveCategory"
              @reactivate="reactivateCategory"
              @delete-category="deleteCategory"
              @update:editCategoryName="(name) => editCategoryName = name"
            />
          </div>
          
          <!-- Categories and their items -->
          <div v-for="cat of filteredCategoryTree" :key="cat.id">
            <ShopCatalogTreeNode
              :node-id="cat.id"
              :expanded="expandedNodes"
              :items="allItems"
              :editing-item-id="editingItemId"
              :editing-category-id="editingCategoryId"
              :edit-category-name="editCategoryName"
              :saving-category-edit="savingCategoryEdit"
              @toggle-expand="toggleExpand"
              @add-child="openAddCategoryDialog"
              @add-item="openAddItemDialog"
              @edit-item="editItem"
              @save-item="saveItemFromTree"
              @delete-item="deleteItem"
              @archive-item="archiveItem"
              @reactivate-item="reactivateItem"
              @edit-category="editCategory"
              @save-category="saveCategoryEdit"
              @cancel-category-edit="cancelCategoryEdit"
              @cancel-item-edit="() => editingItemId = null"
              @archive="archiveCategory"
              @reactivate="reactivateCategory"
              @delete-category="deleteCategory"
              @update:editCategoryName="(name) => editCategoryName = name"
            />
          </div>
        </div>
        <div v-else class="text-center py-5 text-muted">
          <i class="bi bi-inbox" style="font-size: 2rem;"></i>
          <p class="mt-3 mb-0">No categories or items yet. Create one to get started.</p>
        </div>
      </AdminCardWrapper>
    </div>

    <!-- Add Category Modal -->
    <div
      v-if="showAddCategory"
      class="modal d-block bg-dark bg-opacity-50"
      style="display: flex;"
    >
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              {{ parentId ? 'Add Subcategory' : 'Add Category' }}
            </h5>
            <button
              type="button"
              class="btn-close"
              @click="showAddCategory = false"
            />
          </div>
          <div class="modal-body">
            <input
              v-model="newCategoryName"
              type="text"
              class="form-control"
              placeholder="Category name"
              @keyup.enter="createCategory"
            />
          </div>
          <div class="modal-footer">
            <button
              type="button"
              class="btn btn-secondary"
              @click="showAddCategory = false"
            >
              Cancel
            </button>
            <button
              type="button"
              class="btn btn-primary"
              @click="createCategory"
              :disabled="saving || !newCategoryName.trim()"
            >
              {{ saving ? 'Creating...' : 'Create' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Item Modal -->
    <div
      v-if="showAddItem"
      class="modal d-block bg-dark bg-opacity-50"
      style="display: flex;"
    >
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Add Item</h5>
            <button
              type="button"
              class="btn-close"
              @click="showAddItem = false"
            />
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label small">Description</label>
              <input
                v-model="newItemDesc"
                type="text"
                class="form-control"
                placeholder="Item description"
                @keyup.enter="createItem"
              />
            </div>
            <div class="mb-3">
              <label class="form-label small">SKU (optional)</label>
              <input
                v-model="newItemSku"
                type="text"
                class="form-control"
                placeholder="e.g., SKU-12345"
              />
            </div>
            <div class="mb-3">
              <label class="form-label small">Price (optional)</label>
              <input
                v-model="newItemPrice"
                type="number"
                class="form-control"
                step="0.01"
                placeholder="0.00"
              />
            </div>
          </div>
          <div class="modal-footer">
            <button
              type="button"
              class="btn btn-secondary"
              @click="showAddItem = false"
            >
              Cancel
            </button>
            <button
              type="button"
              class="btn btn-primary"
              @click="createItem"
              :disabled="saving || !newItemDesc.trim()"
            >
              {{ saving ? 'Adding...' : 'Add' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;
$select-arrow-color: $body-color;
$select-arrow-hex: str-slice(#{ $select-arrow-color }, 2);
.modal.d-block {
  display: flex !important;
  align-items: center;
  justify-content: center;
}

.catalog-tree {
  border: 1px solid $border-color;
  border-radius: 4px;
  overflow-y: auto;
  max-height: 600px;
  background: $surface;
}

.catalog-tree::-webkit-scrollbar {
  width: 8px;
}

.catalog-tree::-webkit-scrollbar-track {
  background: transparent;
}

.catalog-tree::-webkit-scrollbar-thumb {
  background: rgba($primary, 0.35);
  border-radius: 4px;
}

.catalog-tree::-webkit-scrollbar-thumb:hover {
  background: rgba($primary, 0.5);
}

.table-responsive {
  overflow: visible;
}

/* Dark theme for modals and inputs/dropdowns */
.modal-content {
  background: $surface-2;
  color: $body-color;
  border-color: $border-color;
  box-shadow: $box-shadow;
}

.modal-header,
.modal-footer {
  border-color: $border-color;
}

.btn-close {
  filter: invert(1) contrast(1.1);
}

.form-control,
.form-select {
  background-color: $surface-3;
  color: $body-color;
  border-color: $border-color;
}

.form-control:focus,
.form-select:focus {
  background-color: $surface-3;
  color: $body-color;
  border-color: $primary;
  box-shadow: 0 0 0 0.15rem rgba($primary, 0.25);
}

.form-select {
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill='none' stroke='%23#{$select-arrow-hex}' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M2 5l6 6 6-6'/%3e%3c/svg%3e");
  background-color: $surface-3;
}
</style>
