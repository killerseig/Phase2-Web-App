import { computed, effectScope, reactive, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEmployeeActions } from '@/features/employees/useEmployeeActions'
import { useShopCatalogFormActions } from '@/features/shopCatalog/useShopCatalogFormActions'
import { useAdminRequestContext } from '@/features/admin/useAdminRequestContext'
import type { EmployeeRecord, ShopCatalogItemRecord } from '@/types/domain'
import {
  createEmployeeRecord,
  deleteEmployeeRecord,
  updateEmployeeRecord,
} from '@/services/employees'
import { updateShopCatalogItem } from '@/services/shopCatalog'

vi.mock('@/services/employees', () => ({
  createEmployeeRecord: vi.fn<(typeof import('@/services/employees'))['createEmployeeRecord']>(),
  deleteEmployeeRecord: vi.fn<(typeof import('@/services/employees'))['deleteEmployeeRecord']>(),
  updateEmployeeRecord: vi.fn<(typeof import('@/services/employees'))['updateEmployeeRecord']>(),
}))
vi.mock('@/services/shopCatalog', () => ({
  createShopCatalogItem:
    vi.fn<(typeof import('@/services/shopCatalog'))['createShopCatalogItem']>(),
  createShopCategory: vi.fn<(typeof import('@/services/shopCatalog'))['createShopCategory']>(),
  updateShopCatalogItem:
    vi.fn<(typeof import('@/services/shopCatalog'))['updateShopCatalogItem']>(),
  updateShopCategory: vi.fn<(typeof import('@/services/shopCatalog'))['updateShopCategory']>(),
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
const scopes: ReturnType<typeof effectScope>[] = []
function scoped<T>(setup: () => T) {
  const scope = effectScope()
  scopes.push(scope)
  return { scope, state: scope.run(setup)! }
}
function employee(id: string): EmployeeRecord {
  return {
    id,
    employeeNumber: id,
    firstName: 'Synthetic',
    lastName: 'Person',
    occupation: 'Installer',
    active: true,
    isContractor: false,
    jobId: null,
  }
}
function employees() {
  return scoped(() => {
    const uid = ref('admin-a'),
      enabled = ref(true)
    const context = useAdminRequestContext(uid, enabled)
    const selectedEmployeeId = ref<string>('a')
    const selectedEmployee = computed(() =>
      selectedEmployeeId.value === 'new' ? null : employee(selectedEmployeeId.value),
    )
    const detailInfo = ref(''),
      detailError = ref(''),
      createInfo = ref('')
    const createForm = reactive({ ...employee('new') }),
      detailForm = reactive({ ...employee('a') })
    const createLoading = ref(false),
      saveLoading = ref(false),
      deleteLoading = ref(false),
      deleteConfirmOpen = ref(false)
    const actions = useEmployeeActions({
      context,
      createForm,
      detailForm,
      createLoading,
      saveLoading,
      deleteLoading,
      deleteConfirmOpen,
      selectedEmployee,
      selectedEmployeeId,
      hasUnsavedDetailChanges: () => true,
      syncingDetailForm: ref(false),
      resetCreateForm: () => undefined,
      resetCreateMessages: () => {
        createInfo.value = ''
      },
      resetDetailMessages: () => {
        detailInfo.value = ''
        detailError.value = ''
      },
      setCreateError: (_error, fallback) => {
        createInfo.value = fallback
      },
      setCreateErrorMessage: (value) => {
        createInfo.value = value
      },
      setCreateInfo: (value) => {
        createInfo.value = value
      },
      setDetailError: (_error, fallback) => {
        detailError.value = fallback
      },
      setDetailErrorMessage: (value) => {
        detailError.value = value
      },
      setDetailInfo: (value) => {
        detailInfo.value = value
      },
    })
    return {
      ...actions,
      uid,
      enabled,
      context,
      createForm,
      detailForm,
      selectedEmployeeId,
      detailInfo,
      detailError,
      createInfo,
      createLoading,
      saveLoading,
      deleteConfirmOpen,
    }
  })
}
beforeEach(() => vi.resetAllMocks())
afterEach(() => scopes.splice(0).forEach((scope) => scope.stop()))

describe('admin action request ownership', () => {
  it('does not report an old employee save in another selected record', async () => {
    const request = deferred<void>()
    vi.mocked(updateEmployeeRecord).mockReturnValue(request.promise)
    const { state } = employees()
    const pending = state.handleAutoSaveEmployee()
    state.selectedEmployeeId.value = 'b'
    state.detailInfo.value = 'Editing B'
    request.resolve()
    await pending
    expect(state.detailInfo.value).toBe('Editing B')
  })
  it('does not retarget a pending employee deletion to a newer selection', async () => {
    const { state } = employees()
    await state.handleDeleteEmployee()
    state.selectedEmployeeId.value = 'b'
    await state.confirmDeleteEmployee()
    expect(deleteEmployeeRecord).not.toHaveBeenCalled()
  })
  it('does not select a newly created employee after the owner is disposed', async () => {
    const request = deferred<string>()
    vi.mocked(createEmployeeRecord).mockReturnValue(request.promise)
    const { state, scope } = employees()
    state.selectedEmployeeId.value = 'new'
    const pending = state.handleCreateEmployee()
    scope.stop()
    request.resolve('created')
    await pending
    expect(state.selectedEmployeeId.value).toBe('new')
    expect(state.createInfo.value).toBe('')
  })
  it.each(['account', 'access', 'relogin'] as const)(
    'invalidates employee confirmation on %s transition',
    async (transition) => {
      const { state } = employees()
      await state.handleDeleteEmployee()
      if (transition === 'account') state.uid.value = 'admin-b'
      else if (transition === 'access') state.enabled.value = false
      else {
        state.uid.value = ''
        state.uid.value = 'admin-a'
      }
      await state.confirmDeleteEmployee()
      expect(deleteEmployeeRecord).not.toHaveBeenCalled()
      expect(state.deleteConfirmOpen.value).toBe(false)
    },
  )
  it('keeps a newer employee save busy when the old response completes', async () => {
    const first = deferred<void>(),
      second = deferred<void>()
    vi.mocked(updateEmployeeRecord)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    const { state } = employees()
    const oldRequest = state.handleAutoSaveEmployee()
    state.selectedEmployeeId.value = 'b'
    const newRequest = state.handleAutoSaveEmployee()
    first.resolve()
    await oldRequest
    expect(state.saveLoading.value).toBe(true)
    expect(state.detailInfo.value).toBe('Saving changes...')
    second.resolve()
    await newRequest
    expect(state.saveLoading.value).toBe(false)
    expect(state.detailInfo.value).toBe('All changes saved.')
  })
  it('does not mark edits made during an employee save as saved', async () => {
    const request = deferred<void>()
    vi.mocked(updateEmployeeRecord).mockReturnValue(request.promise)
    const { state } = employees()
    const pending = state.handleAutoSaveEmployee()
    state.detailForm.firstName = 'Later edit'
    state.detailInfo.value = 'Unsaved later edit'
    request.resolve()
    await pending
    expect(state.detailInfo.value).toBe('Unsaved later edit')
    expect(state.saveLoading.value).toBe(false)
  })
  it('rejects employee mutations while access is unavailable', async () => {
    const { state } = employees()
    state.enabled.value = false
    await state.handleCreateEmployee()
    await state.handleAutoSaveEmployee()
    await state.handleDeleteEmployee()
    expect(createEmployeeRecord).not.toHaveBeenCalled()
    expect(updateEmployeeRecord).not.toHaveBeenCalled()
    expect(state.deleteConfirmOpen.value).toBe(false)
  })
  it('does not move the catalog inspector when an earlier item save finishes', async () => {
    const request = deferred<void>()
    vi.mocked(updateShopCatalogItem).mockReturnValue(request.promise)
    const { state } = scoped(() => {
      const selectedInspectorKey = ref('item:a'),
        activeFolderId = ref<string | null>('folder-a'),
        info = ref('')
      const selectedItem = ref<ShopCatalogItemRecord | null>({
        id: 'a',
        categoryId: 'folder-a',
        description: 'Item A',
        sku: null,
        price: 1,
        active: true,
      })
      const actions = useShopCatalogFormActions({
        activeFolderId,
        selectedInspectorKey,
        selectedItem,
        selectedCategory: ref(null),
        createLoading: ref(false),
        saveLoading: ref(false),
        createCategoryForm: { name: '', parentId: null, active: true },
        detailCategoryForm: { name: '', parentId: null, active: true },
        createItemForm: { description: '', sku: '', price: '', categoryId: null, active: true },
        detailItemForm: {
          description: 'Item A',
          sku: '',
          price: '1',
          categoryId: 'folder-a',
          active: true,
        },
        expandedCategoryIds: ref([]),
        ensureExpandedToCategory: () => undefined,
        resetDetailMessages: () => {
          info.value = ''
        },
        showInspectorPanel: () => undefined,
        setCreateError: () => undefined,
        setCreateErrorMessage: () => undefined,
        setDetailError: () => undefined,
        setDetailErrorMessage: () => undefined,
        setDetailInfo: (value) => {
          info.value = value
        },
      })
      return { ...actions, selectedInspectorKey, selectedItem, activeFolderId, info }
    })
    const pending = state.handleSaveItem()
    state.selectedInspectorKey.value = 'item:b'
    state.selectedItem.value = {
      id: 'b',
      categoryId: 'folder-b',
      description: 'Item B',
      sku: null,
      price: 2,
      active: true,
    }
    state.activeFolderId.value = 'unrelated'
    state.info.value = 'Editing B'
    request.resolve()
    await pending
    expect(state.activeFolderId.value).toBe('unrelated')
    expect(state.info.value).toBe('Editing B')
  })
})
