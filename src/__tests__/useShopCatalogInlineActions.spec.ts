import { computed, reactive, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useShopCatalogInlineActions } from '@/features/shopCatalog/useShopCatalogInlineActions'
import { useShopCatalogInlineEditing } from '@/features/shopCatalog/useShopCatalogInlineEditing'
import type { ShopCatalogTreeNode } from '@/features/shopCatalog/treeTypes'
import { createShopCatalogItem, createShopCategory, updateShopCatalogItem, updateShopCategory } from '@/services/shopCatalog'
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

function mountInlineActions(options: {
  categories?: ShopCategoryRecord[]
  createState?: {
    key: ShopCatalogTreeNode['key'] | null
    kind: 'category' | 'item' | null
    parentId: string | null
    value: string
    saving: boolean
  }
  items?: ShopCatalogItemRecord[]
  renameState?: {
    key: ShopCatalogTreeNode['key'] | null
    value: string
    saving: boolean
  }
} = {}) {
  const activeFolderId = ref<string | null>('cat-tools')
  const categories = ref(options.categories ?? [
    makeCategory({ id: 'cat-tools', name: 'Tools' }),
    makeCategory({ id: 'cat-bits', name: 'Bits', parentId: 'cat-tools' }),
  ])
  const items = ref(options.items ?? [makeItem()])
  const categoriesById = computed(() => new Map(categories.value.map((category) => [category.id, category])))
  const createState = reactive(options.createState ?? {
    key: null as ShopCatalogTreeNode['key'] | null,
    kind: null as 'category' | 'item' | null,
    parentId: null as string | null,
    value: '',
    saving: false,
  })
  const renameState = reactive(options.renameState ?? {
    key: null as ShopCatalogTreeNode['key'] | null,
    value: '',
    saving: false,
  })
  const expandedCategoryIds = ref<string[]>(['cat-tools'])
  const rootBucketExpanded = ref(false)
  const selectedInspectorKey = ref('root')
  const cancelInlineCreate = vi.fn(() => {
    createState.key = null
    createState.kind = null
    createState.parentId = null
    createState.value = ''
    createState.saving = false
  })
  const cancelRename = vi.fn(() => {
    renameState.key = null
    renameState.value = ''
    renameState.saving = false
  })
  const closeContextMenu = vi.fn()
  const ensureExpandedToCategory = vi.fn()
  const focusInlineInput = vi.fn(() => Promise.resolve())
  const inspectItem = vi.fn()
  const prepareCreateItemForm = vi.fn()
  const selectFolder = vi.fn()
  const showInspectorPanel = vi.fn()
  const startInlineCreate = vi.fn((kind: 'category' | 'item', parentId: string | null) => {
    createState.kind = kind
    createState.parentId = parentId
    createState.key = `draft-${kind}:test`
    createState.value = ''
  })
  const startInlineRename = vi.fn((key: ShopCatalogTreeNode['key'], value: string) => {
    renameState.key = key
    renameState.value = value
  })
  const createErrors: Array<{ error: unknown; fallbackMessage: string }> = []
  const createErrorMessages: string[] = []
  const detailErrors: Array<{ error: unknown; fallbackMessage: string }> = []

  const actions = useShopCatalogInlineActions({
    activeFolderId,
    cancelInlineCreate,
    cancelRename,
    categoriesById,
    closeContextMenu,
    createState,
    ensureExpandedToCategory,
    expandedCategoryIds,
    focusInlineInput,
    inspectItem,
    items,
    prepareCreateItemForm,
    renameState,
    rootBucketExpanded,
    selectFolder,
    selectedInspectorKey,
    setCreateError: (error, fallbackMessage) => {
      createErrors.push({ error, fallbackMessage })
    },
    setCreateErrorMessage: (message) => {
      createErrorMessages.push(message)
    },
    setDetailError: (error, fallbackMessage) => {
      detailErrors.push({ error, fallbackMessage })
    },
    showInspectorPanel,
    startInlineCreate,
    startInlineRename,
  })

  return {
    actions,
    activeFolderId,
    cancelInlineCreate,
    cancelRename,
    closeContextMenu,
    createErrorMessages,
    createErrors,
    createState,
    detailErrors,
    ensureExpandedToCategory,
    expandedCategoryIds,
    focusInlineInput,
    inspectItem,
    prepareCreateItemForm,
    renameState,
    rootBucketExpanded,
    selectFolder,
    selectedInspectorKey,
    showInspectorPanel,
    startInlineCreate,
    startInlineRename,
  }
}

describe('useShopCatalogInlineEditing', () => {
  it('keeps create and rename state mutually exclusive and resettable', () => {
    const editing = useShopCatalogInlineEditing()

    editing.startInlineCreate('category', 'cat-tools')
    expect(editing.createState).toMatchObject({
      kind: 'category',
      parentId: 'cat-tools',
      value: '',
      saving: false,
    })
    expect(editing.createState.key?.startsWith('draft-category:')).toBe(true)
    expect(editing.isCreatingNode(editing.createState.key as ShopCatalogTreeNode['key'])).toBe(true)

    editing.startInlineRename('item:item-drill', 'Cordless Drill')
    expect(editing.createState.key).toBeNull()
    expect(editing.renameState).toMatchObject({
      key: 'item:item-drill',
      value: 'Cordless Drill',
      saving: false,
    })
    expect(editing.isRenamingNode('item:item-drill')).toBe(true)

    editing.cancelRename()
    expect(editing.renameState).toMatchObject({
      key: null,
      value: '',
      saving: false,
    })
  })
})

describe('useShopCatalogInlineActions', () => {
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

  it('opens create-item mode for folders and root', () => {
    const {
      actions,
      activeFolderId,
      cancelInlineCreate,
      cancelRename,
      ensureExpandedToCategory,
      prepareCreateItemForm,
      rootBucketExpanded,
      selectedInspectorKey,
      showInspectorPanel,
    } = mountInlineActions()

    actions.openCreateItemMode('cat-tools')

    expect(cancelRename).toHaveBeenCalledTimes(1)
    expect(cancelInlineCreate).toHaveBeenCalledTimes(1)
    expect(activeFolderId.value).toBe('cat-tools')
    expect(selectedInspectorKey.value).toBe('new-item')
    expect(showInspectorPanel).toHaveBeenCalledTimes(1)
    expect(prepareCreateItemForm).toHaveBeenCalledWith('cat-tools')
    expect(ensureExpandedToCategory).toHaveBeenCalledWith('cat-tools')

    actions.openCreateItemMode(null)
    expect(rootBucketExpanded.value).toBe(true)
    expect(prepareCreateItemForm).toHaveBeenLastCalledWith(null)
  })

  it('starts inline creation with parent expansion, context cleanup, and focus', async () => {
    const {
      actions,
      closeContextMenu,
      createErrorMessages,
      createState,
      ensureExpandedToCategory,
      focusInlineInput,
      rootBucketExpanded,
      selectedInspectorKey,
      startInlineCreate,
    } = mountInlineActions()

    await actions.beginInlineCreate('category', 'cat-tools')
    await actions.beginInlineCreate('item', null)

    expect(createErrorMessages).toEqual(['', ''])
    expect(ensureExpandedToCategory).toHaveBeenCalledWith('cat-tools')
    expect(selectedInspectorKey.value).toBe('category:cat-tools')
    expect(startInlineCreate).toHaveBeenNthCalledWith(1, 'category', 'cat-tools')
    expect(startInlineCreate).toHaveBeenNthCalledWith(2, 'item', null)
    expect(createState.key).toBe('draft-item:test')
    expect(rootBucketExpanded.value).toBe(true)
    expect(closeContextMenu).toHaveBeenCalledTimes(2)
    expect(focusInlineInput).toHaveBeenCalledTimes(2)
  })

  it('starts inline rename for folders and items with selected text focus', async () => {
    const {
      actions,
      closeContextMenu,
      focusInlineInput,
      inspectItem,
      selectFolder,
      startInlineRename,
    } = mountInlineActions()

    await actions.beginRenameNode({ kind: 'category', id: 'cat-tools' })
    await actions.beginRenameNode({ kind: 'item', id: 'item-drill' })
    await actions.beginRenameNode({ kind: 'root' })
    await actions.beginRenameNode({ kind: 'item', id: 'missing-item' })

    expect(selectFolder).toHaveBeenCalledWith('cat-tools', { showInspector: false })
    expect(inspectItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'item-drill' }), { showInspector: false })
    expect(startInlineRename).toHaveBeenNthCalledWith(1, 'category:cat-tools', 'Tools')
    expect(startInlineRename).toHaveBeenNthCalledWith(2, 'item:item-drill', 'Cordless Drill')
    expect(closeContextMenu).toHaveBeenCalledTimes(2)
    expect(focusInlineInput).toHaveBeenCalledTimes(2)
    expect(focusInlineInput).toHaveBeenCalledWith({ select: true })
  })

  it('cancels blank inline creates without service calls', async () => {
    const { actions, cancelInlineCreate, createState } = mountInlineActions({
      createState: {
        key: 'draft-category:test',
        kind: 'category',
        parentId: 'cat-tools',
        value: '   ',
        saving: false,
      },
    })

    await actions.saveInlineCreate()

    expect(cancelInlineCreate).toHaveBeenCalledTimes(1)
    expect(createShopCategoryMock).not.toHaveBeenCalled()
    expect(createState.saving).toBe(false)
  })

  it('creates inline folders and selects the new folder', async () => {
    const {
      actions,
      cancelInlineCreate,
      createErrorMessages,
      createState,
      ensureExpandedToCategory,
      expandedCategoryIds,
      selectFolder,
    } = mountInlineActions({
      createState: {
        key: 'draft-category:test',
        kind: 'category',
        parentId: 'cat-tools',
        value: ' Fasteners ',
        saving: false,
      },
    })

    await actions.saveInlineCreate()

    expect(createErrorMessages).toEqual([''])
    expect(createShopCategoryMock).toHaveBeenCalledWith({
      name: 'Fasteners',
      parentId: 'cat-tools',
      active: true,
    })
    expect(ensureExpandedToCategory).toHaveBeenCalledWith('cat-tools')
    expect(expandedCategoryIds.value).toEqual(['cat-tools', 'cat-new'])
    expect(selectFolder).toHaveBeenCalledWith('cat-new', { showInspector: false })
    expect(cancelInlineCreate).toHaveBeenCalledTimes(1)
    expect(createState.saving).toBe(false)
  })

  it('creates inline items and falls back to selecting pending item ids until records arrive', async () => {
    const {
      actions,
      activeFolderId,
      cancelInlineCreate,
      createState,
      inspectItem,
      selectedInspectorKey,
    } = mountInlineActions({
      createState: {
        key: 'draft-item:test',
        kind: 'item',
        parentId: 'cat-tools',
        value: ' Hammer Drill ',
        saving: false,
      },
      items: [makeItem({ id: 'item-existing' })],
    })

    await actions.saveInlineCreate()

    expect(createShopCatalogItemMock).toHaveBeenCalledWith({
      description: 'Hammer Drill',
      categoryId: 'cat-tools',
      sku: null,
      price: null,
      active: true,
    })
    expect(inspectItem).not.toHaveBeenCalled()
    expect(activeFolderId.value).toBe('cat-tools')
    expect(selectedInspectorKey.value).toBe('item:item-new')
    expect(cancelInlineCreate).toHaveBeenCalledTimes(1)
    expect(createState.saving).toBe(false)
  })

  it('reports inline create failures without closing the draft row', async () => {
    const error = new Error('No write access')
    createShopCatalogItemMock.mockRejectedValueOnce(error)
    const { actions, cancelInlineCreate, createErrors, createState } = mountInlineActions({
      createState: {
        key: 'draft-item:test',
        kind: 'item',
        parentId: null,
        value: 'Root Item',
        saving: false,
      },
    })

    await actions.saveInlineCreate()

    expect(createErrors).toEqual([{ error, fallbackMessage: 'Failed to create item.' }])
    expect(cancelInlineCreate).not.toHaveBeenCalled()
    expect(createState.saving).toBe(false)
  })

  it('cancels blank or unchanged renames without service calls', async () => {
    const blank = mountInlineActions({
      renameState: {
        key: 'category:cat-tools',
        value: ' ',
        saving: false,
      },
    })
    const unchanged = mountInlineActions({
      renameState: {
        key: 'item:item-drill',
        value: 'Cordless Drill',
        saving: false,
      },
    })

    await blank.actions.saveInlineRename()
    await unchanged.actions.saveInlineRename()

    expect(blank.cancelRename).toHaveBeenCalledTimes(1)
    expect(unchanged.cancelRename).toHaveBeenCalledTimes(1)
    expect(updateShopCategoryMock).not.toHaveBeenCalled()
    expect(updateShopCatalogItemMock).not.toHaveBeenCalled()
  })

  it('renames folders with preserved parent and active fields', async () => {
    const { actions, cancelRename, renameState } = mountInlineActions({
      renameState: {
        key: 'category:cat-bits',
        value: ' Driver Bits ',
        saving: false,
      },
    })

    await actions.saveInlineRename()

    expect(updateShopCategoryMock).toHaveBeenCalledWith('cat-bits', {
      name: 'Driver Bits',
      parentId: 'cat-tools',
      active: true,
    })
    expect(cancelRename).toHaveBeenCalledTimes(1)
    expect(renameState.saving).toBe(false)
  })

  it('renames items with the updated description and preserved metadata', async () => {
    const { actions, cancelRename, renameState } = mountInlineActions({
      renameState: {
        key: 'item:item-drill',
        value: ' Rotary Hammer ',
        saving: false,
      },
    })

    await actions.saveInlineRename()

    expect(updateShopCatalogItemMock).toHaveBeenCalledWith('item-drill', {
      description: 'Rotary Hammer',
      categoryId: 'cat-tools',
      sku: 'DR-1',
      price: 12.5,
      active: true,
    })
    expect(cancelRename).toHaveBeenCalledTimes(1)
    expect(renameState.saving).toBe(false)
  })

  it('reports rename failures without closing the inline editor', async () => {
    const error = new Error('Rename denied')
    updateShopCategoryMock.mockRejectedValueOnce(error)
    const { actions, cancelRename, detailErrors, renameState } = mountInlineActions({
      renameState: {
        key: 'category:cat-tools',
        value: 'Updated Tools',
        saving: false,
      },
    })

    await actions.saveInlineRename()

    expect(detailErrors).toEqual([{ error, fallbackMessage: 'Failed to rename catalog entry.' }])
    expect(cancelRename).not.toHaveBeenCalled()
    expect(renameState.saving).toBe(false)
  })
})
