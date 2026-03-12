import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import Login from '@/views/Login.vue'
import { ROUTE_NAMES } from '@/constants/app'

let mockPush: ReturnType<typeof vi.fn>
let mockReplace: ReturnType<typeof vi.fn>
let mockLogin: ReturnType<typeof vi.fn>
let mockSendPasswordResetEmail: ReturnType<typeof vi.fn>

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ login: mockLogin }),
}))

vi.mock('@/services', () => ({
  sendPasswordResetEmail: (...args: unknown[]) => mockSendPasswordResetEmail(...args),
}))

const ToastStub = defineComponent({
  name: 'ToastStub',
  template: '<div />',
  methods: {
    show() {},
  },
})

const mountLogin = () =>
  mount(Login, {
    global: {
      stubs: {
        Toast: ToastStub,
      },
    },
  })

describe('Login view', () => {
  beforeEach(() => {
    mockPush = vi.fn()
    mockReplace = vi.fn()
    mockLogin = vi.fn().mockResolvedValue(undefined)
    mockSendPasswordResetEmail = vi.fn().mockResolvedValue(undefined)
  })

  it('submits credentials and redirects to dashboard', async () => {
    const wrapper = mountLogin()
    const inputs = wrapper.findAll('input.form-control')
    expect(inputs.length).toBeGreaterThanOrEqual(2)

    await inputs[0]!.setValue('user@example.com')
    await inputs[1]!.setValue('secret123')
    await wrapper.get('button.btn.btn-primary.w-100').trigger('click')
    await flushPromises()

    expect(mockLogin).toHaveBeenCalledWith('user@example.com', 'secret123')
    expect(mockReplace).toHaveBeenCalledWith({ name: ROUTE_NAMES.DASHBOARD })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('sends password reset request from the modal', async () => {
    const wrapper = mountLogin()

    await wrapper.get('button.btn-link').trigger('click')
    expect(wrapper.find('.modal').exists()).toBe(true)

    await wrapper.get('.modal input[type="email"]').setValue('reset@example.com')
    await wrapper.get('.modal .btn.btn-primary').trigger('click')
    await flushPromises()

    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith('reset@example.com')
    expect(wrapper.find('.modal').exists()).toBe(false)
  })
})
