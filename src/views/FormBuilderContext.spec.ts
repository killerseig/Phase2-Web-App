import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, reactive, ref } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import PrimeVue from 'primevue/config'
import { newTemplate, emptyLibrary } from '@/features/forms/model'
import { readLibrary, saveLibrary } from '@/features/forms/localLibrary'
import { sampleContent } from '@/features/intranet/__tests__/fixtures'

const { api, ask, fixture } = vi.hoisted(() => ({
  api: vi.fn<(name: string, data: { action: string; [key: string]: unknown }) => Promise<unknown>>(),
  ask: vi.fn<(options: { title: string; message: string; confirmLabel: string }) => Promise<boolean>>(),
  fixture: { server: true },
}))
const account = reactive<{ currentUser: { uid: string } | null; rawRole: string; hasWorkspaceAccess: boolean }>({
  currentUser: { uid: 'context-admin' }, rawRole: 'admin', hasWorkspaceAccess: true,
})
vi.mock('@/services/forms', () => ({ formApi: api, isFormServerEnabled: () => fixture.server, isFormEmulatorEnabled: () => false }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => account }))
vi.mock('@/layouts/AppShell.vue', () => ({ default: { template: '<main><slot :openNavigation="() => {}" :mobileNavOpen="false" /></main>' } }))
vi.mock('@/features/intranet/usePrivateReferences', () => ({ usePrivateReferences: () => ({
  content: ref({ ...sampleContent(), forms: [{ id: 'foreman-source-b14', title: 'Private source', paragraphs: [], fields: [{ label: 'Date of Damage', type: 'text', required: true, signature: false }] }] }),
  packages: ref([]), selectedPackage: ref(''), loading: ref(false), error: ref(''), notice: ref(''), selectSource: vi.fn<(id: string) => void>(), reload: vi.fn<() => void>(), cancel: vi.fn<() => void>(),
}) }))
import FormBuilderView from './FormBuilderView.vue'

let wrapper: VueWrapper | undefined
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done }); return { promise, resolve } }
const definition = { title: 'First form', description: '', recipients: [], fields: [{ id: 'notes', kind: 'text', label: 'Notes', required: false, options: [] }] }
async function render() {
  api.mockImplementation(async (_name, data) => {
    if (data.action === 'list') return { templates: ['first', 'second'].map(id => ({ id, draft: { ...definition, title: id }, revision: 1, latestVersion: 0, archived: false, used: false })) }
    throw new Error('This caller regression must not send a mutation')
  })
  const dialog = defineComponent({ setup(_props, { expose }) { expose({ ask }); return () => null } })
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/admin/forms', component: FormBuilderView }, { path: '/other', component: { template: '<p>Other</p>' } }] })
  await router.push('/admin/forms'); await router.isReady()
  wrapper = mount(RouterView, { global: { plugins: [router, PrimeVue], stubs: { BuilderConfirmDialog: dialog } } })
  await flushPromises()
  return router
}
const button = (name: string) => wrapper!.findAll('button').find(item => item.attributes('aria-label') === name || item.text() === name)!
const title = () => wrapper!.get('.inspector-panel input[maxlength="160"]')
async function select(id: string) { await wrapper!.get('[data-template-id="' + id + '"] .library-target').trigger('click'); await flushPromises() }
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  api.mockReset(); ask.mockReset(); fixture.server = true
  account.currentUser = { uid: 'context-admin' }; account.rawRole = 'admin'; account.hasWorkspaceAccess = true
  localStorage.clear()
})
afterEach(() => { wrapper?.unmount(); wrapper = undefined; vi.unstubAllGlobals(); localStorage.clear() })

describe('Form Builder caller context boundaries', () => {
  it('keeps the current draft when edits change and revert while discard confirmation is pending', async () => {
    await render(); await select('first'); await title().setValue('Unsaved first')
    const gate = deferred<boolean>(); ask.mockReturnValue(gate.promise)
    await select('second')
    await title().setValue('Newer edit'); await title().setValue('Unsaved first')
    gate.resolve(true); await flushPromises()
    expect((title().element as HTMLInputElement).value).toBe('Unsaved first')
    expect(wrapper!.text()).toContain('Unsaved edits')
  })

  it.each(['role', 'access', 'session'])('does not revive a pending source confirmation after %s revocation and restoration', async kind => {
    await render(); await select('first'); await title().setValue('Unsaved first')
    const gate = deferred<boolean>(); ask.mockReturnValue(gate.promise)
    await button('Private source draft').trigger('click')
    if (kind === 'role') { account.rawRole = 'foreman'; account.rawRole = 'admin' }
    else if (kind === 'access') { account.hasWorkspaceAccess = false; account.hasWorkspaceAccess = true }
    else { account.currentUser = null; account.currentUser = { uid: 'context-admin' } }
    gate.resolve(true); await flushPromises()
    expect(wrapper!.find('.inspector-panel input[maxlength="160"]').exists()).toBe(false)
    expect(wrapper!.text()).not.toContain('Prepared an unsaved Admin-only draft')
    expect(api.mock.calls.every(([, data]) => data.action === 'list')).toBe(true)
  })

  it('does not leave when the draft changes after the leave confirmation opens', async () => {
    const router = await render(); await select('first'); await title().setValue('Unsaved first')
    const gate = deferred<boolean>(); ask.mockReturnValue(gate.promise)
    const navigation = router.push('/other'); await flushPromises()
    await title().setValue('Newer edit')
    gate.resolve(true); await navigation; await flushPromises()
    expect(router.currentRoute.value.path).toBe('/admin/forms')
    expect((title().element as HTMLInputElement).value).toBe('Newer edit')
  })

  it('clears a source draft and suppresses its queued readiness message on revocation', async () => {
    await render()
    button('Private source draft').element.click()
    account.rawRole = 'foreman'
    await flushPromises()
    expect(wrapper!.find('.inspector-panel input[maxlength="160"]').exists()).toBe(false)
    expect(wrapper!.text()).not.toContain('Prepared an unsaved Admin-only draft')
  })

  it('does not remove a local form after its selected draft changes during confirmation', async () => {
    fixture.server = false
    const template = newTemplate(); template.title = 'Local draft'
    saveLibrary(localStorage, 'context-admin', { ...emptyLibrary(), templates: [template] })
    await render(); await select(template.id)
    const gate = deferred<boolean>(); ask.mockReturnValue(gate.promise)
    await button('Form actions').trigger('click')
    await button('Delete').trigger('click')
    await title().setValue('Newer local edit')
    gate.resolve(true); await flushPromises()
    expect(readLibrary(localStorage, 'context-admin').templates.map(item => item.id)).toEqual([template.id])
    expect((title().element as HTMLInputElement).value).toBe('Newer local edit')
  })
})
