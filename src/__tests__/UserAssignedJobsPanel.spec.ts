import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import UserAssignedJobsPanel from '@/components/users/UserAssignedJobsPanel.vue'
import type { JobRecord } from '@/types/domain'

function makeJob(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    id: 'job-1',
    name: 'Shop',
    code: '736',
    gc: 'Phase 2',
    type: 'general',
    active: true,
    assignedForemanIds: [],
    ...overrides,
  }
}

function mountPanel(overrides: Partial<InstanceType<typeof UserAssignedJobsPanel>['$props']> = {}) {
  return mount(UserAssignedJobsPanel, {
    props: {
      assignedJobIds: ['job-2'],
      disabled: false,
      emptyMessage: 'No active jobs available.',
      jobs: [
        makeJob({
          id: 'job-1',
          name: 'Phase 2 Company Office',
          code: '111A',
        }),
        makeJob({
          id: 'job-2',
          name: '',
          code: null,
        }),
      ],
      jobsLoading: false,
      searchTerm: 'shop',
      ...overrides,
    },
  })
}

describe('UserAssignedJobsPanel', () => {
  it('renders assigned-job search, selected count, rows, checked state, and fallbacks', () => {
    const wrapper = mountPanel()

    expect(wrapper.text()).toContain('Assigned Jobs')
    expect(wrapper.text()).toContain('1 selected')
    expect(wrapper.get<HTMLInputElement>('input[type="search"]').element.value).toBe('shop')
    expect(wrapper.get('input[type="search"]').attributes('placeholder')).toBe('Search jobs by name or number')
    expect(wrapper.text()).toContain('Phase 2 Company Office')
    expect(wrapper.text()).toContain('111A')
    expect(wrapper.text()).toContain('Untitled Job')
    expect(wrapper.text()).toContain('No Number')
    expect(wrapper.findAll<HTMLInputElement>('input[type="checkbox"]')[0]!.element.checked).toBe(false)
    expect(wrapper.findAll<HTMLInputElement>('input[type="checkbox"]')[1]!.element.checked).toBe(true)
  })

  it('emits search and job toggle events without mutating parent-owned selected ids', async () => {
    const wrapper = mountPanel()

    await wrapper.get('input[type="search"]').setValue('office')
    await wrapper.findAll('input[type="checkbox"]')[0]!.setValue(true)
    await wrapper.findAll('input[type="checkbox"]')[1]!.setValue(false)

    expect(wrapper.emitted('update:searchTerm')).toEqual([['office']])
    expect(wrapper.emitted('toggleJob')).toEqual([['job-1'], ['job-2']])
    expect(wrapper.props('assignedJobIds')).toEqual(['job-2'])
  })

  it('disables row toggles when the parent is saving', () => {
    const wrapper = mountPanel({
      disabled: true,
    })

    for (const checkbox of wrapper.findAll('input[type="checkbox"]')) {
      expect(checkbox.attributes('disabled')).toBeDefined()
    }
  })

  it('renders loading and empty states from parent-owned data state', () => {
    const loadingWrapper = mountPanel({
      jobs: [],
      jobsLoading: true,
    })
    const emptyWrapper = mountPanel({
      assignedJobIds: [],
      jobs: [],
      jobsLoading: false,
      emptyMessage: 'No jobs match your search.',
    })

    expect(loadingWrapper.text()).toContain('Loading jobs...')
    expect(loadingWrapper.find('input[type="checkbox"]').exists()).toBe(false)
    expect(emptyWrapper.text()).toContain('0 selected')
    expect(emptyWrapper.text()).toContain('No jobs match your search.')
  })
})
