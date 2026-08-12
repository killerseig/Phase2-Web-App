import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ShopCatalogCreateCategoryPanel from '@/components/shopCatalog/ShopCatalogCreateCategoryPanel.vue'
import ShopCatalogCreateItemPanel from '@/components/shopCatalog/ShopCatalogCreateItemPanel.vue'
import ShopCatalogCategoryDetailPanel from '@/components/shopCatalog/ShopCatalogCategoryDetailPanel.vue'
import ShopCatalogItemDetailPanel from '@/components/shopCatalog/ShopCatalogItemDetailPanel.vue'
import ShopCatalogRootInspector from '@/components/shopCatalog/ShopCatalogRootInspector.vue'
import type {
  ShopCatalogCategoryFormState,
  ShopCatalogCategoryOption,
  ShopCatalogItemFormState,
} from '@/features/shopCatalog/adminViewHelpers'

const categoryOptions: ShopCatalogCategoryOption[] = [
  { value: 'cat-tools', label: 'Tools' },
  { value: 'cat-safety', label: 'Safety' },
]

function makeCategoryForm(overrides: Partial<ShopCatalogCategoryFormState> = {}): ShopCatalogCategoryFormState {
  return {
    name: 'Fasteners',
    parentId: 'cat-tools',
    active: true,
    ...overrides,
  }
}

function makeItemForm(overrides: Partial<ShopCatalogItemFormState> = {}): ShopCatalogItemFormState {
  return {
    description: 'AHA Book',
    categoryId: 'cat-safety',
    sku: 'AHA-1',
    price: '$12.50',
    active: true,
    ...overrides,
  }
}

describe('ShopCatalogRootInspector', () => {
  it('renders catalog overview counts and adding-entry guidance', () => {
    const wrapper = mount(ShopCatalogRootInspector, {
      props: {
        visibleFolderCount: 12,
        visibleItemCount: 345,
      },
    })

    expect(wrapper.text()).toContain('Inspector')
    expect(wrapper.get('h2').text()).toBe('Shop Catalog')
    expect(wrapper.text()).toContain('Overview')
    expect(wrapper.text()).toContain('12 folders visible')
    expect(wrapper.text()).toContain('345 items visible')
    expect(wrapper.text()).toContain('Right-click a folder or the empty catalog area to open actions.')
    expect(wrapper.text()).toContain('On touch devices, press and hold to open the same menu.')
  })
})

describe('ShopCatalogCreateCategoryPanel', () => {
  it('renders create-folder fields and forwards form updates with nullable parent selection', async () => {
    const wrapper = mount(ShopCatalogCreateCategoryPanel, {
      props: {
        form: makeCategoryForm(),
        categoryOptions,
        createLoading: false,
      },
    })
    const textInput = wrapper.get<HTMLInputElement>('input[type="text"]')
    const parentSelect = wrapper.get<HTMLSelectElement>('select')
    const activeToggle = wrapper.get<HTMLInputElement>('input[type="checkbox"]')

    expect(wrapper.text()).toContain('Create')
    expect(wrapper.get('h2').text()).toBe('New Folder')
    expect(wrapper.text()).toContain('Folder Name')
    expect(wrapper.text()).toContain('Parent Folder')
    expect(textInput.element.value).toBe('Fasteners')
    expect(parentSelect.element.value).toBe('cat-tools')
    expect(activeToggle.element.checked).toBe(true)
    expect(wrapper.text()).toContain('Top Level')
    expect(wrapper.text()).toContain('Safety')

    await textInput.setValue('Adhesive')
    await parentSelect.setValue('')
    await activeToggle.setValue(false)
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('update:name')).toEqual([['Adhesive']])
    expect(wrapper.emitted('update:parent-id')).toEqual([[null]])
    expect(wrapper.emitted('update:active')).toEqual([[false]])
    expect(wrapper.emitted('submit')).toHaveLength(1)
  })

  it('locks the create-folder action while creating', () => {
    const wrapper = mount(ShopCatalogCreateCategoryPanel, {
      props: {
        form: makeCategoryForm(),
        categoryOptions,
        createLoading: true,
      },
    })
    const submitButton = wrapper.get('button.app-button--primary')

    expect(submitButton.text()).toBe('Creating...')
    expect(submitButton.attributes('disabled')).toBeDefined()
    expect(submitButton.attributes('aria-busy')).toBe('true')
  })
})

describe('ShopCatalogCreateItemPanel', () => {
  it('renders create-item fields and forwards text, folder, active, submit, and price events', async () => {
    const wrapper = mount(ShopCatalogCreateItemPanel, {
      props: {
        form: makeItemForm(),
        categoryOptions,
        createLoading: false,
      },
    })
    const inputs = wrapper.findAll('input.app-text-input')
    const folderSelect = wrapper.get<HTMLSelectElement>('select')
    const activeToggle = wrapper.get<HTMLInputElement>('input[type="checkbox"]')

    expect(wrapper.text()).toContain('Create')
    expect(wrapper.get('h2').text()).toBe('New Item')
    expect(wrapper.text()).toContain('Description')
    expect(wrapper.text()).toContain('Folder')
    expect(wrapper.text()).toContain('SKU')
    expect(wrapper.text()).toContain('Price')
    expect((inputs[0]!.element as HTMLInputElement).value).toBe('AHA Book')
    expect(folderSelect.element.value).toBe('cat-safety')
    expect((inputs[1]!.element as HTMLInputElement).value).toBe('AHA-1')
    expect((inputs[2]!.element as HTMLInputElement).value).toBe('$12.50')
    expect((inputs[2]!.element as HTMLInputElement).placeholder).toBe('$0.00')
    expect(activeToggle.element.checked).toBe(true)

    await inputs[0]!.setValue('Foreman Book')
    await folderSelect.setValue('')
    await inputs[1]!.setValue('FB-1')
    await inputs[2]!.setValue('25.00')
    await inputs[2]!.trigger('focus')
    await inputs[2]!.trigger('blur')
    await activeToggle.setValue(false)
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('update:description')).toEqual([['Foreman Book']])
    expect(wrapper.emitted('update:category-id')).toEqual([[null]])
    expect(wrapper.emitted('update:sku')).toEqual([['FB-1']])
    expect(wrapper.emitted('price-input')).toHaveLength(1)
    expect(wrapper.emitted('price-focus')).toHaveLength(1)
    expect(wrapper.emitted('price-blur')).toHaveLength(1)
    expect(wrapper.emitted('update:active')).toEqual([[false]])
    expect(wrapper.emitted('submit')).toHaveLength(1)
  })

  it('locks the create-item action while creating', () => {
    const wrapper = mount(ShopCatalogCreateItemPanel, {
      props: {
        form: makeItemForm(),
        categoryOptions,
        createLoading: true,
      },
    })
    const submitButton = wrapper.get('button.app-button--primary')

    expect(submitButton.text()).toBe('Creating...')
    expect(submitButton.attributes('disabled')).toBeDefined()
    expect(submitButton.attributes('aria-busy')).toBe('true')
  })
})

describe('ShopCatalogCategoryDetailPanel', () => {
  it('renders category details and forwards edit, archive, delete, and submit events', async () => {
    const wrapper = mount(ShopCatalogCategoryDetailPanel, {
      props: {
        form: makeCategoryForm(),
        parentOptions: categoryOptions,
        title: 'Fasteners',
        active: true,
        pathLabel: 'Tools / Fasteners',
        summaryLabel: '2 folders / 18 items',
        saveLoading: false,
        deleteLoading: false,
        deleteDisabled: false,
      },
    })
    const textInput = wrapper.get<HTMLInputElement>('input[type="text"]')
    const parentSelect = wrapper.get<HTMLSelectElement>('select')
    const activeToggle = wrapper.get<HTMLInputElement>('input[type="checkbox"]')
    const buttons = wrapper.findAll('button')

    expect(wrapper.text()).toContain('Folder')
    expect(wrapper.get('h2').text()).toBe('Fasteners')
    expect(textInput.element.value).toBe('Fasteners')
    expect(parentSelect.element.value).toBe('cat-tools')
    expect(activeToggle.element.checked).toBe(true)
    expect(wrapper.text()).toContain('Tools / Fasteners')
    expect(wrapper.text()).toContain('2 folders / 18 items')
    expect(buttons[1]!.text()).toBe('Archive Folder')

    await textInput.setValue('Hardware')
    await parentSelect.setValue('')
    await activeToggle.setValue(false)
    await wrapper.get('form').trigger('submit')
    await buttons[1]!.trigger('click')
    await buttons[2]!.trigger('click')

    expect(wrapper.emitted('update:name')).toEqual([['Hardware']])
    expect(wrapper.emitted('update:parent-id')).toEqual([[null]])
    expect(wrapper.emitted('update:active')).toEqual([[false]])
    expect(wrapper.emitted('submit')).toHaveLength(1)
    expect(wrapper.emitted('archive')).toHaveLength(1)
    expect(wrapper.emitted('delete')).toHaveLength(1)
  })

  it('shows restore copy and locks category actions for save/delete constraints', () => {
    const saveWrapper = mount(ShopCatalogCategoryDetailPanel, {
      props: {
        form: makeCategoryForm({ active: false }),
        parentOptions: categoryOptions,
        title: 'Archived Folder',
        active: false,
        pathLabel: 'Top Level',
        summaryLabel: '0 folders / 0 items',
        saveLoading: true,
        deleteLoading: false,
        deleteDisabled: true,
      },
    })
    const deleteWrapper = mount(ShopCatalogCategoryDetailPanel, {
      props: {
        form: makeCategoryForm(),
        parentOptions: categoryOptions,
        title: 'Deleting Folder',
        active: true,
        pathLabel: 'Top Level',
        summaryLabel: '0 folders / 0 items',
        saveLoading: false,
        deleteLoading: true,
        deleteDisabled: false,
      },
    })
    const saveButtons = saveWrapper.findAll('button')
    const deleteButtons = deleteWrapper.findAll('button')

    expect(saveButtons[0]!.text()).toBe('Saving...')
    expect(saveButtons[0]!.attributes('disabled')).toBeDefined()
    expect(saveButtons[0]!.attributes('aria-busy')).toBe('true')
    expect(saveButtons[1]!.text()).toBe('Restore Folder')
    expect(saveButtons[1]!.attributes('disabled')).toBeDefined()
    expect(saveButtons[2]!.attributes('disabled')).toBeDefined()

    expect(deleteButtons[2]!.text()).toBe('Deleting...')
    expect(deleteButtons[2]!.attributes('disabled')).toBeDefined()
    expect(deleteButtons[2]!.attributes('aria-busy')).toBe('true')
  })
})

describe('ShopCatalogItemDetailPanel', () => {
  it('renders item details and forwards edit, price, archive, delete, and submit events', async () => {
    const wrapper = mount(ShopCatalogItemDetailPanel, {
      props: {
        form: makeItemForm(),
        title: 'AHA Book',
        active: true,
        pathLabel: 'Safety / Books',
        skuLabel: 'SKU AHA-1',
        priceLabel: '$12.50',
        saveLoading: false,
        deleteLoading: false,
      },
    })
    const inputs = wrapper.findAll('input.app-text-input')
    const activeToggle = wrapper.get<HTMLInputElement>('input[type="checkbox"]')
    const buttons = wrapper.findAll('button')

    expect(wrapper.text()).toContain('Item')
    expect(wrapper.get('h2').text()).toBe('AHA Book')
    expect((inputs[0]!.element as HTMLInputElement).value).toBe('AHA Book')
    expect((inputs[1]!.element as HTMLInputElement).value).toBe('AHA-1')
    expect((inputs[2]!.element as HTMLInputElement).value).toBe('$12.50')
    expect((inputs[2]!.element as HTMLInputElement).placeholder).toBe('$0.00')
    expect(activeToggle.element.checked).toBe(true)
    expect(wrapper.text()).toContain('Safety / Books')
    expect(wrapper.text()).toContain('SKU AHA-1')
    expect(wrapper.text()).toContain('$12.50')
    expect(buttons[1]!.text()).toBe('Archive Item')

    await inputs[0]!.setValue('Foreman Book')
    await inputs[1]!.setValue('FB-1')
    await inputs[2]!.setValue('25.00')
    await inputs[2]!.trigger('focus')
    await inputs[2]!.trigger('blur')
    await activeToggle.setValue(false)
    await wrapper.get('form').trigger('submit')
    await buttons[1]!.trigger('click')
    await buttons[2]!.trigger('click')

    expect(wrapper.emitted('update:description')).toEqual([['Foreman Book']])
    expect(wrapper.emitted('update:sku')).toEqual([['FB-1']])
    expect(wrapper.emitted('price-input')).toHaveLength(1)
    expect(wrapper.emitted('price-focus')).toHaveLength(1)
    expect(wrapper.emitted('price-blur')).toHaveLength(1)
    expect(wrapper.emitted('update:active')).toEqual([[false]])
    expect(wrapper.emitted('submit')).toHaveLength(1)
    expect(wrapper.emitted('archive')).toHaveLength(1)
    expect(wrapper.emitted('delete')).toHaveLength(1)
  })

  it('shows restore copy and locks item actions while saving or deleting', () => {
    const saveWrapper = mount(ShopCatalogItemDetailPanel, {
      props: {
        form: makeItemForm({ active: false }),
        title: 'Archived Item',
        active: false,
        pathLabel: 'Top Level',
        skuLabel: 'No SKU',
        priceLabel: 'No Price',
        saveLoading: true,
        deleteLoading: false,
      },
    })
    const deleteWrapper = mount(ShopCatalogItemDetailPanel, {
      props: {
        form: makeItemForm(),
        title: 'Deleting Item',
        active: true,
        pathLabel: 'Top Level',
        skuLabel: 'SKU AHA-1',
        priceLabel: '$12.50',
        saveLoading: false,
        deleteLoading: true,
      },
    })
    const saveButtons = saveWrapper.findAll('button')
    const deleteButtons = deleteWrapper.findAll('button')

    expect(saveButtons[0]!.text()).toBe('Saving...')
    expect(saveButtons[0]!.attributes('disabled')).toBeDefined()
    expect(saveButtons[0]!.attributes('aria-busy')).toBe('true')
    expect(saveButtons[1]!.text()).toBe('Restore Item')
    expect(saveButtons[1]!.attributes('disabled')).toBeDefined()

    expect(deleteButtons[2]!.text()).toBe('Deleting...')
    expect(deleteButtons[2]!.attributes('disabled')).toBeDefined()
    expect(deleteButtons[2]!.attributes('aria-busy')).toBe('true')
  })
})
