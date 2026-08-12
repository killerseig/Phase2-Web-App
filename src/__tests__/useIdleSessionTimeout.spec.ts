import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_IDLE_SESSION_TIMEOUT_MS,
  useIdleSessionTimeout,
} from '@/composables/useIdleSessionTimeout'

const mocks = vi.hoisted(() => ({
  auth: {
    isAuthenticated: true,
    signOut: vi.fn(),
  },
  router: {
    push: vi.fn(),
  },
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => mocks.auth,
}))

vi.mock('vue-router', () => ({
  useRouter: () => mocks.router,
}))

const Harness = defineComponent({
  setup() {
    useIdleSessionTimeout()
    return () => null
  },
})

describe('useIdleSessionTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.auth.isAuthenticated = true
    mocks.auth.signOut.mockReset()
    mocks.auth.signOut.mockResolvedValue(undefined)
    mocks.router.push.mockReset()
    mocks.router.push.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('signs out through Firebase auth after the idle window', async () => {
    const wrapper = mount(Harness)

    await vi.advanceTimersByTimeAsync(DEFAULT_IDLE_SESSION_TIMEOUT_MS - 1)

    expect(mocks.auth.signOut).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)

    expect(mocks.auth.signOut).toHaveBeenCalledTimes(1)
    expect(mocks.router.push).toHaveBeenCalledWith('/login')

    wrapper.unmount()
  })

  it('resets the idle timer when the user is active', async () => {
    const wrapper = mount(Harness)

    await vi.advanceTimersByTimeAsync(DEFAULT_IDLE_SESSION_TIMEOUT_MS - 1)
    window.dispatchEvent(new KeyboardEvent('keydown'))
    await vi.advanceTimersByTimeAsync(DEFAULT_IDLE_SESSION_TIMEOUT_MS - 1)

    expect(mocks.auth.signOut).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)

    expect(mocks.auth.signOut).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })
})
