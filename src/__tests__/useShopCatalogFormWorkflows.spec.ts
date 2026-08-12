import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useShopCatalogFormActions } from '@/features/shopCatalog/useShopCatalogFormActions'
import { useShopCatalogForms } from '@/features/shopCatalog/useShopCatalogForms'
import {
  createShopCatalogItem,
  createShopCategory,
  updateShopCatalogItem,
  updateShopCategory,
} from '@/services/shopCatalog'
import type { ShopCatalogItemRecord, ShopCategoryRecord } from '@/types/domain'

vi.mock('@/services/shopCatalog', () => ({
  createShopCatalogItem: vi.fn(),
  createShopCategory: vi.fn(),
  updateShopCatalogItem: vi.fn(),
  updateShopCategory: vi.fn(),
}))

const createShopCatalogItemMock = vi.mocked(createShopCatalogItem)
const createShopCategoryMock = vi.mocked(createShopCategory)
const updateShopCatalogItemMock = vi.mocked(updateShopCatalogItem)
const updateShopCategoryMock = vi.mocked(updateShopCategory)

function makeCategory(overrides: Partial<ShopCategoryRecord> = {}): ShopCategoryRecord {
  return {
    active: true,
    id: 'cat-tools',
    name: 'Tools',
    parentId: null,
    ...overrides,
  }
}

function makeItem(overrides: Partial<ShopCatalogItemRecord> = {}): ShopCatalogItemRecord {
  return {
    active: true,
    categoryId: 'cat-tools',
    description: 'Cordless Drill',
    id: 'item-drill',
    price: 12.5,
    sku: 'DR-1',
    ...overrides,
  }
}

function inputEvent(value: string) {
  const input = document.createElement('input')
  input.value = value
  const event = new Event('input', {
    bubbles: true,
  })
  Object.defineProperty(event, 'target', {
    configurable: true,
    value: input,
  })
  return event
}

function mountFormWorkflows(options: {
  selectedCategory?: ShopCategoryRecord | null
  selectedItem?: ShopCatalogItemRecord | null
} = {}) {
  const activeFolderId = ref<string | null>('cat-tools')
  const createError = ref('previous create error')
  const detailError = ref('previous detail error')
  const detailInfo = ref('previous detail info')
  const forms = useShopCatalogForms({
    activeFolderId,
    createError,
    detailError,
    detailInfo,
  })
  const createLoading = ref(false)
  const saveLoading = ref(false)
  const expandedCategoryIds = ref<string[]>(['cat-existing'])
  const selectedInspectorKey = ref('root')
  const ensureExpandedToCategory = vi.fn()
  const resetDetailMessages = vi.fn(() => {
    detailError.value = ''
    detailInfo.value = ''
  })
  const showInspectorPanel = vi.fn()
  const createErrors: Array<{ error: unknown; fallbackMessage: string }> = []
  const createErrorMessages: string[] = []
  const detailErrors: Array<{ error: unknown; fallbackMessage: string }> = []
  const detailErrorMessages: string[] = []
  const detailInfos: string[] = []
  const selectedCategory = computed(() => (
    options.selectedCategory === undefined ? makeCategory() : options.selectedCategory
  ))
  const selectedItem = computed(() => (
    options.selectedItem === undefined ? makeItem() : options.selectedItem
  ))
  const actions = useShopCatalogFormActions({
    activeFolderId,
    createCategoryForm: forms.createCategoryForm,
    createItemForm: forms.createItemForm,
    createLoading,
    detailCategoryForm: forms.detailCategoryForm,
    detailItemForm: forms.detailItemForm,
    ensureExpandedToCategory,
    expandedCategoryIds,
    resetDetailMessages,
    saveLoading,
    selectedCategory,
    selectedInspectorKey,
    selectedItem,
    setCreateError: (error, fallbackMessage) => {
      createErrors.push({ error, fallbackMessage })
    },
    setCreateErrorMessage: (message) => {
      createErrorMessages.push(message)
      createError.value = message
    },
    setDetailError: (error, fallbackMessage) => {
      detailErrors.push({ error, fallbackMessage })
    },
    setDetailErrorMessage: (message) => {
      detailErrorMessages.push(message)
      detailError.value = message
    },
    setDetailInfo: (message) => {
      detailInfos.push(message)
      detailInfo.value = message
    },
    showInspectorPanel,
  })

  return {
    actions,
    activeFolderId,
    createError,
    createErrorMessages,
    createErrors,
    createLoading,
    detailError,
    detailErrorMessages,
    detailErrors,
    detailInfo,
    detailInfos,
    ensureExpandedToCategory,
    expandedCategoryIds,
    forms,
    resetDetailMessages,
    saveLoading,
    selectedInspectorKey,
    showInspectorPanel,
  }
}

describe('useShopCatalogForms', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('resets create forms to the active folder and clears create errors', () => {
    const { createError, forms } = mountFormWorkflows()

    forms.createCategoryForm.name = 'Temp Folder'
    forms.createCategoryForm.parentId = 'cat-other'
    forms.createCategoryForm.active = false
    forms.createItemForm.description = 'Temp Item'
    forms.createItemForm.categoryId = 'cat-other'
    forms.createItemForm.sku = 'TEMP'
    forms.createItemForm.price = '$123.45'
    forms.createItemForm.active = false

    forms.resetCreateCategoryForm()
    forms.resetCreateItemForm()

    expect(forms.createCategoryForm).toMatchObject({
      name: '',
      parentId: 'cat-tools',
      active: true,
    })
    expect(forms.createItemForm).toMatchObject({
      description: '',
      categoryId: 'cat-tools',
      sku: '',
      price: '',
      active: true,
    })
    expect(createError.value).toBe('')
  })

  it('hydrates detail forms and normalizes item price input/focus/blur values', () => {
    const { detailError, detailInfo, forms } = mountFormWorkflows()

    forms.applySelectedCategoryToForm(makeCategory({
      id: 'cat-bits',
      name: 'Bits',
      parentId: 'cat-tools',
      active: false,
    }))
    forms.applySelectedItemToForm(makeItem({
      description: 'Bit Holder',
      categoryId: 'cat-bits',
      sku: null,
      price: 7.5,
      active: false,
    }))

    expect(forms.detailCategoryForm).toMatchObject({
      name: 'Bits',
      parentId: 'cat-tools',
      active: false,
    })
    expect(forms.detailItemForm).toMatchObject({
      description: 'Bit Holder',
      categoryId: 'cat-bits',
      sku: '',
      price: '$7.50',
      active: false,
    })
    expect(detailError.value).toBe('')
    expect(detailInfo.value).toBe('')

    forms.handlePriceInput(forms.detailItemForm, inputEvent('$12.345abc'))
    expect(forms.detailItemForm.price).toBe('12.34')

    forms.handlePriceFocus(forms.detailItemForm)
    expect(forms.detailItemForm.price).toBe('12.34')

    forms.handlePriceBlur(forms.detailItemForm)
    expect(forms.detailItemForm.price).toBe('$12.34')
  })

  it('prepares create item forms for a requested parent folder', () => {
    const { createError, forms } = mountFormWorkflows()

    forms.createItemForm.description = 'Temp Item'
    forms.prepareCreateItemForm('cat-bits')

    expect(forms.createItemForm).toMatchObject({
      description: '',
      categoryId: 'cat-bits',
      sku: '',
      price: '',
      active: true,
    })
    expect(createError.value).toBe('')
  })
})

describe('useShopCatalogFormActions', () => {
  beforeEach(() => {
    createShopCatalogItemMock.mockReset()
    createShopCategoryMock.mockReset()
    updateShopCatalogItemMock.mockReset()
    updateShopCategoryMock.mockReset()
    createShopCatalogItemMock.mockResolvedValue('item-new')
    createShopCategoryMock.mockResolvedValue('cat-new')
    updateShopCatalogItemMock.mockResolvedValue(undefined)
    updateShopCategoryMock.mockResolvedValue(undefined)
  })

  it('blocks invalid folder creation before calling the service', async () => {
    const { actions, createErrorMessages, createLoading } = mountFormWorkflows()

    await actions.handleCreateCategory()

    expect(createErrorMessages).toEqual(['', 'Enter a folder name.'])
    expect(createShopCategoryMock).not.toHaveBeenCalled()
    expect(createLoading.value).toBe(false)
  })

  it('creates folders and selects the new folder in the inspector', async () => {
    const {
      actions,
      activeFolderId,
      ensureExpandedToCategory,
      expandedCategoryIds,
      forms,
      selectedInspectorKey,
      showInspectorPanel,
    } = mountFormWorkflows()
    forms.createCategoryForm.name = 'Fasteners'
    forms.createCategoryForm.parentId = 'cat-tools'
    forms.createCategoryForm.active = false

    await actions.handleCreateCategory()

    expect(createShopCategoryMock).toHaveBeenCalledWith({
      name: 'Fasteners',
      parentId: 'cat-tools',
      active: false,
    })
    expect(activeFolderId.value).toBe('cat-tools')
    expect(ensureExpandedToCategory).toHaveBeenCalledWith('cat-tools')
    expect(expandedCategoryIds.value).toEqual(['cat-existing', 'cat-new'])
    expect(selectedInspectorKey.value).toBe('category:cat-new')
    expect(showInspectorPanel).toHaveBeenCalledTimes(1)
  })

  it('creates items with normalized SKU and price payloads', async () => {
    const {
      actions,
      activeFolderId,
      ensureExpandedToCategory,
      forms,
      selectedInspectorKey,
      showInspectorPanel,
    } = mountFormWorkflows()
    forms.createItemForm.description = 'Hammer Drill'
    forms.createItemForm.categoryId = 'cat-tools'
    forms.createItemForm.sku = ' HD-1 '
    forms.createItemForm.price = '$42.499'
    forms.createItemForm.active = true

    await actions.handleCreateItem()

    expect(createShopCatalogItemMock).toHaveBeenCalledWith({
      description: 'Hammer Drill',
      categoryId: 'cat-tools',
      sku: 'HD-1',
      price: 42.5,
      active: true,
    })
    expect(activeFolderId.value).toBe('cat-tools')
    expect(ensureExpandedToCategory).toHaveBeenCalledWith('cat-tools')
    expect(selectedInspectorKey.value).toBe('item:item-new')
    expect(showInspectorPanel).toHaveBeenCalledTimes(1)
  })

  it('saves selected folder details and reports success', async () => {
    const {
      actions,
      activeFolderId,
      detailInfos,
      ensureExpandedToCategory,
      forms,
      resetDetailMessages,
      saveLoading,
    } = mountFormWorkflows()
    forms.detailCategoryForm.name = 'Updated Tools'
    forms.detailCategoryForm.parentId = null
    forms.detailCategoryForm.active = true

    await actions.handleSaveCategory()

    expect(resetDetailMessages).toHaveBeenCalledTimes(1)
    expect(updateShopCategoryMock).toHaveBeenCalledWith('cat-tools', {
      name: 'Updated Tools',
      parentId: null,
      active: true,
    })
    expect(activeFolderId.value).toBe('cat-tools')
    expect(ensureExpandedToCategory).toHaveBeenCalledWith(null)
    expect(detailInfos).toEqual(['Folder updated.'])
    expect(saveLoading.value).toBe(false)
  })

  it('blocks invalid item saves and keeps the service untouched', async () => {
    const { actions, detailErrorMessages, forms } = mountFormWorkflows()
    forms.detailItemForm.description = 'Cordless Drill'
    forms.detailItemForm.price = 'abc'

    await actions.handleSaveItem()

    expect(detailErrorMessages).toEqual(['Enter a valid price.'])
    expect(updateShopCatalogItemMock).not.toHaveBeenCalled()
  })

  it('saves selected item details while preserving the selected item folder id', async () => {
    const {
      actions,
      activeFolderId,
      detailInfos,
      ensureExpandedToCategory,
      forms,
      resetDetailMessages,
    } = mountFormWorkflows({
      selectedItem: makeItem({ categoryId: 'cat-original' }),
    })
    forms.detailItemForm.description = 'Updated Drill'
    forms.detailItemForm.categoryId = 'cat-form-change'
    forms.detailItemForm.sku = ' '
    forms.detailItemForm.price = ''
    forms.detailItemForm.active = false

    await actions.handleSaveItem()

    expect(resetDetailMessages).toHaveBeenCalledTimes(1)
    expect(updateShopCatalogItemMock).toHaveBeenCalledWith('item-drill', {
      description: 'Updated Drill',
      categoryId: 'cat-original',
      sku: null,
      price: null,
      active: false,
    })
    expect(activeFolderId.value).toBe('cat-original')
    expect(ensureExpandedToCategory).toHaveBeenCalledWith('cat-original')
    expect(detailInfos).toEqual(['Catalog item updated.'])
  })

  it('reports service failures without leaving loading state stuck', async () => {
    const error = new Error('No write access')
    createShopCatalogItemMock.mockRejectedValueOnce(error)
    const { actions, createErrors, createLoading, forms } = mountFormWorkflows()
    forms.createItemForm.description = 'Hammer Drill'

    await actions.handleCreateItem()

    expect(createErrors).toEqual([{ error, fallbackMessage: 'Failed to create catalog item.' }])
    expect(createLoading.value).toBe(false)
  })
})
