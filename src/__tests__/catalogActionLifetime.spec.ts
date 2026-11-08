import { computed, effectScope, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdminRequestContext } from '@/features/admin/useAdminRequestContext'
import { useShopCatalogInlineActions } from '@/features/shopCatalog/useShopCatalogInlineActions'
import { useShopCatalogInlineEditing } from '@/features/shopCatalog/useShopCatalogInlineEditing'
import { useShopCatalogArchiveActions } from '@/features/shopCatalog/useShopCatalogArchiveActions'
import { useShopCatalogDeleteActions } from '@/features/shopCatalog/useShopCatalogDeleteActions'
import { useShopCatalogMoveActions } from '@/features/shopCatalog/useShopCatalogMoveActions'
import { useShopCatalogRecords } from '@/features/shopCatalog/useShopCatalogRecords'
import { useShopCatalogDragDrop } from '@/features/shopCatalog/useShopCatalogDragDrop'
import type { ShopCatalogConfirmAction } from '@/features/shopCatalog/adminViewHelpers'
import type { ShopCatalogItemRecord, ShopCategoryRecord } from '@/types/domain'
import {
  createShopCategory,
  deleteShopCatalogItem,
  subscribeShopCatalogItems,
  subscribeShopCategories,
  updateShopCatalogItem,
  updateShopCategory,
} from '@/services/shopCatalog'

vi.mock('@/services/shopCatalog', () => ({
  createShopCatalogItem:
    vi.fn<(typeof import('@/services/shopCatalog'))['createShopCatalogItem']>(),
  createShopCategory: vi.fn<(typeof import('@/services/shopCatalog'))['createShopCategory']>(),
  updateShopCatalogItem:
    vi.fn<(typeof import('@/services/shopCatalog'))['updateShopCatalogItem']>(),
  updateShopCategory: vi.fn<(typeof import('@/services/shopCatalog'))['updateShopCategory']>(),
  deleteShopCatalogItem:
    vi.fn<(typeof import('@/services/shopCatalog'))['deleteShopCatalogItem']>(),
  deleteShopCategory: vi.fn<(typeof import('@/services/shopCatalog'))['deleteShopCategory']>(),
  subscribeShopCatalogItems:
    vi.fn<(typeof import('@/services/shopCatalog'))['subscribeShopCatalogItems']>(),
  subscribeShopCategories:
    vi.fn<(typeof import('@/services/shopCatalog'))['subscribeShopCategories']>(),
}))
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}
const scopes: ReturnType<typeof effectScope>[] = []
function fixture() {
  const scope = effectScope()
  scopes.push(scope)
  return scope.run(() => {
    const uid = ref('a'),
      enabled = ref(true),
      context = useAdminRequestContext(uid, enabled)
    const categories = ref<ShopCategoryRecord[]>([
      { id: 'folder', name: 'Folder', parentId: null, active: true },
    ])
    const items = ref<ShopCatalogItemRecord[]>([
      { id: 'item', description: 'Item', categoryId: 'folder', sku: null, price: 1, active: true },
    ])
    const categoriesById = computed(
      () => new Map(categories.value.map((entry) => [entry.id, entry])),
    )
    const selectedInspectorKey = ref('item:item'),
      activeFolderId = ref<string | null>('folder')
    const selectedItem = computed(
      () => items.value.find((entry) => `item:${entry.id}` === selectedInspectorKey.value) ?? null,
    )
    const selectedCategory = computed(
      () =>
        categories.value.find((entry) => `category:${entry.id}` === selectedInspectorKey.value) ??
        null,
    )
    const info = ref(''),
      error = ref(''),
      catalogConfirmAction = ref<ShopCatalogConfirmAction | null>(null),
      saveLoading = ref(false),
      deleteLoading = ref(false)
    const selectFolder = vi.fn<(id: string) => void>((id) => {
      selectedInspectorKey.value = `category:${id}`
    })
    const inspectItem = vi.fn<(item: ShopCatalogItemRecord) => void>((item) => {
      selectedInspectorKey.value = `item:${item.id}`
    })
    const setDetailError = (_reason: unknown, message: string) => {
      error.value = message
    }
    const shared = {
      context,
      activeFolderId,
      categoriesById,
      items,
      selectedInspectorKey,
      selectedCategory,
      selectedItem,
      catalogConfirmAction,
      saveLoading,
      deleteLoading,
      selectFolder,
      inspectItem,
      setDetailError,
      setDetailInfo: (value: string) => {
        info.value = value
      },
      resetDetailMessages: () => {
        info.value = ''
        error.value = ''
      },
      ensureExpandedToCategory: () => undefined,
    }
    const editing = useShopCatalogInlineEditing(context)
    const inline = useShopCatalogInlineActions({
      ...shared,
      ...editing,
      closeContextMenu: () => undefined,
      expandedCategoryIds: ref([]),
      rootBucketExpanded: ref(true),
      prepareCreateItemForm: () => undefined,
      showInspectorPanel: () => undefined,
      setCreateError: setDetailError,
      setCreateErrorMessage: (value) => {
        error.value = value
      },
    })
    const archive = useShopCatalogArchiveActions({
      ...shared,
      childCategoriesByParent: computed(() => new Map([[null, categories.value]])),
      showArchived: ref(false),
    })
    const deletion = useShopCatalogDeleteActions({
      ...shared,
      selectedCategoryHasChildren: ref(false),
      setDetailErrorMessage: (value) => {
        error.value = value
      },
    })
    const move = useShopCatalogMoveActions(shared)
    return {
      scope,
      uid,
      enabled,
      context,
      categories,
      items,
      selectedInspectorKey,
      activeFolderId,
      info,
      error,
      catalogConfirmAction,
      saveLoading,
      deleteLoading,
      selectFolder,
      inspectItem,
      ...editing,
      ...inline,
      ...archive,
      ...deletion,
      ...move,
    }
  })!
}
beforeEach(() => vi.resetAllMocks())
afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop())
  vi.unstubAllGlobals()
})

describe('catalog operation ownership', () => {
  it('reports an owned drop failure after the browser emits normal dragend', async () => {
    const request = deferred<void>(),
      state = fixture()
    const failed = vi.fn<(error: unknown) => void>()
    const drag = state.scope.run(() =>
      useShopCatalogDragDrop({
        categoriesById: computed(
          () => new Map(state.categories.value.map((entry) => [entry.id, entry])),
        ),
        childCategoriesByParent: computed(() => new Map([[null, state.categories.value]])),
        items: state.items,
        clearPointerType: () => undefined,
        closeContextMenu: () => undefined,
        getScrollContainer: () => null,
        isCreatingNode: () => false,
        isRenamingNode: () => false,
        shouldBlockDragStart: ref(false),
        moveEntry: () => request.promise,
        onMoveError: failed,
      }),
    )!
    const event = { preventDefault: () => undefined, dataTransfer: null } as unknown as DragEvent
    drag.handleTreeDragStart(event, {
      key: 'item:item',
      kind: 'item',
      id: 'item',
      label: 'Item',
      secondary: '',
      parentId: 'folder',
      depth: 1,
      hasChildren: false,
      active: true,
    })
    const pending = drag.handleRootDrop(event)
    drag.handleTreeDragEnd()
    const error = new Error('Move failed')
    request.reject(error)
    await pending
    expect(failed).toHaveBeenCalledExactlyOnceWith(error)
    expect(drag.dragState.dropping).toBe(false)
  })
  it('does not close or select over a replacement inline create', async () => {
    const request = deferred<string>()
    vi.mocked(createShopCategory).mockReturnValue(request.promise)
    const state = fixture()
    state.startInlineCreate('category', null)
    state.createState.value = 'Original'
    const pending = state.saveInlineCreate()
    state.cancelInlineCreate()
    state.startInlineCreate('item', 'folder')
    state.createState.value = 'Replacement'
    request.resolve('created')
    await pending
    expect(state.createState.kind).toBe('item')
    expect(state.createState.value).toBe('Replacement')
    expect(state.selectFolder).not.toHaveBeenCalled()
  })
  it('does not report an old rename error into a new rename', async () => {
    const request = deferred<void>()
    vi.mocked(updateShopCatalogItem).mockReturnValue(request.promise)
    const state = fixture()
    state.startInlineRename('item:item', 'Renamed')
    const pending = state.saveInlineRename()
    state.cancelRename()
    state.startInlineRename('category:folder', 'Next rename')
    request.reject(new Error('Old failure'))
    await pending
    expect(state.renameState.value).toBe('Next rename')
    expect(state.error.value).toBe('')
  })
  it('does not commit pending focus after cancellation or disposal', async () => {
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback)
      return frames.length
    })
    const state = fixture(),
      input = document.createElement('input')
    document.body.append(input)
    const focus = vi.spyOn(input, 'focus')
    state.setInlineInputRef(input)
    state.startInlineCreate('category', null)
    await state.focusInlineInput()
    state.cancelInlineCreate()
    frames.splice(0).forEach((frame) => frame(0))
    expect(focus).not.toHaveBeenCalled()
    state.startInlineCreate('category', null)
    await state.focusInlineInput()
    state.scope.stop()
    frames.splice(0).forEach((frame) => frame(0))
    expect(focus).not.toHaveBeenCalled()
    input.remove()
  })
  it('does not dispatch an obsolete captured deletion after same-account relogin', async () => {
    const state = fixture()
    state.handleDeleteItem()
    const action = state.catalogConfirmAction.value
    expect(action?.kind).toBe('delete-item')
    if (action?.kind !== 'delete-item') throw new Error('Expected item deletion')
    state.uid.value = ''
    state.uid.value = 'a'
    await state.confirmDeleteItem(action)
    expect(deleteShopCatalogItem).not.toHaveBeenCalled()
  })
  it('does not close a newer dialog when an older deletion finishes', async () => {
    const request = deferred<void>()
    vi.mocked(deleteShopCatalogItem).mockReturnValue(request.promise)
    const state = fixture()
    state.handleDeleteItem()
    const action = state.catalogConfirmAction.value
    if (action?.kind !== 'delete-item') throw new Error('Expected item deletion')
    const pending = state.confirmDeleteItem(action)
    state.selectedInspectorKey.value = 'category:folder'
    state.handleDeleteCategory()
    const newer = state.catalogConfirmAction.value
    request.resolve()
    await pending
    expect(state.catalogConfirmAction.value).toEqual(newer)
    expect(state.selectedInspectorKey.value).toBe('category:folder')
  })
  it('suppresses an obsolete archive completion after access is revoked', async () => {
    const request = deferred<void>()
    vi.mocked(updateShopCatalogItem).mockReturnValue(request.promise)
    const state = fixture()
    state.handleArchiveItem(false)
    const action = state.catalogConfirmAction.value
    if (action?.kind !== 'archive-item') throw new Error('Expected item archive')
    const pending = state.confirmArchiveItem(action)
    state.enabled.value = false
    request.resolve()
    await pending
    expect(state.info.value).toBe('')
    expect(state.selectedInspectorKey.value).toBe('item:item')
    expect(state.saveLoading.value).toBe(false)
  })
  it('suppresses an obsolete move failure and leaves the current selection alone', async () => {
    const request = deferred<void>()
    vi.mocked(updateShopCatalogItem).mockReturnValue(request.promise)
    const state = fixture()
    const pending = state.moveDraggedEntry({ kind: 'item', id: 'item' }, null)
    state.selectedInspectorKey.value = 'category:folder'
    request.reject(new Error('Old move'))
    await expect(pending).resolves.toBeUndefined()
    expect(state.inspectItem).not.toHaveBeenCalled()
    expect(state.info.value).toBe('')
  })
  it('rejects catalog writes without current access', async () => {
    const state = fixture()
    state.enabled.value = false
    state.handleArchiveItem(false)
    state.handleDeleteItem()
    await state.moveDraggedEntry({ kind: 'category', id: 'folder' }, null)
    await state.saveInlineCreate()
    await state.saveInlineRename()
    expect(state.catalogConfirmAction.value).toBeNull()
    expect(updateShopCategory).not.toHaveBeenCalled()
    expect(updateShopCatalogItem).not.toHaveBeenCalled()
    expect(createShopCategory).not.toHaveBeenCalled()
  })
  it('clears both record streams on denial and ignores superseded callbacks', () => {
    const state = fixture()
    let folders!: (entries: ShopCategoryRecord[]) => void,
      itemUpdate!: (entries: ShopCatalogItemRecord[]) => void,
      fail!: (reason: unknown) => void
    const offFolders = vi.fn<() => void>(),
      offItems = vi.fn<() => void>()
    vi.mocked(subscribeShopCategories).mockImplementation((update, error) => {
      folders = update
      fail = error!
      return offFolders
    })
    vi.mocked(subscribeShopCatalogItems).mockImplementation((update) => {
      itemUpdate = update
      return offItems
    })
    const records = state.scope.run(() => useShopCatalogRecords({ context: state.context }))!
    records.subscribeCatalogRecords()
    folders(state.categories.value)
    itemUpdate(state.items.value)
    fail(Object.assign(new Error('Denied'), { code: 'permission-denied' }))
    folders(state.categories.value)
    itemUpdate(state.items.value)
    expect(records.categories.value).toEqual([])
    expect(records.items.value).toEqual([])
    expect(offFolders).toHaveBeenCalledOnce()
    expect(offItems).toHaveBeenCalledOnce()
  })
})
