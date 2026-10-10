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
import { committeeAudit, newTemplate } from '@/features/forms/model'

import { validateFormDefinition } from '../../functions/src/formModel'
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); api.mockReset() })
describe('normal Form Builder controls with synthetic server fixtures', () => {
  it('does not show the exact New-form discard modal for untouched persisted forms or blank shells', async () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
    const templates = [committeeAudit(), committeeAudit()].map((source, index) => ({
      id: 'persisted-' + index, draft: validateFormDefinition({ ...JSON.parse(JSON.stringify(source)), title: 'Persisted ' + index }),
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
      await wrapper.findAll('.library-target').find(button => button.attributes('aria-label') === template.draft.title)!.trigger('click'); await flushPromises()
      await clickNew(); expect(ask).not.toHaveBeenCalled()
      expect((wrapper.get('.inspector-panel input[maxlength="160"]').element as HTMLInputElement).value).toBe('Untitled form')
      await clickNew(); expect(ask).not.toHaveBeenCalled() // untouched initial blank -> New
    }
    await wrapper.get('.inspector-panel input[maxlength="160"]').setValue('Actual edit')
    await clickNew()
    expect(ask).toHaveBeenCalledExactlyOnceWith({ title: 'Discard unsaved form edits?', message: 'Create a new form without saving these edits.', confirmLabel: 'Discard edits' })
    expect((wrapper.get('.inspector-panel input[maxlength="160"]').element as HTMLInputElement).value).toBe('Actual edit')
    ask.mockResolvedValue(true); await clickNew(); ask.mockClear()
    for (const label of ['Committee audit starter']) {
      await wrapper.findAll('button').find(button => button.text() === label)!.trigger('click'); await flushPromises()
      await clickNew(); expect(ask).not.toHaveBeenCalled() // untouched starter -> New
    }
    await wrapper.findAll('button').find(button => button.text() === 'Committee audit starter')!.trigger('click'); await flushPromises()
    await wrapper.get('.inspector-panel input[maxlength="160"]').setValue('Edited starter')
    ask.mockResolvedValue(false)
    await clickNew()
    expect(ask).toHaveBeenCalledExactlyOnceWith({ title: 'Discard unsaved form edits?', message: 'Create a new form without saving these edits.', confirmLabel: 'Discard edits' })
    expect((wrapper.get('.inspector-panel input[maxlength="160"]').element as HTMLInputElement).value).toBe('Edited starter')
    expect(api.mock.calls.every(([, data]) => data.action === 'list')).toBe(true)
    wrapper.unmount()
  })

})
