import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TimecardExportWeekFiltersPanel from '@/components/timecards/TimecardExportWeekFiltersPanel.vue'

const SelectStub = {
  props: ['modelValue', 'options', 'optionLabel', 'optionValue'],
  emits: ['update:modelValue'],
  template: `
    <select
      data-testid="date-mode-select"
      :value="modelValue"
      @change="$emit('update:modelValue', $event.target.value)"
    >
      <option
        v-for="option in options"
        :key="option[optionValue]"
        :value="option[optionValue]"
      >
        {{ option[optionLabel] }}
      </option>
    </select>
  `,
}

const SearchInputStub = {
  props: ['modelValue', 'placeholder'],
  emits: ['update:modelValue'],
  template: `
    <input
      data-testid="timecard-export-week-search"
      type="search"
      :placeholder="placeholder"
      :value="modelValue"
      @input="$emit('update:modelValue', $event.target.value)"
    />
  `,
}

const DateInputStub = {
  props: ['modelValue'],
  emits: ['change', 'click'],
  template: `
    <input
      type="date"
      :value="modelValue"
      @change="$emit('change', $event)"
      @click="$emit('click', $event)"
    />
  `,
}

function mountPanel(overrides = {}) {
  return mount(TimecardExportWeekFiltersPanel, {
    props: {
      filters: {
        dateMode: 'single',
        singleWeekEndDate: '2026-06-13',
        rangeStartDate: '2026-06-01',
        rangeEndDate: '2026-06-30',
        weekSearch: 'shop',
      },
      dateModeOptions: [
        { label: 'Single', value: 'single' },
        { label: 'Range', value: 'range' },
      ],
      mobileActive: true,
      ...overrides,
    },
    global: {
      stubs: {
        Select: SelectStub,
        AppSearchInput: SearchInputStub,
        AppDateInput: DateInputStub,
      },
    },
  })
}

describe('TimecardExportWeekFiltersPanel', () => {
  it('renders single-week filters and forwards selected values', () => {
    const wrapper = mountPanel()
    const dateInput = wrapper.get('input[type="date"]').element as HTMLInputElement

    expect(wrapper.get('legend').text()).toBe('Week Filters')
    expect((wrapper.get('[data-testid="timecard-export-week-search"]').element as HTMLInputElement).value).toBe('shop')
    expect((wrapper.get('[data-testid="date-mode-select"]').element as HTMLSelectElement).value).toBe('single')
    expect(wrapper.text()).toContain('Week Ending')
    expect(dateInput.value).toBe('2026-06-13')
  })

  it('emits search, date mode, and single week date updates', async () => {
    const wrapper = mountPanel()

    await wrapper.get('[data-testid="timecard-export-week-search"]').setValue('lucky')
    await wrapper.get('[data-testid="date-mode-select"]').setValue('range')
    await wrapper.get('input[type="date"]').setValue('2026-06-20')

    expect(wrapper.emitted('updateFilter')?.[0]).toEqual(['weekSearch', 'lucky'])
    expect(wrapper.emitted('updateFilter')?.[1]).toEqual(['dateMode', 'range'])
    expect(wrapper.emitted('updateFilter')?.[2]).toEqual(['singleWeekEndDate', '2026-06-20'])
  })

  it('renders and emits range date filters', async () => {
    const wrapper = mountPanel({
      filters: {
        dateMode: 'range',
        singleWeekEndDate: '2026-06-13',
        rangeStartDate: '2026-06-01',
        rangeEndDate: '2026-06-30',
        weekSearch: '',
      },
    })
    const dateInputs = wrapper.findAll('input[type="date"]')

    expect(wrapper.text()).toContain('Start Date')
    expect(wrapper.text()).toContain('End Date')
    expect((dateInputs[0]!.element as HTMLInputElement).value).toBe('2026-06-01')
    expect((dateInputs[1]!.element as HTMLInputElement).value).toBe('2026-06-30')

    await dateInputs[0]!.setValue('2026-06-07')
    await dateInputs[1]!.setValue('2026-06-21')

    expect(wrapper.emitted('updateFilter')?.[0]).toEqual(['rangeStartDate', '2026-06-07'])
    expect(wrapper.emitted('updateFilter')?.[1]).toEqual(['rangeEndDate', '2026-06-21'])
  })
})
