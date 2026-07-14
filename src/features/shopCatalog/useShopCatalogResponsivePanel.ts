import { ref } from 'vue'

export type ShopCatalogMobilePanel = 'catalog' | 'inspector'

interface ShopCatalogResponsivePanelOptions {
  singlePaneBreakpoint?: number
}

export function useShopCatalogResponsivePanel(options: ShopCatalogResponsivePanelOptions = {}) {
  const singlePaneBreakpoint = options.singlePaneBreakpoint ?? 1180
  const activeMobilePanel = ref<ShopCatalogMobilePanel>('catalog')
  const isSinglePaneLayout = ref(false)

  function syncLayoutMode() {
    if (typeof window === 'undefined') {
      isSinglePaneLayout.value = false
      return
    }

    isSinglePaneLayout.value = window.innerWidth <= singlePaneBreakpoint
  }

  function showMobilePanel(panel: ShopCatalogMobilePanel) {
    activeMobilePanel.value = panel
  }

  function showInspectorPanel() {
    showMobilePanel('inspector')
  }

  return {
    activeMobilePanel,
    isSinglePaneLayout,
    showInspectorPanel,
    showMobilePanel,
    syncLayoutMode,
  }
}
