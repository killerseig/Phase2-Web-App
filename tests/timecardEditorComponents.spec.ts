import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TimecardDetailPanel from '@/components/timecards/TimecardDetailPanel.vue'
import TimecardEditorHeader from '@/components/timecards/TimecardEditorHeader.vue'
import TimecardJobTable from '@/components/timecards/TimecardJobTable.vue'
import type { TimecardEmployeeEditorForm, TimecardModel } from '@/views/timecards/timecardUtils'

const editForm: TimecardEmployeeEditorForm = {
  employeeNumber: '100',
  firstName: 'Casey',
  lastName: 'Stone',
  occupation: 'Carpenter',
  employeeWage: '30',
  subcontractedEmployee: false,
}

function createTimecard(): TimecardModel {
  return {
    id: 'tc-1',
    jobId: 'job-1',
    weekStartDate: '2026-03-08',
    weekEndingDate: '2026-03-14',
    status: 'draft',
    createdByUid: 'creator-1',
    employeeRosterId: 'roster-1',
    employeeNumber: '100',
    employeeName: 'Casey Stone',
    firstName: 'Casey',
    lastName: 'Stone',
    occupation: 'Carpenter',
    employeeWage: 30,
    subcontractedEmployee: false,
    mileage: 0,
    jobs: [{
      jobNumber: '100',
      subsectionArea: 'A',
      area: 'A',
      account: '200',
      acct: '200',
      difH: '',
      difP: '',
      difC: '',
      days: Array.from({ length: 7 }, (_, index) => ({
        date: `2026-03-${String(index + 8).padStart(2, '0')}`,
        dayOfWeek: index,
        hours: 0,
        production: 0,
        unitCost: 0,
        lineTotal: 0,
      })),
    }],
    days: [],
    totals: {
      hours: [0, 0, 0, 0, 0, 0, 0],
      production: [0, 0, 0, 0, 0, 0, 0],
      hoursTotal: 8,
      productionTotal: 5,
      lineTotal: 240,
    },
    notes: '',
    archived: false,
  }
}

describe('timecard editor components', () => {
  it('emits edit, delete, and form updates from the header', async () => {
    const wrapper = mount(TimecardEditorHeader, {
      props: {
        itemKey: 'tc-1',
        timecard: createTimecard(),
        isEditing: true,
        editForm,
        editDisabled: false,
        deleteDisabled: false,
      },
    })

    await wrapper.find('input[placeholder="First name"]').setValue('Jordan')
    await wrapper.find('.btn-outline-danger').trigger('click')
    await wrapper.find('.btn-outline-secondary').trigger('click')

    expect(wrapper.emitted('update:editForm')?.[0]?.[0]).toMatchObject({ firstName: 'Jordan' })
    expect(wrapper.emitted('delete')).toEqual([[]])
    expect(wrapper.emitted('toggle-edit')).toEqual([[]])
  })

  it('emits job table changes and add-row action', async () => {
    const wrapper = mount(TimecardJobTable, {
      props: {
        itemKey: 'tc-1',
        timecard: createTimecard(),
        jobFieldsLocked: false,
      },
    })

    await wrapper.find('input[placeholder="Job #"]').setValue('999')
    await wrapper.find('input[placeholder="0"]').setValue('8')
    await wrapper.find('.btn-outline-primary').trigger('click')

    expect(wrapper.emitted('update-job-number')).toEqual([[{ jobIndex: 0, value: '999' }]])
    expect(wrapper.emitted('update-hours')).toEqual([[{ jobIndex: 0, dayIndex: 0, value: 8 }]])
    expect(wrapper.emitted('add-job-row')).toEqual([[]])
  })

  it('emits mileage and notes updates from the detail panel', async () => {
    const wrapper = mount(TimecardDetailPanel, {
      props: {
        timecard: createTimecard(),
        notesLocked: false,
        mileageDisabled: false,
      },
    })

    const inputs = wrapper.findAll('input')
    await inputs[0]?.setValue('12.5')
    await wrapper.find('textarea').setValue('Follow up on units')

    expect(wrapper.emitted('update-mileage')).toEqual([['12.5']])
    expect(wrapper.emitted('update-notes')).toEqual([['Follow up on units']])
  })
})
