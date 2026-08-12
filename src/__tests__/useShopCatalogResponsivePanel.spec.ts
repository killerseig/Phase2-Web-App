import { afterEach, describe, expect, it, vi } from 'vitest'

import { useShopCatalogResponsivePanel } from '@/features/shopCatalog/useShopCatalogResponsivePanel'

const ORIGINAL_WIDTH = window.innerWidth

function setWindowWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  })
}

describe('useShopCatalogResponsivePanel', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    setWindowWidth(ORIGINAL_WIDTH)
  })

  it('starts in catalog mode with a two-pane layout assumption', () => {
    const panel = useShopCatalogResponsivePanel()

    expect(panel.activeMobilePanel.value).toBe('catalog')
    expect(panel.isSinglePaneLayout.value).toBe(false)
  })

  it('syncs single-pane state from the default breakpoint', () => {
    const panel = useShopCatalogResponsivePanel()

    setWindowWidth(1180)
    panel.syncLayoutMode()

    expect(panel.isSinglePaneLayout.value).toBe(true)

    setWindowWidth(1181)
    panel.syncLayoutMode()

    expect(panel.isSinglePaneLayout.value).toBe(false)
  })

  it('supports custom single-pane breakpoints', () => {
    const panel = useShopCatalogResponsivePanel({ singlePaneBreakpoint: 900 })

    setWindowWidth(901)
    panel.syncLayoutMode()

    expect(panel.isSinglePaneLayout.value).toBe(false)

    setWindowWidth(900)
    panel.syncLayoutMode()

    expect(panel.isSinglePaneLayout.value).toBe(true)
  })

  it('switches between catalog and inspector mobile panels', () => {
    const panel = useShopCatalogResponsivePanel()

    panel.showInspectorPanel()

    expect(panel.activeMobilePanel.value).toBe('inspector')

    panel.showMobilePanel('catalog')

    expect(panel.activeMobilePanel.value).toBe('catalog')
  })

  it('falls back to two-pane layout when window is unavailable', () => {
    const panel = useShopCatalogResponsivePanel()

    setWindowWidth(320)
    panel.syncLayoutMode()
    expect(panel.isSinglePaneLayout.value).toBe(true)

    vi.stubGlobal('window', undefined)
    panel.syncLayoutMode()

    expect(panel.isSinglePaneLayout.value).toBe(false)
  })
})
