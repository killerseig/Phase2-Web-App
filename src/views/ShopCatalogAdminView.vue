<script setup lang="ts">
import {
  computed,
  ref,
  type ComponentPublicInstance,
} from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import ShopCatalogContextMenu from '@/components/shopCatalog/ShopCatalogContextMenu.vue'
import ShopCatalogInspectorPane from '@/components/shopCatalog/ShopCatalogInspectorPane.vue'
import ShopCatalogMobileNav from '@/components/shopCatalog/ShopCatalogMobileNav.vue'
import ShopCatalogTreePane from '@/components/shopCatalog/ShopCatalogTreePane.vue'
import { usePageMessages } from '@/composables/usePageMessages'
import { useToastMessages } from '@/composables/useToastMessages'
import { useWindowEventListener } from '@/composables/useWindowEventListener'
import { useShopCatalogContextMenu } from '@/features/shopCatalog/useShopCatalogContextMenu'
import { useShopCatalogArchiveActions } from '@/features/shopCatalog/useShopCatalogArchiveActions'
import { useShopCatalogContextMenuActions } from '@/features/shopCatalog/useShopCatalogContextMenuActions'
import { useShopCatalogContextDeleteActions } from '@/features/shopCatalog/useShopCatalogContextDeleteActions'
import { useShopCatalogContextMenuTargets } from '@/features/shopCatalog/useShopCatalogContextMenuTargets'
import { useShopCatalogConfirmDispatcher } from '@/features/shopCatalog/useShopCatalogConfirmDispatcher'
import { useShopCatalogConfirmDialog } from '@/features/shopCatalog/useShopCatalogConfirmDialog'
import { useShopCatalogDeleteActions } from '@/features/shopCatalog/useShopCatalogDeleteActions'
import { useShopCatalogDragDrop } from '@/features/shopCatalog/useShopCatalogDragDrop'
import { useShopCatalogDerivedData } from '@/features/shopCatalog/useShopCatalogDerivedData'
import { useShopCatalogFormActions } from '@/features/shopCatalog/useShopCatalogFormActions'
import { useShopCatalogForms } from '@/features/shopCatalog/useShopCatalogForms'
import { useShopCatalogInlineEditing } from '@/features/shopCatalog/useShopCatalogInlineEditing'
import { useShopCatalogInlineActions } from '@/features/shopCatalog/useShopCatalogInlineActions'
import { useShopCatalogAdminLifecycle } from '@/features/shopCatalog/useShopCatalogAdminLifecycle'
import { useShopCatalogInspectorSummary } from '@/features/shopCatalog/useShopCatalogInspectorSummary'
import { useShopCatalogMoveActions } from '@/features/shopCatalog/useShopCatalogMoveActions'
import { useShopCatalogRecords } from '@/features/shopCatalog/useShopCatalogRecords'
import { useShopCatalogResponsivePanel } from '@/features/shopCatalog/useShopCatalogResponsivePanel'
import {
  useShopCatalogSelection,
} from '@/features/shopCatalog/useShopCatalogSelection'
import { useShopCatalogSelectionSync } from '@/features/shopCatalog/useShopCatalogSelectionSync'
import { useShopCatalogTreeDisplayState } from '@/features/shopCatalog/useShopCatalogTreeDisplayState'
import { useShopCatalogTreeExpansion } from '@/features/shopCatalog/useShopCatalogTreeExpansion'
import { useShopCatalogTreeInteractions } from '@/features/shopCatalog/useShopCatalogTreeInteractions'
import AppShell from '@/layouts/AppShell.vue'

const {
  categories,
  error: catalogError,
  items,
  loading: catalogLoading,
  stopCatalogRecords,
  subscribeCatalogRecords,
} = useShopCatalogRecords({
  loadingMode: 'category-or-items',
  categoryErrorMessage: 'Failed to load folders.',
  itemErrorMessage: 'Failed to load catalog items.',
})
const treeSearch = ref('')
const showArchived = ref(false)
const {
  pageError: createError,
  resetMessages: resetCreateMessages,
  setPageError: setCreateError,
  setPageErrorMessage: setCreateErrorMessage,
} = usePageMessages()
const {
  pageError: detailError,
  pageInfo: detailInfo,
  resetMessages: resetDetailMessages,
  setPageError: setDetailError,
  setPageErrorMessage: setDetailErrorMessage,
  setPageInfo: setDetailInfo,
} = usePageMessages()
const createLoading = ref(false)
const saveLoading = ref(false)
const deleteLoading = ref(false)
const treeInitialized = ref(false)
const treeListElement = ref<HTMLDivElement | null>(null)
const {
  clearPointerType,
  closeContextMenu,
  consumeSuppressedClick,
  contextMenu,
  disposeContextMenu,
  beginLongPress,
  handleLongPressEnd,
  handleLongPressMove,
  openContextMenu,
  shouldBlockDragStart,
} = useShopCatalogContextMenu()
const {
  cancelInlineCreate,
  cancelRename,
  createState,
  focusInlineInput,
  isCreatingNode,
  isRenamingNode,
  renameState,
  setInlineInputRef: setRenameInputRef,
  startInlineCreate,
  startInlineRename,
} = useShopCatalogInlineEditing()

function setTreeListRef(element: Element | ComponentPublicInstance | null) {
  treeListElement.value = element instanceof HTMLDivElement ? element : null
}

const {
  categoriesById,
  categoryOptions,
  childCategoriesByParent,
  childItemsByParent,
  getCategoryPath,
  getDirectChildCategoryCount,
  getDirectChildItemCount,
  getVisibleChildCategoryCount,
  getVisibleChildItemCount,
  visibleFolderCount,
  visibleItemCount,
} = useShopCatalogDerivedData({
  categories,
  items,
  showArchived,
})

const catalogConfirmBusy = computed(() => saveLoading.value || deleteLoading.value)
const {
  catalogConfirmAction,
  catalogConfirmDestructive,
  catalogConfirmLabel,
  catalogConfirmMessage,
  catalogConfirmTitle,
  handleCatalogConfirmOpenUpdate,
} = useShopCatalogConfirmDialog(catalogConfirmBusy)

const {
  activeMobilePanel,
  isSinglePaneLayout,
  showInspectorPanel,
  showMobilePanel,
  syncLayoutMode,
} = useShopCatalogResponsivePanel()

const {
  collapseAllCategories,
  ensureExpandedToCategory,
  expandAllCategories,
  expandedCategoryIds,
  getVisibleCategoryIds,
  initializeRootCategories,
  isCategoryExpanded,
  rootBucketExpanded,
  toggleCategoryExpanded,
  toggleRootBucketExpanded,
} = useShopCatalogTreeExpansion({
  categories,
  categoriesById,
  closeContextMenu,
  showArchived,
})

const {
  activeFolderId,
  inspectItem,
  isCreateCategoryMode,
  isCreateItemMode,
  isRootInspector,
  selectFolder,
  selectedCategory,
  selectedCategoryId,
  selectedInspectorKey,
  selectedItem,
  selectedItemId,
  selectRoot,
} = useShopCatalogSelection({
  cancelInlineCreate,
  categoriesById,
  ensureExpandedToCategory,
  items,
  showInspectorPanel,
})

const {
  applySelectedCategoryToForm,
  applySelectedItemToForm,
  createCategoryForm,
  createItemForm,
  detailCategoryForm,
  detailItemForm,
  handlePriceBlur,
  handlePriceFocus,
  handlePriceInput,
  prepareCreateItemForm,
  resetCreateCategoryForm,
  resetCreateItemForm,
} = useShopCatalogForms({
  activeFolderId,
  createError,
  detailError,
  detailInfo,
})

const {
  handleDragMoveError,
  moveDraggedEntry,
} = useShopCatalogMoveActions({
  categoriesById,
  ensureExpandedToCategory,
  inspectItem,
  items,
  resetDetailMessages,
  selectFolder,
  setDetailError,
  setDetailInfo,
})

const {
  clearDragState,
  dragState,
  handleDragLeave,
  handleNodeDragOver,
  handleNodeDrop,
  handleRootDragOver,
  handleRootDrop,
  handleTreeDragEnd,
  handleTreeDragStart,
  handleTreeListDragLeave,
  handleTreeListDragOver,
  stopTreeListAutoScroll,
} = useShopCatalogDragDrop({
  categoriesById,
  childCategoriesByParent,
  clearPointerType,
  closeContextMenu,
  getScrollContainer: () => treeListElement.value,
  isCreatingNode,
  isRenamingNode,
  items,
  moveEntry: moveDraggedEntry,
  onMoveError: handleDragMoveError,
  shouldBlockDragStart,
})

const {
  beginNodeLongPress,
  beginRootLongPress,
  openNodeContextMenu,
  openRootContextMenu,
} = useShopCatalogContextMenuTargets({
  beginLongPress,
  openContextMenu,
})

useToastMessages([
  { source: catalogError, severity: 'error', summary: 'Shop Catalog' },
  { source: createError, severity: 'error', summary: 'Catalog Create' },
  { source: detailError, severity: 'error', summary: 'Catalog Inspector' },
  { source: detailInfo, severity: 'success', summary: 'Catalog Inspector' },
])

const {
  confirmArchiveCategory,
  confirmArchiveItem,
  handleArchiveCategory,
  handleArchiveItem,
} = useShopCatalogArchiveActions({
  activeFolderId,
  catalogConfirmAction,
  categoriesById,
  childCategoriesByParent,
  inspectItem,
  items,
  resetDetailMessages,
  saveLoading,
  selectFolder,
  selectedCategory,
  selectedInspectorKey,
  selectedItem,
  setDetailError,
  setDetailInfo,
  showArchived,
})

const {
  beginInlineCreate,
  beginRenameNode,
  openCreateItemMode,
  saveInlineCreate,
  saveInlineRename,
} = useShopCatalogInlineActions({
  activeFolderId,
  cancelInlineCreate,
  cancelRename,
  categoriesById,
  closeContextMenu,
  createState,
  ensureExpandedToCategory,
  expandedCategoryIds,
  focusInlineInput,
  inspectItem,
  items,
  prepareCreateItemForm,
  renameState,
  rootBucketExpanded,
  selectFolder,
  selectedInspectorKey,
  setCreateError,
  setCreateErrorMessage,
  setDetailError,
  showInspectorPanel,
  startInlineCreate,
  startInlineRename,
})

const {
  detailCategoryParentOptions,
  rootBucketHasChildren,
  rootBucketSummary,
  treeNodes,
} = useShopCatalogTreeDisplayState({
  categoryOptions,
  childCategoriesByParent,
  childItemsByParent,
  createState,
  expandedCategoryIds,
  getCategoryPath,
  getVisibleChildCategoryCount,
  getVisibleChildItemCount,
  rootBucketExpanded,
  selectedCategory,
  showArchived,
  treeSearch,
})

const {
  handleGlobalKeydown,
  handleGlobalPointerDown,
  handleRootBucketClick,
  handleRootSurfaceClick,
  handleTreeNodeClick,
} = useShopCatalogTreeInteractions({
  clearDragState,
  closeContextMenu,
  consumeSuppressedClick,
  inspectItem,
  items,
  selectFolder,
  selectRoot,
  toggleCategoryExpanded,
  toggleRootBucketExpanded,
})

useWindowEventListener('pointerdown', handleGlobalPointerDown)
useWindowEventListener('keydown', handleGlobalKeydown)
useWindowEventListener('resize', syncLayoutMode)

const {
  handleCreateCategory,
  handleCreateItem,
  handleSaveCategory,
  handleSaveItem,
} = useShopCatalogFormActions({
  activeFolderId,
  createCategoryForm,
  createItemForm,
  createLoading,
  detailCategoryForm,
  detailItemForm,
  ensureExpandedToCategory,
  expandedCategoryIds,
  resetDetailMessages,
  saveLoading,
  selectedCategory,
  selectedInspectorKey,
  selectedItem,
  setCreateError,
  setCreateErrorMessage,
  setDetailError,
  setDetailErrorMessage,
  setDetailInfo,
  showInspectorPanel,
})

const {
  selectedCategoryHasChildren,
  selectedCategoryPathLabel,
  selectedCategorySummaryLabel,
  selectedCategoryTitle,
  selectedItemPathLabel,
  selectedItemPriceLabel,
  selectedItemSkuLabel,
  selectedItemTitle,
} = useShopCatalogInspectorSummary({
  childCategoriesByParent,
  childItemsByParent,
  getCategoryPath,
  selectedCategory,
  selectedItem,
})

function handleSelectedCategoryArchiveRequest() {
  if (!selectedCategory.value) return
  handleArchiveCategory(!selectedCategory.value.active)
}

function handleSelectedItemArchiveRequest() {
  if (!selectedItem.value) return
  handleArchiveItem(!selectedItem.value.active)
}

const {
  confirmDeleteCategory,
  confirmDeleteItem,
  handleDeleteCategory,
  handleDeleteItem,
} = useShopCatalogDeleteActions({
  activeFolderId,
  catalogConfirmAction,
  deleteLoading,
  resetDetailMessages,
  selectedCategory,
  selectedCategoryHasChildren,
  selectedInspectorKey,
  selectedItem,
  setDetailError,
  setDetailErrorMessage,
})

const {
  deleteCategoryFromContext,
  deleteItemFromContext,
} = useShopCatalogContextDeleteActions({
  closeContextMenu,
  handleDeleteCategory,
  handleDeleteItem,
  inspectItem,
  items,
  selectFolder,
})

const { contextMenuActions } = useShopCatalogContextMenuActions({
  beginInlineCreate,
  beginRenameNode,
  closeContextMenu,
  collapseAllCategories,
  deleteCategoryFromContext,
  deleteItemFromContext,
  expandedCategoryIds,
  expandAllCategories,
  getCategoryById: (categoryId) => categoriesById.value.get(categoryId) ?? null,
  getDirectChildCategoryCount,
  getDirectChildItemCount,
  getItemById: (itemId) => items.value.find((candidate) => candidate.id === itemId) ?? null,
  getVisibleCategoryIds,
  handleArchiveCategory,
  handleArchiveItem,
  inspectItem,
  isSinglePaneLayout,
  openCreateItemMode,
  rootBucketExpanded,
  selectFolder,
  selectRoot,
  showMobileInspector: () => showMobilePanel('inspector'),
  target: computed(() => contextMenu.target),
})

const { confirmCatalogAction } = useShopCatalogConfirmDispatcher({
  catalogConfirmAction,
  confirmArchiveCategory,
  confirmArchiveItem,
  confirmDeleteCategory,
  confirmDeleteItem,
})

useShopCatalogSelectionSync({
  activeFolderId,
  applySelectedCategoryToForm,
  applySelectedItemToForm,
  categories,
  initializeRootCategories,
  isCreateCategoryMode,
  isCreateItemMode,
  items,
  resetCreateCategoryForm,
  resetCreateItemForm,
  selectedCategory,
  selectedCategoryId,
  selectedInspectorKey,
  selectedItem,
  selectedItemId,
  treeInitialized,
})

useShopCatalogAdminLifecycle({
  disposeContextMenu,
  stopCatalogRecords,
  stopTreeListAutoScroll,
  subscribeCatalogRecords,
  syncLayoutMode,
})
</script>

<template>
  <AppShell>
    <div
      class="catalog-explorer"
      data-testid="shop-catalog-page"
      :class="{
        'catalog-explorer--mobile-catalog': activeMobilePanel === 'catalog',
        'catalog-explorer--mobile-inspector': activeMobilePanel === 'inspector',
      }"
    >
      <ShopCatalogMobileNav :active-panel="activeMobilePanel" @show="showMobilePanel" />

      <ShopCatalogTreePane
        :search="treeSearch"
        :show-archived="showArchived"
        :catalog-loading="catalogLoading"
        :selected-inspector-key="selectedInspectorKey"
        :root-bucket-expanded="rootBucketExpanded"
        :root-bucket-has-children="rootBucketHasChildren"
        :root-bucket-summary="rootBucketSummary"
        :tree-nodes="treeNodes"
        :drag-source-key="dragState.sourceKey"
        :drag-over-key="dragState.overKey"
        :create-key="createState.key"
        :create-value="createState.value"
        :rename-key="renameState.key"
        :rename-value="renameState.value"
        :expanded-category-ids="expandedCategoryIds"
        :set-input-ref="setRenameInputRef"
        :set-list-ref="setTreeListRef"
        @update-search="treeSearch = $event"
        @update-show-archived="showArchived = $event"
        @root-surface-click="(event) => handleRootSurfaceClick(event)"
        @root-context-menu="(event) => openRootContextMenu(event)"
        @root-pointer-down="(event) => beginRootLongPress(event)"
        @root-pointer-move="handleLongPressMove"
        @root-pointer-up="handleLongPressEnd"
        @root-pointer-cancel="handleLongPressEnd"
        @tree-list-drag-over="handleTreeListDragOver"
        @tree-list-drag-leave="handleTreeListDragLeave"
        @root-drag-over="handleRootDragOver"
        @root-drag-leave="handleDragLeave($event, 'root')"
        @root-drop="handleRootDrop"
        @root-bucket-click="(event) => handleRootBucketClick(event)"
        @root-toggle-expanded="toggleRootBucketExpanded"
        @node-click="handleTreeNodeClick"
        @node-context-menu="openNodeContextMenu"
        @node-pointer-down="beginNodeLongPress"
        @node-pointer-move="handleLongPressMove"
        @node-pointer-up="handleLongPressEnd"
        @node-pointer-cancel="handleLongPressEnd"
        @node-drag-start="handleTreeDragStart"
        @node-drag-end="handleTreeDragEnd"
        @node-drag-over="handleNodeDragOver"
        @node-drag-leave="handleDragLeave"
        @node-drop="handleNodeDrop"
        @toggle-category-expanded="toggleCategoryExpanded"
        @update-create-value="createState.value = $event"
        @update-rename-value="renameState.value = $event"
        @save-inline-create="saveInlineCreate"
        @cancel-inline-create="cancelInlineCreate"
        @save-inline-rename="saveInlineRename"
        @cancel-rename="cancelRename"
      />

      <ShopCatalogInspectorPane
        :mobile-visible="activeMobilePanel === 'inspector'"
        :is-root-inspector="isRootInspector"
        :is-create-category-mode="isCreateCategoryMode"
        :is-create-item-mode="isCreateItemMode"
        :visible-folder-count="visibleFolderCount"
        :visible-item-count="visibleItemCount"
        :create-category-form="createCategoryForm"
        :create-item-form="createItemForm"
        :category-options="categoryOptions"
        :create-loading="createLoading"
        :selected-category="selectedCategory"
        :detail-category-form="detailCategoryForm"
        :detail-category-parent-options="detailCategoryParentOptions"
        :selected-category-title="selectedCategoryTitle"
        :selected-category-path-label="selectedCategoryPathLabel"
        :selected-category-summary-label="selectedCategorySummaryLabel"
        :selected-category-has-children="selectedCategoryHasChildren"
        :selected-item="selectedItem"
        :detail-item-form="detailItemForm"
        :selected-item-title="selectedItemTitle"
        :selected-item-path-label="selectedItemPathLabel"
        :selected-item-sku-label="selectedItemSkuLabel"
        :selected-item-price-label="selectedItemPriceLabel"
        :save-loading="saveLoading"
        :delete-loading="deleteLoading"
        @submit-create-category="handleCreateCategory"
        @update-create-category-name="createCategoryForm.name = $event"
        @update-create-category-parent-id="createCategoryForm.parentId = $event"
        @update-create-category-active="createCategoryForm.active = $event"
        @submit-create-item="handleCreateItem"
        @update-create-item-description="createItemForm.description = $event"
        @update-create-item-category-id="createItemForm.categoryId = $event"
        @update-create-item-sku="createItemForm.sku = $event"
        @update-create-item-active="createItemForm.active = $event"
        @create-item-price-input="handlePriceInput(createItemForm, $event)"
        @create-item-price-focus="handlePriceFocus(createItemForm)"
        @create-item-price-blur="handlePriceBlur(createItemForm)"
        @submit-category="handleSaveCategory"
        @update-category-name="detailCategoryForm.name = $event"
        @update-category-parent-id="detailCategoryForm.parentId = $event"
        @update-category-active="detailCategoryForm.active = $event"
        @archive-category="handleSelectedCategoryArchiveRequest"
        @delete-category="handleDeleteCategory"
        @submit-item="handleSaveItem"
        @update-item-description="detailItemForm.description = $event"
        @update-item-sku="detailItemForm.sku = $event"
        @update-item-active="detailItemForm.active = $event"
        @detail-item-price-input="handlePriceInput(detailItemForm, $event)"
        @detail-item-price-focus="handlePriceFocus(detailItemForm)"
        @detail-item-price-blur="handlePriceBlur(detailItemForm)"
        @archive-item="handleSelectedItemArchiveRequest"
        @delete-item="handleDeleteItem"
      />

      <ShopCatalogContextMenu
        :visible="contextMenu.visible"
        :x="contextMenu.x"
        :y="contextMenu.y"
        :actions="contextMenuActions"
      />
    </div>

    <ConfirmDialog
      :open="catalogConfirmAction !== null"
      :title="catalogConfirmTitle"
      :message="catalogConfirmMessage"
      :confirm-label="catalogConfirmLabel"
      :destructive="catalogConfirmDestructive"
      :busy="catalogConfirmBusy"
      @update:open="handleCatalogConfirmOpenUpdate"
      @confirm="confirmCatalogAction"
    />
  </AppShell>
</template>

<style scoped>
.catalog-explorer {
  display: grid;
  grid-template-columns: minmax(420px, 1fr) minmax(420px, 1fr);
  gap: 1rem;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

@media (max-width: 1440px) {
  .catalog-explorer {
    grid-template-columns: minmax(360px, 1fr) minmax(360px, 1fr);
  }
}

@media (max-width: 1180px) {
  .catalog-explorer {
    grid-template-columns: 1fr;
    height: auto;
    overflow: visible;
    align-content: start;
  }

  .catalog-explorer--mobile-inspector .catalog-tree-pane {
    display: none;
  }
}

</style>
