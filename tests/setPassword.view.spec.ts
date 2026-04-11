import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import SetPassword from '@/views/SetPassword.vue'
import { ROLES, ROUTE_NAMES, type Role } from '@/constants/app'

let mockPush: ReturnType<typeof vi.fn>
let mockVerifySetupToken: ReturnType<typeof vi.fn>
let mockSetPasswordFromSetupLink: ReturnType<typeof vi.fn>
const mockAuthStore: {
  login: ReturnType<typeof vi.fn>
  role: Role
} = {
  login: vi.fn(),
  role: ROLES.ADMIN,
}
let mockRoute: { query: Record<string, string> }

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useRoute: () => mockRoute,
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => mockAuthStore,
}))

vi.mock('@/services', () => ({
  verifySetupToken: (...args: unknown[]) => mockVerifySetupToken(...args),
  setPasswordFromSetupLink: (...args: unknown[]) => mockSetPasswordFromSetupLink(...args),
}))

const mountSetPassword = () =>
  mount(SetPassword, {
    global: {
      stubs: {
        RouterLink: RouterLinkStub,
      },
    },
  })

describe('SetPassword view', () => {
  beforeEach(() => {
    mockPush = vi.fn()
    mockVerifySetupToken = vi.fn().mockResolvedValue('worker@example.com')
    mockSetPasswordFromSetupLink = vi.fn().mockResolvedValue(undefined)
    mockAuthStore.login = vi.fn().mockResolvedValue(undefined)
    mockAuthStore.role = ROLES.ADMIN
    mockRoute = { query: {} }
  })

  it('shows an invalid-link state when query params are missing', async () => {
    const wrapper = mountSetPassword()
    await flushPromises()

    expect(mockVerifySetupToken).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Link Invalid or Expired')
  })

  it('verifies token, sets password, logs in, and redirects to dashboard', async () => {
    mockRoute = { query: { setupToken: 'token-1', uid: 'user-1' } }
    const wrapper = mountSetPassword()
    await flushPromises()

    await wrapper.get('input[placeholder="Enter your password"]').setValue('secure-pass')
    await wrapper.get('input[placeholder="Confirm your password"]').setValue('secure-pass')
    await wrapper.get('button.btn.btn-primary.w-100').trigger('click')
    await flushPromises()

    expect(mockVerifySetupToken).toHaveBeenCalledWith('user-1', 'token-1')
    expect(mockSetPasswordFromSetupLink).toHaveBeenCalledWith('user-1', 'secure-pass', 'token-1')
    expect(mockAuthStore.login).toHaveBeenCalledWith('worker@example.com', 'secure-pass')
    expect(mockPush).toHaveBeenCalledWith({ name: ROUTE_NAMES.DASHBOARD })
  })

  it('redirects to unauthorized when role is none after login', async () => {
    mockRoute = { query: { setupToken: 'token-2', uid: 'user-2' } }
    mockAuthStore.role = ROLES.NONE
    const wrapper = mountSetPassword()
    await flushPromises()

    await wrapper.get('input[placeholder="Enter your password"]').setValue('secure-pass')
    await wrapper.get('input[placeholder="Confirm your password"]').setValue('secure-pass')
    await wrapper.get('button.btn.btn-primary.w-100').trigger('click')
    await flushPromises()

    expect(mockPush).toHaveBeenCalledWith({ name: ROUTE_NAMES.UNAUTHORIZED })
  })

  it('does not render the self-serve sign-in footer on the invite-only screen', async () => {
    mockRoute = { query: { setupToken: 'token-3', uid: 'user-3' } }
    const wrapper = mountSetPassword()
    await flushPromises()

    expect(wrapper.text()).not.toContain('Already have an account?')
    expect(wrapper.text()).not.toContain('Sign in here')
  })
})
