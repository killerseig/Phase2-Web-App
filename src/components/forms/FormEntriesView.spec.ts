import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
const { api } = vi.hoisted(() => ({ api: vi.fn() }))
vi.mock('@/services/forms', () => ({ formApi: api }))
import FormEntriesView from './FormEntriesView.vue'
beforeEach(() => { api.mockReset() })
afterEach(() => vi.unstubAllGlobals())
async function mountView() {
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/', component: { template: '<div />' } },
    { path: '/form-submissions/:id', name: 'form-submission-view', component: { template: '<h1>Completed entry fixture</h1>' } },
  ] })
  await router.push('/')
  await router.isReady()
  const wrapper = mount(FormEntriesView, { props: { templateId: 'synthetic-form' }, global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}
const fixture = { entries: [{ id: 'synthetic-entry', title: 'Synthetic completed report', templateVersion: 2, submittedAt: 1700000000000, jobId: '' }], nextCursor: null, snapshotBefore: 1700000000100 }
describe('completed entries UI flow with synthetic data', () => {
  it('shows loading and a truthful empty state without enabling page downloads', async () => {
    let finish!: (result: unknown) => void
    api.mockReturnValue(new Promise(resolve => { finish = resolve }))
    const { wrapper } = await mountView()
    expect(wrapper.get('[role="status"]').text()).toContain('Loading entries')
    expect(wrapper.findAll('button').filter(button => /Export|Download/.test(button.text())).every(button => button.attributes('disabled') !== undefined)).toBe(true)
    finish({ entries: [], nextCursor: null, snapshotBefore: 1700000000100 })
    await flushPromises()
    expect(wrapper.text()).toContain('No accessible completed entries.')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.findAll('button').filter(button => /Download/.test(button.text())).every(button => button.attributes('disabled') !== undefined)).toBe(true)
    wrapper.unmount()
  })
  it('loads submitted entries and follows the completed-entry route rather than preview', async () => {
    api.mockResolvedValue(fixture)
    const { wrapper, router } = await mountView()
    expect(api).toHaveBeenCalledWith('formEntries', expect.objectContaining({ action: 'list', templateId: 'synthetic-form' }))
    expect(wrapper.text()).toContain('Form preview shows questions only')
    expect(wrapper.get('a').attributes('href')).toBe('/form-submissions/synthetic-entry')
    await wrapper.get('a').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('form-submission-view')
    wrapper.unmount()
  })
  it('keeps exports disabled on a missing service, then recovers through Refresh', async () => {
    api.mockRejectedValueOnce(Object.assign(new Error('Not found'), { code: 'functions/not-found' })).mockResolvedValueOnce(fixture)
    const { wrapper } = await mountView()
    expect(wrapper.get('[role="alert"]').text()).toContain('confirm the entries service is deployed')
    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.findAll('button').filter(button => /Export|Download/.test(button.text())).every(button => button.attributes('disabled') !== undefined)).toBe(true)
    await wrapper.findAll('button').find(button => button.text() === 'Refresh')!.trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.get('table').text()).toContain('Synthetic completed report')
    expect(wrapper.findAll('button').find(button => button.text() === 'Export all entries to Excel')!.attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })
  it('clears stale next-page navigation and disables downloads when a later page fails', async () => {
    api.mockResolvedValueOnce({ ...fixture, nextCursor: 'page-2' }).mockRejectedValueOnce(new Error('Synthetic network failure'))
    const { wrapper } = await mountView()
    await wrapper.findAll('button').find(button => button.text() === 'Next entries')!.trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toBe('Synthetic network failure')
    expect(wrapper.findAll('button').find(button => button.text() === 'Next entries')!.attributes('disabled')).toBeDefined()
    expect(wrapper.findAll('button').filter(button => /Export|Download/.test(button.text())).every(button => button.attributes('disabled') !== undefined)).toBe(true)
    wrapper.unmount()
  })
})
