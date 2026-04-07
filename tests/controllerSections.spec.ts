import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ControllerReviewSection from '@/components/controller/ControllerReviewSection.vue'
import ControllerSummaryStats from '@/components/controller/ControllerSummaryStats.vue'
import type { ControllerJobGroup } from '@/types/controller'

const groupedTimecards: ControllerJobGroup[] = [{
  jobId: 'job-1',
  jobName: 'Alpha Build',
  jobCode: '100',
  totalCount: 1,
  draftCount: 1,
  submittedCount: 0,
  totalHours: 0,
  totalProduction: 0,
  totalLine: 0,
  creatorGroups: [],
}]

describe('controller section components', () => {
  it('renders the shared controller stats row', () => {
    const wrapper = mount(ControllerSummaryStats, {
      props: {
        loadedWeekLabel: 'Mar 8 to Mar 14',
        summary: {
          totalCount: 12,
          submittedCount: 8,
          draftCount: 4,
          totalHours: 96,
        },
      },
    })

    expect(wrapper.text()).toContain('Timecards')
    expect(wrapper.text()).toContain('Submitted')
    expect(wrapper.text()).toContain('Drafts')
    expect(wrapper.text()).toContain('96')
  })

  it('forwards sort and grouped result events through the review section', async () => {
    const wrapper = mount(ControllerReviewSection, {
      props: {
        activeFilterSummary: 'All jobs',
        currentSortLabel: 'Week Ending',
        loadedWeekLabel: 'Mar 8 to Mar 14',
        refreshing: false,
        sortOptions: [{ key: 'weekEnding', label: 'Week Ending' }],
        sortKey: 'weekEnding',
        sortDir: 'asc',
        loadingTimecards: false,
        timecardsLoadError: '',
        groupedTimecards,
        editForm: {
          employeeNumber: '',
          firstName: '',
          lastName: '',
          occupation: '',
          employeeWage: '',
          subcontractedEmployee: false,
        },
        expandedId: null,
        editingTimecardId: null,
        isAdmin: true,
        formatTimecardWeek: () => 'Week ending 2026-03-14',
        isTimecardLocked: () => false,
        isTimecardDeleteDisabled: () => false,
      },
      global: {
        stubs: {
          ControllerResultsToolbar: {
            emits: ['update:sort-key', 'toggle-direction'],
            template: `
              <div class="results-toolbar-stub">
                <button class="emit-sort" @click="$emit('update:sort-key', 'employeeName')">Sort</button>
                <button class="emit-dir" @click="$emit('toggle-direction')">Dir</button>
              </div>
            `,
          },
          ControllerGroupedResults: {
            emits: ['toggle-open', 'update:edit-form'],
            template: `
              <div class="grouped-results-stub">
                <button class="emit-open" @click="$emit('toggle-open', { key: 'job-1::tc-1', open: true })">Open</button>
                <button class="emit-edit-form" @click="$emit('update:edit-form', { employeeNumber: '100', firstName: 'Casey', lastName: 'Stone', occupation: 'Carpenter', employeeWage: '', subcontractedEmployee: false })">Edit</button>
              </div>
            `,
          },
        },
      },
    })

    await wrapper.get('.emit-sort').trigger('click')
    await wrapper.get('.emit-dir').trigger('click')
    await wrapper.get('.emit-open').trigger('click')
    await wrapper.get('.emit-edit-form').trigger('click')

    expect(wrapper.emitted('update:sortKey')).toEqual([['employeeName']])
    expect(wrapper.emitted('toggle-direction')).toEqual([[]])
    expect(wrapper.emitted('toggle-open')).toEqual([[{ key: 'job-1::tc-1', open: true }]])
    expect(wrapper.emitted('update:editForm')?.[0]?.[0]).toMatchObject({
      employeeNumber: '100',
      firstName: 'Casey',
    })
  })
})
