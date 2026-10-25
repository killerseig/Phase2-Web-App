import { mount, flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import CompanyLibraryView from './CompanyLibraryView.vue'
import PrivateReferenceStatus from '@/components/intranet/PrivateReferenceStatus.vue'
import { ref } from 'vue'
import { sampleContent } from '@/features/intranet/__tests__/fixtures'
const load = vi.hoisted(() => vi.fn())
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ rawRole: 'admin' }) }))
vi.mock('@/services/sds', () => ({ loadSds: load, sdsErrorMessage: (error: Error) => error.message }))
vi.mock('@/features/intranet/usePrivateReferences', () => ({ usePrivateReferences: () => ({ content: ref(sampleContent()), packages: ref([]), selectedPackage: ref(''), loading: ref(false), error: ref(''), notice: ref(''), selectSource: vi.fn(), reload: vi.fn(), cancel: vi.fn() }) }))
function render() { return mount(CompanyLibraryView, { global: { stubs: { AppShell: { template: '<div><slot /></div>' }, PrivateReferenceStatus: true, SdsExplorerModule: { props: ['title', 'initialFolderId', 'references', 'referenceCategory'], template: '<div data-explorer :data-folder="initialFolderId" :data-category="referenceCategory"><slot name="navigation" :disabled="false" />{{ title }}</div>' } } } }) }
beforeEach(() => { load.mockReset() })
describe('Company Library categories', () => {
  it('uses existing categories and explorer for supplied references, without a separate tab or page', async () => {
    load.mockResolvedValue({ folders: [{ id: 'safety-root', name: 'Safety', parentId: '' }] })
    const view = render(); await flushPromises()
    expect(load).toHaveBeenCalledWith('', true)
    expect(view.findAll('[aria-label="Library categories"]')).toHaveLength(1)
    expect(view.find('[data-explorer] [aria-label="Library categories"]').exists()).toBe(true)
    expect(view.text()).not.toContain('Company intranet')
    expect(view.find('h1').exists()).toBe(false)
    expect(view.getComponent(PrivateReferenceStatus).props('showEmptyState')).toBe(false)
    const explorer = view.get('[data-explorer]').element
    await view.findAll('[aria-label="Library categories"] button')[1]!.trigger('click')
    expect(view.find('[data-explorer]').attributes('data-folder')).toBe('safety-root')
    expect(view.find('[data-explorer]').attributes('data-category')).toBe('Safety')
    await view.findAll('[aria-label="Library categories"] button')[2]!.trigger('click')
    expect(view.get('[data-explorer]').element).toBe(explorer)
    expect(view.text()).toContain('No AHA category folder is configured')
    expect(view.find('[data-explorer]').attributes('data-category')).toBe('AHA')
  })
  it('keeps authorization failures visible', async () => {
    load.mockRejectedValue(new Error('Access denied'))
    const view = render(); await flushPromises()
    expect(view.find('[role="alert"]').text()).toContain('Access denied')
    expect(view.find('[data-explorer]').exists()).toBe(false)
  })
  it('omits the obsolete reference paragraph while retaining genuine loading errors', async () => {
    const status = mount(PrivateReferenceStatus, { props: { loading: false, error: '', notice: '', packages: [], selected: '', showEmptyState: false } })
    expect(status.text()).toBe('')
    await status.setProps({ error: 'Reference access denied' })
    expect(status.get('[role=alert]').text()).toContain('Reference access denied')
    status.unmount()
  })
})
