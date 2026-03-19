import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ControllerFilterCard from '@/components/controller/ControllerFilterCard.vue'
import ControllerGroupedResults from '@/components/controller/ControllerGroupedResults.vue'
import ControllerResultsToolbar from '@/components/controller/ControllerResultsToolbar.vue'
import ControllerStatCard from '@/components/controller/ControllerStatCard.vue'
import ControllerTimecardSummary from '@/components/controller/ControllerTimecardSummary.vue'
import type { TimecardEmployeeEditorForm, TimecardModel } from '@/views/timecards/timecardUtils'

const editForm: TimecardEmployeeEditorForm = {
  employeeNumber: '',
  firstName: '',
  lastName: '',
  occupation: '',
  employeeWage: '',
  subcontractedEmployee: false,
}

const timecard: TimecardModel = {
  id: 'tc-1',
  jobId: 'job-1',
  employeeName: 'Casey Stone',
  employeeNumber: '100',
  weekStartDate: '2026-03-08',
  weekEndingDate: '2026-03-14',
  occupation: 'Carpenter',
  status: 'draft',
  createdByUid: 'creator-1',
  employeeRosterId: 'roster-1',
  notes: '',
  archived: false,
  jobs: [],
  days: [],
  totals: {
    hours: [0, 0, 0, 0, 0, 0, 0],
    production: [0, 0, 0, 0, 0, 0, 0],
    hoursTotal: 0,
    productionTotal: 0,
    lineTotal: 0,
  },
}

describe('controller components', () => {
  it('renders controller stat cards with value and helper text', () => {
    const wrapper = mount(ControllerStatCard, {
      props: {
        label: 'Submitted',
        value: 12,
        helperText: 'Matching results',
        valueClass: 'text-success',
      },
    })

    expect(wrapper.text()).toContain('Submitted')
    expect(wrapper.text()).toContain('12')
    expect(wrapper.text()).toContain('Matching results')
    expect(wrapper.find('.stat-value').classes()).toContain('text-success')
  })

  it('renders grouped metrics with submission badges and totals', () => {
    const wrapper = mount(ControllerTimecardSummary, {
      props: {
        draftCount: 2,
        submittedCount: 5,
        totalHours: 48,
        totalProduction: 120.5,
        totalLine: 456.75,
      },
    })

    expect(wrapper.text()).toContain('2 Draft')
    expect(wrapper.text()).toContain('5 Submitted')
    expect(wrapper.text()).toContain('48 hrs')
    expect(wrapper.text()).toContain('120.50 prod')
    expect(wrapper.text()).toContain('$456.75')
  })

  it('renders creator summary counts without metric text', () => {
    const wrapper = mount(ControllerTimecardSummary, {
      props: {
        draftCount: 1,
        submittedCount: 1,
        totalCount: 2,
      },
    })

    expect(wrapper.text()).toContain('2 timecards')
    expect(wrapper.text()).not.toContain('hrs')
  })

  it('emits sort updates and direction toggles', async () => {
    const wrapper = mount(ControllerResultsToolbar, {
      props: {
        activeFilterSummary: 'All jobs',
        currentSortLabel: 'Week Ending',
        refreshing: true,
        sortOptions: [
          { key: 'weekEnding', label: 'Week Ending' },
          { key: 'employeeName', label: 'Employee' },
        ],
        sortKey: 'weekEnding',
        sortDir: 'asc',
      },
    })

    expect(wrapper.text()).toContain('All jobs')
    expect(wrapper.text()).toContain('Updating...')

    await wrapper.find('select').setValue('employeeName')
    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('update:sortKey')).toEqual([['employeeName']])
    expect(wrapper.emitted('toggle-direction')).toEqual([[]])
  })

  it('emits filter updates and download actions', async () => {
    const wrapper = mount(ControllerFilterCard, {
      props: {
        useWeekRange: false,
        selectedSingleDate: '2026-03-14',
        selectedRangeStartDate: '2026-03-14',
        selectedRangeEndDate: '2026-03-21',
        weekPickerConfig: {},
        selectedJobId: '',
        jobOptions: [{ id: 'job-1', label: '100 - Alpha' }],
        tradeFilter: '',
        firstNameFilter: '',
        lastNameFilter: '',
        subcontractedFilter: 'all',
        statusFilter: 'all',
        currentWeekLabel: 'Mar 8 to Mar 14',
        currentFilterSummary: 'All jobs, trades, and employees.',
        pendingFilterChanges: false,
        refreshingTimecards: false,
        downloadingPdf: false,
        downloadingCsv: false,
        isDownloading: false,
        loadingTimecards: false,
        filterValidationError: '',
      },
    })

    await wrapper.find('input[type="checkbox"]').setValue(true)
    await wrapper.find('input[placeholder="e.g. Carpenter"]').setValue('Carpenter')
    await wrapper.find('button.btn-outline-primary').trigger('click')

    expect(wrapper.emitted('update:useWeekRange')).toEqual([[true]])
    expect(wrapper.emitted('update:tradeFilter')).toEqual([['Carpenter']])
    expect(wrapper.emitted('download')).toEqual([['pdf']])
  })

  it('renders grouped results and forwards timecard actions', async () => {
    const wrapper = mount(ControllerGroupedResults, {
      props: {
        groupedTimecards: [{
          jobId: 'job-1',
          jobName: 'Alpha Build',
          jobCode: '100',
          totalCount: 1,
          draftCount: 1,
          submittedCount: 0,
          totalHours: 0,
          totalProduction: 0,
          totalLine: 0,
          creatorGroups: [{
            creatorKey: 'creator-1',
            creatorName: 'Pat Foreman',
            totalCount: 1,
            draftCount: 1,
            submittedCount: 0,
            totalHours: 0,
            totalProduction: 0,
            totalLine: 0,
            timecards: [{
              key: 'job-1::tc-1',
              row: {
                id: 'row-1',
                timecardId: 'tc-1',
                jobId: 'job-1',
                jobName: 'Alpha Build',
                jobCode: '100',
                createdByUid: 'creator-1',
                createdByName: 'Pat Foreman',
                weekEnding: '2026-03-14',
                weekStart: '2026-03-08',
                employeeNumber: '100',
                employeeName: 'Casey Stone',
                occupation: 'Carpenter',
                status: 'draft',
                totalHours: 0,
                totalProduction: 0,
                totalLine: 0,
                mileage: 0,
                subcontractedEmployee: false,
                submittedAt: null,
                submittedAtMs: null,
                firstName: 'Casey',
                lastName: 'Stone',
              },
              timecard,
            }],
          }],
        }],
        editForm,
        expandedId: null,
        editingTimecardId: null,
        isAdmin: true,
        formatTimecardWeek: () => 'Week ending 2026-03-14',
        isTimecardLocked: () => false,
        isTimecardDeleteDisabled: () => false,
      },
      global: {
        stubs: {
          TimecardEditorCard: {
            props: ['itemKey', 'editForm'],
            emits: ['update:open', 'update:editForm', 'toggle-edit', 'delete'],
            template: `
              <div class="timecard-editor-stub">
                <slot name="badges" />
                <button class="emit-open" @click="$emit('update:open', true)">Open</button>
                <button class="emit-toggle-edit" @click="$emit('toggle-edit')">Toggle Edit</button>
              </div>
            `,
          },
        },
      },
    })

    expect(wrapper.text()).toContain('Alpha Build')
    expect(wrapper.text()).toContain('Pat Foreman')
    expect(wrapper.text()).toContain('Week ending 2026-03-14')

    await wrapper.find('.emit-open').trigger('click')
    await wrapper.find('.emit-toggle-edit').trigger('click')

    expect(wrapper.emitted('toggle-open')).toEqual([[{ key: 'job-1::tc-1', open: true }]])
    const toggleEditEvent = wrapper.emitted('toggle-edit')?.[0]?.[0] as { key: string } | undefined
    expect(toggleEditEvent?.key).toBe('job-1::tc-1')
  })
})
