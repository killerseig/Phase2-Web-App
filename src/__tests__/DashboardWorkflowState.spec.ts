import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import SharedDashboardCanvas from '@/components/dashboard/SharedDashboardCanvas.vue'
import type { JobRecord } from '@/types/domain'
vi.mock('@/components/dashboard/CompanyLibraryWidget.vue', () => ({
  default: { template: '<div />' },
}))
vi.mock('@/components/dashboard/RoleResourcesModule.vue', () => ({
  default: { template: '<div />' },
}))
vi.mock('@/components/dashboard/DashboardWorkflowsWidget.vue', () => ({
  default: { props: ['jobId', 'scope'], template: '<div data-testid="workflow">{{ jobId }}</div>' },
}))
const job: JobRecord = {
  id: 'authorized',
  name: 'Authorized job',
  code: 'A',
  gc: null,
  type: 'acoustics',
  active: true,
  assignedForemanIds: [],
}
const render = () =>
  mount(SharedDashboardCanvas, {
    props: {
      scope: 'personal',
      widgets: [{ id: 'work', type: 'workflows', title: 'Tools', text: '', span: 12 }],
      job: null,
      jobs: [],
      notes: {},
      events: [],
      role: 'foreman',
      textContext: { user: { name: 'Tester', role: 'Foreman' } },
      editing: false,
      selected: '',
      canEditNotes: true,
      busy: false,
      jobsLoading: true,
    },
  })
describe('workflow job selection state', () => {
  it('distinguishes loading, failure, empty and available jobs', async () => {
    const wrapper = render()
    expect(wrapper.text()).toContain('Loading jobs for tools.')
    expect(wrapper.text()).not.toContain('No jobs are available')
    expect(wrapper.find('select').exists()).toBe(false)
    await wrapper.setProps({ jobsLoading: false, jobsError: 'Connection lost' })
    expect(wrapper.get('[role="alert"]').text()).toContain('Use Refresh to try again.')
    expect(wrapper.text()).not.toContain('No jobs are available')
    await wrapper.setProps({ jobsError: null })
    expect(wrapper.text()).toContain('No jobs are available for your account.')
    await wrapper.setProps({ jobs: [job], initialToolJobId: 'authorized' })
    expect(wrapper.get('select').element.value).toBe('authorized')
    expect(wrapper.get('[data-testid="workflow"]').text()).toBe('authorized')
    wrapper.unmount()
  })
  it('does not open a job from return context unless still authorized', async () => {
    const wrapper = render()
    await wrapper.setProps({ jobsLoading: false, jobs: [job], initialToolJobId: 'not-authorized' })
    expect(wrapper.find('[data-testid="workflow"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Choose a job to open')
    await wrapper.setProps({ initialToolJobId: 'authorized' })
    expect(wrapper.find('[data-testid="workflow"]').exists()).toBe(true)
    await wrapper.setProps({ jobs: [] })
    expect(wrapper.find('[data-testid="workflow"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
