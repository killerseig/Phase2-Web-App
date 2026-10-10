import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory, RouterView } from 'vue-router'
import { defineComponent } from 'vue'
import PrimeVue from 'primevue/config'
const { api } = vi.hoisted(() => ({ api: vi.fn() }))
vi.mock('@/services/forms', () => ({ formApi: api, isFormServerEnabled: () => true, isFormEmulatorEnabled: () => false }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ currentUser: { uid: 'synthetic-builder-admin' } }) }))
vi.mock('@/layouts/AppShell.vue', () => ({ default: { template: '<main><slot :openNavigation="() => {}" :mobileNavOpen="false" /></main>' } }))
import FormBuilderView from './FormBuilderView.vue'
import committeeSource from '../../functions/src/committee-inspection-native.json'
import bbsSource from '../../functions/src/behavior-based-safety-observation-native.json'
import { validateFormDefinition } from '../../functions/src/formModel'
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); api.mockReset() })
describe('normal Form Builder controls with synthetic server fixtures', () => {
  it('does not show the exact New-form discard modal for untouched persisted forms or blank shells', async () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
    const templates = [committeeSource, bbsSource].map((source, index) => ({
      id: 'persisted-' + index, draft: validateFormDefinition(JSON.parse(JSON.stringify(source))),
      revision: 7, latestVersion: 2, archived: false, used: true,
    }))
    let hydrate!: () => void
    const deferred = new Promise(resolve => { hydrate = () => resolve({ templates }) })
    api.mockImplementation((name, data) => {
      if (name === 'formTemplates' && data.action === 'list') return deferred
      throw new Error('This New-form regression must not save or publish')
    })
    const ask = vi.fn().mockResolvedValue(false)
    const dialog = defineComponent({ setup(_props, { expose }) { expose({ ask }); return () => null } })
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/admin/forms', component: FormBuilderView }] })
    await router.push('/admin/forms'); await router.isReady()
    const wrapper = mount(RouterView, { global: { plugins: [router, PrimeVue], stubs: { BuilderConfirmDialog: dialog } } })
    hydrate(); await flushPromises()
    const clickNew = async () => { await wrapper.findAll('button').find(button => button.text() === 'New form')!.trigger('click'); await flushPromises() }
    for (const template of templates) {
      await wrapper.get('[data-template-id="' + template.id + '"] .library-target').trigger('click'); await flushPromises()
      await clickNew(); expect(ask).not.toHaveBeenCalled()
      expect((wrapper.get('.inspector-panel input[maxlength="160"]').element as HTMLInputElement).value).toBe('Untitled form')
      await clickNew(); expect(ask).not.toHaveBeenCalled() // untouched initial blank -> New
    }
    await wrapper.get('.inspector-panel input[maxlength="160"]').setValue('Actual edit')
    await clickNew()
    expect(ask).toHaveBeenCalledExactlyOnceWith({ title: 'Discard unsaved form edits?', message: 'Create a new form without saving these edits.', confirmLabel: 'Discard edits' })
    expect((wrapper.get('.inspector-panel input[maxlength="160"]').element as HTMLInputElement).value).toBe('Actual edit')
    ask.mockResolvedValue(true); await clickNew(); ask.mockClear()
    for (const label of ['Corrected Committee inspection', 'BBS Observation', 'General Site Visit', 'Near Miss / Safety Observation']) {
      await wrapper.findAll('button').find(button => button.text() === label)!.trigger('click'); await flushPromises()
      await clickNew(); expect(ask).not.toHaveBeenCalled() // untouched starter -> New
    }
    await wrapper.findAll('button').find(button => button.text() === 'Corrected Committee inspection')!.trigger('click'); await flushPromises()
    await wrapper.get('.inspector-panel input[maxlength="160"]').setValue('Edited starter')
    ask.mockResolvedValue(false)
    await clickNew()
    expect(ask).toHaveBeenCalledExactlyOnceWith({ title: 'Discard unsaved form edits?', message: 'Create a new form without saving these edits.', confirmLabel: 'Discard edits' })
    expect((wrapper.get('.inspector-panel input[maxlength="160"]').element as HTMLInputElement).value).toBe('Edited starter')
    expect(api.mock.calls.every(([, data]) => data.action === 'list')).toBe(true)
    wrapper.unmount()
  })
  it('leaves untouched hydration clean and preserves edit/cancel/save/switch/history guards', async () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
    const definition = { title: 'Saved form', description: '', recipients: [], fields: [{ id: 'notes', kind: 'text', label: 'Notes', required: false, options: [] }] }
    const templates = ['first', 'second'].map(id => ({ id, draft: { ...definition, title: id }, revision: 1, latestVersion: 0, archived: false, used: false }))
    let hydrate!: () => void
    const firstLoad = new Promise(resolve => { hydrate = () => resolve({ templates }) })
    let loaded = false
    api.mockImplementation((name, data) => {
      if (name === 'formTemplates' && data.action === 'list') { if (!loaded) { loaded = true; return firstLoad }; return Promise.resolve({ templates }) }
      if (name === 'formTemplates' && data.action === 'save') {
        const item = templates.find(item => item.id === data.id)!
        item.draft = JSON.parse(JSON.stringify(data.definition)); item.revision++
        return Promise.resolve(item)
      }
      throw new Error('Unexpected mocked call')
    })
    const ask = vi.fn().mockResolvedValue(false)
    const dialog = defineComponent({ setup(_props, { expose }) { expose({ ask }); return () => null } })
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/admin/forms', component: FormBuilderView }, { path: '/other', component: { template: '<p>Other page</p>' } }] })
    await router.push('/admin/forms'); await router.isReady()
    const wrapper = mount(RouterView, { global: { plugins: [router, PrimeVue], stubs: { BuilderConfirmDialog: dialog } } })
    hydrate(); await flushPromises()
    const open = async (id: string) => { await wrapper.get('[data-template-id="' + id + '"] .library-target').trigger('click'); await flushPromises() }
    await open('first')
    await wrapper.get('.inspector-panel').trigger('input') // Preview/hydration input without a definition edit.
    await router.push('/other'); expect(ask).not.toHaveBeenCalled()
    router.back(); await flushPromises(); expect(router.currentRoute.value.path).toBe('/admin/forms')
    await open('first')
    await wrapper.get('.inspector-panel input[maxlength="160"]').setValue('Actual edit')
    await router.push('/other'); expect(ask).toHaveBeenCalledOnce(); expect(router.currentRoute.value.path).toBe('/admin/forms')
    expect((wrapper.get('.inspector-panel input[maxlength="160"]').element as HTMLInputElement).value).toBe('Actual edit')
    await open('second'); expect(ask).toHaveBeenCalledTimes(2) // Cancel keeps the edited first form.
    ask.mockResolvedValue(true); await open('second')
    await router.push('/other'); expect(ask).toHaveBeenCalledTimes(3) // Switch established a new clean baseline.
    router.back(); await flushPromises(); await open('first')
    await wrapper.get('.inspector-panel input[maxlength="160"]').setValue('Saved change')
    await wrapper.findAll('button').find(button => button.text() === 'Save draft')!.trigger('click'); await flushPromises()
    const asksBeforeLeave = ask.mock.calls.length
    await router.push('/other'); expect(ask).toHaveBeenCalledTimes(asksBeforeLeave)
    router.back(); await flushPromises(); router.forward(); await flushPromises()
    expect(router.currentRoute.value.path).toBe('/other')
    expect(api.mock.calls.filter(([, data]) => data.action === 'save')).toHaveLength(1)
    wrapper.unmount()
  })
  it('distinguishes an unpublished draft, preview, public link and missing entries service', async () => {
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'phase2-website')
    vi.stubEnv('VITE_PUBLIC_SITE_URL', '')
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
    const definition = { title: 'Synthetic report', description: '', recipients: [], access: { respondents: 'public', identity: 'anonymous', respondentUserIds: [], respondentRoles: [], entryUserIds: [], entryRoles: [] }, fields: [{ id: 'notes', kind: 'textarea', label: 'Notes', required: false, options: [] }] }
    const templates = [
      { id: 'synthetic-unpublished', draft: { ...definition, title: 'Synthetic unpublished' }, revision: 1, latestVersion: 0, archived: false, used: false },
      { id: 'synthetic-published', draft: definition, definition: { ...definition, version: 1, createdAt: '2026-01-01T00:00:00Z' }, revision: 2, latestVersion: 1, archived: false, used: false },
    ]
    api.mockImplementation((name, data) => {
      if (name === 'formTemplates' && data.action === 'list') return Promise.resolve({ templates })
      if (name === 'formWorkspace' && data.action === 'list') return Promise.resolve({ records: [] })
      if (name === 'formEntries') return Promise.reject(Object.assign(new Error('Not deployed'), { code: 'functions/not-found' }))
      throw new Error('Unexpected synthetic API call: ' + name + ':' + data.action)
    })
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/admin/forms', component: FormBuilderView }] })
    await router.push('/admin/forms'); await router.isReady()
    const wrapper = mount(RouterView, { global: { plugins: [router], stubs: { BuilderConfirmDialog: true } } })
    await flushPromises()
    await wrapper.get('[data-template-id="synthetic-unpublished"] .library-target').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Unpublished draft — no respondent link.')
    expect(wrapper.find('.form-share-links a').exists()).toBe(false)
    await wrapper.findAll('button').find(button => button.text() === 'Full-page preview')!.trigger('click')
    expect(wrapper.text()).toContain('Edit fields')
    expect(api.mock.calls.some(([name]) => name === 'formEntries')).toBe(false)
    await wrapper.findAll('button').find(button => button.text() === 'Edit fields')!.trigger('click')
    await wrapper.get('[data-template-id="synthetic-published"] .library-target').trigger('click')
    await flushPromises()
    expect(wrapper.get('.form-share-links a').attributes('href')).toBe('https://phase2-website.web.app/forms/synthetic-published')
    await wrapper.findAll('button').find(button => button.text() === 'View Entries')!.trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('confirm the entries service is deployed')
    expect(wrapper.text()).toContain('Form preview shows questions only')
    expect(api.mock.calls.every(([name, data]) => !['save', 'issue', 'create', 'submit'].includes(data.action))).toBe(true)
    wrapper.unmount()
  })
})
