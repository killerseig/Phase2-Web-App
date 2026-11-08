import { onBeforeUnmount, onMounted, watch } from 'vue'
import type { AdminRequestContext } from '@/features/admin/useAdminRequestContext'

type UseShopCatalogAdminLifecycleOptions = {
  context?: AdminRequestContext
  disposeContextMenu: () => void
  stopCatalogRecords: () => void
  stopTreeListAutoScroll: () => void
  subscribeCatalogRecords: () => void
  syncLayoutMode: () => void
}

export function useShopCatalogAdminLifecycle({
  context,
  disposeContextMenu,
  stopCatalogRecords,
  stopTreeListAutoScroll,
  subscribeCatalogRecords,
  syncLayoutMode,
}: UseShopCatalogAdminLifecycleOptions) {
  let mounted = false
  onMounted(() => {
    mounted = true
    syncLayoutMode()
    if (!context || context.allowed.value) subscribeCatalogRecords()
  })

  onBeforeUnmount(() => {
    mounted = false
    disposeContextMenu()
    stopTreeListAutoScroll()
    stopCatalogRecords()
  })
  if (context) watch(context.revision, () => {
    stopCatalogRecords()
    stopTreeListAutoScroll()
    if (mounted && context.allowed.value) subscribeCatalogRecords()
  }, { flush: 'sync' })
}
