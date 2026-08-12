import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { useShopCatalogAdminLifecycle } from '@/features/shopCatalog/useShopCatalogAdminLifecycle'

function mountLifecycle() {
  const calls: string[] = []
  const disposeContextMenu = vi.fn(() => calls.push('disposeContextMenu'))
  const stopCatalogRecords = vi.fn(() => calls.push('stopCatalogRecords'))
  const stopTreeListAutoScroll = vi.fn(() => calls.push('stopTreeListAutoScroll'))
  const subscribeCatalogRecords = vi.fn(() => calls.push('subscribeCatalogRecords'))
  const syncLayoutMode = vi.fn(() => calls.push('syncLayoutMode'))

  const Component = defineComponent({
    setup() {
      useShopCatalogAdminLifecycle({
        disposeContextMenu,
        stopCatalogRecords,
        stopTreeListAutoScroll,
        subscribeCatalogRecords,
        syncLayoutMode,
      })

      return () => null
    },
  })

  return {
    calls,
    disposeContextMenu,
    stopCatalogRecords,
    stopTreeListAutoScroll,
    subscribeCatalogRecords,
    syncLayoutMode,
    wrapper: mount(Component),
  }
}

describe('useShopCatalogAdminLifecycle', () => {
  it('syncs layout mode before starting catalog subscriptions on mount', () => {
    const { calls, subscribeCatalogRecords, syncLayoutMode, wrapper } = mountLifecycle()

    expect(syncLayoutMode).toHaveBeenCalledTimes(1)
    expect(subscribeCatalogRecords).toHaveBeenCalledTimes(1)
    expect(calls).toEqual(['syncLayoutMode', 'subscribeCatalogRecords'])

    wrapper.unmount()
  })

  it('does not run cleanup callbacks before unmount', () => {
    const { disposeContextMenu, stopCatalogRecords, stopTreeListAutoScroll, wrapper } = mountLifecycle()

    expect(disposeContextMenu).not.toHaveBeenCalled()
    expect(stopTreeListAutoScroll).not.toHaveBeenCalled()
    expect(stopCatalogRecords).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('cleans up context menus, tree auto-scroll, and subscriptions on unmount', () => {
    const { calls, disposeContextMenu, stopCatalogRecords, stopTreeListAutoScroll, wrapper } = mountLifecycle()

    wrapper.unmount()

    expect(disposeContextMenu).toHaveBeenCalledTimes(1)
    expect(stopTreeListAutoScroll).toHaveBeenCalledTimes(1)
    expect(stopCatalogRecords).toHaveBeenCalledTimes(1)
    expect(calls).toEqual([
      'syncLayoutMode',
      'subscribeCatalogRecords',
      'disposeContextMenu',
      'stopTreeListAutoScroll',
      'stopCatalogRecords',
    ])
  })
})
