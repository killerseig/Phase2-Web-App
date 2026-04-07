import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TimecardSelectedMetaCard from '@/components/timecards/TimecardSelectedMetaCard.vue'
import TimecardWorkspaceCard from '@/components/timecards/TimecardWorkspaceCard.vue'
import type { TimecardModel } from '@/utils/timecardUtils'

function createTimecard(): TimecardModel {
  return {
    id: 'tc-1',
    jobId: 'job-1',
    weekStartDate: '2026-03-08',
    weekEndingDate: '2026-03-14',
    status: 'draft',
    createdByUid: 'user-1',
    employeeRosterId: 'roster-1',
    employeeNumber: '240',
    employeeName: 'Aguirre Marcelo',
    firstName: 'Aguirre',
    lastName: 'Marcelo',
    occupation: 'Framer/Rocker',
    employeeWage: 30,
    subcontractedEmployee: false,
    mileage: 12.5,
    jobs: [
      {
        jobNumber: '4197',
        subsectionArea: '99',
        area: '99',
        account: '1121',
        acct: '1121',
        difH: '',
        difP: '',
        difC: '',
        offHours: 0,
        offProduction: 0,
        offCost: 0,
        days: [
          { date: '2026-03-08', dayOfWeek: 0, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
          { date: '2026-03-09', dayOfWeek: 1, hours: 7, production: 20, unitCost: 13.59, lineTotal: 271.8 },
          { date: '2026-03-10', dayOfWeek: 2, hours: 5.5, production: 20, unitCost: 10.68, lineTotal: 213.6 },
          { date: '2026-03-11', dayOfWeek: 3, hours: 6, production: 20, unitCost: 11.65, lineTotal: 233 },
          { date: '2026-03-12', dayOfWeek: 4, hours: 7, production: 30, unitCost: 9.06, lineTotal: 271.8 },
          { date: '2026-03-13', dayOfWeek: 5, hours: 3.5, production: 10, unitCost: 13.59, lineTotal: 135.9 },
          { date: '2026-03-14', dayOfWeek: 6, hours: 0, production: 0, unitCost: 0, lineTotal: 0 },
        ],
      },
    ],
    days: [],
    totals: {
      hours: [0, 7, 5.5, 6, 7, 3.5, 0],
      production: [0, 20, 20, 20, 30, 10, 0],
      hoursTotal: 29,
      productionTotal: 100,
      lineTotal: 1125.8,
    },
    notes: 'Sample note',
    archived: false,
  }
}

describe('timecard workspace card', () => {
  it('renders workbook-style card fields and emits line edits', async () => {
    const wrapper = mount(TimecardWorkspaceCard, {
      props: {
        itemKey: 'tc-1',
        timecard: createTimecard(),
        jobFieldsLocked: false,
        notesLocked: false,
      },
    })

    expect(wrapper.text()).toContain('PHASE 2 COMPANY')
    expect(wrapper.text()).toContain('EMPLOYEE#')
    expect(wrapper.text()).toContain('WEEK ENDING')
    expect(wrapper.get('input[aria-label="Workbook line 1 job number"]').element.closest('td')?.getAttribute('rowspan')).toBe('3')
    expect(wrapper.get('input[aria-label="Workbook line 1 area"]').element.closest('td')?.getAttribute('rowspan')).toBe('3')
    expect(wrapper.get('input[aria-label="Workbook line 1 account"]').element.closest('td')?.getAttribute('rowspan')).toBe('3')

    await wrapper.get('input[aria-label="Workbook line 1 job number"]').setValue('5000')
    await wrapper.get('input[aria-label="Workbook line 1 area"]').setValue('42')
    await wrapper.get('input[aria-label="Workbook line 1 MON hours"]').setValue('8')
    await wrapper.get('input[aria-label="Workbook line 1 MON production"]').setValue('25')
    await wrapper.get('input[aria-label="Workbook line 1 MON cost"]').setValue('1.75')
    await wrapper.get('input[aria-label="Workbook line 1 off hours"]').setValue('1.5')
    await wrapper.get('input[aria-label="Workbook footer job or GL"]').setValue('6428')
    await wrapper.get('textarea[aria-label="Workbook notes for Aguirre Marcelo"]').setValue('Updated note')

    expect(wrapper.emitted('update-job-number')).toEqual([[{ jobIndex: 0, value: '5000' }]])
    expect(wrapper.emitted('update-subsection-area')).toEqual([[{ jobIndex: 0, value: '42' }]])
    expect(wrapper.emitted('update-hours')).toEqual([[{ jobIndex: 0, dayIndex: 1, value: 8 }]])
    expect(wrapper.emitted('update-production')).toEqual([[{ jobIndex: 0, dayIndex: 1, value: 25 }]])
    expect(wrapper.emitted('update-unit-cost')).toEqual([[{ jobIndex: 0, dayIndex: 1, value: 1.75 }]])
    expect(wrapper.emitted('update-off-value')).toEqual([[{ jobIndex: 0, field: 'offHours', value: 1.5 }]])
    expect(wrapper.emitted('update-footer-field')).toEqual([[{ field: 'footerJobOrGl', value: '6428' }]])
    expect(wrapper.emitted('update-notes')).toEqual([['Updated note']])
  })

  it('accepts shorthand decimals in workbook cells', async () => {
    const wrapper = mount(TimecardWorkspaceCard, {
      props: {
        itemKey: 'tc-1',
        timecard: createTimecard(),
        jobFieldsLocked: false,
        notesLocked: false,
      },
    })

    await wrapper.get('input[aria-label="Workbook line 1 TUE hours"]').setValue('.5')
    await wrapper.get('input[aria-label="Workbook line 1 TUE cost"]').setValue('.75')

    expect(wrapper.emitted('update-hours')).toEqual([[{ jobIndex: 0, dayIndex: 2, value: 0.5 }]])
    expect(wrapper.emitted('update-unit-cost')).toEqual([[{ jobIndex: 0, dayIndex: 2, value: 0.75 }]])
  })

  it('emits employee header edits when header editing is enabled', async () => {
    const wrapper = mount(TimecardWorkspaceCard, {
      props: {
        itemKey: 'tc-1',
        timecard: createTimecard(),
        jobFieldsLocked: false,
        notesLocked: false,
        headerEditable: true,
        headerEmployeeName: 'Casey Stone',
        headerEmployeeNumber: '100',
        headerOccupation: 'Carpenter',
        headerEmployeeWage: '32',
      },
    })

    await wrapper.get('input[aria-label="Workbook employee name for tc-1"]').setValue('Jordan Stone')
    await wrapper.get('input[aria-label="Workbook employee number for tc-1"]').setValue('101')
    await wrapper.get('input[aria-label="Workbook occupation for tc-1"]').setValue('Foreman')
    await wrapper.get('input[aria-label="Workbook wage for tc-1"]').setValue('34.5')

    expect(wrapper.emitted('update-employee-name')).toEqual([['Jordan Stone']])
    expect(wrapper.emitted('update-employee-number')).toEqual([['101']])
    expect(wrapper.emitted('update-occupation')).toEqual([['Foreman']])
    expect(wrapper.emitted('update-employee-wage')).toEqual([['34.5']])
  })

  it('renders a compact selected meta summary without mileage controls', () => {
    const wrapper = mount(TimecardSelectedMetaCard, {
      props: {
        timecard: createTimecard(),
      },
    })

    expect(wrapper.text()).toContain('Selected Card')
    expect(wrapper.text()).toContain('240')
    expect(wrapper.text()).toContain('Framer/Rocker')
    expect(wrapper.text()).not.toContain('Mileage')
    expect(wrapper.find('input[type="number"]').exists()).toBe(false)
  })
})
