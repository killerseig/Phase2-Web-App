import { mount, flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import CompanyLibraryView from './CompanyLibraryView.vue'
const load = vi.hoisted(() => vi.fn())
vi.mock('@/services/sds', () => ({ loadSds: load, sdsErrorMessage: (error: Error) => error.message }))
function render() { return mount(CompanyLibraryView, { global: { stubs: { AppShell: { template: '<div><slot /></div>' }, SdsExplorerModule: { props: ['title', 'initialFolderId'], template: '<div data-explorer :data-folder="initialFolderId">{{ title }}</div>' } } } }) }
beforeEach(() => { load.mockReset() })
describe('Company Library categories', () => {
  it('reuses existing category folders without creating content', async () => {
    load.mockResolvedValue({ folders: [{ id: 'safety-root', name: 'Safety', parentId: '' }, { id: 'nested-aha', name: 'AHA', parentId: 'other' }] })
    const view = render(); await flushPromises()
    expect(load).toHaveBeenCalledWith('', true)
    await view.findAll('nav button')[1]!.trigger('click')
    expect(view.find('[data-explorer]').attributes('data-folder')).toBe('safety-root')
    await view.findAll('nav button')[2]!.trigger('click')
    expect(view.text()).toContain('No AHA category folder is configured')
    expect(view.find('[data-explorer]').exists()).toBe(false)
  })
  it('keeps authorization failures visible', async () => {
    load.mockImplementation(async () => { throw new Error('Access denied') })
    const view = render(); await flushPromises()
    expect(view.find('[role="alert"]').text()).toContain('Access denied')
    expect(view.find('[data-explorer]').exists()).toBe(false)
  })
})
