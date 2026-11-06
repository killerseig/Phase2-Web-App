import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import DashboardWorkflowsWidget from '@/components/dashboard/DashboardWorkflowsWidget.vue'
const { api, user } = vi.hoisted(() => ({
  api: vi.fn<(name: string, data: unknown) => Promise<{ templates: unknown[] }>>(),
  user: { currentUser: { uid: 'tester' }, rawRole: 'foreman', hasWorkspaceAccess: true },
}))
vi.mock('@/services/forms', () => ({ formApi: api }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => user }))
async function render(editing = false, scope?: 'personal' | 'role' | 'job') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  await router.push('/dashboards/personal')
  const wrapper = mount(DashboardWorkflowsWidget, {
    props: { jobId: 'job-a', editing, scope },
    global: { plugins: [router] },
  })
  await flushPromises()
  return { wrapper, router }
}
afterEach(() => {
  api.mockReset()
  user.rawRole = 'foreman'
  user.hasWorkspaceAccess = true
})
describe('dashboard workflow parity', () => {
  it.each(['personal', 'role', 'job'] as const)(
    'preserves %s dashboard return context',
    async (scope) => {
      api.mockResolvedValue({
        templates: [{ id: 'form', latestVersion: 1, definition: { title: 'Form' } }],
      })
      const { wrapper, router } = await render(false, scope)
      await wrapper.get('[aria-label="Form"]').trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.query).toEqual({
        dashboardJob: 'job-a',
        dashboard: scope === 'personal' ? 'personal' : 'role',
        ...(scope === 'personal'
          ? {}
          : { dashboardReturn: scope === 'job' ? 'shared-job' : 'shared-role' }),
      })
      wrapper.unmount()
    },
  )
  it('keeps library and job tools and opens only authorized published forms with selected job context', async () => {
    api.mockResolvedValue({
      templates: [
        {
          id: 'safety',
          latestVersion: 1,
          definition: { title: 'Safety check', access: { respondentRoles: ['foreman'] } },
        },
        {
          id: 'private',
          latestVersion: 1,
          definition: { title: 'Private', access: { respondentRoles: ['admin'] } },
        },
        { id: 'draft', latestVersion: 0, definition: { title: 'Draft' } },
      ],
    })
    const { wrapper, router } = await render()
    expect(wrapper.findAll('a').map((link) => link.attributes('href'))).toEqual([
      '/jobs/job-a/timecards',
      '/jobs/job-a/daily-logs',
      '/jobs/job-a/shop-orders',
      '/company-library',
    ])
    expect(wrapper.findAll('ul button')).toHaveLength(1)
    await wrapper.setProps({ jobId: 'job-b' })
    await flushPromises()
    await wrapper.get('[aria-label="Safety check"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/forms/safety?dashboardJob=job-b')
    wrapper.unmount()
  })
  it('does not fetch forms in template editing preview', async () => {
    const { wrapper } = await render(true)
    expect(api).not.toHaveBeenCalled()
    expect(wrapper.attributes('inert')).toBeDefined()
    expect(wrapper.text()).toContain('finish editing the template')
    wrapper.unmount()
  })
  it('preserves the existing role boundary and library access check', async () => {
    user.rawRole = 'payroll'
    user.hasWorkspaceAccess = false
    const { wrapper } = await render()
    expect(api).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Forms are not available for your current role.')
    expect(wrapper.findAll('a')).toHaveLength(3)
    wrapper.unmount()
  })
})
