import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createRouter, createMemoryHistory, RouterView } from 'vue-router'
import { defineComponent } from 'vue'
import PrimeVue from 'primevue/config'
const { api, ask } = vi.hoisted(() => ({ api: vi.fn(), ask: vi.fn() }))
vi.mock('@/services/forms', () => ({ formApi: api, isFormServerEnabled: () => true, isFormEmulatorEnabled: () => false }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ currentUser: { uid: 'synthetic-admin' }, rawRole: 'admin' }) }))
vi.mock('@/features/intranet/usePrivateReferences', async () => {
  const { ref } = await import('vue')
  return { usePrivateReferences: () => ({ content: ref(null), packages: ref([]), selectedPackage: ref(null), loading: ref(false), error: ref(''), notice: ref(''), reload: vi.fn(), cancel: vi.fn(), selectSource: vi.fn() }) }
})
vi.mock('@/layouts/AppShell.vue', () => ({ default: { template: '<main><slot :openNavigation="() => {}" :mobileNavOpen="false" /></main>' } }))
import FormBuilderView from './FormBuilderView.vue'

const definition = () => ({ title: 'Original', description: '', recipients: [], fields: [{ id: 'notes', kind: 'text', label: 'Notes', required: false, options: [] }] })
let wrapper: VueWrapper
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value))
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done }); return { promise, resolve } }
const dialog = defineComponent({ setup(_props, { expose }) { expose({ ask }); return () => null } })
async function setup(options: { saveError?: string; publishError?: string; confirmation?: Promise<boolean>; saveWait?: Promise<void>; issueWait?: Promise<void>; wrongId?: boolean; archived?: boolean } = {}) {
  const template = { id: 'test-form', draft: definition(), revision: 7, latestVersion: 0, archived: !!options.archived, used: false }
  ask.mockImplementation(() => options.confirmation ?? Promise.resolve(true))
  api.mockImplementation(async (name, data) => {
    if (name === 'formTemplates' && data.action === 'list') return { templates: [copy(template)] }
    if (name === 'formTemplates' && data.action === 'save') {
      await options.saveWait
      if (options.saveError) throw new Error(options.saveError)
      template.draft = copy(data.definition); template.revision++
      return { ...copy(template), id: options.wrongId ? 'wrong-id' : template.id }
    }
    if (name === 'formTemplates' && data.action === 'issue') {
      await options.issueWait
      if (options.publishError) throw new Error(options.publishError)
      expect(data.revision).toBe(template.revision)
      template.latestVersion = 1
      return { ok: true }
    }
    throw new Error('Unexpected synthetic request ' + name + ':' + data.action)
  })
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/admin/forms', component: FormBuilderView }, { path: '/other', component: { template: '<p>Other</p>' } }] })
  await router.push('/admin/forms'); await router.isReady()
  wrapper = mount(RouterView, { global: { plugins: [router, PrimeVue], stubs: { BuilderConfirmDialog: dialog } } })
  await flushPromises()
  await wrapper.get('[data-template-id="test-form"] .library-target').trigger('click'); await flushPromises()
  return router
}
const button = (label: string) => wrapper.findAll('button').find(item => item.text() === label)!
const title = () => wrapper.get('.inspector-panel input[maxlength="160"]')
async function publishing() { await wrapper.get('[aria-label="Publishing settings"]').trigger('click'); await flushPromises() }
const mutations = () => api.mock.calls.filter(([, data]) => ['save', 'issue'].includes(data.action))
beforeEach(() => { vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }); api.mockReset(); ask.mockReset() })
afterEach(() => { wrapper?.unmount(); vi.unstubAllGlobals() })

describe('confirmed save then publish using isolated synthetic API responses', () => {
  it.each([false, true])('saves current state and issues its exact returned revision (edited=%s)', async edited => {
    const router = await setup()
    if (edited) await title().setValue('Edited current draft')
    await publishing(); await button('Publish').trigger('click'); await flushPromises()
    expect(mutations().map(([, data]) => data.action)).toEqual(['save', 'issue'])
    expect(mutations()[0]![1]).toMatchObject({ revision: 7, definition: { title: edited ? 'Edited current draft' : 'Original' } })
    expect(mutations()[1]![1]).toEqual({ action: 'issue', id: 'test-form', revision: 8 })
    expect(ask).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ confirmLabel: 'Save and publish' }))
    await router.push('/other'); expect(ask).toHaveBeenCalledTimes(1)
  })
  it('blocks invalid definitions and canceled confirmation before saving', async () => {
    await setup(); await title().setValue(''); await publishing(); await button('Publish').trigger('click'); await flushPromises()
    expect(mutations()).toEqual([]); expect(ask).not.toHaveBeenCalled()
    await button('Edit').trigger('click'); await title().setValue('Valid again'); await publishing()
    ask.mockResolvedValue(false); await button('Publish').trigger('click'); await flushPromises()
    expect(mutations()).toEqual([]); expect(wrapper.text()).toContain('Unsaved edits')
  })
  it('never issues stale server state after save failure and preserves edited state/dirty guard', async () => {
    const router = await setup({ saveError: 'Revision conflict' })
    await title().setValue('Keep this edit'); await publishing(); await button('Publish').trigger('click'); await flushPromises()
    expect(mutations().map(([, data]) => data.action)).toEqual(['save'])
    expect(wrapper.text()).toContain('Revision conflict'); expect(wrapper.text()).toContain('Unsaved edits')
    ask.mockResolvedValue(false); await router.push('/other'); expect(router.currentRoute.value.path).toBe('/admin/forms')
    await button('Edit').trigger('click'); expect((title().element as HTMLInputElement).value).toBe('Keep this edit')
  })
  it('blocks broken email placeholders before confirmation, save or publication', async () => {
    await setup(); await publishing()
    await wrapper.get('textarea[maxlength="20000"]').setValue('{{deleted_field}}')
    await button('Publish').trigger('click'); await flushPromises()
    expect(mutations()).toEqual([]); expect(ask).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('nonexistent or deleted field: deleted_field')
    expect(wrapper.text()).toContain('Unsaved edits')
  })
  it('reports publication failure while keeping the successfully saved draft baseline', async () => {
    const router = await setup({ publishError: 'Publication conflict' })
    await title().setValue('Saved even if publication fails'); await publishing(); await button('Publish').trigger('click'); await flushPromises()
    expect(wrapper.text()).toContain('Draft saved, but publication failed: Publication conflict')
    expect(wrapper.text()).not.toContain('Unsaved edits')
    await button('Edit').trigger('click'); expect((title().element as HTMLInputElement).value).toBe('Saved even if publication fails')
    await router.push('/other'); expect(ask).toHaveBeenCalledTimes(1)
  })
  it('locks confirmation, save and publish against repeated clicks and form switches', async () => {
    const confirm = deferred<boolean>(), saving = deferred<void>(), issuing = deferred<void>()
    const router = await setup({ confirmation: confirm.promise, saveWait: saving.promise, issueWait: issuing.promise })
    await publishing(); const publish = button('Publish')
    await publish.trigger('click'); await publish.trigger('click'); expect(ask).toHaveBeenCalledOnce()
    expect(wrapper.get('[data-template-id="test-form"] .library-target').attributes('disabled')).toBeDefined()
    await router.push('/other'); expect(router.currentRoute.value.path).toBe('/admin/forms')
    confirm.resolve(true); await flushPromises(); expect(button('Saving draft…').attributes('disabled')).toBeDefined()
    await button('Saving draft…').trigger('click'); saving.resolve(); await flushPromises()
    expect(button('Publishing…').attributes('disabled')).toBeDefined(); await button('Publishing…').trigger('click')
    issuing.resolve(); await flushPromises(); expect(mutations().map(([, data]) => data.action)).toEqual(['save', 'issue'])
    expect(button('Publish').attributes('disabled')).toBeUndefined()
  })
  it('rejects a mismatched save response instead of issuing another template', async () => {
    await setup({ wrongId: true }); await publishing(); await button('Publish').trigger('click'); await flushPromises()
    expect(mutations().map(([, data]) => data.action)).toEqual(['save'])
    expect(wrapper.text()).toContain('Review it before publishing again')
  })
  it.each(['confirming', 'saving'])('blocks publication when state changes during %s', async phase => {
    const gate = deferred<boolean>(), saving = deferred<void>()
    await setup(phase === 'confirming' ? { confirmation: gate.promise } : { saveWait: saving.promise })
    await publishing(); await button('Publish').trigger('click'); await flushPromises()
    // Simulate an asynchronous state update despite disabled user controls.
    wrapper.findComponent({ name: 'FormOutputSettings' }).vm.$emit('update:definition', { ...definition(), title: 'Changed while pending' })
    gate.resolve(true); saving.resolve(); await flushPromises()
    expect(mutations().filter(([, data]) => data.action === 'issue')).toHaveLength(0)
    expect(wrapper.text()).toContain('before publishing again')
    expect(wrapper.text()).toContain('Unsaved edits')
  })
  it('keeps archived metadata readable without enabling editing, duplication or publication', async () => {
    await setup({ archived: true }); await button('Form actions').trigger('click')
    expect(wrapper.get('section[aria-label="Form actions"]').isVisible()).toBe(true)
    expect(wrapper.get('[aria-label="Duplicate server form"]').attributes('disabled')).toBeDefined()
    expect((title().element as HTMLInputElement).matches(':disabled')).toBe(true)
    await publishing(); expect(button('Publish').attributes('disabled')).toBeDefined()
    expect(mutations()).toEqual([])
  })
  it('opens actual publishing settings when leaving Preview and leaves standalone Save draft available', async () => {
    await setup(); await button('Preview').trigger('click')
    expect(wrapper.find('[aria-label="Full-page form preview"]').exists()).toBe(true)
    await publishing(); expect(wrapper.find('[aria-label="Full-page form preview"]').exists()).toBe(false)
    expect(wrapper.get('[aria-label="Publishing checks"]').isVisible()).toBe(true)
    expect(button('Save draft').attributes('disabled')).toBeUndefined(); expect(mutations()).toEqual([])
  })
})
