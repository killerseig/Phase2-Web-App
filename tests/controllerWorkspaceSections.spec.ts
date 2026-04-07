import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ControllerTimecardBrowser from '@/components/controller/ControllerTimecardBrowser.vue'
import ControllerTimecardDetailPane from '@/components/controller/ControllerTimecardDetailPane.vue'
import type { ControllerJobGroup } from '@/types/controller'
import type { TimecardEmployeeEditorForm, TimecardModel } from '@/utils/timecardUtils'

const editForm: TimecardEmployeeEditorForm = {
  employeeNumber: '',
  firstName: '',
  lastName: '',
  occupation: '',
  employeeWage: '',
  subcontractedEmployee: false,
}

const populatedEditForm: TimecardEmployeeEditorForm = {
  employeeNumber: '100',
  firstName: 'Casey',
  lastName: 'Stone',
  occupation: 'Carpenter',
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
    hoursTotal: 8,
    productionTotal: 12,
    lineTotal: 0,
  },
}

const groupedTimecards: ControllerJobGroup[] = [{
  jobId: 'job-1',
  jobName: 'Alpha Build',
  jobCode: '100',
  totalCount: 1,
  draftCount: 1,
  submittedCount: 0,
  totalHours: 8,
  totalProduction: 12,
  totalLine: 0,
  creatorGroups: [{
    creatorKey: 'creator-1',
    creatorName: 'Pat Foreman',
    totalCount: 1,
    draftCount: 1,
    submittedCount: 0,
    totalHours: 8,
    totalProduction: 12,
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
        firstName: 'Casey',
        lastName: 'Stone',
        occupation: 'Carpenter',
        status: 'draft',
        totalHours: 8,
        totalProduction: 12,
        totalLine: 0,
        mileage: 0,
        subcontractedEmployee: false,
        submittedAt: null,
        submittedAtMs: null,
      },
      timecard,
    }],
  }],
}]

describe('controller workspace sections', () => {
  it('lets the browser select timecards and change sort state', async () => {
    const wrapper = mount(ControllerTimecardBrowser, {
      props: {
        groupedTimecards,
        selectedKey: null,
        activeFilterSummary: 'All jobs',
        currentSortLabel: 'Week Ending',
        refreshing: false,
        loading: false,
        loadError: '',
        sortOptions: [
          { key: 'weekEnding', label: 'Week Ending' },
          { key: 'employeeName', label: 'Employee' },
        ],
        sortKey: 'weekEnding',
        sortDir: 'asc',
        formatTimecardWeek: () => 'Week ending 2026-03-14',
      },
    })

    expect(wrapper.text()).toContain('Alpha Build')
    expect(wrapper.text()).toContain('Pat Foreman')

    await wrapper.get('.controller-timecard-browser__item').trigger('click')
    await wrapper.get('select').setValue('employeeName')
    await wrapper.get('.controller-timecard-browser__sort-row button').trigger('click')

    expect(wrapper.emitted('select')).toEqual([['job-1::tc-1']])
    expect(wrapper.emitted('update:sortKey')).toEqual([['employeeName']])
    expect(wrapper.emitted('toggle-direction')).toEqual([[]])
  })

  it('forwards detail pane edit and workbook events for the selected card', async () => {
    const wrapper = mount(ControllerTimecardDetailPane, {
      props: {
        selectedEntry: groupedTimecards[0]?.creatorGroups[0]?.timecards[0] ?? null,
        editForm: populatedEditForm,
        isEditing: true,
        jobFieldsLocked: false,
        notesLocked: false,
        editDisabled: false,
        deleteDisabled: false,
        formatTimecardWeek: () => 'Week ending 2026-03-14',
      },
      global: {
        stubs: {
          TimecardWorkspaceCard: {
            emits: ['update-employee-name', 'update-hours', 'update-footer-field', 'update-notes'],
            template: `
              <div class="timecard-workspace-card-stub">
                <button class="emit-employee-name" @click="$emit('update-employee-name', 'Jordan Stone')">Employee</button>
                <button class="emit-hours" @click="$emit('update-hours', { jobIndex: 0, dayIndex: 1, value: 8 })">Hours</button>
              <button class="emit-footer" @click="$emit('update-footer-field', { field: 'footerOffice', value: 'HQ' })">Footer</button>
              <button class="emit-notes" @click="$emit('update-notes', 'Updated notes')">Notes</button>
            </div>
            `,
          },
        },
      },
    })

    await wrapper.get('.emit-employee-name').trigger('click')
    await wrapper.get('.controller-timecard-detail-pane__hero-buttons .btn-outline-secondary').trigger('click')
    await wrapper.get('.controller-timecard-detail-pane__hero-buttons .btn-outline-danger').trigger('click')
    await wrapper.get('.emit-hours').trigger('click')
    await wrapper.get('.emit-footer').trigger('click')
    await wrapper.get('.emit-notes').trigger('click')

    expect(wrapper.emitted('update:editForm')?.[0]?.[0]).toMatchObject({
      employeeNumber: '100',
      firstName: 'Jordan',
      lastName: 'Stone',
    })
    expect(wrapper.emitted('toggle-edit')).toEqual([[]])
    expect(wrapper.emitted('delete')).toEqual([[]])
    expect(wrapper.emitted('update-hours')).toEqual([[{ jobIndex: 0, dayIndex: 1, value: 8 }]])
    expect(wrapper.emitted('update-footer-field')).toEqual([[{ field: 'footerOffice', value: 'HQ' }]])
    expect(wrapper.emitted('update-notes')).toEqual([['Updated notes']])
  })
})
