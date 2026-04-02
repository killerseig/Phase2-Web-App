import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import AdminShopCatalog from '@/views/admin/AdminShopCatalog.vue'
import { useShopCatalogStore } from '@/stores/shopCatalog'
import { useShopCategoriesStore } from '@/stores/shopCategories'

describe('AdminShopCatalog view', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders an inline draft child row when adding an item from a root item', async () => {
    const catalogStore = useShopCatalogStore()
    const categoriesStore = useShopCategoriesStore()

    catalogStore.items = [
      { id: 'item-a', description: '1 test', sku: 'SKU-1', price: 12.5, active: true },
    ]
    categoriesStore.categories = []
    catalogStore.subscribeCatalog = () => {}
    categoriesStore.subscribeAllCategories = () => {}
    catalogStore.stopCatalogSubscription = () => {}
    categoriesStore.stopCategoriesSubscription = () => {}

    const wrapper = mount(AdminShopCatalog, {
      global: {
        stubs: {
          Transition: false,
          AppPageHeader: {
            template: '<div><slot name="actions" /></div>',
          },
          AdminAccordionFormCard: {
            props: ['open', 'title', 'subtitle', 'loading', 'submitDisabled', 'submitLabel'],
            emits: ['update:open', 'submit', 'cancel'],
            template: '<div v-if="open" data-add-item-form><slot /></div>',
          },
          AppToolbarCard: {
            template: '<div><slot /></div>',
          },
          AdminCardWrapper: {
            props: ['title'],
            template: '<div><slot /></div>',
          },
          AppAlert: true,
          AppLoadingState: true,
          AppEmptyState: true,
          BaseModal: true,
        },
      },
    })

    await wrapper.get('button[title="Toggle edit mode"]').trigger('click')
    await wrapper.get('button[title="Add item"]').trigger('click')
    await nextTick()

    const descriptionInput = wrapper.get('input[placeholder="Description"]')
    const skuInput = wrapper.get('input[placeholder="SKU"]')
    const priceInput = wrapper.get('input[placeholder="Price"]')

    expect((descriptionInput.element as HTMLInputElement).value).toBe('')
    expect((skuInput.element as HTMLInputElement).value).toBe('')
    expect((priceInput.element as HTMLInputElement).value).toBe('')
  })
})
