import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TimecardAccountsSummaryCard from '@/components/timecards/TimecardAccountsSummaryCard.vue'
import TimecardWeekToolbar from '@/components/timecards/TimecardWeekToolbar.vue'

describe('timecard week components', () => {
  it('emits week changes and submit actions from the workspace toolbar', async () => {
    const wrapper = mount(TimecardWeekToolbar, {
      props: {
        selectedDate: '2026-03-14',
        weekPickerConfig: {},
        loading: false,
        employeeCount: 5,
        draftCount: 3,
        submittedCount: 2,
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
    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('update:selectedDate')).toEqual([['2026-03-21']])
    expect(wrapper.emitted('changeWeek')).toEqual([['2026-03-21']])
    expect(wrapper.emitted('submitAll')).toEqual([[]])
  })

  it('renders account summary rows and stats', () => {
    const wrapper = mount(TimecardAccountsSummaryCard, {
      props: {
        employeeCount: 4,
        draftCount: 2,
        submittedCount: 2,
        accounts: [
          {
            key: '1000|frame|5000',
            jobNumber: '1000',
            subsectionArea: 'Frame',
            account: '5000',
            hoursTotal: 10,
            productionTotal: 21,
          },
        ],
      },
      global: {
        stubs: {
          AppSectionCard: {
            template: '<div><slot /></div>',
          },
          AppEmptyState: {
            template: '<div class="empty-stub"></div>',
          },
        },
      },
    })

    expect(wrapper.text()).toContain('Employees')
    expect(wrapper.text()).toContain('Draft')
    expect(wrapper.text()).toContain('Submitted')
    expect(wrapper.findAll('.timecard-summary-stats__item')).toHaveLength(3)
    expect(wrapper.text()).toContain('1000')
    expect(wrapper.text()).toContain('Frame')
    expect(wrapper.text()).toContain('5000')
    expect(wrapper.text()).toContain('10.00')
    expect(wrapper.text()).toContain('21.00')
  })
})
