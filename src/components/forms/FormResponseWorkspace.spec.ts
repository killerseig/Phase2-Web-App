import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, RouterView } from 'vue-router'
import { describe, expect, it, vi, afterEach } from 'vitest'
import FormResponseWorkspace from './FormResponseWorkspace.vue'
const api = vi.hoisted(() => vi.fn())
vi.mock('@/services/forms', () => ({ formApi: api, isFormServerEnabled: () => true, isFormEmulatorEnabled: () => false, uploadFormPhoto: vi.fn() }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ currentUser: { uid: 'respondent' }, rawRole: 'foreman' }) }))
afterEach(() => { api.mockReset(); localStorage.clear() })
const definition = { title: 'Visit', description: '', recipients: [], fields: [{ id: 'sites', kind: 'repeat', label: 'Sites', required: false, options: [], minInstances: 1, maxInstances: 3, fields: [{ id: 'notes', kind: 'text', label: 'Notes', required: false, options: [] }] }] }
async function render() {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: FormResponseWorkspace, props: { templateId: 'visit', inline: true, allowFullInline: true } }, { path: '/other', component: { template: '<p>Other</p>' } }] })
  await router.push('/'); await router.isReady()
  const host = mount(RouterView, { global: { plugins: [router], stubs: { BuilderConfirmDialog: true, FormRecipientVerification: true } } })
  return { host, view: host.findComponent(FormResponseWorkspace), router }
}
describe('respondent hydration versus unsaved answers', () => {
  it('does not save or warn for initialized repeat rows; real edits save once and establish a clean baseline', async () => {
    let record = { id: 'record', ownerUid: 'respondent', templateId: 'visit', templateVersion: 1, revision: 1, status: 'draft', definition: { ...definition, version: 1 }, answers: { sites: [] }, updatedAt: 1 }
    const template = { id: 'visit', definition, latestVersion: 1 }
    api.mockImplementation((name, data) => {
      if (name === 'formTemplates') return Promise.resolve(data.action === 'respondent' ? template : { templates: [template] })
      if (data.action === 'list') return Promise.resolve({ records: [record] })
      if (data.action === 'get') return Promise.resolve(record)
      if (data.action === 'save') { record = { ...record, revision: 2, answers: JSON.parse(JSON.stringify(data.answers)) }; return Promise.resolve(record) }
      throw new Error('Unexpected mocked mutation')
    })
    const { host, view, router } = await render(); await flushPromises()
    expect(await view.vm.prepareNavigation()).toBe(true)
    expect(api.mock.calls.some(([, data]) => data.action === 'save')).toBe(false)
    await view.get('input[type="text"]').setValue('Actual answer')
    expect(await view.vm.prepareNavigation()).toBe(true); await flushPromises()
    expect(api.mock.calls.filter(([, data]) => data.action === 'save')).toHaveLength(1)
    expect(await view.vm.prepareNavigation()).toBe(true)
    expect(api.mock.calls.filter(([, data]) => data.action === 'save')).toHaveLength(1)
    await router.push('/other'); expect(router.currentRoute.value.path).toBe('/other'); host.unmount()
  })
  it('allows leaving an untouched pending read without manufacturing an edit or save', async () => {
    let complete!: (value: unknown) => void
    api.mockImplementation(() => new Promise(resolve => { complete = resolve }))
    const { host, view, router } = await render()
    expect(await view.vm.prepareNavigation()).toBe(true)
    expect(api.mock.calls.some(([, data]) => data.action === 'save')).toBe(false)
    await router.push('/other'); expect(router.currentRoute.value.path).toBe('/other'); host.unmount(); complete({ definition, latestVersion: 1 }); await flushPromises()
  })
})
