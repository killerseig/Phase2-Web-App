import { enableAutoUnmount, flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import type { Ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SetPasswordView from '@/views/SetPasswordView.vue'

const fake = vi.hoisted(() => ({
  verify: vi.fn<(uid: string, token: string) => Promise<string>>(),
  setPassword: vi.fn<(uid: string, password: string, token: string) => Promise<void>>(),
  login: vi.fn<(email: string, password: string) => Promise<void>>(),
  replace: vi.fn<(target: unknown) => Promise<void>>(),
  messages: vi.fn<(configs: Array<{ source: Ref<string>; severity?: string }>) => void>(),
}))
vi.mock('@/services/auth', () => ({ verifySetupToken: fake.verify, setPasswordFromSetupLink: fake.setPassword }))
vi.mock('@/services/firebaseConfig', () => ({ hasConfiguredFirebase: true }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ login: fake.login }) }))
vi.mock('@/composables/useToastMessages', () => ({ useToastMessages: fake.messages }))
vi.mock('vue-router', async importOriginal => ({
  ...await importOriginal<typeof import('vue-router')>(),
  useRoute: () => ({ query: { uid: 'setup-user', setupToken: 'setup-token' } }),
  useRouter: () => ({ replace: fake.replace }),
}))

enableAutoUnmount(afterEach)
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((accept, fail) => { resolve = accept; reject = fail })
  return { promise, resolve, reject }
}
function start() {
  return mount(SetPasswordView, { global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } })
}
async function submit(wrapper: VueWrapper) {
  await flushPromises()
  await wrapper.get('#setup-password').setValue('Synthetic-password-123')
  await wrapper.get('#setup-confirm-password').setValue('Synthetic-password-123')
  await wrapper.get('form').trigger('submit')
}
function errorSource() {
  const source = fake.messages.mock.calls.at(-1)?.[0].find(config => config.severity === 'error')?.source
  if (!source) throw new Error('The setup page must provide its error feedback source.')
  return source
}
beforeEach(() => {
  vi.resetAllMocks()
  fake.verify.mockResolvedValue('synthetic@example.invalid')
  fake.setPassword.mockResolvedValue()
  fake.login.mockResolvedValue()
  fake.replace.mockResolvedValue()
})

describe('password setup lifetime', () => {
  it('does not start automatic login after leaving a pending password request', async () => {
    const request = deferred<void>()
    fake.setPassword.mockReturnValue(request.promise)
    const wrapper = start()
    await submit(wrapper)
    expect(fake.setPassword).toHaveBeenCalledWith('setup-user', 'Synthetic-password-123', 'setup-token')
    expect(wrapper.text()).toContain('Back to login')
    wrapper.unmount()
    request.resolve()
    await flushPromises()
    expect(fake.login).not.toHaveBeenCalled()
    expect(fake.replace).not.toHaveBeenCalled()
  })

  it.each(['resolve', 'reject'] as const)('does not redirect after leaving while automatic login will %s', async outcome => {
    const request = deferred<void>()
    fake.login.mockReturnValue(request.promise)
    const wrapper = start()
    await submit(wrapper)
    await flushPromises()
    expect(fake.login).toHaveBeenCalledOnce()
    wrapper.unmount()
    const settle = { resolve: () => request.resolve(), reject: () => request.reject(new Error('Synthetic login failure')) }
    settle[outcome]()
    await flushPromises()
    expect(fake.replace).not.toHaveBeenCalled()
  })

  it('does not publish a late password failure after leaving', async () => {
    const request = deferred<void>()
    fake.setPassword.mockReturnValue(request.promise)
    const wrapper = start()
    await submit(wrapper)
    const error = errorSource()
    wrapper.unmount()
    request.reject(new Error('Synthetic password failure'))
    await flushPromises()
    expect(error.value).toBe('')
    expect(fake.login).not.toHaveBeenCalled()
    expect(fake.replace).not.toHaveBeenCalled()
  })

  it('does not publish a late verification failure after leaving', async () => {
    const request = deferred<string>()
    fake.verify.mockReturnValue(request.promise)
    const wrapper = start()
    const error = errorSource()
    wrapper.unmount()
    request.reject(new Error('Synthetic verification failure'))
    await flushPromises()
    expect(error.value).toBe('')
  })

  it('preserves successful password setup and automatic login while mounted', async () => {
    const wrapper = start()
    await submit(wrapper)
    await flushPromises()
    expect(fake.login).toHaveBeenCalledWith('synthetic@example.invalid', 'Synthetic-password-123')
    expect(fake.replace).toHaveBeenCalledExactlyOnceWith('/jobs')
  })

  it('preserves the sign-in fallback if password creation succeeds but login fails', async () => {
    fake.login.mockRejectedValue(new Error('Synthetic login failure'))
    const wrapper = start()
    await submit(wrapper)
    await flushPromises()
    expect(fake.replace).toHaveBeenCalledExactlyOnceWith({
      name: 'login', query: { email: 'synthetic@example.invalid', passwordCreated: '1' },
    })
  })

  it('retains mounted failures and allows a normal retry with the entered values', async () => {
    fake.setPassword.mockRejectedValueOnce(new Error('Synthetic password failure'))
    const wrapper = start()
    await submit(wrapper)
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Synthetic password failure')
    expect((wrapper.get('#setup-password').element as HTMLInputElement).value).toBe('Synthetic-password-123')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined()
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(fake.setPassword).toHaveBeenCalledTimes(2)
    expect(fake.replace).toHaveBeenCalledExactlyOnceWith('/jobs')
  })
})
