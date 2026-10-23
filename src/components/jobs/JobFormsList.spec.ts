import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import JobFormsList from './JobFormsList.vue'
import ModuleLauncherGrid from './ModuleLauncherGrid.vue'
import { getJobDashboardModules } from '@/features/jobs/jobDashboardModules'
const { api, user } = vi.hoisted(() => ({ api: vi.fn(), user: { currentUser: { uid: 'reviewer' }, rawRole: 'foreman', hasWorkspaceAccess: true } }))
vi.mock('@/services/forms', () => ({ formApi: api }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => reactive(user) }))
const template = (id: string, title: string, overrides = {}) => ({ id, latestVersion: 1, archived: false, definition: { title, access: { respondentRoles: ['foreman'] } }, ...overrides })
async function render(component = JobFormsList, props: Record<string, unknown> = { jobId: 'job-123' }) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }] })
  await router.push('/jobs/job-123')
  const wrapper = mount(component, { props: props as never, global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}
afterEach(() => { api.mockReset(); user.rawRole = 'foreman'; user.hasWorkspaceAccess = true; user.currentUser.uid = 'reviewer' })
describe('job forms and existing links', () => {
  it('lists only permitted published forms in name order and opens the existing route with job context', async () => {
    api.mockResolvedValue({ templates: [template('z', 'Zulu'), template('a', 'alpha'), template('draft', 'Draft', { latestVersion: 0 }), template('old', 'Old', { archived: true }), template('none', 'None', { definition: undefined }), template('private', 'Private', { definition: { title: 'Private', access: { respondentRoles: ['admin'] } } })] })
    const { wrapper, router } = await render()
    expect(wrapper.findAll('ul button').map(button => button.text())).toEqual(['alpha', 'Zulu'])
    await wrapper.get('[aria-label="alpha"]').trigger('click'); await flushPromises()
    expect(router.currentRoute.value.path).toBe('/forms/a')
    expect(router.currentRoute.value.query).toEqual({ dashboardJob: 'job-123' })
    wrapper.unmount()
  })
  it.each(['payroll', 'employee', ''])('does not fetch forbidden lists for unsupported role %s', async role => {
    user.rawRole = role
    const { wrapper } = await render()
    expect(api).not.toHaveBeenCalled(); expect(wrapper.text()).toContain('not available for your current role')
    wrapper.unmount()
  })
  it('does not fetch for inactive or signed-out users', async () => {
    user.hasWorkspaceAccess = false
    let result = await render(); expect(api).not.toHaveBeenCalled(); result.wrapper.unmount()
    user.hasWorkspaceAccess = true; user.currentUser.uid = ''
    result = await render(); expect(api).not.toHaveBeenCalled(); result.wrapper.unmount()
  })
  it('shows a retryable failure and a clear empty state', async () => {
    api.mockRejectedValueOnce(new Error('Local service unavailable')).mockResolvedValueOnce({ templates: [] })
    const { wrapper } = await render()
    expect(wrapper.get('[role="alert"]').text()).toContain('Local service unavailable')
    await wrapper.get('button').trigger('click'); await flushPromises()
    expect(wrapper.text()).toContain('No published forms are available'); wrapper.unmount()
  })
  it('adds exactly one Company Library link and preserves the three existing job routes', async () => {
    const { wrapper } = await render(ModuleLauncherGrid as typeof JobFormsList, { jobId: 'job-123', modules: getJobDashboardModules(), showCompanyLibrary: true })
    expect(wrapper.findAll('a').map(link => link.attributes('href'))).toEqual(['/jobs/job-123/timecards', '/jobs/job-123/daily-logs', '/jobs/job-123/shop-orders', '/company-library'])
    expect(wrapper.text()).toContain('Company Library'); expect(api).not.toHaveBeenCalled(); wrapper.unmount()
  })
})
