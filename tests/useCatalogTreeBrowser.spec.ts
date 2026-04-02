import { computed, effectScope, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { useCatalogTreeBrowser } from '@/composables/useCatalogTreeBrowser'

describe('useCatalogTreeBrowser', () => {
  it('builds filtered root nodes in mixed alphabetical order', () => {
    const items = ref([
      { id: 'item-a', description: 'Z Anchor Kit', active: true },
      { id: 'item-b', description: 'Hidden Kit', active: false },
    ])
    const categories = ref([
      { id: 'category-a', name: 'Anchors', parentId: null, active: true },
      { id: 'category-b', name: 'Hidden Category', parentId: null, active: false },
    ])

    const scope = effectScope()
    try {
      const browser = scope.run(() =>
        useCatalogTreeBrowser({
          items: computed(() => items.value),
          categories: computed(() => categories.value),
          includeCategory: (category) => category.active !== false,
          includeItem: (item) => item.active !== false,
        })
      )

      expect(browser?.rootNodeIds.value).toEqual(['category-a', 'item-item-a'])
      expect(browser?.hasAnyNodes.value).toBe(true)
    } finally {
      scope.stop()
    }
  })

  it('applies the expand hook only when opening a node', () => {
    const items = ref([])
    const categories = ref([])
    const onExpandNode = vi.fn((nodeId: string, nextExpanded: Set<string>) => {
      nextExpanded.add(`ancestor-for-${nodeId}`)
    })

    const scope = effectScope()
    try {
      const browser = scope.run(() =>
        useCatalogTreeBrowser({
          items: computed(() => items.value),
          categories: computed(() => categories.value),
          onExpandNode,
        })
      )

      browser?.toggleExpand('item-item-a')
      expect(onExpandNode).toHaveBeenCalledWith('item-item-a', expect.any(Set))
      expect(browser?.expandedNodes.value).toEqual(new Set(['item-item-a', 'ancestor-for-item-item-a']))

      browser?.toggleExpand('item-item-a')
      expect(onExpandNode).toHaveBeenCalledTimes(1)
      expect(browser?.expandedNodes.value).toEqual(new Set(['ancestor-for-item-item-a']))
    } finally {
      scope.stop()
    }
  })

  it('clears search text and expands the revealed result path', async () => {
    const items = ref([])
    const categories = ref([])
    const searchQuery = ref('anchor')

    const scope = effectScope()
    try {
      const browser = scope.run(() =>
        useCatalogTreeBrowser({
          items: computed(() => items.value),
          categories: computed(() => categories.value),
          searchQuery,
        })
      )

      await browser?.revealSearchResult({
        id: 'item-a',
        nodeId: 'item-item-a',
        label: 'Anchor Kit',
        pathLabel: 'Anchors > Anchor Kit',
        breadcrumbLabel: 'Anchors',
        kind: 'item',
        active: true,
        hasChildren: true,
        ancestorNodeIds: ['category-a'],
        matchStrength: 'primary',
        sku: undefined,
        price: undefined,
        item: undefined,
        category: undefined,
      })

      expect(searchQuery.value).toBe('')
      expect(browser?.expandedNodes.value).toEqual(new Set(['category-a', 'item-item-a']))
    } finally {
      scope.stop()
    }
  })
})
