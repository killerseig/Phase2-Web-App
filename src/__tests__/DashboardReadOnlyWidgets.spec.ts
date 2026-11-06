import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DashboardJobInformation from '@/components/dashboard/DashboardJobInformation.vue'
import DashboardCalendarAgenda from '@/components/dashboard/DashboardCalendarAgenda.vue'
import type { JobRecord } from '@/types/domain'
const job: JobRecord = { id: 'allowed', name: 'Allowed job', code: '12', gc: 'Builder', type: 'acoustics', active: true, assignedForemanIds: [], jobAddress: '123 Main St\nSuite 2', startDate: '2026-11-01' }
afterEach(() => vi.useRealTimers())
describe('read-only dashboard widgets', () => {
  it('only displays a currently authorized selected job and drops revoked data', async () => {
    const wrapper = mount(DashboardJobInformation, { props: { job: null, jobs: [job], editing: false, jobScope: false } })
    expect(wrapper.text()).not.toContain('123 Main')
    await wrapper.get('select').setValue('allowed')
    expect(wrapper.text()).toContain('123 Main St')
    expect(wrapper.text()).toContain('Not provided')
    expect(wrapper.findAll('time').map(node => node.attributes('datetime'))).toEqual(['2026-11-01'])
    await wrapper.setProps({ jobs: [] })
    expect(wrapper.text()).not.toContain('123 Main')
    expect(wrapper.text()).toContain('No jobs are available')
    wrapper.unmount()
  })
  it('distinguishes loading and failed jobs and keeps editing inert', async () => {
    const wrapper = mount(DashboardJobInformation, { props: { job: null, jobs: [], loading: true, editing: true, jobScope: false } })
    expect(wrapper.attributes('inert')).toBeDefined()
    expect(wrapper.text()).not.toContain('No jobs are available')
    await wrapper.setProps({ loading: false, error: 'Offline' })
    expect(wrapper.get('[role="alert"]').text()).toContain('Offline')
    wrapper.unmount()
  })
  it('renders selected job metadata literally without a provider or editable fields', () => {
    const wrapper = mount(DashboardJobInformation, { props: { job: { ...job, code: '12', gc: 'Builder', jobAddress: '<script>alert(1)</script>', startDate: '', finishDate: '' }, jobs: [], editing: false, jobScope: true } })
    expect(wrapper.text()).toContain('<script>alert(1)</script>')
    expect(wrapper.find('script').exists()).toBe(false)
    expect(wrapper.find('select,input,a,iframe').exists()).toBe(false)
    wrapper.unmount()
  })
  it('filters a date-only agenda without mutating events and restores past dates', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 6, 12))
    const events = [{ id: 'future', title: 'Future', date: '2026-11-07' }, { id: 'past', title: 'Past entry', date: '2026-11-05' }, { id: 'today', title: 'Inspection', date: '2026-11-06' }]
    const wrapper = mount(DashboardCalendarAgenda, { props: { events } })
    expect(wrapper.findAll('time').map(node => node.text())).toEqual(['2026-11-05', '2026-11-06', '2026-11-07'])
    expect(wrapper.get('[aria-current="date"]').text()).toBe('2026-11-06')
    await wrapper.get('select').setValue('upcoming')
    expect(wrapper.get('[role="status"]').text()).toBe('2 of 3 dates')
    expect(wrapper.text()).not.toContain('Past entry')
    await wrapper.get('select').setValue('all')
    expect(wrapper.text()).toContain('Past entry')
    expect(events[0]?.id).toBe('future')
    wrapper.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('updates today across midnight and explains an empty upcoming view', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 6, 23, 59, 30))
    const wrapper = mount(DashboardCalendarAgenda, { props: { events: [{ id: 'date', title: 'Inspection', date: '2026-11-06' }] } })
    await wrapper.get('select').setValue('upcoming')
    expect(wrapper.text()).toContain('Inspection')
    await vi.advanceTimersByTimeAsync(60000)
    expect(wrapper.text()).toContain('No upcoming dates')
    await wrapper.setProps({ events: [] })
    expect(wrapper.text()).toBe('No calendar dates yet.')
    wrapper.unmount()
  })
})
