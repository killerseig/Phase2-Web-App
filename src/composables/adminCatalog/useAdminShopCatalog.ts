import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useShopCatalogSources } from '@/composables/useShopCatalogSources'
import { useCatalogTreeBrowser } from '@/composables/useCatalogTreeBrowser'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useToast } from '@/composables/useToast'
import { useAdminCatalogDownload } from './useAdminCatalogDownload'
import { useAdminCatalogMutations } from './useAdminCatalogMutations'
import {
  expandAdminCatalogAncestorNodes,
  useAdminCatalogTreeActions,
} from './useAdminCatalogTreeActions'

export function useAdminShopCatalog() {
  const { confirm } = useConfirmDialog()
  const toast = useToast()
  const {
    categoriesStore,
    catalogStore,
    categories,
    catalogItems: allItems,
    loading,
    error,
    subscribe,
    stop,
    clearErrors,
  } = useShopCatalogSources()

  const catalogSearchQuery = ref('')

  let catalogBrowser: ReturnType<typeof useCatalogTreeBrowser>

  const {
    saving,
    editingItemId,
    editingCategoryId,
    editCategoryName,
    savingCategoryEdit,
    inlineDraftItem,
    createCategory: createCategoryRecord,
    createItem: createCatalogItem,
    archiveCategory,
    reactivateCategory,
    deleteCategory,
    editItem,
    saveItemFromTree,
    editCategory,
    saveCategoryEdit,
    cancelCategoryEdit,
    cancelItemEdit,
    deleteItem,
    archiveItem,
    reactivateItem,
  } = useAdminCatalogMutations({
    categoriesStore,
    catalogStore,
    categories,
    allItems,
    getChildIds: () => catalogBrowser.browseTreeIndex.value.childIds,
    confirm,
    toast,
  })

  const browseItems = computed(() => (
    inlineDraftItem.value ? [...allItems.value, inlineDraftItem.value] : allItems.value
  ))

  const {
    expandedNodes,
    browseTreeIndex,
    rootNodeIds,
    isSearching,
    searchResults,
    totalResultCount,
    hasMoreResults,
    hasSearchResults,
    updateExpandedNodes,
    toggleExpand,
    revealSearchResult,
  } = (catalogBrowser = useCatalogTreeBrowser({
    items: browseItems,
    categories,
    searchQuery: catalogSearchQuery,
    onExpandNode: (nodeId, nextExpanded) => {
      expandAdminCatalogAncestorNodes(nodeId, nextExpanded, categories.value, allItems.value)
    },
  }))
  const {
    newCategoryName,
    newItemDesc,
    newItemSku,
    newItemPrice,
    showAddCategory,
    showAddItemForm,
    parentId,
    closeAddCategoryDialog,
    createCategory,
    createItem,
    cancelAddItem,
    treeListeners,
  } = useAdminCatalogTreeActions({
    allItems,
    categories,
    inlineDraftItem,
    editingItemId,
    editingCategoryId,
    editCategoryName,
    toggleExpand,
    updateExpandedNodes,
    createCategoryRecord,
    createCatalogItem,
    archiveCategory,
    reactivateCategory,
    deleteCategory,
    editItem,
    saveItemFromTree,
    deleteItem,
    editCategory,
    saveCategoryEdit,
    cancelCategoryEdit,
    cancelItemEdit,
    archiveItem,
    reactivateItem,
  })

  const { downloading, downloadCatalog } = useAdminCatalogDownload({
    categoriesStore,
    categories,
    allItems,
    toast,
  })

  onMounted(() => {
    subscribe()
  })

  onUnmounted(() => {
    stop()
  })

  return {
    allItems,
    browseTreeIndex,
    loading,
    err: error,
    saving,
    downloading,
    rootNodeIds,
    expandedNodes,
    searchQuery: catalogSearchQuery,
    isSearching,
    searchResults,
    totalResultCount,
    hasMoreResults,
    hasSearchResults,
    showAddCategory,
    showAddItemForm,
    newCategoryName,
    newItemDesc,
    newItemSku,
    newItemPrice,
    parentId,
    editingItemId,
    editingCategoryId,
    editCategoryName,
    savingCategoryEdit,
    clearErrors,
    downloadCatalog,
    closeAddCategoryDialog,
    createCategory,
    createItem,
    cancelAddItem,
    revealSearchResult,
    treeListeners,
  }
}
