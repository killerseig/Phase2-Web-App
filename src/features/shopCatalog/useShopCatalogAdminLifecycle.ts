import { onBeforeUnmount, onMounted } from 'vue'

type UseShopCatalogAdminLifecycleOptions = {
  disposeContextMenu: () => void
  stopCatalogRecords: () => void
  stopTreeListAutoScroll: () => void
  subscribeCatalogRecords: () => void
  syncLayoutMode: () => void
}

export function useShopCatalogAdminLifecycle({
  disposeContextMenu,
  stopCatalogRecords,
  stopTreeListAutoScroll,
  subscribeCatalogRecords,
  syncLayoutMode,
}: UseShopCatalogAdminLifecycleOptions) {
  onMounted(() => {
    syncLayoutMode()
    subscribeCatalogRecords()
  })

  onBeforeUnmount(() => {
    disposeContextMenu()
    stopTreeListAutoScroll()
    stopCatalogRecords()
  })
}
