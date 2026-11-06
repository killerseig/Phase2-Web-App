import { mount, RouterLinkStub } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DashboardJobsWidget from '@/components/dashboard/DashboardJobsWidget.vue'
import type { JobRecord } from '@/types/domain'

const jobs: JobRecord[] = Array.from({ length: 85 }, (_, index) => ({
  id: `job-${index}`,
  code: `P${index}`,
  name: index === 84 ? 'North Campus Remodel' : `Building ${index}`,
  gc: null,
  type: 'acoustics',
  active: true,
  assignedForemanIds: [],
}))
function render(entries = jobs, editing = false) {
  return mount(DashboardJobsWidget, {
    props: { jobs: entries, editing },
    global: { stubs: { RouterLink: RouterLinkStub } },
  })
}
describe('dashboard jobs widget', () => {
  it('shows loading or a local failure instead of a false empty state', async () => {
    const wrapper = render([])
    await wrapper.setProps({ jobsLoading: true })
    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.text()).not.toContain('No jobs are available')
    expect(wrapper.find('input').exists()).toBe(false)
    await wrapper.setProps({ jobsLoading: false, jobsError: 'Please refresh and try again.' })
    expect(wrapper.get('[role="alert"]').text()).toContain('Jobs could not be loaded.')
    expect(wrapper.text()).not.toContain('No jobs are available')
    await wrapper.setProps({ jobsError: null, jobs })
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.findAll('article')).toHaveLength(85)
  })
  it('keeps every provided job and the existing destinations', () => {
    const wrapper = render()
    expect(wrapper.findAll('article')).toHaveLength(85)
    expect(wrapper.get('[role="status"]').text()).toBe('85 of 85 jobs')
    const links = wrapper.findAllComponents(RouterLinkStub).slice(-4)
    expect(links.map((link) => link.props('to'))).toEqual([
      { name: 'shared-job-home', params: { jobId: 'job-84' } },
      '/jobs/job-84/timecards',
      '/jobs/job-84/daily-logs',
      '/jobs/job-84/shop-orders',
    ])
    expect(wrapper.get('label').attributes('for')).toBe(wrapper.get('input').attributes('id'))
    expect(wrapper.get('[role="region"]').attributes('tabindex')).toBe('0')
  })
  it('matches number and name case-insensitively with multiple trimmed terms', async () => {
    const wrapper = render()
    await wrapper.get('input').setValue('  NORTH   p84 ')
    expect(wrapper.findAll('article')).toHaveLength(1)
    expect(wrapper.get('article').text()).toContain('North Campus Remodel')
    expect(wrapper.get('[role="status"]').text()).toBe('1 of 85 jobs')
    await wrapper.setProps({ jobs: jobs.slice(0, 84) })
    expect(wrapper.findAll('article')).toHaveLength(0)
    expect(wrapper.text()).toContain('No jobs match your search.')
    expect(wrapper.get('[role="status"]').text()).toBe('0 of 84 jobs')
    await wrapper.get('button').trigger('click')
    expect(wrapper.get('input').element.value).toBe('')
    expect(wrapper.findAll('article')).toHaveLength(84)
  })
  it('clears with Escape and preserves jobs without a number', async () => {
    const wrapper = render([{ ...jobs[0]!, code: null }])
    await wrapper.get('input').setValue('missing')
    expect(wrapper.get('[role="region"]').attributes('tabindex')).toBeUndefined()
    await wrapper.get('input').trigger('keydown', { key: 'Escape' })
    expect(wrapper.findAll('article')).toHaveLength(1)
    expect(wrapper.text()).toContain('No Job #')
    expect(wrapper.get('[role="status"]').text()).toBe('1 of 1 job')
  })
  it('distinguishes no authorized jobs from search misses and disables editing preview', () => {
    const empty = render([])
    expect(empty.text()).toContain('No jobs are available for your account.')
    expect(empty.find('input').exists()).toBe(false)
    expect(render(jobs, true).attributes('inert')).toBeDefined()
  })
})
