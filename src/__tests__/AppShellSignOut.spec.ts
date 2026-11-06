import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import AppShell from '@/layouts/AppShell.vue'
const { auth, push } = vi.hoisted(() => ({
  auth: { rawRole: 'admin', displayName: 'Test Admin', signOut: vi.fn(async () => {}) },
  push: vi.fn(async () => {}),
}))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => auth }))
vi.mock('vue-router', async importOriginal => ({
  ...await importOriginal<typeof import('vue-router')>(),
  useRoute: () => ({ name: 'jobs', fullPath: '/jobs', params: {} }),
  useRouter: () => ({ push }),
}))
const wrappers: ReturnType<typeof mount>[] = []
function render(beforeSignOut?: () => boolean | Promise<boolean>) {
  const wrapper = mount(AppShell, {
    props: { beforeSignOut },
    global: { stubs: { RouterLink: RouterLinkStub, Button: { props: ['disabled'], template: '<button :disabled="disabled"><slot /></button>' } } },
  })
  wrappers.push(wrapper)
  return wrapper.findAll('button').find(button => button.text() === 'Sign Out')!
}
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); vi.clearAllMocks() })
it('keeps authentication and route intact when draft preparation is cancelled', async () => {
  const button = render(() => false)
  await button.trigger('click')
  await flushPromises()
  expect(auth.signOut).not.toHaveBeenCalled()
  expect(push).not.toHaveBeenCalled()
  expect(button.attributes('disabled')).toBeUndefined()
})
it('waits for preparation and prevents duplicate sign-out while it is pending', async () => {
  let approve!: (accepted: boolean) => void
  const prepare = vi.fn(() => new Promise<boolean>(resolve => { approve = resolve }))
  const button = render(prepare)
  await button.trigger('click')
  expect(button.attributes('disabled')).toBeDefined()
  expect(auth.signOut).not.toHaveBeenCalled()
  await button.trigger('click')
  expect(prepare).toHaveBeenCalledTimes(1)
  approve(true)
  await flushPromises()
  expect(auth.signOut).toHaveBeenCalledTimes(1)
  expect(push).toHaveBeenCalledWith('/login')
})
it('preserves normal sign-out for pages without a draft preparation callback', async () => {
  const button = render()
  await button.trigger('click')
  await flushPromises()
  expect(auth.signOut).toHaveBeenCalledTimes(1)
  expect(push).toHaveBeenCalledWith('/login')
})
