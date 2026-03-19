import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TimecardCreateModal from '@/components/timecards/TimecardCreateModal.vue'
import TimecardSummaryModal from '@/components/timecards/TimecardSummaryModal.vue'
import TimecardsToolbar from '@/components/timecards/TimecardsToolbar.vue'
import type { TimecardCreateForm } from '@/components/timecards/timecardPageModels'

const createModalStub = {
  props: ['open'],
  emits: ['close'],
  template: '<div v-if="open"><slot /><slot name="footer" /></div>',
}

describe('timecards components', () => {
  it('emits toolbar actions and week picker changes', async () => {
    const wrapper = mount(TimecardsToolbar, {
      props: {
        selectedDate: '2026-03-14',
        weekPickerConfig: {},
        loading: false,
        showCreateForm: false,
        allTimecardCount: 2,
        draftCount: 1,
        submittedCount: 1,
        submittingAll: false,
      },
      global: {
        stubs: {
          AppToolbarCard: {
            template: '<div><slot /></div>',
          },
          SubmissionCountBadges: {
            props: ['draftCount', 'submittedCount'],
            template: '<div class="badges">{{ draftCount }}/{{ submittedCount }}</div>',
          },
          DatePickerField: {
            props: [
              'modelValue',
              'config',
              'inputAriaLabel',
              'groupClass',
              'inputClass',
              'size',
              'showOpenButton',
              'openOnFocus',
            ],
            emits: ['update:modelValue', 'change'],
            template: `
              <div>
                <input
                  class="date-picker-stub"
                  :value="modelValue"
                  @input="$emit('update:modelValue', $event.target.value)"
                  @change="$emit('change', $event.target.value)"
                />
              </div>
            `,
          },
        },
      },
    })

    await wrapper.find('.date-picker-stub').setValue('2026-03-21')
    const buttons = wrapper.findAll('button')
    await buttons[0]?.trigger('click')
    await buttons[1]?.trigger('click')
    await buttons[2]?.trigger('click')

    expect(wrapper.emitted('update:selectedDate')).toEqual([['2026-03-21']])
    expect(wrapper.emitted('changeWeek')).toEqual([['2026-03-21']])
    expect(wrapper.emitted('create')).toEqual([[]])
    expect(wrapper.emitted('openSummary')).toEqual([[]])
    expect(wrapper.emitted('submitAll')).toEqual([[]])
  })

  it('emits form updates and submit actions from the create modal', async () => {
    const form: TimecardCreateForm = {
      employeeNumber: '',
      firstName: '',
      lastName: '',
      occupation: '',
      employeeWage: '',
      subcontractedEmployee: 'no',
    }

    const wrapper = mount(TimecardCreateModal, {
      props: {
        open: true,
        form,
      },
      global: {
        stubs: {
          BaseModal: createModalStub,
        },
      },
    })

    await wrapper.get('#tc-create-employee-number').setValue('1234')
    await wrapper.get('#tc-create-first-name').setValue('Casey')
    await wrapper.get('.btn-primary').trigger('click')

    expect(wrapper.emitted('update:form')?.[0]?.[0]).toMatchObject({ employeeNumber: '1234' })
    expect(wrapper.emitted('update:form')?.[1]?.[0]).toMatchObject({ firstName: 'Casey' })
    expect(wrapper.emitted('submit')).toEqual([[]])
  })

  it('renders summary rows and totals in the summary modal', () => {
    const wrapper = mount(TimecardSummaryModal, {
      props: {
        open: true,
        weekEndingDate: '2026-03-14',
        weekRange: 'Mar 8 to Mar 14',
        summaryRows: [
          {
            id: 'tc-1',
            employeeName: 'Casey Stone',
            employeeNumber: '100',
            status: 'draft',
            hours: 8,
            production: 5,
            lineTotal: 240,
          },
          {
            id: 'tc-2',
            employeeName: 'Jordan Smith',
            employeeNumber: '101',
            status: 'submitted',
            hours: 12,
            production: 7,
            lineTotal: 360,
          },
        ],
      },
      global: {
        stubs: {
          BaseModal: createModalStub,
          TimecardStatusBadge: {
            props: ['status'],
            template: '<span class="status-badge">{{ status }}</span>',
          },
        },
      },
    })

    expect(wrapper.text()).toContain('Casey Stone')
    expect(wrapper.text()).toContain('Jordan Smith')
    expect(wrapper.text()).toContain('20.00')
    expect(wrapper.text()).toContain('12.00')
    expect(wrapper.text()).toContain('600.00')
  })
})
