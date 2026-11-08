import { flushPromises, shallowMount, type VueWrapper } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import UsersView from '@/views/UsersView.vue'
import EmployeesView from '@/views/EmployeesView.vue'
import ShopCatalogAdminView from '@/views/ShopCatalogAdminView.vue'
import type {
  EmployeeRecord,
  ShopCatalogItemRecord,
  ShopCategoryRecord,
  UserProfile,
} from '@/types/domain'
import { deleteUserByAdmin } from '@/services/users'
import { deleteEmployeeRecord } from '@/services/employees'

type Listener<T> = { update: (records: T[]) => void; off: () => void }
const harness = vi.hoisted(() => ({
  auth: {
    currentUser: { uid: 'admin-a' } as { uid: string } | null,
    rawRole: 'admin',
    hasWorkspaceAccess: true,
  },
  users: [] as Listener<UserProfile>[],
  employees: [] as Listener<EmployeeRecord>[],
  categories: [] as Listener<ShopCategoryRecord>[],
  items: [] as Listener<ShopCatalogItemRecord>[],
  notices: [] as string[],
}))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => harness.auth }))
vi.mock('@/composables/useAppToast', () => ({
  useAppToast: () => ({
    show: (message: { detail: string }) => {
      harness.notices.push(message.detail)
    },
  }),
}))
vi.mock('@/services/jobs', () => ({ subscribeVisibleJobs: () => () => undefined }))
vi.mock('@/services/users', () => ({
  subscribeUsers: (update: (records: UserProfile[]) => void) => {
    const off = vi.fn<() => void>()
    harness.users.push({ update, off })
    return off
  },
  createUserByAdmin: vi.fn<(typeof import('@/services/users'))['createUserByAdmin']>(),
  deleteUserByAdmin: vi.fn<(typeof import('@/services/users'))['deleteUserByAdmin']>(),
  resendUserInviteByAdmin: vi.fn<(typeof import('@/services/users'))['resendUserInviteByAdmin']>(),
  sendPendingInvitesByAdmin:
    vi.fn<(typeof import('@/services/users'))['sendPendingInvitesByAdmin']>(),
  sendUserPasswordResetByAdmin:
    vi.fn<(typeof import('@/services/users'))['sendUserPasswordResetByAdmin']>(),
  updateUser: vi.fn<(typeof import('@/services/users'))['updateUser']>(),
}))
vi.mock('@/services/employees', () => ({
  subscribeEmployees: (update: (records: EmployeeRecord[]) => void) => {
    const off = vi.fn<() => void>()
    harness.employees.push({ update, off })
    return off
  },
  createEmployeeRecord: vi.fn<(typeof import('@/services/employees'))['createEmployeeRecord']>(),
  deleteEmployeeRecord: vi.fn<(typeof import('@/services/employees'))['deleteEmployeeRecord']>(),
  updateEmployeeRecord: vi.fn<(typeof import('@/services/employees'))['updateEmployeeRecord']>(),
}))
vi.mock('@/services/shopCatalog', () => ({
  subscribeShopCategories: (update: (records: ShopCategoryRecord[]) => void) => {
    const off = vi.fn<() => void>()
    harness.categories.push({ update, off })
    return off
  },
  subscribeShopCatalogItems: (update: (records: ShopCatalogItemRecord[]) => void) => {
    const off = vi.fn<() => void>()
    harness.items.push({ update, off })
    return off
  },
  createShopCatalogItem:
    vi.fn<(typeof import('@/services/shopCatalog'))['createShopCatalogItem']>(),
  createShopCategory: vi.fn<(typeof import('@/services/shopCatalog'))['createShopCategory']>(),
  updateShopCatalogItem:
    vi.fn<(typeof import('@/services/shopCatalog'))['updateShopCatalogItem']>(),
  updateShopCategory: vi.fn<(typeof import('@/services/shopCatalog'))['updateShopCategory']>(),
  deleteShopCatalogItem:
    vi.fn<(typeof import('@/services/shopCatalog'))['deleteShopCatalogItem']>(),
  deleteShopCategory: vi.fn<(typeof import('@/services/shopCatalog'))['deleteShopCategory']>(),
}))
const wrappers: VueWrapper[] = []
const shell = {
  template:
    '<div><slot name="primary"/><slot name="secondary"/><slot name="catalog"/><slot name="inspector"/><slot/></div>',
}
function mountView(
  component: typeof UsersView | typeof EmployeesView | typeof ShopCatalogAdminView,
) {
  const wrapper = shallowMount(component, {
    global: {
      stubs: { DirectoryEditorWorkspaceShell: shell, ShopCatalogPageShell: shell, AppShell: shell },
    },
  })
  wrappers.push(wrapper)
  return wrapper
}
beforeEach(() => {
  harness.auth = reactive({
    currentUser: { uid: 'admin-a' },
    rawRole: 'admin',
    hasWorkspaceAccess: true,
  })
  harness.users = []
  harness.employees = []
  harness.categories = []
  harness.items = []
  harness.notices = []
})
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

describe('mounted admin access boundaries', () => {
  it('announces an owned User deletion when its listener removes the record before the callable returns', async () => {
    let resolve!: (value: Awaited<ReturnType<typeof deleteUserByAdmin>>) => void
    vi.mocked(deleteUserByAdmin).mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    const wrapper = mountView(UsersView),
      listener = harness.users[0]!
    listener.update([
      {
        id: 'target',
        email: 'target@example.test',
        firstName: 'Target',
        lastName: 'Person',
        role: 'foreman',
        active: true,
        assignedJobIds: [],
      },
    ])
    await nextTick()
    wrapper.findComponent({ name: 'UserDirectoryPanel' }).vm.$emit('select-user', 'target')
    await nextTick()
    wrapper.findComponent({ name: 'UserEditorPanel' }).vm.$emit('delete-user')
    await nextTick()
    wrapper.findComponent({ name: 'UserConfirmDialogs' }).vm.$emit('confirm-delete')
    listener.update([])
    await nextTick()
    resolve({ success: true, message: 'User deleted.' })
    await flushPromises()
    expect(harness.notices).toContain('User deleted.')
    expect(wrapper.findComponent({ name: 'UserConfirmDialogs' }).props('deleteOpen')).toBe(false)
  })
  it('announces an owned Employee deletion when its listener removes the record before the write returns', async () => {
    let resolve!: () => void
    vi.mocked(deleteEmployeeRecord).mockReturnValue(
      new Promise<void>((done) => {
        resolve = done
      }),
    )
    const wrapper = mountView(EmployeesView),
      listener = harness.employees[0]!
    listener.update([
      {
        id: 'target',
        employeeNumber: '1',
        firstName: 'Target',
        lastName: 'Person',
        occupation: 'Installer',
        active: true,
        isContractor: false,
        jobId: null,
      },
    ])
    await nextTick()
    wrapper.findComponent({ name: 'EmployeeDirectoryPanel' }).vm.$emit('select-employee', 'target')
    await nextTick()
    wrapper.findComponent({ name: 'EmployeeEditorPanel' }).vm.$emit('delete-employee')
    await nextTick()
    wrapper.findComponent({ name: 'EmployeeConfirmDialogs' }).vm.$emit('confirm-delete')
    listener.update([])
    await nextTick()
    resolve()
    await flushPromises()
    expect(harness.notices).toContain('Employee deleted.')
    expect(wrapper.findComponent({ name: 'EmployeeConfirmDialogs' }).props('deleteOpen')).toBe(
      false,
    )
  })
  it('clears Users on role revocation and ignores old listeners after the same account returns', async () => {
    const wrapper = mountView(UsersView),
      old = harness.users[0]!
    const user: UserProfile = {
      id: 'private',
      email: 'private@example.test',
      firstName: 'Private',
      lastName: 'Person',
      active: true,
      role: 'foreman',
      assignedJobIds: [],
    }
    old.update([user])
    await nextTick()
    expect(wrapper.findComponent({ name: 'UserDirectoryPanel' }).props('users')).toHaveLength(1)
    harness.auth.rawRole = 'foreman'
    await nextTick()
    expect(wrapper.text()).toContain('You do not have access')
    expect(old.off).toHaveBeenCalledOnce()
    harness.auth.rawRole = 'admin'
    await nextTick()
    old.update([user])
    await nextTick()
    expect(wrapper.findComponent({ name: 'UserDirectoryPanel' }).props('users')).toEqual([])
    expect(harness.users).toHaveLength(2)
  })
  it('retains Payroll employee access, then clears records on workspace revocation', async () => {
    harness.auth.rawRole = 'payroll'
    const wrapper = mountView(EmployeesView),
      old = harness.employees[0]!
    old.update([
      {
        id: 'person',
        employeeNumber: '1',
        firstName: 'Private',
        lastName: 'Employee',
        occupation: 'Installer',
        active: true,
        isContractor: false,
        jobId: null,
      },
    ])
    await nextTick()
    expect(
      wrapper.findComponent({ name: 'EmployeeDirectoryPanel' }).props('employees'),
    ).toHaveLength(1)
    harness.auth.hasWorkspaceAccess = false
    await nextTick()
    expect(wrapper.text()).toContain('You do not have access')
    expect(old.off).toHaveBeenCalledOnce()
    harness.auth.hasWorkspaceAccess = true
    await nextTick()
    expect(wrapper.findComponent({ name: 'EmployeeDirectoryPanel' }).props('employees')).toEqual([])
  })
  it('retains Shop Foreman catalog access and revokes both listeners on sign-out', async () => {
    harness.auth.rawRole = 'shop-foreman'
    const wrapper = mountView(ShopCatalogAdminView),
      folders = harness.categories[0]!,
      items = harness.items[0]!
    folders.update([{ id: 'folder', name: 'Private folder', parentId: null, active: true }])
    items.update([
      {
        id: 'item',
        description: 'Private item',
        categoryId: null,
        sku: null,
        price: 1,
        active: true,
      },
    ])
    await nextTick()
    expect(
      wrapper.findComponent({ name: 'ShopCatalogTreePane' }).props('treeNodes').length,
    ).toBeGreaterThan(0)
    harness.auth.currentUser = null
    await nextTick()
    expect(wrapper.text()).toContain('You do not have access')
    expect(folders.off).toHaveBeenCalledOnce()
    expect(items.off).toHaveBeenCalledOnce()
    harness.auth.currentUser = { uid: 'admin-a' }
    await nextTick()
    folders.update([{ id: 'stale', name: 'Stale', parentId: null, active: true }])
    await nextTick()
    expect(wrapper.findComponent({ name: 'ShopCatalogTreePane' }).props('treeNodes')).toEqual([])
  })
  it.each([UsersView, EmployeesView, ShopCatalogAdminView])(
    'never subscribes without workspace access',
    async (component) => {
      harness.auth.hasWorkspaceAccess = false
      const wrapper = mountView(component)
      await nextTick()
      expect(wrapper.text()).toContain('You do not have access')
      expect(harness.users).toHaveLength(0)
      expect(harness.employees).toHaveLength(0)
      expect(harness.categories).toHaveLength(0)
      expect(harness.items).toHaveLength(0)
    },
  )
})
