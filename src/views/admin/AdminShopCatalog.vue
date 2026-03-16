<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import AppPageHeader from '@/components/layout/AppPageHeader.vue'
import Toast from '@/components/Toast.vue'
import AdminCardWrapper from '@/components/admin/AdminCardWrapper.vue'
import ShopCatalogTreeNode from '@/components/admin/ShopCatalogTreeNode.vue'
import BaseAccordionCard from '@/components/common/BaseAccordionCard.vue'
import { useShopCategoriesStore } from '@/stores/shopCategories'
import { useShopCatalogStore } from '@/stores/shopCatalog'
import type { ShopCatalogItem } from '@/services'
import { useCatalogTreeSearch } from '@/composables/useCatalogTreeSearch'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { normalizeError } from '@/services/serviceUtils'
import { logError } from '@/utils'

const toastRef = ref<InstanceType<typeof Toast> | null>(null)
const categoriesStore = useShopCategoriesStore()
const catalogStore = useShopCatalogStore()
const { confirm } = useConfirmDialog()
const {
  categories,
  fullTree,
  isLoading: categoriesLoading,
  error: categoriesError,
} = storeToRefs(categoriesStore)
const { items: allItems, loading: catalogLoading, error: catalogError } = storeToRefs(catalogStore)

const saving = ref(false)
const downloading = ref(false)
const expandedNodes = ref<Set<string>>(new Set())
const newCategoryName = ref('')
const newItemDesc = ref('')
const newItemSku = ref('')
const newItemPrice = ref('')
const showAddCategory = ref(false)
const showAddItemForm = ref(false)
const parentId = ref<string | null>(null) // Can be category ID or item ID
const selectedCategoryForItem = ref<string | null>(null)
const editingItemId = ref<string | null>(null)
const editingCategoryId = ref<string | null>(null)
const editCategoryName = ref('')
const editCategoryNameOriginal = ref('')
const savingCategoryEdit = ref(false)
const searchQuery = ref('')

// Computed
const loading = computed(() => categoriesLoading.value || catalogLoading.value)
const err = computed(() => categoriesError.value || catalogError.value || '')
const clearErrors = () => {
  categoriesStore.clearError()
  catalogStore.clearError()
}
const {
  filteredCategoryTree,
  filteredUncategorizedItemNodeIds: filteredUncategorizedItems,
  buildExpandedNodesForSearch,
} = useCatalogTreeSearch({
  searchQuery,
  categories,
  allItems,
  fullTree,
  getCategoryById: (id) => categoriesStore.getCategoryById(id),
  getChildren: (parentId) => categoriesStore.getChildren(parentId),
})

function loadAll() {
  categoriesStore.subscribeAllCategories()
  catalogStore.subscribeCatalog()
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

  const category = categories.value.find(c => c.id === nodeId)
  if (!category?.parentId) {
    return
  }

  const parentNodeId = resolveParentNodeId(category.parentId)
  set.add(parentNodeId)
  expandAncestors(parentNodeId, set, depth + 1)
}

watch(
  () => searchQuery.value,
  () => {
    if (!searchQuery.value.trim()) return
    expandedNodes.value = buildExpandedNodesForSearch()
  },
  { immediate: false }
)

function openAddCategoryDialog(id: string | null = null) {
  parentId.value = id
  newCategoryName.value = ''
  showAddCategory.value = true
}

function openAddItemDialog(categoryId: string | null = null) {
  selectedCategoryForItem.value = categoryId
  newItemDesc.value = ''
  newItemSku.value = ''
  newItemPrice.value = ''
  showAddItemForm.value = true
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
  } catch (e) {
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
    showAddItemForm.value = false
  } catch (e) {
    toastRef.value?.show('Failed to add item', 'error')
  } finally {
    saving.value = false
  }
}

function cancelAddItem() {
  newItemDesc.value = ''
  newItemSku.value = ''
  newItemPrice.value = ''
  selectedCategoryForItem.value = null
  showAddItemForm.value = false
}

async function archiveCategory(categoryId: string) {
  const cat = categoriesStore.getCategoryById(categoryId)
  if (!cat) return
  
  saving.value = true
  try {
    await categoriesStore.archiveCategory(categoryId)
    toastRef.value?.show(`Archived "${cat.name}"`, 'success')
  } catch (e) {
    toastRef.value?.show('Failed to archive category', 'error')
  } finally {
    saving.value = false
  }
}

async function reactivateCategory(categoryId: string) {
  const visited = new Set<string>()
  const MAX_DEPTH = 100
  const reactivateRecursive = async (id: string, depth = 0): Promise<void> => {
    if (depth > MAX_DEPTH) return
    if (visited.has(id)) return
    visited.add(id)

    const current = categoriesStore.getCategoryById(id)
    if (!current) return

    // Reactivate this category
    await categoriesStore.reactivateCategory(id)

    // Then reactivate parent chain if needed
    if (current.parentId) {
      if (current.parentId.startsWith('item-')) {
        // Parent is an item - reactivate the item
        const itemId = current.parentId.slice(5)
        const item = allItems.value.find(i => i.id === itemId)
        if (item && !item.active) {
          await catalogStore.setItemActive(itemId, true)
        }
      } else {
        // Parent is a category - reactivate it recursively
        const parentCat = categoriesStore.getCategoryById(current.parentId)
        if (parentCat && !parentCat.active) {
          await reactivateRecursive(current.parentId, depth + 1)
        }
      }
    }
  }

  const cat = categoriesStore.getCategoryById(categoryId)
  if (!cat) return

  saving.value = true
  try {
    await reactivateRecursive(categoryId)
    toastRef.value?.show(`Reactivated "${cat.name}"`, 'success')
  } catch (e) {
    logError('AdminShopCatalog', 'Error reactivating category', e)
    toastRef.value?.show('Failed to reactivate category', 'error')
  } finally {
    saving.value = false
  }
}

async function deleteCategory(categoryId: string) {
  const cat = categoriesStore.getCategoryById(categoryId)
  if (!cat) return

  const categoryIds: string[] = []
  const visited = new Set<string>()
  const MAX_DEPTH = 100
  const collectCategoryDescendants = (id: string, depth = 0) => {
    if (depth > MAX_DEPTH) return
    if (visited.has(id)) return
    visited.add(id)
    const children = categoriesStore.getChildren(id)
    children.forEach(child => {
      collectCategoryDescendants(child.id, depth + 1)
      categoryIds.push(child.id)
    })
  }
  collectCategoryDescendants(categoryId)

  const itemIds = allItems.value
    .filter(item => item.categoryId && [categoryId, ...categoryIds].includes(item.categoryId))
    .map(item => item.id)

  const totalDescendants = categoryIds.length + itemIds.length
  const confirmMessage = totalDescendants > 0
    ? `Delete "${cat.name}" and ${totalDescendants} descendant item(s)/category(ies)? This cannot be undone.`
    : `Delete "${cat.name}"? This cannot be undone.`
  const confirmed = await confirm(confirmMessage, {
    title: 'Delete Category',
    confirmText: 'Delete',
    variant: 'danger',
  })
  if (!confirmed) return

  saving.value = true
  try {
    // Delete descendant items first
    for (const itemId of itemIds) {
      await catalogStore.deleteItem(itemId)
    }

    // Delete descendant categories deepest-first
    for (const childCategoryId of categoryIds) {
      await categoriesStore.deleteCategory(childCategoryId)
    }

    // Delete selected category
    await categoriesStore.deleteCategory(categoryId)
    toastRef.value?.show(`Deleted "${cat.name}"${totalDescendants ? ` with ${totalDescendants} descendants` : ''}`, 'success')
  } catch (e) {
    toastRef.value?.show('Failed to delete category', 'error')
  } finally {
    saving.value = false
  }
}

async function editItem(item: ShopCatalogItem) {
  editingItemId.value = item.id
}

async function saveItemFromTree(
  itemId: string,
  updates: { description?: string; sku?: string | null; price?: number | null }
) {
  saving.value = true
  try {
    await catalogStore.updateItem(itemId, updates)
    toastRef.value?.show('Item updated', 'success')
    editingItemId.value = null
  } catch (err) {
    logError('AdminShopCatalog', 'Failed to update item', err)
    toastRef.value?.show(`Failed to update item: ${normalizeError(err, 'Unknown error')}`, 'error')
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
  } catch (e) {
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
  const childCategories = categories.value.filter(
    c => c.parentId === `item-${item.id}` || c.parentId === item.id
  )

  const descendantCategoryIds: string[] = []
  const visited = new Set<string>()
  const MAX_DEPTH = 100
  const collectCategoryDescendants = (parentCategoryId: string, depth = 0) => {
    if (depth > MAX_DEPTH) return
    if (visited.has(parentCategoryId)) return
    visited.add(parentCategoryId)
    const children = categoriesStore.getChildren(parentCategoryId)
    children.forEach(child => {
      collectCategoryDescendants(child.id, depth + 1)
      descendantCategoryIds.push(child.id)
    })
  }

  childCategories.forEach(cat => {
    collectCategoryDescendants(cat.id)
    descendantCategoryIds.push(cat.id)
  })

  const allCascadeCategoryIds = Array.from(new Set(descendantCategoryIds))
  const descendantItemIds = allItems.value
    .filter(i => i.categoryId && allCascadeCategoryIds.includes(i.categoryId))
    .map(i => i.id)

  const cascadeCount = allCascadeCategoryIds.length + descendantItemIds.length
  const confirmMessage = cascadeCount > 0
    ? `Delete "${item.description}" and ${cascadeCount} descendant item(s)/category(ies)? This cannot be undone.`
    : `Delete "${item.description}"? This cannot be undone.`
  const confirmed = await confirm(confirmMessage, {
    title: 'Delete Item',
    confirmText: 'Delete',
    variant: 'danger',
  })
  if (!confirmed) return

  saving.value = true
  try {
    // Delete descendant items first
    for (const childItemId of descendantItemIds) {
      await catalogStore.deleteItem(childItemId)
    }

    // Delete descendant categories deepest-first
    for (const categoryId of allCascadeCategoryIds) {
      await categoriesStore.deleteCategory(categoryId)
    }

    // Delete selected item
    await catalogStore.deleteItem(item.id)
    toastRef.value?.show(cascadeCount > 0 ? `Item and ${cascadeCount} descendants deleted` : 'Item deleted', 'success')
  } catch (e) {
    toastRef.value?.show('Failed to delete item', 'error')
  } finally {
    saving.value = false
  }
}

async function archiveItem(item: ShopCatalogItem) {
  saving.value = true
  try {
    // Get all child categories of this item
  const childCategories = categories.value.filter(c => c.parentId === `item-${item.id}`)
    
    // Archive the item
    await catalogStore.setItemActive(item.id, false)
    
    // Archive all child categories
    for (const catId of childCategories.map(c => c.id)) {
      await categoriesStore.archiveCategory(catId)
    }
    
    toastRef.value?.show(`Archived "${item.description}" and ${childCategories.length} subcategories`, 'success')
  } catch (e) {
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
  } catch (e) {
    toastRef.value?.show('Failed to reactivate item', 'error')
  } finally {
    saving.value = false
  }
}

const normalizeCategoryId = (value?: string | null) => {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed
}

const escapeCsv = (value: unknown) => {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (/[",\n]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

async function downloadCatalog() {
  if (!allItems.value.length && !categories.value.length) return

  downloading.value = true
  try {
    const header = ['Name', 'Type', 'SKU', 'Price', 'Active', 'Path', 'Hierarchy Level', 'Is Sub Item', 'ID']

    const getChildrenNormalized = (parentId: string | null) =>
      categories.value
        .filter(c => normalizeCategoryId(c.parentId) === normalizeCategoryId(parentId))
        .sort((a, b) => a.name.localeCompare(b.name))

    // Group items by normalized categoryId for fast lookup (handles null/empty)
    const itemsByCategory = new Map<string | null, ShopCatalogItem[]>()
    allItems.value.forEach(item => {
      const key = normalizeCategoryId(item.categoryId)
      const arr = itemsByCategory.get(key) ?? []
      arr.push(item)
      itemsByCategory.set(key, arr)
    })

    const sortItems = (arr: ShopCatalogItem[] = []) => arr.slice().sort((a, b) => a.description.localeCompare(b.description))

    const rows: (string | number)[][] = []
    const MAX_DEPTH = 200
    const visitedCategories = new Set<string>()
    const visitedItems = new Set<string>()

    const addItemRow = (item: ShopCatalogItem, path: string, level: number, depth: number) => {
      if (depth > MAX_DEPTH) return
      if (visitedItems.has(item.id)) return
      visitedItems.add(item.id)

      const isSubItem = level > 0 ? 'Yes' : 'No'
      rows.push([
        item.description || '',
        'Item',
        item.sku || '',
        typeof item.price === 'number' ? item.price.toFixed(2) : '',
        item.active === false ? 'Inactive' : 'Active',
        path,
        level,
        isSubItem,
        item.id,
      ])

      // Traverse subcategories that hang off this item (parentId = item-<id>)
      const childCategories = getChildrenNormalized(`item-${item.id}`)
      const childCategoriesLegacy = getChildrenNormalized(item.id)
      const nextPathBase = path ? `${path} > ${item.description}` : item.description
      childCategories.forEach(childCat => traverseCategory(childCat.id, nextPathBase, level + 1, depth + 1))
      childCategoriesLegacy.forEach(childCat => traverseCategory(childCat.id, nextPathBase, level + 1, depth + 1))
    }

    const traverseCategory = (categoryId: string, parentPath: string, level: number, depth: number) => {
      if (depth > MAX_DEPTH) return
      if (visitedCategories.has(categoryId)) return
      visitedCategories.add(categoryId)

      const cat = categoriesStore.getCategoryById(categoryId)
      if (!cat) return
      const path = parentPath ? `${parentPath} > ${cat.name}` : cat.name

      rows.push([
        cat.name,
        'Category',
        '',
        '',
        cat.active === false ? 'Inactive' : 'Active',
        path,
        level,
        level > 0 ? 'Yes' : 'No',
        cat.id,
      ])

      const itemsInCategory = sortItems(itemsByCategory.get(normalizeCategoryId(categoryId)) ?? [])
      itemsInCategory.forEach(item => addItemRow(item, path, level + 1, depth + 1))

      const childCategories = getChildrenNormalized(categoryId)
      childCategories.forEach(child => traverseCategory(child.id, path, level + 1, depth + 1))
    }

    // Root-level items (no category / empty category)
    sortItems(itemsByCategory.get(null) ?? []).forEach(item => addItemRow(item, '', 0, 0))

    // Root-level categories (parentId === null or empty)
    const rootCategories = getChildrenNormalized(null)
    const seenRootIds = new Set<string>()
    rootCategories
      .filter(cat => {
        if (seenRootIds.has(cat.id)) return false
        seenRootIds.add(cat.id)
        return true
      })
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(cat => traverseCategory(cat.id, '', 0, 0))

    const csv = [header, ...rows]
      .map(row => row.map(escapeCsv).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'shop-catalog.csv'
    link.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    logError('AdminShopCatalog', 'Failed to download catalog', e)
    toastRef.value?.show('Failed to download catalog', 'error')
  } finally {
    downloading.value = false
  }
}

onMounted(() => {
  loadAll()
})

onUnmounted(() => {
  categoriesStore.stopCategoriesSubscription()
  catalogStore.stopCatalogSubscription()
})
</script>

<template>
  <Toast ref="toastRef" />
  
  <div class="app-page">
    <!-- Header -->
    <AppPageHeader eyebrow="Admin Panel" title="Shop Catalog" subtitle="Manage product categories and items in a unified tree view.">
      <template #actions>
        <button
          class="btn btn-outline-primary"
          type="button"
          @click="downloadCatalog"
          :disabled="loading || !allItems.length || downloading"
        >
          <span
            v-if="downloading"
            class="spinner-border spinner-border-sm me-2"
            role="status"
            aria-hidden="true"
          ></span>
          Download catalog
        </button>
      </template>
    </AppPageHeader>

    <BaseAccordionCard
      v-model:open="showAddItemForm"
      title="Add Top-Level Item"
      subtitle="Create a root catalog item with optional SKU and price"
    >
      <form class="row g-3" @submit.prevent="createItem">
        <div class="col-md-6">
          <label class="form-label small">Description</label>
          <input
            v-model="newItemDesc"
            type="text"
            class="form-control"
            placeholder="Item description"
            required
          />
        </div>
        <div class="col-md-3">
          <label class="form-label small">SKU (optional)</label>
          <input
            v-model="newItemSku"
            type="text"
            class="form-control"
            placeholder="e.g., SKU-12345"
          />
        </div>
        <div class="col-md-3">
          <label class="form-label small">Price (optional)</label>
          <input
            v-model="newItemPrice"
            type="number"
            class="form-control"
            step="0.01"
            placeholder="0.00"
          />
        </div>
        <div class="col-12 d-flex gap-2 justify-content-end pt-2">
          <button type="button" class="btn btn-outline-secondary" @click.stop="cancelAddItem" :disabled="saving">
            Cancel
          </button>
          <button type="submit" class="btn btn-primary" :disabled="saving || !newItemDesc.trim()">
            <span v-if="saving" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            Add Item
          </button>
        </div>
      </form>
    </BaseAccordionCard>

    <!-- Search Bar -->
    <div class="card app-toolbar-card mb-4">
      <div class="card-body">
        <input
          v-model="searchQuery"
          type="text"
          class="form-control"
          placeholder="Search by description, SKU, or price..."
        />
      </div>
    </div>

    <!-- Error Alert -->
    <div v-if="err" class="alert alert-danger alert-dismissible fade show" role="alert">
      {{ err }}
      <button type="button" class="btn-close" @click="clearErrors" />
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
        <div v-if="filteredCategoryTree.length > 0 || filteredUncategorizedItems.length > 0" class="app-catalog-tree">
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
          <i class="bi bi-inbox empty-catalog-icon"></i>
          <p class="mt-3 mb-0">No categories or items yet. Create one to get started.</p>
        </div>
      </AdminCardWrapper>
    </div>

    <!-- Add Category Modal -->
    <div
      v-if="showAddCategory"
      class="modal d-block bg-dark bg-opacity-50 catalog-modal"
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

  </div>
</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;
$select-arrow-color: $body-color;
$select-arrow-hex: str-slice(#{ $select-arrow-color }, 2);
.catalog-modal {
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-catalog-icon {
  font-size: 2rem;
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

