import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TimecardExportArchiveFiltersPanel from '@/components/timecards/TimecardExportArchiveFiltersPanel.vue'

const MultiSelectStub = {
  props: ['modelValue', 'options', 'optionLabel', 'optionValue', 'placeholder'],
  emits: ['update:modelValue'],
  template: `
    <select
      data-testid="job-filter"
      multiple
      :value="modelValue"
      @change="$emit(
        'update:modelValue',
        Array.from($event.target.selectedOptions).map((option) => option.value),
      )"
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

const SelectStub = {
  props: ['modelValue', 'options', 'optionLabel', 'optionValue'],
  emits: ['update:modelValue'],
  template: `
    <select
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

function mountPanel(overrides = {}) {
  return mount(TimecardExportArchiveFiltersPanel, {
    props: {
      filters: {
        selectedJobIds: ['job-1'],
        foreman: 'CJ Blanchard',
        status: 'submitted',
      },
      availableJobOptions: [
        { id: 'job-1', code: '736', name: 'Shop', label: '736 - Shop' },
        { id: 'job-2', code: '5229', name: 'Lucky 3 Ranch', label: '5229 - Lucky 3 Ranch' },
      ],
      availableForemanOptions: [
        { label: 'All Foremen', value: 'all' },
        { label: 'CJ Blanchard', value: 'CJ Blanchard' },
        { label: 'Vince Hintz', value: 'Vince Hintz' },
      ],
      weekStatusOptions: [
        { label: 'Submitted', value: 'submitted' },
        { label: 'Draft', value: 'draft' },
        { label: 'Mixed', value: 'all' },
      ],
      mobileActive: true,
      ...overrides,
    },
    global: {
      stubs: {
        MultiSelect: MultiSelectStub,
        Select: SelectStub,
      },
    },
  })
}

describe('TimecardExportArchiveFiltersPanel', () => {
  it('renders archive filter copy and selected values', () => {
    const wrapper = mountPanel()
    const selects = wrapper.findAll('select')

    expect(wrapper.get('legend').text()).toBe('Archive Filters')
    expect(wrapper.text()).toContain('Jobs')
    expect(wrapper.text()).toContain('Foreman')
    expect(wrapper.text()).toContain('Status')
    expect((selects[0]!.element as HTMLSelectElement).selectedOptions[0]?.value).toBe('job-1')
    expect((selects[1]!.element as HTMLSelectElement).value).toBe('CJ Blanchard')
    expect((selects[2]!.element as HTMLSelectElement).value).toBe('submitted')
  })

  it('emits job, foreman, and status filter updates', async () => {
    const wrapper = mountPanel()
    const selects = wrapper.findAll('select')

    await selects[0]!.setValue(['job-2'])
    await selects[1]!.setValue('Vince Hintz')
    await selects[2]!.setValue('draft')

    expect(wrapper.emitted('updateFilter')?.[0]).toEqual(['selectedJobIds', ['job-2']])
    expect(wrapper.emitted('updateFilter')?.[1]).toEqual(['foreman', 'Vince Hintz'])
    expect(wrapper.emitted('updateFilter')?.[2]).toEqual(['status', 'draft'])
  })
})
