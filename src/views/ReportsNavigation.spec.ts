import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import ReportsView from './ReportsView.vue'

const { api, profile } = vi.hoisted(() => ({ api: vi.fn<(...args: unknown[]) => Promise<unknown>>(), profile: { currentUser: { uid: 'test-reader' }, rawRole: 'foreman', hasWorkspaceAccess: true } }))
vi.mock('@/services/forms', () => ({ formApi: api }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => reactive(profile) }))
vi.mock('@/features/intranet/usePrivateReferences', () => ({ usePrivateReferences: () => ({ content: ref(null), packages: ref([]), selectedPackage: ref(''), loading: ref(false), error: ref(''), notice: ref(''), selectSource: vi.fn<() => void>(), reload: vi.fn<() => void>(), cancel: vi.fn<() => void>() }) }))
const template = (id: string, title: string, overrides = {}) => ({ id, latestVersion: 1, archived: false, definition: { title, access: { respondentRoles: ['foreman'] } }, ...overrides })
const user = reactive(profile)
async function render() {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }] })
  await router.push('/reports')
  const view = mount(ReportsView, { global: { plugins: [router], stubs: { AppShell: { template: '<div><slot /></div>' }, PrivateReferenceStatus: true } } })
  await flushPromises()
  return { view, router }
}
afterEach(() => { api.mockReset(); profile.rawRole = 'foreman'; profile.hasWorkspaceAccess = true; profile.currentUser.uid = 'test-reader' })
describe('first-page inspection forms', () => {
  it('lists only permitted issued forms alphabetically and opens without inventing job context', async () => {
    api.mockResolvedValue({ templates: [template('z', 'Zulu'), template('a', 'alpha'), template('draft', 'Draft', { latestVersion: 0 }), template('old', 'Old', { archived: true }), template('private', 'Private', { definition: { title: 'Private', access: { respondentRoles: ['admin'] } } })] })
    const { view, router } = await render()
    expect(api).toHaveBeenCalledWith('formTemplates', { action: 'list' })
    const links = view.findAll('ul a')
    expect(links.map(link => link.text())).toEqual(['alpha', 'Zulu'])
    await links[0]!.trigger('click'); await flushPromises()
    expect(router.currentRoute.value.path).toBe('/forms/a')
    expect(router.currentRoute.value.query).toEqual({})
    view.unmount()
  })
  it('does not fetch forbidden lists and clears records if access changes', async () => {
    user.rawRole = 'payroll'
    const { view } = await render()
    expect(api).not.toHaveBeenCalled()
    expect(view.text()).toContain('not available for your current role')
    api.mockResolvedValue({ templates: [template('a', 'Allowed')] })
    user.rawRole = 'foreman'; await flushPromises()
    expect(view.text()).toContain('Allowed')
    user.hasWorkspaceAccess = false; await flushPromises()
    expect(view.find('ul').exists()).toBe(false)
    view.unmount()
  })
  it('ignores a stale response after sign-out', async () => {
    let finish!: (result: unknown) => void
    api.mockReturnValue(new Promise(resolve => { finish = resolve }))
    const { view } = await render()
    user.currentUser.uid = ''; await flushPromises()
    finish({ templates: [template('a', 'Stale result')] }); await flushPromises()
    expect(view.text()).not.toContain('Stale result')
    view.unmount()
  })
})
