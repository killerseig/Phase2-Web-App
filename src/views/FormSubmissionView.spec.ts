import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FormSubmissionView from './FormSubmissionView.vue'
const api = vi.hoisted(() => vi.fn())
vi.mock('@/services/forms', () => ({ formApi: api }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ init: async () => {}, hasWorkspaceAccess: true, roleKey: 'foreman' }) }))
vi.mock('vue-router', () => ({ useRoute: () => ({ params: { id: 'entry' }, hash: '', fullPath: '/form-submissions/entry' }), RouterLink: { template: '<a><slot /></a>' } }))
beforeEach(() => { api.mockReset() })
describe('private completed gallery authorization', () => {
  it('requests every photo through the authenticated viewer and shows denial without exposing an image', async () => {
    api.mockResolvedValueOnce({ id: 'entry', definition: { title: 'Visit', fields: [{ id: 'photos', kind: 'photo', label: 'Photos', options: [] }] }, answers: { photos: ['asset'] }, templateVersion: 1, submittedAt: 0 })
    api.mockRejectedValueOnce(new Error('Photo access denied'))
    const view = mount(FormSubmissionView, { global: { stubs: { FormEntryTranslation: true } } }); await flushPromises()
    expect(api).toHaveBeenNthCalledWith(1, 'formSubmissionViewer', { action: 'get', id: 'entry' })
    expect(view.find('#label-photos').exists()).toBe(true)
    await view.findAll('button').find(button => button.text().startsWith('View Photos'))!.trigger('click'); await flushPromises()
    expect(api).toHaveBeenNthCalledWith(2, 'formSubmissionViewer', { action: 'photo', id: 'entry', assetId: 'asset' })
    expect(view.find('[role="alert"]').text()).toContain('Photo access denied')
    expect(view.find('img').exists()).toBe(false)
    view.unmount()
  })
  it('does not render completed answers when the entry read is denied', async () => {
    api.mockRejectedValueOnce(new Error('Entry access denied'))
    const view = mount(FormSubmissionView, { global: { stubs: { FormEntryTranslation: true } } }); await flushPromises()
    expect(view.find('[role="alert"]').text()).toContain('Entry access denied')
    expect(view.find('article').exists()).toBe(false)
    expect(api).toHaveBeenCalledOnce()
    view.unmount()
  })
})
