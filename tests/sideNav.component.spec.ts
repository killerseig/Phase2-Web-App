import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { mount, RouterLinkStub } from '@vue/test-utils'
import SideNav from '@/components/layout/SideNav.vue'
import { ROUTES } from '@/constants/app'

let mockRole = 'shop'
const mockRoute = reactive({
  params: {} as Record<string, string>,
  path: ROUTES.DASHBOARD,
})
const mockAppStore = reactive({
  currentJobId: null as string | null,
  currentJobName: null as string | null,
  sidebarCollapsed: false,
  sidebarOpenMobile: false,
  setSidebarOpenMobile: vi.fn(),
  toggleSidebar: vi.fn(),
})
const mockJobsStore = reactive({
  currentJob: null as { id: string; name: string } | null,
})

vi.mock('vue-router', () => ({
  useRoute: () => mockRoute,
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ role: mockRole }),
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => mockAppStore,
}))

vi.mock('@/stores/jobs', () => ({
  useJobsStore: () => mockJobsStore,
}))

const mountSideNav = () =>
  mount(SideNav, {
    global: {
      stubs: {
        RouterLink: RouterLinkStub,
      },
      mocks: {
        $route: mockRoute,
      },
    },
  })

describe('SideNav component', () => {
  beforeEach(() => {
    mockRole = 'shop'
    mockRoute.path = ROUTES.DASHBOARD
    mockRoute.params = {}
    mockAppStore.currentJobId = null
    mockAppStore.currentJobName = null
    mockAppStore.sidebarCollapsed = false
    mockAppStore.sidebarOpenMobile = false
    mockAppStore.setSidebarOpenMobile.mockReset()
    mockAppStore.toggleSidebar.mockReset()
    mockJobsStore.currentJob = null
  })

  it('uses navigation semantics for the sidebar container', () => {
    const wrapper = mountSideNav()
    expect(wrapper.get('aside').attributes('role')).toBe('navigation')
  })

  it('hides the admin section when the role has no admin nav entries', () => {
    mockRole = 'shop'
    const wrapper = mountSideNav()
    expect(wrapper.text()).not.toContain('Admin')
  })

  it('shows the admin section for admin users', () => {
    mockRole = 'admin'
    const wrapper = mountSideNav()
    expect(wrapper.text()).toContain('Admin')
  })
})
