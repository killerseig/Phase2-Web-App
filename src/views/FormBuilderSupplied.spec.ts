import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory, RouterView } from 'vue-router'
import { defineComponent, ref } from 'vue'
import { sampleContent } from '@/features/intranet/__tests__/fixtures'
import PrimeVue from 'primevue/config'
const { api, ask, state } = vi.hoisted(() => ({ api: vi.fn(), ask: vi.fn(), state: { role: 'admin' } }))
vi.mock('@/services/forms', () => ({ formApi: api, isFormServerEnabled: () => true, isFormEmulatorEnabled: () => false }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ rawRole: state.role, currentUser: { uid: 'synthetic-builder-admin' } }) }))
vi.mock('@/layouts/AppShell.vue', () => ({ default: { template: '<main><slot :openNavigation="() => {}" :mobileNavOpen="false" /></main>' } }))
vi.mock('@/features/intranet/usePrivateReferences', () => ({ usePrivateReferences: () => ({ content: ref({ ...sampleContent(), forms: [
  { id: 'foreman-source-b14', title: 'Synthetic damage report', paragraphs: [], fields: [{ label: 'Date of Damage', type: 'text', required: true, signature: false }] },
  { id: 'foreman-source-b17', title: 'Synthetic confidential warning', paragraphs: [], fields: [{ label: 'Signature', type: 'text', signature: true, required: false }] },
] }), packages: ref([]), selectedPackage: ref(''), loading: ref(false), error: ref(''), notice: ref(''), selectSource: vi.fn(), reload: vi.fn(), cancel: vi.fn() }) }))
import FormBuilderView from './FormBuilderView.vue'
afterEach(() => { vi.unstubAllGlobals(); api.mockReset(); ask.mockReset(); state.role = 'admin' })
async function render() {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  const dialog = defineComponent({ setup(_props, { expose }) { expose({ ask }); return () => null } })
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/admin/forms', component: FormBuilderView }] })
  await router.push('/admin/forms'); await router.isReady()
  const wrapper = mount(RouterView, { global: { plugins: [router, PrimeVue], stubs: { BuilderConfirmDialog: dialog } } })
  await flushPromises(); return wrapper
}
async function click(view: Awaited<ReturnType<typeof render>>, text: string) { await view.findAll('button').find(button => button.attributes('aria-label') === text || button.text() === text)!.trigger('click'); await flushPromises() }
describe('supplied starters use the existing Form Builder', () => {
  it('keeps auxiliary tools out of the compact selector and adds fields through the inspector', async () => {
    api.mockResolvedValue({ templates: [] }); ask.mockResolvedValue(false)
    const view = await render(); await click(view, 'Synthetic damage report draft')
    const sidebar = view.get('aside[aria-label="Form library"]')
    expect(sidebar.element.children).toHaveLength(1)
    expect(sidebar.find('details,input,textarea,select,[role="status"],[role="alert"]').exists()).toBe(false)
    expect(sidebar.findAll('button').every(button => button.text().includes('New form') || button.classes().includes('library-target'))).toBe(true)
    const inspector = view.get('.inspector-panel')
    const toggle = inspector.findAll('button').find(button => button.text().includes('Add fields'))!
    await toggle.trigger('click')
    expect(inspector.get('[aria-label="Field palette"]').isVisible()).toBe(true)
    const before = view.findAll('[data-widget-id]').length
    await inspector.get('[aria-label="Add text"]').trigger('click'); await flushPromises()
    expect(view.findAll('[data-widget-id]')).toHaveLength(before + 1)
    expect(toggle.attributes('aria-expanded')).toBe('false')
    await click(view, 'New form'); expect(ask).toHaveBeenCalledOnce()
    view.unmount()
  })
  it('creates nothing on opening, prepares editable fields, then saves only through the existing draft endpoint', async () => {
    const templates: unknown[] = []
    api.mockImplementation(async (_name, data) => {
      if (data.action === 'list') return { templates }
      if (data.action === 'save') { const item = { id: data.id, draft: data.definition, revision: 1, latestVersion: 0, archived: false, used: false }; templates.push(item); return item }
      throw new Error('Publication and delivery are outside this test')
    })
    const view = await render()
    expect(api.mock.calls.every(([, data]) => data.action === 'list')).toBe(true)
    expect(view.text()).not.toContain('Synthetic confidential warning draft')
    await click(view, 'Synthetic damage report draft')
    expect(view.text()).toContain('Prepared an unsaved Admin-only draft')
    expect(view.get('[aria-label="Form settings"]').isVisible()).toBe(true)
    expect(view.find('input[type=date]').exists()).toBe(true)
    await view.get('.inspector-panel input[maxlength="160"]').setValue('Edited synthetic damage')
    await click(view, 'Save draft')
    const writes = api.mock.calls.filter(([, data]) => data.action !== 'list')
    expect(writes).toHaveLength(1)
    expect(writes[0]![0]).toBe('formTemplates')
    expect(writes[0]![1]).toMatchObject({ action: 'save', revision: 0, definition: { title: 'Edited synthetic damage', recipients: [], access: { respondentRoles: ['admin'], entryRoles: [] } } })
    expect(view.text()).toContain('Draft saved.')
    view.unmount()
  })
  it('honors the existing discard guard when switching away from a supplied draft', async () => {
    api.mockResolvedValue({ templates: [] }); ask.mockResolvedValue(false)
    const view = await render(); await click(view, 'Synthetic damage report draft')
    await view.get('input[maxlength="160"]').setValue('Actual edit')
    await click(view, 'New form')
    expect(ask).toHaveBeenCalledOnce()
    expect((view.get('.inspector-panel input[maxlength="160"]').element as HTMLInputElement).value).toBe('Actual edit')
    view.unmount()
  })
  it('switches untouched or reverted source starters without a discard prompt', async () => {
    api.mockResolvedValue({ templates: [] }); ask.mockResolvedValue(false)
    const view = await render()
    await click(view, 'Synthetic damage report draft'); await click(view, 'New form')
    expect(ask).not.toHaveBeenCalled()
    await click(view, 'Synthetic damage report draft')
    await view.get('.inspector-panel input[maxlength="160"]').setValue('Temporary edit')
    await view.get('.inspector-panel input[maxlength="160"]').setValue('Synthetic damage report')
    await click(view, 'BBS Observation')
    expect(ask).not.toHaveBeenCalled()
    view.unmount()
  })
  it('does not offer source preparation controls to another role', async () => {
    state.role = 'foreman'; api.mockResolvedValue({ templates: [] })
    const view = await render(); expect(view.text()).not.toContain('Synthetic damage report draft'); view.unmount()
  })
})
