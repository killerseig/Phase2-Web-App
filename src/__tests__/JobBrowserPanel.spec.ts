import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import JobBrowserPanel from '@/components/jobs/JobBrowserPanel.vue'
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

function mountPanel(overrides = {}) {
  return mount(JobBrowserPanel, {
    props: {
      canCreateJobs: true,
      canManageJobs: true,
      canUseJobSetupEditor: true,
      editMode: true,
      searchTerm: '',
      statusFilter: 'active',
      activeJobCount: 2,
      archivedJobCount: 1,
      visibleJobs: [makeJob()],
      loading: false,
      selectedJobId: null,
      showAllJobsEntry: true,
      allJobsId: '__all_jobs__',
      ...overrides,
    },
  })
}

describe('JobBrowserPanel', () => {
  it('renders admin edit controls, counts, global row, and job rows', () => {
    const wrapper = mountPanel({
      selectedJobId: 'job-1',
      visibleJobs: [
        makeJob(),
        makeJob({
          id: 'job-2',
          name: 'Phase 2 Company Office',
          code: null,
          gc: 'Hillside',
          type: 'acoustics',
        }),
      ],
    })

    expect(wrapper.text()).toContain('Admin')
    expect(wrapper.get('[data-testid="jobs-new-button"]').text()).toBe('New Job')
    expect(wrapper.text()).toContain('2 active')
    expect(wrapper.text()).toContain('1 archived')
    expect(wrapper.text()).toContain('2 visible')
    expect(wrapper.text()).toContain('All Jobs')
    expect(wrapper.text()).toContain('Global notification defaults')
    expect(wrapper.text()).toContain('Shop')
    expect(wrapper.text()).toContain('General / Phase 2')
    expect(wrapper.text()).toContain('Job #736')
    expect(wrapper.text()).toContain('Phase 2 Company Office')
    expect(wrapper.text()).toContain('Acoustics / Hillside')
    expect(wrapper.text()).toContain('Job #No Job Number')
  })

  it('emits search, status, create, all-jobs, and job selection events', async () => {
    const job = makeJob()
    const wrapper = mountPanel({
      visibleJobs: [job],
    })

    await wrapper.get('[data-testid="jobs-search"]').setValue('shop')
    await wrapper.get('[data-testid="jobs-status-filter"]').setValue('both')
    await wrapper.get('[data-testid="jobs-new-button"]').trigger('click')
    await wrapper.get('.jobs-browser__row--global').trigger('click')
    await wrapper.get('[data-testid="job-card-736"]').trigger('click')

    expect(wrapper.emitted('updateSearchTerm')).toEqual([['shop']])
    expect(wrapper.emitted('updateStatusFilter')).toEqual([['both']])
    expect(wrapper.emitted('createJob')).toHaveLength(1)
    expect(wrapper.emitted('selectAllJobs')).toHaveLength(1)
    expect(wrapper.emitted('selectJob')).toEqual([[job]])
  })

  it('hides admin-only controls for field users', () => {
    const wrapper = mountPanel({
      canCreateJobs: false,
      canManageJobs: false,
      canUseJobSetupEditor: false,
      editMode: false,
      archivedJobCount: 9,
      showAllJobsEntry: false,
    })

    expect(wrapper.text()).toContain('Field Workspace')
    expect(wrapper.find('[data-testid="jobs-new-button"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="jobs-status-filter"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('9 archived')
    expect(wrapper.text()).not.toContain('All Jobs')
  })

  it('shows create action for payroll-style job creators without showing admin filters', () => {
    const wrapper = mountPanel({
      canCreateJobs: true,
      canManageJobs: false,
      canUseJobSetupEditor: true,
      editMode: true,
      archivedJobCount: 3,
      showAllJobsEntry: false,
    })

    expect(wrapper.get('[data-testid="jobs-new-button"]').text()).toBe('New Job')
    expect(wrapper.find('[data-testid="jobs-status-filter"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('3 archived')
    expect(wrapper.text()).not.toContain('All Jobs')
  })

  it('renders loading and empty states', () => {
    expect(
      mountPanel({
        loading: true,
        visibleJobs: [],
        showAllJobsEntry: false,
      }).text(),
    ).toContain('Loading jobs...')

    const emptyWrapper = mountPanel({
      loading: false,
      visibleJobs: [],
      showAllJobsEntry: false,
    })

    expect(emptyWrapper.get('[data-testid="jobs-empty"]').text()).toContain('No jobs match your search.')
  })
})
