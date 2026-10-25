import { mount, flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import CompanyLibraryView from './CompanyLibraryView.vue'
import PrivateReferenceStatus from '@/components/intranet/PrivateReferenceStatus.vue'
import { ref } from 'vue'
import { sampleContent } from '@/features/intranet/__tests__/fixtures'
const load = vi.hoisted(() => vi.fn())
const referenceError = ref('')
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ rawRole: 'admin' }) }))
vi.mock('@/services/sds', () => ({ loadSds: load, sdsErrorMessage: (error: Error) => error.message }))
vi.mock('@/features/intranet/usePrivateReferences', () => ({ usePrivateReferences: () => ({ content: ref(sampleContent()), packages: ref([]), selectedPackage: ref(''), loading: ref(false), error: referenceError, notice: ref(''), selectSource: vi.fn(), reload: vi.fn(), cancel: vi.fn() }) }))
function render() { return mount(CompanyLibraryView, { global: { stubs: { AppShell: { template: '<div><slot /></div>' }, SdsExplorerModule: { props: ['title', 'initialFolderId', 'references', 'referenceCategory'], template: '<div data-explorer :data-folder="initialFolderId" :data-category="referenceCategory"><slot name="navigation" :disabled="false" />{{ title }}</div>' } } } }) }
beforeEach(() => { load.mockReset(); referenceError.value = '' })
describe('Company Library master navigation', () => {
  it('uses the ordinary explorer without category shortcuts or a hidden category filter', async () => {
    const view = render(); await flushPromises()
    expect(load).not.toHaveBeenCalled()
    expect(view.find('[aria-label="Library categories"]').exists()).toBe(false)
    expect(view.text()).not.toContain('Company intranet')
    expect(view.find('h1').exists()).toBe(false)
    expect(view.getComponent(PrivateReferenceStatus).props('showEmptyState')).toBe(false)
    expect(view.find('[data-explorer]').attributes('data-folder')).toBeUndefined()
    expect(view.find('[data-explorer]').attributes('data-category')).toBeUndefined()
    expect(view.find('[data-explorer]').text()).toBe('Documents')
  })
  it('keeps private reference errors visible without hiding the file explorer', async () => {
    referenceError.value = 'Access denied'
    const view = render(); await flushPromises()
    expect(view.find('[role="alert"]').text()).toContain('Access denied')
    expect(view.find('[data-explorer]').exists()).toBe(true)
  })
  it('omits the obsolete reference paragraph while retaining genuine loading errors', async () => {
    const status = mount(PrivateReferenceStatus, { props: { loading: false, error: '', notice: '', packages: [], selected: '', showEmptyState: false } })
    expect(status.text()).toBe('')
    await status.setProps({ error: 'Reference access denied' })
    expect(status.get('[role=alert]').text()).toContain('Reference access denied')
    status.unmount()
  })
})
