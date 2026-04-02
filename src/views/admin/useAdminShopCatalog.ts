import { computed, onMounted, onUnmounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useCatalogTreeBrowser } from '@/composables/useCatalogTreeBrowser'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useToast } from '@/composables/useToast'
import { useShopCategoriesStore } from '@/stores/shopCategories'
import { useShopCatalogStore } from '@/stores/shopCatalog'
import { useAdminCatalogDownload } from '@/views/admin/useAdminCatalogDownload'
import { useAdminCatalogMutations } from '@/views/admin/useAdminCatalogMutations'
import {
  expandAdminCatalogAncestorNodes,
  useAdminCatalogTreeActions,
} from '@/views/admin/useAdminCatalogTreeActions'

export function useAdminShopCatalog() {
  const categoriesStore = useShopCategoriesStore()
  const catalogStore = useShopCatalogStore()
  const { confirm } = useConfirmDialog()
  const toast = useToast()

  const {
    categories,
    isLoading: categoriesLoading,
    error: categoriesError,
  } = storeToRefs(categoriesStore)
  const {
    items: allItems,
    loading: catalogLoading,
    error: catalogError,
  } = storeToRefs(catalogStore)

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

  const loading = computed(() => categoriesLoading.value || catalogLoading.value)
  const err = computed(() => categoriesError.value || catalogError.value || '')
  const clearErrors = () => {
    categoriesStore.clearError()
    catalogStore.clearError()
  }

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

  function loadAll() {
    categoriesStore.subscribeAllCategories()
    catalogStore.subscribeCatalog()
  }
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
    loadAll()
  })

  onUnmounted(() => {
    categoriesStore.stopCategoriesSubscription()
    catalogStore.stopCatalogSubscription()
  })

  return {
    allItems,
    browseTreeIndex,
    loading,
    err,
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
