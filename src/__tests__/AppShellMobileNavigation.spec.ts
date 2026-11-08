import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import AppShell from '@/layouts/AppShell.vue'

const route = reactive({ name: 'jobs', fullPath: '/jobs', params: {} })
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ rawRole: 'admin', signOut: vi.fn<() => Promise<void>>() }) }))
vi.mock('vue-router', async importOriginal => ({
  ...await importOriginal<typeof import('vue-router')>(),
  useRoute: () => route,
  useRouter: () => ({ push: vi.fn<(path: string) => Promise<void>>() }),
}))

let mediaListener: ((event: { matches: boolean }) => void) | undefined
const removeListener = vi.fn<(event: string, listener: (event: { matches: boolean }) => void) => void>()
let wrapper: ReturnType<typeof mount> | undefined
beforeEach(() => {
  route.fullPath = '/jobs'
  mediaListener = undefined
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches: true,
    addEventListener: (_event: string, listener: typeof mediaListener) => { mediaListener = listener },
    removeEventListener: removeListener,
  })))
})
afterEach(() => { wrapper?.unmount(); wrapper = undefined; vi.unstubAllGlobals(); vi.clearAllMocks() })
function render() {
  wrapper = mount(AppShell, {
    attachTo: document.body,
    slots: { default: '<button>Page action</button>' },
    global: { stubs: {
      RouterLink: { props: ['to'], template: '<a :href="typeof to === \'string\' ? to : \'/jobs/job-1\'"><slot /></a>' },
      Button: { template: '<button><slot /></button>' },
    } },
  })
  return wrapper
}

it('makes the closed mobile sidebar inert and focuses the opened navigation', async () => {
  const shell = render()
  expect(shell.get('aside').attributes('inert')).toBeDefined()
  const opener = shell.get<HTMLButtonElement>('.app-shell__menu-button')
  opener.element.focus()
  await opener.trigger('click')
  await flushPromises()
  expect(shell.get('aside').attributes('inert')).toBeUndefined()
  expect(shell.get('aside').attributes('role')).toBe('dialog')
  expect(shell.get('.app-shell__body').attributes('inert')).toBeDefined()
  expect(document.activeElement).toBe(shell.get('.app-shell__sidebar-close').element)
})

it('contains keyboard focus and restores the opener on Escape, excluding composition', async () => {
  const shell = render()
  const opener = shell.get<HTMLButtonElement>('.app-shell__menu-button')
  opener.element.focus()
  await opener.trigger('click')
  await flushPromises()
  const close = shell.get<HTMLButtonElement>('.app-shell__sidebar-close')
  const signOut = shell.get<HTMLButtonElement>('.app-shell__sidebar-signout-button')
  signOut.element.focus()
  const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
  signOut.element.dispatchEvent(tab)
  expect(tab.defaultPrevented).toBe(true)
  expect(document.activeElement).toBe(close.element)
  close.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }))
  expect(document.activeElement).toBe(signOut.element)
  await signOut.trigger('keydown', { key: 'Escape', isComposing: true })
  expect(opener.attributes('aria-expanded')).toBe('true')
  await signOut.trigger('keydown', { key: 'Escape' })
  await flushPromises()
  expect(opener.attributes('aria-expanded')).toBe('false')
  expect(document.activeElement).toBe(opener.element)
  expect(shell.get('.app-shell__body').attributes('inert')).toBeUndefined()
})

it('closes on route changes and releases mobile restrictions at desktop width and disposal', async () => {
  const shell = render()
  await shell.get('.app-shell__menu-button').trigger('click')
  route.fullPath = '/dashboards/personal'
  await flushPromises()
  expect(shell.get('.app-shell__menu-button').attributes('aria-expanded')).toBe('false')
  mediaListener?.({ matches: false })
  await flushPromises()
  expect(shell.get('aside').attributes('inert')).toBeUndefined()
  expect(shell.get('aside').attributes('role')).toBeUndefined()
  shell.unmount()
  wrapper = undefined
  expect(removeListener).toHaveBeenCalledWith('change', expect.any(Function))
})
