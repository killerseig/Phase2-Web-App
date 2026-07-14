import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import JobDashboardHeader from '@/components/jobs/JobDashboardHeader.vue'
import ModuleLauncherCard from '@/components/jobs/ModuleLauncherCard.vue'
import ModuleLauncherGrid from '@/components/jobs/ModuleLauncherGrid.vue'
import type { JobRecord } from '@/types/domain'

const routerLinkStub = {
  props: ['to'],
  template: '<a :href="to"><slot /></a>',
}

function makeJob(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    active: true,
    assignedForemanIds: ['foreman-1'],
    code: '5229',
    gc: 'Lucky GC',
    id: 'job-5229',
    name: 'Lucky 3 Ranch',
    type: 'general',
    ...overrides,
  }
}

describe('Job Dashboard components', () => {
  it('renders a module card as a route link with label, detail, and test id', () => {
    const wrapper = mount(ModuleLauncherCard, {
      global: {
        stubs: {
          RouterLink: routerLinkStub,
        },
      },
      props: {
        detail: 'Create, review, and submit job timecards.',
        label: 'Timecards',
        testId: 'job-dashboard-module-timecards',
        to: '/jobs/job-5229/timecards',
      },
    })

    const link = wrapper.get('[data-testid="job-dashboard-module-timecards"]')

    expect(link.attributes('href')).toBe('/jobs/job-5229/timecards')
    expect(wrapper.text()).toContain('Timecards')
    expect(wrapper.text()).toContain('Create, review, and submit job timecards.')
  })

  it('builds module routes and stable test ids from the job id', () => {
    const wrapper = mount(ModuleLauncherGrid, {
      global: {
        stubs: {
          RouterLink: routerLinkStub,
        },
      },
      props: {
        jobId: 'job-5229',
        modules: [
          {
            detail: 'Submit daily notes.',
            label: 'Daily Logs',
            to: 'daily-logs',
          },
          {
            detail: 'Order tools and supplies.',
            label: 'Shop Orders',
            to: 'shop-orders',
          },
        ],
      },
    })

    expect(wrapper.get('[data-testid="job-dashboard-module-daily-logs"]').attributes('href')).toBe(
      '/jobs/job-5229/daily-logs',
    )
    expect(wrapper.get('[data-testid="job-dashboard-module-shop-orders"]').attributes('href')).toBe(
      '/jobs/job-5229/shop-orders',
    )
  })

  it('summarizes selected job metadata in the dashboard header', () => {
    const wrapper = mount(JobDashboardHeader, {
      props: {
        job: makeJob(),
      },
    })

    expect(wrapper.text()).toContain('5229 - Lucky 3 Ranch')
    expect(wrapper.text()).toContain('Type: General')
    expect(wrapper.text()).toContain('GC: Lucky GC')
    expect(wrapper.text()).toContain('Mode: module launcher')
  })

  it('shows a safe empty state when the job is missing', () => {
    const wrapper = mount(JobDashboardHeader, {
      props: {
        job: null,
      },
    })

    expect(wrapper.text()).toContain('Job not found')
    expect(wrapper.text()).toContain('Mode: module launcher')
  })
})
