import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import ShopCatalogTreeNode from '@/components/catalog/ShopCatalogTreeNode.vue'
import { useShopCategoriesStore } from '@/stores/shopCategories'

describe('ShopCatalogTreeNode', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders a newly added nested subcategory under an already expanded branch', async () => {
    const categoriesStore = useShopCategoriesStore()
    categoriesStore.categories = [
      { id: 'manufacturer-lists', name: 'Manufacturer lists', parentId: null, active: true },
      { id: 'grabber-brand', name: 'Grabber Brand', parentId: 'manufacturer-lists', active: true },
      { id: 'screws', name: 'Screws', parentId: 'grabber-brand', active: true },
    ]

    const wrapper = mount(ShopCatalogTreeNode, {
      props: {
        nodeId: 'manufacturer-lists',
        expanded: new Set(['manufacturer-lists', 'grabber-brand', 'screws']),
        items: [],
      },
      global: {
        stubs: {
          Transition: false,
        },
      },
    })

    expect(wrapper.text()).toContain('Screws')
    expect(wrapper.text()).not.toContain('Self Tapping')

    categoriesStore.categories = [
      ...categoriesStore.categories,
      { id: 'self-tapping', name: 'Self Tapping', parentId: 'screws', active: true },
    ]

    await nextTick()

    expect(wrapper.text()).toContain('Self Tapping')
  })
})
